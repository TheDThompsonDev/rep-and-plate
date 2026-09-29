import { describe, expect, it } from "vitest";
import { modelAnswerSchema, normalizeAnswer } from "./ai";
import { requestFixture } from "../tests/ai-fixtures";

const answer = () =>
  modelAnswerSchema.parse({
    purchase: null,
    recipePortionProposal: null,
    suggestedAction: null,
    preferenceProposal: null,
    reply: "Spot Check: are these the completed sets?",
    intent: "conversation",
    store: null,
    receiptNote: "",
    items: [],
    meal: null,
    sources: [],
    workout: {
      title: "Bench session",
      day: "2026-09-25",
      note: "As reported.",
      exercises: [{ name: "Bench Press", weight: 185, reps: [5, 5, 5] }],
    },
  });
describe("Spot proposal boundaries", () => {
  it("returns reviewed training separately from food and holds it when intent conflicts", () => {
    const req = { ...requestFixture(), text: "Bench 185 3x5" };
    const result = normalizeAnswer(answer(), req, new Map());
    expect(result.workout?.exercises[0].reps).toEqual([5, 5, 5]);
    expect(result.meal).toBeNull();
    expect(result.receipt).toBeNull();
    expect(result.suggestedAction).toBeNull();
    expect(
      normalizeAnswer(answer(), req, new Map(), {
        choice: "meal",
        confidence: 0.99,
      }).workout,
    ).toBeNull();
  });
  it("keeps an explicit past meal date and holds impossible or future dates", () => {
    const meal = {
      title: "Oats",
      category: "Breakfast" as const,
      portion: "One bowl",
      note: "",
      calories: 300,
      protein: 10,
      carbs: 45,
      fat: 8,
      sources: [],
      components: null,
      day: "2026-09-24",
    };
    const a = { ...answer(), intent: "meal" as const, workout: null, meal };
    expect(normalizeAnswer(a, requestFixture(), new Map()).meal?.day).toBe(
      "2026-09-24",
    );
    for (const day of ["2026-02-30", "2999-01-01", "bad"])
      expect(
        normalizeAnswer(
          { ...a, meal: { ...meal, day } },
          requestFixture(),
          new Map(),
        ).meal,
      ).toBeNull();
  });
});
