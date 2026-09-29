import { describe, expect, it } from "vitest";
import {
  demoState,
  initialState,
  type AppState,
  type Meal,
} from "../../domain";
import { detachMealFromPantry, getPantryLots, reconcileMeal } from "./ledger";
import { pantryLinkBlockReason, suggestPantryLinks } from "./suggestions";

function fixture(): { state: AppState; meal: Meal } {
  const meal: Meal = {
    ...demoState().meals[0],
    example: false,
    id: "eaten",
    title: "Oats with milk",
    source: "Photo estimate",
    note: "",
    calories: 250,
  };
  const item = {
    id: "milk",
    receiptText: "MILK",
    name: "Whole milk",
    quantity: "1 carton",
    serving: "1 cup",
    servingsPurchased: 8,
    nutrition: { calories: 150, protein: 8, carbs: 12, fat: 8 },
    match: "user" as const,
    note: "",
    sources: [
      {
        title: "Source fixture",
        url: "https://fdc.nal.usda.gov/food-details/1/nutrients",
      },
    ],
    needsReview: false,
    availability: "available" as const,
  };
  return {
    meal,
    state: {
      ...initialState(),
      meals: [meal],
      messages: [],
      groceries: [
        {
          id: "shop",
          fingerprint: "fixture",
          store: "Fixture market",
          date: "2026-09-25",
          note: "",
          sources: [],
          items: [
            item,
            { ...item, id: "oat-milk", name: "Oat milk" },
            {
              ...item,
              id: "oats",
              name: "Rolled oats",
              serving: "1/2 cup",
              servingsPurchased: 20,
            },
            {
              ...item,
              id: "rice",
              name: "Brown rice",
              serving: "1 cup cooked",
            },
          ],
        },
      ],
    },
  };
}

