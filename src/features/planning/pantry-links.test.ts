import { describe, it, expect } from "vitest";
import type { PantryLot } from "../pantry/ledger";
import type { MealPlan } from "./contracts";
import { defaultPreferences } from "../preferences/contracts";
import {
  linkPlannedIngredient,
  suggestedLinkedServings,
  unloggedPlan,
} from "./pantry-links";
import {
  mealEstimate,
  mealPortionSelections,
  planShoppingList,
} from "./meal-plans";
import { basketSummary, estimatePlanBasket } from "./basket";
import type { GroceryReceipt } from "../../ai-contract";

const lot: PantryLot = {
  id: "receipt::rice",
  receiptId: "receipt",
  date: "2026-09-29",
  store: "Shop",
  purchased: 4,
  remaining: 4,
  inconsistent: false,
  item: {
    id: "rice",
    name: "Rice",
    receiptText: "Rice",
    quantity: "4 servings",
    serving: "100 g",
    servingsPurchased: 4,
    nutrition: { calories: 200, protein: 4, carbs: 44, fat: 0 },
    match: "user",
    needsReview: false,
    availability: "available",
    note: "",
    sources: [],
    price: { total: 8, discount: null },
  },
};
function fixture(): MealPlan {
  return {
    id: "week",
    createdAt: "2026-09-29",
    status: "approved",
    days: Array.from({ length: 7 }, (_, index) => ({
      date: `2026-10-0${index + 1}`,
      meals:
        index === 0
          ? [
              {
                id: "rice-meal",
                title: "Rice bowl",
                portions: 1,
                minutes: 20,
                notes: "Cook rice.",
                ingredients: [
                  {
                    lotId: null,
                    name: "Rice",
                    servingLabel: "g",
                    servings: 100,
                  },
                ],
              },
            ]
          : [],
    })),
  };
}
const context = {
  lots: [lot],
  preferences: defaultPreferences(),
  loggedMealIds: [] as string[],
  confirmed: true,
};
const receipt: GroceryReceipt = {
  id: "receipt",
  fingerprint: "receipt",
  date: "2026-09-29",
  store: "Shop",
  items: [lot.item],
  note: "",
  sources: [],
  purchase: {
    purchaseDate: "2026-09-29",
    currency: "USD",
    subtotal: 8,
    tax: 0,
    discount: 0,
    total: 8,
    confirmed: true,
  },
};
describe("reviewed plan purchase connection", () => {
  it("repairs the audited purchased-rice gap only after explicit review", () => {
    const original = fixture();
    expect(mealPortionSelections(original.days[0].meals[0], [lot])).toBeNull();
    expect(planShoppingList(original, [lot])).toHaveLength(1);
    expect(() =>
      linkPlannedIngredient(original, "rice-meal", 0, lot.id, 1, {
        ...context,
        confirmed: false,
      }),
    ).toThrow("Confirm");
    const linked = linkPlannedIngredient(
      original,
      "rice-meal",
      0,
      lot.id,
      1,
      context,
    );
    expect(linked.status).toBe("draft");
    expect(linked.id).toBe(original.id);
    expect(planShoppingList(linked, [lot])).toEqual([]);
    expect(mealEstimate(linked.days[0].meals[0], [lot])).toMatchObject({
      complete: true,
      totals: { calories: 200 },
    });
    expect(mealPortionSelections(linked.days[0].meals[0], [lot])).toEqual([
      { lotId: lot.id, servings: 1 },
    ]);
    expect(original.days[0].meals[0].ingredients[0].lotId).toBeNull();
    expect(lot.remaining).toBe(4);
  });
  it("replaces exhausted stock without changing IDs or previously logged history", () => {
    const original = fixture();
    original.days[0].meals[0].ingredients[0].lotId = "old-lot";
    const next = linkPlannedIngredient(
      original,
      "rice-meal",
      0,
      lot.id,
      2,
      context,
    );
    expect(next.days[0].meals[0].id).toBe("rice-meal");
    expect(original.days[0].meals[0].ingredients[0].lotId).toBe("old-lot");
    const logged = ["pantry-meal:plan:week:rice-meal"];
    expect(() =>
      linkPlannedIngredient(original, "rice-meal", 0, lot.id, 2, {
        ...context,
        loggedMealIds: logged,
      }),
    ).toThrow("already logged");
    expect(planShoppingList(unloggedPlan(next, logged), [lot])).toEqual([]);
  });
  it("does not guess mass/volume, raw/cooked, density or ambiguous cup conversions", () => {
    const ingredient = fixture().days[0].meals[0].ingredients[0];
    expect(suggestedLinkedServings(ingredient, lot)).toBe(1);
    expect(
      suggestedLinkedServings(
        { ...ingredient, servingLabel: "kg", servings: 0.5 },
        lot,
      ),
    ).toBe(5);
    expect(
      suggestedLinkedServings({ ...ingredient, servingLabel: "ml" }, lot),
    ).toBeNull();
    expect(
      suggestedLinkedServings(
        { ...ingredient, servingLabel: "1 cup cooked" },
        lot,
      ),
    ).toBeNull();
  });
  it("rejects unreviewed, unavailable, inconsistent and dietary-conflicting purchases", () => {
    for (const changed of [
      { ...lot, item: { ...lot.item, needsReview: true } },
      { ...lot, remaining: null },
      { ...lot, remaining: 0 },
      { ...lot, inconsistent: true },
    ])
      expect(() =>
        linkPlannedIngredient(fixture(), "rice-meal", 0, lot.id, 1, {
          ...context,
          lots: [changed],
        }),
      ).toThrow("Review");
    expect(() =>
      linkPlannedIngredient(fixture(), "rice-meal", 0, lot.id, 1, {
        ...context,
        preferences: { ...defaultPreferences(), dislikes: ["rice"] },
      }),
    ).toThrow("Review");
    expect(() =>
      linkPlannedIngredient(fixture(), "rice-meal", 0, lot.id, NaN, context),
    ).toThrow("servings");
  });
});
describe("remaining basket evidence", () => {
  it("allocates shared stock once and prices only the shortage using reviewed purchased servings", () => {
    const linked = linkPlannedIngredient(
      fixture(),
      "rice-meal",
      0,
      lot.id,
      6,
      context,
    );
    const cost = estimatePlanBasket(linked, [lot], [receipt], "2026-09-29");
    expect(cost).toEqual({
      totals: { USD: 4 },
      covered: 0,
      priced: 1,
      unknown: [],
      total: 1,
      complete: true,
    });
    expect(basketSummary(cost, 3, "USD").budgetText).toContain("exceed");
  });
  it("never treats missing prices, stale receipts, unreviewed purchases or unknown amounts as free", () => {
    const linked = linkPlannedIngredient(
      fixture(),
      "rice-meal",
      0,
      lot.id,
      6,
      context,
    );
    for (const receipts of [
      [],
      [{ ...receipt, purchase: { ...receipt.purchase!, confirmed: false } }],
    ])
      expect(
        estimatePlanBasket(linked, [lot], receipts, "2026-09-29"),
      ).toMatchObject({ complete: false, totals: {}, unknown: ["Rice"] });
    expect(
      estimatePlanBasket(linked, [lot], [receipt], "2026-11-29").complete,
    ).toBe(false);
    expect(
      estimatePlanBasket(fixture(), [lot], [receipt], "2026-09-29").complete,
    ).toBe(false);
    expect(
      estimatePlanBasket(
        linked,
        [{ ...lot, remaining: null }],
        [receipt],
        "2026-09-29",
      ).complete,
    ).toBe(false);
  });
  it("does not combine currencies into a budget conclusion", () => {
    const result = {
      totals: { USD: 4, EUR: 3 },
      covered: 0,
      priced: 2,
      unknown: [],
      total: 2,
      complete: true,
    };
    expect(basketSummary(result, 20, "USD").budgetText).toContain(
      "cannot be assessed",
    );
  });
});
