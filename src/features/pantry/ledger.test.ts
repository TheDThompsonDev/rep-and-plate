import { describe, expect, it } from "vitest";
import {
  demoState,
  initialState,
  stateSchema,
  type AppState,
} from "../../domain";
import {
  adjustPantry,
  deleteMealWithPantry,
  detachMealFromPantry,
  getPantryLots,
  mealFromPantry,
  reconcileMeal,
  undoPantryAdjustment,
  updatePantryItem,
} from "./ledger";
import { componentNutrition, scaleNutrition } from "../meals/arithmetic";

function fixture(): AppState {
  return {
    ...initialState(),
    meals: [],
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

describe("pantry ledger and confirmed consumption", () => {
  it('uses purchase day for pantry age while keeping the original capture day',()=>{
    const state=fixture();const receipt=state.groceries![0];
    receipt.date='2026-09-30';
    receipt.purchase={purchaseDate:'2026-09-25',currency:'USD',subtotal:null,tax:null,discount:null,total:null,confirmed:true};
    expect(getPantryLots(state)[0].date).toBe('2026-09-25');
    expect(receipt.date).toBe('2026-09-30');
    receipt.purchase.purchaseDate=null;
    expect(getPantryLots(state)[0].date).toBe('2026-09-30');
  });
  it("rejects explicit and legacy example meals without consuming real pantry portions", () => {
    for (const example of [
      { example: true, source: "Typed locally", note: "" },
      { source: "Text: protein shake", note: "Demo estimate for one scoop with water. Edit to match your brand and portion." },
    ]) {
      const state = fixture();
      state.meals = [{ id: "example-target", title: "Protein shake", category: "Snack", time: "9:00 AM", day: "2026-09-26", confidence: "estimated", calories: 160, protein: 30, carbs: 5, fat: 2, ...example }];
      const before = structuredClone(state);
      expect(() => reconcileMeal(state, "example-target", [{ lotId: "shop::milk", servings: 1 }], "example-link")).toThrow(/example/i);
      expect(state).toEqual(before);
      expect(getPantryLots(state)[0].remaining).toBe(8);
      expect(state.pantryEvents ?? []).toEqual([]);
    }
  });
  it("migrates legacy purchases without inventing quantities or consumption", () => {
    const state = fixture();
    state.groceries![0].items[0].servingsPurchased = null;
    state.groceries![0].items[1].availability = "used";
    const parsed = stateSchema.parse(state);
    expect(parsed.pantryEvents).toBeUndefined();
    expect(getPantryLots(parsed).map((lot) => lot.remaining)).toEqual([
      null,
      0,
    ]);
    expect(parsed.meals).toHaveLength(0);
  });
  it("logs milk plus oats and deducts fractions once across retry and refresh", () => {
    const base = fixture();
    const selection = [
      { lotId: "shop::milk", servings: 0.5 },
      { lotId: "shop::oats", servings: 1 },
    ];
    const next = mealFromPantry(
      base,
      selection,
      "breakfast",
      "Breakfast",
      "Creamy oats",
    );
    expect(next.meals[0]).toMatchObject({
      calories: 225,
      protein: 9,
      carbs: 33,
      fat: 7,
    });
    expect(next.meals[0].components).toHaveLength(2);
    expect(getPantryLots(next).map((lot) => lot.remaining)).toEqual([7.5, 9]);
    const refreshed = stateSchema.parse(JSON.parse(JSON.stringify(next)));
    expect(
      mealFromPantry(
        refreshed,
        selection,
        "breakfast",
        "Breakfast",
        "Creamy oats",
      ),
    ).toBe(refreshed);
    expect(base.meals).toHaveLength(0);
  });
  it("undo restores exactly the linked portions once and blocks a stale replay", () => {
    const selection = [{ lotId: "shop::milk", servings: 1 }];
    const next = mealFromPantry(fixture(), selection, "drink", "Snack", "Milk");
    const undone = deleteMealWithPantry(next, next.meals[0].id);
    expect(undone.meals).toHaveLength(0);
    expect(getPantryLots(undone)[0].remaining).toBe(8);
    expect(
      deleteMealWithPantry(undone, next.meals[0].id).pantryEvents,
    ).toHaveLength(2);
    expect(mealFromPantry(undone, selection, "drink", "Snack", "Milk")).toBe(
      undone,
    );
    expect(
      updatePantryItem(undone, "shop", {
        ...undone.groceries![0].items[0],
        servingsPurchased: 4,
      }).groceries![0].items[0].servingsPurchased,
    ).toBe(4);
  });
  it("keeps repeated purchases separate and rejects negative stock, unknowns and unchecked estimates", () => {
    const state = fixture();
    state.groceries!.push({ ...state.groceries![0], id: "second-shop" });
    const next = mealFromPantry(
      state,
      [{ lotId: "shop::milk", servings: 8 }],
      "use",
      "Snack",
      "Milk",
    );
    expect(
      getPantryLots(next)
        .filter((lot) => lot.item.id === "milk")
        .map((lot) => lot.remaining),
    ).toEqual([0, 8]);
    expect(() =>
      mealFromPantry(
        next,
        [{ lotId: "shop::milk", servings: 1 }],
        "over",
        "Snack",
        "Milk",
      ),
    ).toThrow();
    state.groceries![0].items[0].servingsPurchased = null;
    expect(() =>
      mealFromPantry(
        state,
        [{ lotId: "shop::milk", servings: 1 }],
        "unknown",
        "Snack",
        "Milk",
      ),
    ).toThrow();
    state.groceries![0].items[1].needsReview = true;
    expect(() =>
      mealFromPantry(
        state,
        [{ lotId: "shop::oats", servings: 1 }],
        "review",
        "Snack",
        "Oats",
      ),
    ).toThrow();
  });
  it("keeps historical nutrition unchanged when purchase estimates change", () => {
    const next = mealFromPantry(
      fixture(),
      [{ lotId: "shop::milk", servings: 1 }],
      "milk",
      "Snack",
      "Milk",
    );
    const item = next.groceries![0].items[0];
    const corrected = updatePantryItem(next, "shop", {
      ...item,
      nutrition: { ...item.nutrition!, calories: 160 },
    });
    expect(corrected.meals[0].calories).toBe(150);
    expect(corrected.meals[0].components![0].nutrition.calories).toBe(150);
    expect(() =>
      updatePantryItem(next, "shop", { ...item, servingsPurchased: 2 }),
    ).toThrow();
  });
  it("records explicit adjustments and discards without adding food intake", () => {
    const next = adjustPantry(
      fixture(),
      "shop::milk",
      6,
      "discard",
      "discarded",
    );
    expect(getPantryLots(next)[0].remaining).toBe(6);
    expect(next.meals).toHaveLength(0);
    expect(adjustPantry(next, "shop::milk", 6, "discard", "discarded")).toBe(
      next,
    );
    expect(() =>
      adjustPantry(next, "shop::milk", 9, "more", "discarded"),
    ).toThrow();
    const counted = adjustPantry(next, "shop::milk", 7, "count");
    expect(getPantryLots(counted)[0].remaining).toBe(7);
    const undone = undoPantryAdjustment(counted, "count");
    expect(getPantryLots(undone)[0].remaining).toBe(6);
    expect(undoPantryAdjustment(undone, "count")).toBe(undone);
    expect(
      getPantryLots(undoPantryAdjustment(undone, "discard"))[0].remaining,
    ).toBe(8);
  });
  it("links an existing eaten meal without duplicating its calories, then detaches on edit", () => {
    const state = fixture();
    state.meals = [
      {
        ...demoState().meals[0],
        example: false,
        source: "Your logged meal",
        id: "already-eaten",
      },
    ];
    const linked = reconcileMeal(
      state,
      "already-eaten",
      [{ lotId: "shop::milk", servings: 1 }],
      "link",
    );
    expect(linked.meals).toHaveLength(1);
    expect(linked.meals[0].calories).toBe(state.meals[0].calories);
    expect(getPantryLots(linked)[0].remaining).toBe(7);
    expect(
      reconcileMeal(
        linked,
        "already-eaten",
        [{ lotId: "shop::milk", servings: 1 }],
        "link",
      ),
    ).toBe(linked);
    const detached = detachMealFromPantry(linked, "already-eaten");
    expect(getPantryLots(detached)[0].remaining).toBe(8);
    expect(detached.meals[0].components).toBeUndefined();
    expect(detached.meals).toHaveLength(1);
  });
  it("scales drinks and recipe oil portions using deterministic component arithmetic", () => {
    const milk = scaleNutrition(
      { calories: 150, protein: 8, carbs: 12, fat: 8 },
      0.5,
    );
    const syrup = scaleNutrition(
      { calories: 40, protein: 0, carbs: 10, fat: 0 },
      2,
    );
    const oil = scaleNutrition(
      { calories: 120, protein: 0, carbs: 0, fat: 14 },
      0.25,
    );
    const sum = componentNutrition(
      [milk, syrup, oil].map((nutrition, index) => ({
        id: String(index),
        name: "Ingredient",
        servings: 1,
        servingLabel: "Confirmed portion",
        nutrition,
        sourceUrls: [],
      })),
    );
    expect(sum).toEqual({ calories: 185, protein: 4, carbs: 26, fat: 7.5 });
    expect(() => scaleNutrition(milk, Number.NaN)).toThrow();
  });
});