describe("conservative pantry-link suggestions", () => {
  it("lists possible ingredients without changing records or inferring portions", () => {
    const { state, meal } = fixture();
    const before = structuredClone(state);
    const suggestions = suggestPantryLinks(state, meal);
    expect(suggestions.map((entry) => entry.lot.item.id)).toEqual(
      expect.arrayContaining(["milk", "oat-milk", "oats"]),
    );
    expect(suggestions.some((entry) => entry.lot.item.id === "rice")).toBe(
      false,
    );
    expect(
      suggestions.every(
        (entry) =>
          !Object.hasOwn(entry, "servings") &&
          !Object.hasOwn(entry, "selected"),
      ),
    ).toBe(true);
    expect(state).toEqual(before);
    expect(state.pantryEvents).toBeUndefined();
  });
  it("flags generic name collisions and repeated purchases instead of choosing a source", () => {
    const { state, meal } = fixture();
    meal.title = "Milk";
    state.groceries!.push({
      ...state.groceries![0],
      id: "second-shop",
      date: "2026-09-24",
      items: [state.groceries![0].items[0]],
    });
    const suggestions = suggestPantryLinks(state, meal);
    expect(suggestions).toHaveLength(3);
    expect(suggestions.every((entry) => entry.ambiguous)).toBe(true);
    expect(
      suggestions.every((entry) =>
        entry.reasons.some((reason) => reason.includes("purchase date")),
      ),
    ).toBe(true);
    expect(new Set(suggestions.map((entry) => entry.lot.id)).size).toBe(3);
  });
  it("ignores generic words and negated or uncertain ingredient descriptions", () => {
    const { state, meal } = fixture();
    expect(
      suggestPantryLinks(state, {
        ...meal,
        title: "Fresh organic meal",
        note: "Estimated nutrition per serving",
      }),
    ).toEqual([]);
    expect(
      suggestPantryLinks(state, {
        ...meal,
        title: "Coffee without milk",
        note: "Maybe oat milk",
      }),
    ).toEqual([]);
    expect(
      suggestPantryLinks(state, {
        ...meal,
        title: "Coffee",
        note: "Milk quantity unknown",
      }),
    ).toEqual([]);
  });
  it("requires two note-only name words but can match explicit saved component names", () => {
    const { state, meal } = fixture();
    expect(
      suggestPantryLinks(state, { ...meal, title: "Porridge", note: "milk" }),
    ).toEqual([]);
    const fromNote = suggestPantryLinks(state, {
      ...meal,
      title: "Porridge",
      note: "Whole milk",
    });
    expect(fromNote).toHaveLength(1);
    expect(fromNote[0].lot.item.id).toBe("milk");
    const fromComponents = suggestPantryLinks(state, {
      ...meal,
      title: "Porridge",
      components: [
        {
          id: "c",
          name: "Rolled oats",
          servings: 1,
          servingLabel: "1/2 cup",
          nutrition: { calories: 150, protein: 5, carbs: 27, fat: 3 },
          sourceUrls: [],
        },
      ],
    });
    expect(fromComponents.some((entry) => entry.lot.item.id === "oats")).toBe(
      true,
    );
  });
  it("explains unknown stock and unchecked nutrition without making those amounts available", () => {
    const { state, meal } = fixture();
    state.groceries![0].items[0].servingsPurchased = null;
    state.groceries![0].items[1].needsReview = true;
    state.groceries![0].items[2].serving = "";
    const suggestions = suggestPantryLinks(state, meal);
    expect(
      suggestions.find((entry) => entry.lot.item.id === "milk")?.blockedReason,
    ).toContain("unknown");
    expect(
      suggestions.find((entry) => entry.lot.item.id === "oat-milk")
        ?.blockedReason,
    ).toContain("nutrition");
    expect(
      suggestions.find((entry) => entry.lot.item.id === "oats")?.blockedReason,
    ).toContain("serving size");
    expect(
      pantryLinkBlockReason(
        getPantryLots(state).find((lot) => lot.item.id === "rice")!,
      ),
    ).toBeNull();
  });
  it("only explicit confirmed fractions deduct stock and never add a second meal", () => {
    const { state, meal } = fixture();
    const suggestions = suggestPantryLinks(state, meal);
    expect(
      getPantryLots(state).find((lot) => lot.id === "shop::milk")!.remaining,
    ).toBe(8);
    expect(suggestions.length).toBeGreaterThan(0);
    const linked = reconcileMeal(
      state,
      meal.id,
      [{ lotId: "shop::milk", servings: 0.25 }],
      "explicit",
    );
    expect(linked.meals).toHaveLength(1);
    expect(linked.meals[0].calories).toBe(250);
    expect(linked.meals[0].components![0]).toMatchObject({
      servings: 0.25,
      nutrition: { calories: 37.5 },
      sourceUrls: state.groceries![0].items[0].sources.map(
        (source) => source.url,
      ),
    });
    expect(
      getPantryLots(linked).find((lot) => lot.id === "shop::milk")!.remaining,
    ).toBe(7.75);
    expect(
      reconcileMeal(
        linked,
        meal.id,
        [{ lotId: "shop::milk", servings: 0.25 }],
        "explicit",
      ),
    ).toBe(linked);
    const undone = detachMealFromPantry(linked, meal.id);
    expect(
      getPantryLots(undone).find((lot) => lot.id === "shop::milk")!.remaining,
    ).toBe(8);
    expect(undone.meals[0].calories).toBe(250);
    expect(detachMealFromPantry(undone, meal.id)).toBe(undone);
  });
  it("refuses stale amounts or a removed meal instead of using the earlier suggestion", () => {
    const { state, meal } = fixture();
    suggestPantryLinks(state, meal);
    state.groceries![0].items[0].servingsPurchased = 0.5;
    expect(() =>
      reconcileMeal(
        state,
        meal.id,
        [{ lotId: "shop::milk", servings: 1 }],
        "stale",
      ),
    ).toThrow("available");
    expect(() =>
      reconcileMeal(
        { ...state, meals: [] },
        meal.id,
        [{ lotId: "shop::milk", servings: 0.25 }],
        "removed",
      ),
    ).toThrow("no longer");
    expect(state.pantryEvents).toBeUndefined();
  });
});
