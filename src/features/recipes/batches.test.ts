import { describe, expect, it } from "vitest";
import { initialState, stateSchema, type AppState } from "../../domain";
import {
  deleteMealWithPantry,
  getPantryLots,
  reconcileMeal,
} from "../pantry/ledger";
import {
  logRecipePortion,
  prepareRecipeBatch,
  undoRecipePreparation,
} from "./batches";
import { remainingRecipePortions, restoreRecipePortion } from "./portions";

function fixture(): AppState {
  return {
    ...initialState(),
    meals: [],
    messages: [],
    pantryEvents: [],
    recipeBatches: [],
    groceries: [
      {
        id: "shop",
        fingerprint: "fixture",
        store: "Fixture market",
        date: "2026-09-25",
        note: "",
        sources: [],
        items: [
          {
            id: "milk",
            receiptText: "MILK",
            name: "Whole milk",
            quantity: "1 bottle",
            serving: "1 cup (240 ml)",
            servingsPurchased: 8,
            nutrition: { calories: 150, protein: 8, carbs: 12, fat: 8 },
            match: "user",
            note: "",
            sources: [],
            needsReview: false,
            availability: "available",
          },
          {
            id: "oats",
            receiptText: "OATS",
            name: "Rolled oats",
            quantity: "1 bag",
            serving: "1/2 cup (40 g)",
            servingsPurchased: 10,
            nutrition: { calories: 150, protein: 5, carbs: 27, fat: 3 },
            match: "user",
            note: "",
            sources: [],
            needsReview: false,
            availability: "available",
          },
        ],
      },
    ],
  };
}
const input = {
  id: "batch",
  name: "Overnight oats",
  totalPortions: 4,
  ingredients: [
    { lotId: "shop::milk", servings: 2 },
    { lotId: "shop::oats", servings: 4 },
  ],
};
const prepare = () => prepareRecipeBatch(fixture(), input);

