import { clockTime, today, isExampleMeal, type AppState, type Meal } from "../../domain";
import type { GroceryItem } from "../../ai-contract";
import type { PantryEvent } from "./contracts";
import type { MealComponent } from "../meals/contracts";
import { componentNutrition, scaleNutrition } from "../meals/arithmetic";
import { restoreRecipePortion } from "../recipes/portions";

export type PantryLot = {
  id: string;
  receiptId: string;
  store: string;
  date: string;
  item: GroceryItem;
  purchased: number | null;
  remaining: number | null;
  inconsistent: boolean;
};
const rounded = (n: number) => Math.round(n * 10000) / 10000;

export function pantryLots(state: AppState): PantryLot[] {
  return (state.groceries || []).flatMap((receipt) =>
    receipt.items
      .filter((item) => item.match !== "nonfood")
      .map((item) => {
        const lotId = `${receipt.id}::${item.id}`;
        const purchased = item.servingsPurchased;
        const events = (state.pantryEvents || []).filter(
          (event) => event.lotId === lotId,
        );
        const balance =
          purchased === null
            ? null
            : rounded(
                (item.availability === "used" ? 0 : purchased) +
                  events.reduce((sum, event) => sum + event.servings, 0),
              );
        return {
          id: lotId,
          receiptId: receipt.id,
          store: receipt.store,
          date: receipt.date,
          item,
          purchased,
          remaining: balance,
          inconsistent: balance !== null && balance < 0,
        };
      }),
  );
}
export const getPantryLots = pantryLots;

export type PantrySelection = { lotId: string; servings: number };
export function mealFromPantry(
  state: AppState,
  selections: PantrySelection[],
  operationId: string,
  category: Meal["category"],
  title: string,
): AppState {
  const mealId = `pantry-meal:${operationId}`;
  if (
    state.meals.some((meal) => meal.id === mealId) ||
    (state.pantryEvents || []).some((event) => event.mealId === mealId)
  )
    return state;
  if (!selections.length || selections.length > 40)
    throw new Error("Choose at least one ingredient and at most 40.");
  if (new Set(selections.map((s) => s.lotId)).size !== selections.length)
    throw new Error(
      "Choose each purchase once; combine its serving quantities.",
    );
  const lots = pantryLots(state);
  const now = new Date().toISOString();
  const events: PantryEvent[] = [];
  const components: MealComponent[] = selections.map((selection, index) => {
    const lot = lots.find((entry) => entry.id === selection.lotId);
    if (
      !lot ||
      lot.inconsistent ||
      lot.remaining === null ||
      lot.item.availability === "used"
    )
      throw new Error(
        "Confirm how much is available before logging this ingredient.",
      );
    if (
      !Number.isFinite(selection.servings) ||
      selection.servings <= 0 ||
      selection.servings > lot.remaining
    )
      throw new Error(
        `Choose an amount within the available ${lot.remaining} servings of ${lot.item.name}.`,
      );
    if (!lot.item.nutrition || lot.item.needsReview)
      throw new Error(
        `Check the nutrition and serving size for ${lot.item.name} first.`,
      );
    events.push({
      id: `${operationId}:${index}`,
      lotId: lot.id,
      kind: "consumed",
      servings: -selection.servings,
      mealId,
      createdAt: now,
      note: "Ingredient and amount selected by you.",
    });
    return {
      id: `${mealId}:${index}`,
      name: lot.item.name,
      lotId: lot.id,
      servings: selection.servings,
      servingLabel: lot.item.serving,
      nutrition: scaleNutrition(lot.item.nutrition, selection.servings),
      sourceUrls: lot.item.sources.map((source) => source.url),
      productSnapshot: lot.item.productSnapshot,
    };
  });
  const totals = componentNutrition(components);
  if (Object.values(totals).some((amount) => amount > 20000))
    throw new Error(
      "That portion is too large to log as one meal. Check the serving amounts.",
    );
  const meal: Meal = {
    id: mealId,
    title:
      title.trim().slice(0, 200) ||
      components
        .map((component) => component.name)
        .join(" + ")
        .slice(0, 200),
    category,
    time: clockTime(),
    day: today(),
    source: "Your pantry · confirmed ingredients",
    confidence: "estimated",
    note: "Portions and grocery sources confirmed by you. Nutrition uses the saved per-serving estimates.",
    components,
    ...totals,
  };
  return {
    ...state,
    pantryEvents: [...(state.pantryEvents || []), ...events],
    meals: [...state.meals, meal],
    messages: [
      ...state.messages,
      {
        id: `${mealId}:message`,
        role: "assistant",
        text: "Added your meal and updated the ingredients you selected. You can undo this in your pantry.",
        time: clockTime(),
        mealId,
      },
    ],
  };
}

