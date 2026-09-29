import { clockTime, today, type AppState, type Meal } from "../../domain";
import { componentNutrition, scaleNutrition } from "../meals/arithmetic";
import type { MealComponent } from "../meals/contracts";
import type { PantryEvent } from "../pantry/contracts";
import { getPantryLots, type PantrySelection } from "../pantry/ledger";
import { pantryLinkBlockReason } from "../pantry/suggestions";
import { recipeBatchSchema } from "./contracts";
import { remainingRecipePortions } from "./portions";
export { remainingRecipePortions, restoreRecipePortion } from "./portions";

const quantity = (value: number) => Math.round(value * 10000) / 10000;

export function prepareRecipeBatch(
  state: AppState,
  input: {
    id: string;
    name: string;
    totalPortions: number;
    ingredients: PantrySelection[];
  },
): AppState {
  if ((state.recipeBatches || []).some((batch) => batch.id === input.id))
    return state;
  const totalPortions = quantity(input.totalPortions);
  if (!input.id || !input.name.trim())
    throw new Error("Give this batch a name.");
  if (
    !Number.isFinite(totalPortions) ||
    totalPortions < 0.0001 ||
    totalPortions > 1000
  )
    throw new Error(
      "Enter the number of portions this batch makes, up to 1,000.",
    );
  if (!input.ingredients.length || input.ingredients.length > 40)
    throw new Error("Choose between one and 40 ingredients.");
  if (
    new Set(input.ingredients.map((entry) => entry.lotId)).size !==
    input.ingredients.length
  )
    throw new Error("Choose each purchase once and combine its quantities.");
  const lots = getPantryLots(state);
  const createdAt = new Date().toISOString();
  const events: PantryEvent[] = [];
  const ingredients: MealComponent[] = input.ingredients.map(
    (selection, index) => {
      const lot = lots.find((entry) => entry.id === selection.lotId);
      if (!lot)
        throw new Error(
          "An ingredient is no longer in the pantry. Check this batch again.",
        );
      const blocked = pantryLinkBlockReason(lot);
      if (blocked) throw new Error(`${lot.item.name}: ${blocked}`);
      if (
        !["calories", "protein", "carbs", "fat"].every((key) => {
          const value =
            lot.item.nutrition?.[
              key as keyof NonNullable<typeof lot.item.nutrition>
            ];
          return (
            typeof value === "number" && Number.isFinite(value) && value >= 0
          );
        })
      )
        throw new Error(
          `${lot.item.name}: Complete the nutrition amounts before preparing this batch.`,
        );
      const servings = quantity(selection.servings);
      if (
        !Number.isFinite(servings) ||
        servings < 0.0001 ||
        servings > lot.remaining!
      )
        throw new Error(
          `Choose an amount within the available ${lot.remaining} servings of ${lot.item.name}.`,
        );
      events.push({
        id: `recipe-prep:${input.id}:${index}`,
        lotId: lot.id,
        kind: "prepared",
        servings: -servings,
        createdAt,
        note: `Transferred to prepared batch: ${input.name.trim().slice(0, 200)}. Not logged as eaten.`,
      });
      return {
        id: `recipe-ingredient:${input.id}:${index}`,
        name: lot.item.name,
        lotId: lot.id,
        servings,
        servingLabel: lot.item.serving,
        nutrition: scaleNutrition(lot.item.nutrition!, servings),
        sourceUrls: lot.item.sources.map((source) => source.url),
        productSnapshot: lot.item.productSnapshot
          ? structuredClone(lot.item.productSnapshot)
          : undefined,
      };
    },
  );
  const batch = recipeBatchSchema.parse({
    id: input.id,
    name: input.name.trim().slice(0, 200),
    createdAt,
    totalPortions,
    ingredients,
    nutrition: componentNutrition(ingredients),
    preparationEventIds: events.map((event) => event.id),
    consumptions: [],
  });
  return {
    ...state,
    recipeBatches: [...(state.recipeBatches || []), batch],
    pantryEvents: [...(state.pantryEvents || []), ...events],
    messages: [
      ...state.messages,
      {
        id: `recipe-prepared:${batch.id}`,
        role: "assistant",
        text: `Your ${batch.name} batch is saved with ${batch.totalPortions} portions. Its ingredients moved out of the pantry. Nothing has been added to your food log.`,
        time: clockTime(),
      },
    ],
  };
}

