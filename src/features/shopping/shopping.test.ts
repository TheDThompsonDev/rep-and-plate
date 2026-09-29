import { describe, it, expect } from "vitest";
import {
  receiptSpending,
  compareProducts,
  comparePrices,
  addShoppingItem,
  receiptPrice,
} from "./shopping";
import { prepareSnapshot } from "../cloud/client";
import { initialState } from "../../domain";
import { buildAIRequest } from "../../ai-client";
import { defaultPreferences } from "../preferences/contracts";
import { resultFixture } from "../../../tests/ai-fixtures";
import { normalizeUSDA } from "../../../server/products/usda";

const product = (id: number, calories: number, sugar: number, size = 40) =>
  normalizeUSDA({
    fdcId: id,
    gtinUpc: "012345678905",
    description: "Black beans",
    dataType: "Branded",
    servingSize: size,
    servingSizeUnit: "g",
    labelNutrients: {
      calories: { value: calories },
      protein: { value: 4 },
      carbohydrates: { value: 20 },
      fat: { value: 1 },
      sugars: { value: sugar },
    },
  })!;
describe("shopping evidence", () => {
  it("derives price per purchased mass only from checked receipt evidence", () => {
    const receipt = resultFixture("purchased").receipt!;
    const p = product(1, 100, 8);
    receipt.purchase = {
      purchaseDate: "2026-09-26",
      currency: "USD",
      subtotal: null,
      tax: null,
      discount: null,
      total: 4,
      confirmed: true,
    };
    receipt.items = [
      {
        ...receipt.items[0],
        productSnapshot: p,
        servingsPurchased: 10,
        needsReview: false,
        price: { total: 4, discount: 0 },
      },
    ];
    expect(receiptPrice([receipt], p)).toMatchObject({
      price: 4,
      amount: 400,
      unit: "g",
    });
    receipt.items[0].servingsPurchased = null;
    expect(receiptPrice([receipt], p)).toBeUndefined();
  });
  it("keeps new shopping data through backups and passes preferences and reviewed totals to Chat", () => {
    const state = initialState();
    state.preferences = {
      ...defaultPreferences(),
      shoppingPriority: "budget",
      weeklyBudget: 150,
      shoppingCurrency: "USD",
      preferredStores: ["Kroger"],
    };
    state.shopping = {
      list: [
        {
          id: "a",
          name: "Beans",
          quantity: "1 can",
          checked: false,
          createdAt: "2026-09-26",
        },
      ],
      dismissed: ["a:b"],
      prices: {},
    };
    const restored = prepareSnapshot(state);
    expect(restored.shopping).toEqual(state.shopping);
    expect(restored.preferences).toEqual(state.preferences);
    const request = buildAIRequest(restored, {
      id: crypto.randomUUID(),
      role: "user",
      text: "Help me shop",
      time: "now",
    });
    expect(request.context.preferences?.weeklyBudget).toBe(150);
    expect(request.context.shopping?.list).toEqual([
      { name: "Beans", quantity: "1 can", checked: false },
    ]);
  });
  it("treats suspicious store names as data, without prototype changes", () => {
    const receipt = resultFixture("store").receipt!;
    receipt.store = "__proto__";
    receipt.purchase = {
      purchaseDate: null,
      currency: "USD",
      total: 10,
      subtotal: null,
      tax: null,
      discount: null,
      confirmed: true,
    };
    expect(receiptSpending([receipt]).stores["__proto__"].USD).toBe(10);
    expect(({} as Record<string, unknown>).USD).toBeUndefined();
  });
  it("keeps unknown spending unknown and separates currencies and unconfirmed receipts", () => {
    const base = resultFixture("receipt").receipt!;
    expect(receiptSpending([base]).unpriced).toBe(1);
    const receipts = ["USD", "CAD"].map((currency) => ({
      ...base,
      id: currency,
      purchase: {
        currency,
        total: 20,
        subtotal: null,
        tax: null,
        discount: null,
        confirmed: true,
        purchaseDate: "2026-09-26",
      },
    }));
    expect(receiptSpending(receipts).totals).toEqual({ USD: 20, CAD: 20 });
    expect(
      receiptSpending([
        {
          ...receipts[0],
          purchase: { ...receipts[0].purchase, confirmed: false },
        },
      ]).totals,
    ).toEqual({});
  });
  it("compares equal quantities, not misleading different serving sizes", () => {
    expect(
      compareProducts(product(1, 100, 8), product(2, 50, 4, 20))?.calories,
    ).toBe(0);
    expect(compareProducts(product(1, 100, 8), product(2, 60, 0))?.sugar).toBe(
      20,
    );
    const unknown = product(2, 60, 0);
    delete unknown.sugars;
    expect(compareProducts(product(1, 100, 8), unknown)?.sugar).toBeNull();
    expect(
      compareProducts(product(1, 100, 8), {
        ...unknown,
        serving: { ...unknown.serving, unit: "ml" },
      }),
    ).toBeNull();
  });
  it("requires current comparable price evidence and never compares incompatible currencies or units", () => {
    const a = {
      price: 4,
      amount: 400,
      unit: "g" as const,
      currency: "USD",
      date: "2026-09-26",
      store: "Shop",
      conditions: "",
      confirmed: true,
    };
    expect(comparePrices(a, { ...a, price: 2 }, "2026-09-26")?.percent).toBe(
      50,
    );
    expect(
      comparePrices(a, { ...a, price: 2, amount: 200 }, "2026-09-26")?.percent,
    ).toBe(0);
    expect(
      comparePrices(a, { ...a, currency: "CAD" }, "2026-09-26"),
    ).toBeNull();
    expect(
      comparePrices(a, { ...a, date: "2026-08-01" }, "2026-09-26"),
    ).toBeNull();
    expect(
      comparePrices(a, { ...a, confirmed: false }, "2026-09-26"),
    ).toBeNull();
  });
  it("adds a swap once without touching groceries or intake", () => {
    const entry = {
      id: "swap:1",
      name: "Alternative beans",
      quantity: "1 can",
      checked: false,
      createdAt: "2026-09-26",
    };
    expect(addShoppingItem(addShoppingItem([], entry), entry)).toEqual([entry]);
  });
});