export function detachMealFromPantry(
  state: AppState,
  mealId: string,
): AppState {
  const existing = state.pantryEvents || [];
  const reverse = existing.filter(
    (event) =>
      event.mealId === mealId &&
      event.kind === "consumed" &&
      !existing.some((candidate) => candidate.reversesId === event.id),
  );
  if (!reverse.length) return state;
  return {
    ...state,
    pantryEvents: [
      ...existing,
      ...reverse.map((event): PantryEvent => ({
        id: `restore:${event.id}`,
        lotId: event.lotId,
        kind: "restored",
        servings: -event.servings,
        mealId,
        reversesId: event.id,
        createdAt: new Date().toISOString(),
        note: "Meal link reversed; ingredients restored.",
      })),
    ],
    meals: state.meals.map((meal) =>
      meal.id === mealId ? { ...meal, components: undefined } : meal,
    ),
  };
}

/** Link a meal already logged: only inventory changes; daily intake is not added again. */
export function reconcileMeal(
  state: AppState,
  mealId: string,
  links: PantrySelection[],
  operationId: string,
): AppState {
  const meal = state.meals.find((entry) => entry.id === mealId);
  if (!meal) throw new Error("This meal is no longer available.");
  if (isExampleMeal(meal))
    throw new Error("Example meals cannot use pantry ingredients. Choose a meal you actually logged.");
  if (meal.recipeBatchId)
    throw new Error("This portion already uses ingredients from a prepared recipe. Review it in Recipes & leftovers.");
  if (
    (state.pantryEvents || []).some((event) =>
      event.id.startsWith(`${operationId}:`),
    )
  )
    return state;
  if (
    (state.pantryEvents || []).some(
      (event) =>
        event.mealId === mealId &&
        event.kind === "consumed" &&
        !(state.pantryEvents || []).some(
          (other) => other.reversesId === event.id,
        ),
    )
  )
    throw new Error(
      "This meal already has pantry links. Undo those links before replacing them.",
    );
  const prepared = mealFromPantry(
    state,
    links,
    operationId,
    meal.category,
    meal.title,
  );
  const preparedId = `pantry-meal:${operationId}`;
  const snapshot = prepared.meals.find((entry) => entry.id === preparedId);
  if (!snapshot) return state;
  const events = (prepared.pantryEvents || [])
    .filter((event) => event.mealId === preparedId)
    .map((event) => ({ ...event, mealId }));
  return {
    ...state,
    pantryEvents: [...(state.pantryEvents || []), ...events],
    meals: state.meals.map((entry) =>
      entry.id === mealId
        ? {
            ...entry,
            components: snapshot.components,
            note: `${entry.note} Pantry ingredients linked by you; original meal estimate retained.`,
          }
        : entry,
    ),
  };
}

export function deleteMealWithPantry(
  state: AppState,
  mealId: string,
): AppState {
  const next = detachMealFromPantry(restoreRecipePortion(state, mealId), mealId);
  return {
    ...next,
    meals: next.meals.filter((meal) => meal.id !== mealId),
    messages: next.messages.map((message) =>
      message.mealId === mealId
        ? {
            ...message,
            mealId: undefined,
            text: "Meal removed. Any linked pantry or recipe portions have been restored.",
          }
        : message,
    ),
  };
}

