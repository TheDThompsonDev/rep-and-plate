import { describe, expect, it } from "vitest";
import { initialState, stateSchema } from "../../domain";
import { applyAIResult } from "../../ai-client";
import { resultFixture } from "../../../tests/ai-fixtures";
import { firstWeekSteps } from "../planning/first-week";
import {
  receiptReadiness,
  receiptSourcePhoto,
  saveReceiptCapture,
  upgradeSavedReceiptCaptures,
} from "./journey";

describe("receipt journey boundaries", () => {
  it("retains intent and context across serialization and resolves only on extraction", () => {
    const before = initialState();
    const saved = stateSchema.parse(
      saveReceiptCapture(
        before,
        "data:image/png;base64,YQ==",
        "trip.png",
        "For two people",
      ),
    );
    const capture = saved.messages.at(-1)!;
    expect(capture.text).toContain("For two people");
    expect(saved.meals).toEqual(before.meals);
    expect(saved.groceries).toEqual(before.groceries);
    const uncertain = applyAIResult(saved, {
      ...resultFixture(capture.id),
      receipt: null,
      decision: "uncertain",
    });
    expect(uncertain.reviews[0].resolved).toBe(false);
    const extracted = applyAIResult(saved, resultFixture(capture.id));
    expect(extracted.reviews[0]).toMatchObject({
      resolved: true,
      answer: "Groceries extracted",
    });
    expect(extracted.groceries).toHaveLength(1);
    expect(extracted.meals).toEqual(before.meals);
    expect(receiptSourcePhoto(extracted, extracted.groceries![0].id)).toBe(
      "data:image/png;base64,YQ==",
    );
    expect(applyAIResult(extracted, resultFixture(capture.id))).toEqual(
      extracted,
    );
  });
  it("does not count used, empty or unknown-amount stock as meal-ready", () => {
    const state = initialState();
    const receipt = resultFixture("readiness").receipt!;
    receipt.items[1].availability = "used";
    state.groceries = [receipt];
    expect(receiptReadiness(state)).toEqual({
      ready: 1,
      checks: 0,
      available: 1,
    });
    expect(firstWeekSteps(state).find((s) => s.key === "pantry")?.done).toBe(
      true,
    );
    receipt.items[0].servingsPurchased = null;
    expect(receiptReadiness(state)).toEqual({
      ready: 0,
      checks: 1,
      available: 1,
    });
  });
  it("upgrades older saved receipt photos once without changing generic notes", () => {
    const state = initialState();
    state.reviews = [
      {
        id: "old",
        kind: "capture",
        resolved: false,
        question: "Your grocery receipt is saved for review.",
        title: "Receipt",
        source: "Image",
        image: "original-photo",
        options: ["Keep as a note"],
      },
      {
        id: "generic",
        kind: "capture",
        resolved: false,
        question: "Your image is saved.",
        title: "Photo",
        source: "Image",
        image: "other-photo",
        options: ["Keep as a note"],
      },
    ];
    const next = upgradeSavedReceiptCaptures(state);
    expect(
      next.messages.filter((m) => m.captureIntent === "receipt"),
    ).toHaveLength(1);
    expect(next.messages.at(-1)).toMatchObject({
      captureReviewId: "old",
      image: "original-photo",
    });
    expect(upgradeSavedReceiptCaptures(next)).toBe(next);
    expect(next.reviews).toEqual(state.reviews);
  });
});
