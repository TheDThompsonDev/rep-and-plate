import type { AIRequest, AIResult } from "../src/ai-contract";
export const requestFixture = (): AIRequest => ({
  requestId: crypto.randomUUID(),
  text: "These are groceries I bought.",
  day: "2026-09-25",
  history: [],
  context: {
    goals: { calories: 2000, protein: 110, carbs: 250, fat: 78 },
    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    meals: [],
    groceries: [],
    workout: "No active workout",
  },
});
export const resultFixture = (requestId: string): AIResult => ({
  requestId,
  reply:
    "I found milk and oats on your receipt. Milk has a possible product match; the oats need a clearer size.",
  decision: "grocery",
  meal: null,
  warnings: ["Check the product matches."],
  sources: [
    {
      title: "Product nutrition",
      url: "https://www.kroger.com/p/test-product/0001111040101",
    },
  ],
  receipt: {
    id: requestId,
    fingerprint: "test-receipt-fingerprint",
    store: "Kroger",
    date: "2026-09-25",
    note: "Keep these groceries separate from meals eaten.",
    sources: [],
    items: [
      {
        id: `${requestId}-0`,
        receiptText: "WHOLE MILK 1GAL",
        name: "Whole milk",
        quantity: "1 gallon",
        serving: "1 cup (240 ml)",
        servingsPurchased: 16,
        nutrition: { calories: 150, protein: 8, carbs: 12, fat: 8 },
        match: "exact",
        note: "Check the package label.",
        sources: [
          {
            title: "Milk nutrition",
            url: "https://www.kroger.com/p/test-product/0001111040101",
          },
        ],
        needsReview: false,
        availability: "available",
      },
      {
        id: `${requestId}-1`,
        receiptText: "OATS",
        name: "Oats",
        quantity: "1 package",
        serving: "Unknown",
        servingsPurchased: null,
        nutrition: null,
        match: "unresolved",
        note: "The receipt does not identify the brand or size.",
        sources: [],
        needsReview: true,
        availability: "available",
      },
    ],
  },
});