export function adjustPantry(
  state: AppState,
  lotId: string,
  remaining: number,
  operationId: string,
  reason: "adjusted" | "discarded" = "adjusted",
): AppState {
  if ((state.pantryEvents || []).some((event) => event.id === operationId))
    return state;
  const lot = pantryLots(state).find((entry) => entry.id === lotId);
  if (
    !lot ||
    lot.remaining === null ||
    lot.item.availability === "used" ||
    !Number.isFinite(remaining) ||
    remaining < 0 ||
    remaining > 10000
  )
    throw new Error(
      "Check the purchased quantity and availability first, then enter the servings remaining.",
    );
  const delta = rounded(remaining - lot.remaining);
  if (reason === "discarded" && delta > 0)
    throw new Error("Discarding food cannot increase the amount available.");
  if (!delta) return state;
  return {
    ...state,
    pantryEvents: [
      ...(state.pantryEvents || []),
      {
        id: operationId,
        lotId,
        kind: reason,
        servings: delta,
        createdAt: new Date().toISOString(),
        note:
          reason === "discarded"
            ? "Discarded amount confirmed by you."
            : "Remaining amount counted by you.",
      },
    ],
  };
}

export function undoPantryAdjustment(
  state: AppState,
  eventId: string,
): AppState {
  const events = state.pantryEvents || [];
  const event = events.find((entry) => entry.id === eventId);
  if (
    !event ||
    !["adjusted", "discarded"].includes(event.kind) ||
    events.some((entry) => entry.reversesId === eventId)
  )
    return state;
  const lot = getPantryLots(state).find((entry) => entry.id === event.lotId);
  if (!lot || lot.remaining === null || lot.remaining - event.servings < 0)
    throw new Error(
      "Some of that food has since been used. Undo the linked meal or count the remaining amount first.",
    );
  return {
    ...state,
    pantryEvents: [
      ...events,
      {
        id: `restore:${event.id}`,
        lotId: event.lotId,
        kind: "restored",
        servings: -event.servings,
        reversesId: event.id,
        createdAt: new Date().toISOString(),
        note: "Quantity adjustment undone by you.",
      },
    ],
  };
}

/** Purchase corrections cannot silently erase quantities already linked to meals. */
export function updatePantryItem(
  state: AppState,
  receiptId: string,
  item: GroceryItem,
): AppState {
  const lotId = `${receiptId}::${item.id}`;
  const existing = pantryLots(state).find((lot) => lot.id === lotId);
  const events = (state.pantryEvents || []).filter(
    (event) => event.lotId === lotId,
  );
  const activeLinks = events.some(
    (event) =>
      (event.kind === "consumed" || event.kind === "prepared") &&
      !events.some((candidate) => candidate.reversesId === event.id),
  );
  const hasBalanceChange =
    rounded(events.reduce((sum, event) => sum + event.servings, 0)) !== 0;
  if (
    (activeLinks || hasBalanceChange) &&
    (item.availability !== existing?.item.availability ||
      item.servingsPurchased !== existing?.purchased ||
      item.serving !== existing?.item.serving ||
      item.name !== existing?.item.name ||
      item.productSnapshot?.id !== existing?.item.productSnapshot?.id ||
      item.productSnapshot?.gtin !== existing?.item.productSnapshot?.gtin)
  )
    throw new Error(
      "This purchase has quantity history. Keep its product and serving basis, change the remaining amount in the pantry, or undo linked meals and adjustments first.",
    );
  return {
    ...state,
    groceries: (state.groceries || []).map((receipt) =>
      receipt.id === receiptId
        ? {
            ...receipt,
            items: receipt.items.map((entry) =>
              entry.id === item.id ? item : entry,
            ),
          }
        : receipt,
    ),
  };
}
