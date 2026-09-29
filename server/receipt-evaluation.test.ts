import { describe, expect, it } from "vitest";
import { receiptTruthSchema, scoreReceipt } from "./receipt-evaluation";
import { resultFixture } from "../tests/ai-fixtures";

describe("receipt evaluation evidence", () => {
  it("counts missing and extra lines without accepting a duplicate as two matches", () => {
    const result = resultFixture("fixture");
    const expected = receiptTruthSchema.parse({
      items: [
        { receiptText: "WHOLE MILK 1GAL" },
        { receiptText: "WHOLE MILK 1GAL" },
      ],
    });
    expect(scoreReceipt(expected, result)).toMatchObject({
      matchedLines: 1,
      missedLines: 1,
      extraLines: 1,
    });
  });
  it("measures only annotated fields and keeps unknown nutrition distinct from zero", () => {
    const expected = receiptTruthSchema.parse({
      items: [
        { receiptText: "whole milk 1gal", nutrition: null, needsReview: true },
        { receiptText: "OATS" },
      ],
    });
    const score = scoreReceipt(expected, resultFixture("fixture"));
    expect(score).toMatchObject({
      matchedLines: 2,
      unsupportedNutrition: 1,
      reviewMisses: 1,
      fields: { checked: 2, correct: 0 },
      nutrition: { checked: 0, correct: 0 },
    });
  });
  it("does not report a failed extraction as accurate on annotated rows", () => {
    const expected = receiptTruthSchema.parse({
      store: "Kroger",
      items: [
        {
          receiptText: "OATS",
          quantity: "1 package",
          serving: "100 g",
          nutrition: { calories: 100, protein: 1, carbs: 2, fat: 3 },
        },
      ],
    });
    const result = {
      ...resultFixture("fixture"),
      receipt: null,
      decision: "uncertain" as const,
    };
    expect(scoreReceipt(expected, result)).toMatchObject({
      receiptReturned: false,
      correctPurchaseIntent: false,
      matchedLines: 0,
      fields: { checked: 3, correct: 0 },
      nutrition: { checked: 4, correct: 0 },
    });
  });
});