export function logRecipePortion(
  state: AppState,
  batchId: string,
  amount: number,
  category: Meal["category"],
  operationId: string,
): AppState {
  if (!operationId.trim())
    throw new Error("This portion could not be identified. Please try again.");
  const batch = (state.recipeBatches || []).find(
    (entry) => entry.id === batchId,
  );
  if (!batch || batch.undoneAt)
    throw new Error("This batch is no longer available.");
  const mealId = `recipe-meal:${operationId}`;
  if (
    state.meals.some((meal) => meal.id === mealId) ||
    (state.recipeBatches || []).some((entry) =>
      entry.consumptions.some((consumption) => consumption.id === operationId),
    )
  )
    return state;
  const portions = quantity(amount);
  if (
    !Number.isFinite(portions) ||
    portions < 0.0001 ||
    portions > remainingRecipePortions(batch)
  )
    throw new Error(
      `This batch has ${remainingRecipePortions(batch)} portions left. Enter the amount you ate.`,
    );
  const ratio = portions / batch.totalPortions;
  const nutrition = scaleNutrition(batch.nutrition, ratio);
  if (Object.values(nutrition).some((value) => value > 20000))
    throw new Error(
      "That portion is too large for one food-log entry. Check the batch yield and the amount eaten.",
    );
  // Keep nutrition/product evidence, but raw purchase IDs are not new deductions.
  const components: MealComponent[] = batch.ingredients.map(
    (ingredient, index) => ({
      ...ingredient,
      id: `${mealId}:${index}`,
      lotId: undefined,
      servings: ingredient.servings * ratio,
      nutrition: scaleNutrition(ingredient.nutrition, ratio),
      productSnapshot: ingredient.productSnapshot
        ? structuredClone(ingredient.productSnapshot)
        : undefined,
    }),
  );
  const meal: Meal = {
    id: mealId,
    title: batch.name,
    category,
    day: today(),
    time: clockTime(),
    source: "Your prepared batch",
    confidence: "estimated",
    note: `${portions} of ${batch.totalPortions} prepared portions. Nutrition uses the ingredient snapshots saved when you prepared this batch. Pantry ingredients were deducted at preparation, not again here.`,
    components,
    recipeBatchId: batch.id,
    recipePortions: portions,
    ...nutrition,
  };
  const consumption = {
    id: operationId,
    mealId,
    portions,
    createdAt: new Date().toISOString(),
  };
  return {
    ...state,
    recipeBatches: (state.recipeBatches || []).map((entry) =>
      entry.id === batch.id
        ? { ...entry, consumptions: [...entry.consumptions, consumption] }
        : entry,
    ),
    meals: [...state.meals, meal],
    messages: [
      ...state.messages,
      {
        id: `${mealId}:message`,
        role: "assistant",
        text: `Logged ${portions} ${portions === 1 ? "portion" : "portions"} of ${batch.name}. ${quantity(remainingRecipePortions(batch) - portions)} portions remain.`,
        time: clockTime(),
        mealId,
      },
    ],
  };
}

export function undoRecipePreparation(
  state: AppState,
  batchId: string,
): AppState {
  const batch = (state.recipeBatches || []).find(
    (entry) => entry.id === batchId,
  );
  if (!batch || batch.undoneAt) return state;
  if (batch.consumptions.some((entry) => !entry.reversedAt))
    throw new Error(
      "Undo this batch's logged portions before undoing its preparation.",
    );
  const events = state.pantryEvents || [];
  const lots = getPantryLots(state);
  const preparations = batch.preparationEventIds.map((eventId) =>
    events.find((event) => event.id === eventId && event.kind === "prepared"),
  );
  if (
    preparations.some(
      (event) => !event || !lots.some((lot) => lot.id === event.lotId),
    )
  )
    throw new Error(
      "The original purchase history is incomplete. Check the pantry before restoring this batch.",
    );
  const createdAt = new Date().toISOString();
  const restores: PantryEvent[] = preparations
    .filter((event) => !events.some((other) => other.reversesId === event!.id))
    .map((event) => ({
      id: `recipe-undo:${event!.id}`,
      lotId: event!.lotId,
      kind: "restored",
      servings: -event!.servings,
      reversesId: event!.id,
      createdAt,
      note: `Preparation undone: ${batch.name}. Original ingredient quantities restored.`,
    }));
  return {
    ...state,
    recipeBatches: (state.recipeBatches || []).map((entry) =>
      entry.id === batch.id ? { ...entry, undoneAt: createdAt } : entry,
    ),
    pantryEvents: [...events, ...restores],
  };
}