describe("prepared batches and leftovers", () => {
  it("transfers ingredients once without adding intake, including after retry and reload", () => {
    const state = prepare();
    expect(state.meals).toEqual([]);
    expect(state.recipeBatches![0].nutrition).toEqual({
      calories: 900,
      protein: 36,
      carbs: 132,
      fat: 28,
    });
    expect(getPantryLots(state).map((lot) => lot.remaining)).toEqual([6, 6]);
    expect(
      state.pantryEvents!.every(
        (event) => event.kind === "prepared" && !event.mealId,
      ),
    ).toBe(true);
    const reloaded = stateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(prepareRecipeBatch(reloaded, input)).toBe(reloaded);
    expect(remainingRecipePortions(reloaded.recipeBatches![0])).toBe(4);
  });
  it("logs fractional portions proportionally without deducting raw ingredients again", () => {
    const prepared = prepare();
    const state = logRecipePortion(
      prepared,
      "batch",
      1.5,
      "Breakfast",
      "portion",
    );
    expect(state.meals[0]).toMatchObject({
      calories: 337.5,
      protein: 13.5,
      carbs: 49.5,
      fat: 10.5,
      recipeBatchId: "batch",
      recipePortions: 1.5,
    });
    expect(state.meals[0].components!.every((entry) => !entry.lotId)).toBe(
      true,
    );
    expect(state.pantryEvents).toBe(prepared.pantryEvents);
    expect(remainingRecipePortions(state.recipeBatches![0])).toBe(2.5);
    expect(logRecipePortion(state, "batch", 1.5, "Breakfast", "portion")).toBe(
      state,
    );
    const reloaded = stateSchema.parse(JSON.parse(JSON.stringify(state)));
    expect(
      logRecipePortion(reloaded, "batch", 1.5, "Breakfast", "portion"),
    ).toBe(reloaded);
    expect(() =>
      logRecipePortion(state, "batch", 3, "Lunch", "too-much"),
    ).toThrow(/2.5 portions left/);
  });
  it("deleting a meal restores only its batch portions, and reversal retries cannot re-log intake", () => {
    const eaten = logRecipePortion(prepare(), "batch", 1, "Lunch", "portion");
    const restored = deleteMealWithPantry(eaten, eaten.meals[0].id);
    expect(restored.meals).toEqual([]);
    expect(remainingRecipePortions(restored.recipeBatches![0])).toBe(4);
    expect(getPantryLots(restored).map((lot) => lot.remaining)).toEqual([6, 6]);
    expect(restored.pantryEvents).toHaveLength(2);
    expect(restoreRecipePortion(restored, eaten.meals[0].id)).toBe(restored);
    expect(logRecipePortion(restored, "batch", 1, "Lunch", "portion")).toBe(
      restored,
    );
  });
  it("only permits undoing preparation after logged portions are reversed, restoring stock once", () => {
    const eaten = logRecipePortion(prepare(), "batch", 0.5, "Snack", "portion");
    expect(() => undoRecipePreparation(eaten, "batch")).toThrow(
      /Undo this batch's logged portions/,
    );
    const restored = deleteMealWithPantry(eaten, eaten.meals[0].id);
    const undone = undoRecipePreparation(restored, "batch");
    expect(getPantryLots(undone).map((lot) => lot.remaining)).toEqual([8, 10]);
    expect(remainingRecipePortions(undone.recipeBatches![0])).toBe(0);
    expect(undoRecipePreparation(undone, "batch")).toBe(undone);
    expect(prepareRecipeBatch(undone, input)).toBe(undone);
    expect(() => logRecipePortion(undone, "batch", 1, "Lunch", "new")).toThrow(
      /no longer available/,
    );
  });
  it("requires known quantities and complete reviewed nutrition without guessing", () => {
    const unknown = fixture();
    unknown.groceries![0].items[0].servingsPurchased = null;
    expect(() => prepareRecipeBatch(unknown, input)).toThrow(/unknown/);
    const review = fixture();
    review.groceries![0].items[0].needsReview = true;
    expect(() => prepareRecipeBatch(review, input)).toThrow(/nutrition/);
    const missing = fixture();
    missing.groceries![0].items[0].nutrition = null;
    expect(() => prepareRecipeBatch(missing, input)).toThrow(/nutrition/);
    const partial = fixture();
    (
      partial.groceries![0].items[0].nutrition as unknown as { protein: null }
    ).protein = null;
    expect(() => prepareRecipeBatch(partial, input)).toThrow(
      /Complete the nutrition/,
    );
    expect(() =>
      prepareRecipeBatch(fixture(), { ...input, totalPortions: 0 }),
    ).toThrow(/number of portions/);
    expect(() =>
      prepareRecipeBatch(fixture(), {
        ...input,
        ingredients: [{ lotId: "shop::milk", servings: 0 }],
      }),
    ).toThrow(/available/);
    expect(() =>
      prepareRecipeBatch(fixture(), {
        ...input,
        ingredients: [{ lotId: "shop::milk", servings: 9 }],
      }),
    ).toThrow(/available/);
    expect(() =>
      prepareRecipeBatch(fixture(), {
        ...input,
        ingredients: [input.ingredients[0], input.ingredients[0]],
      }),
    ).toThrow(/once/);
  });
  it("keeps snapshot nutrition when source products or logged meal macros are corrected", () => {
    const prepared = prepare();
    prepared.groceries![0].items[0].nutrition = {
      calories: 1,
      protein: 1,
      carbs: 1,
      fat: 1,
    };
    const eaten = logRecipePortion(prepared, "batch", 1, "Lunch", "portion");
    expect(eaten.meals[0].calories).toBe(225);
    const corrected = {
      ...eaten,
      meals: eaten.meals.map((meal) => ({
        ...meal,
        calories: 300,
        components: undefined,
      })),
    };
    expect(remainingRecipePortions(corrected.recipeBatches![0])).toBe(3);
    expect(corrected.recipeBatches![0].nutrition.calories).toBe(900);
    expect(() =>
      reconcileMeal(
        corrected,
        corrected.meals[0].id,
        [{ lotId: "shop::milk", servings: 1 }],
        "link",
      ),
    ).toThrow(/prepared recipe/);
    expect(
      remainingRecipePortions(
        deleteMealWithPantry(corrected, corrected.meals[0].id)
          .recipeBatches![0],
      ),
    ).toBe(4);
  });
  it("refuses restoration when original ingredient history was removed", () => {
    const prepared = prepare();
    prepared.pantryEvents = [];
    expect(() => undoRecipePreparation(prepared, "batch")).toThrow(
      /history is incomplete/,
    );
  });
});
