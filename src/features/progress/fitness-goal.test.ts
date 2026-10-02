import { expect, it } from "vitest";
import { initialState } from "../../domain";
import {
  applyFitnessSetup,
  convertSetupUnit,
  parseFitnessSetup,
  weightCheckIn,
} from "./fitness-goal";
import { buildAIRequest } from "../../ai-client";
import { aiRequestSchema } from "../../ai-contract";

const input = {
  kind: "lose",
  currentWeight: "82.5",
  targetWeight: "78",
  unit: "kg",
  cadence: "weekly",
} as const;
it("saves a real starting measurement and goal together without inventing food targets", () => {
  const before = initialState();
  const next = applyFitnessSetup(
    before,
    input,
    "2026-10-01",
    "starting-weight",
  );
  expect(next.profile.fitnessGoal).toEqual({
    kind: "lose",
    targetWeight: 78,
    unit: "kg",
    cadence: "weekly",
  });
  expect(next.bodyWeights).toEqual([
    { id: "starting-weight", day: "2026-10-01", value: 82.5, unit: "kg" },
  ]);
  expect(next.profile.calories).toBe(before.profile.calories);
  expect(next.meals).toEqual(before.meals);
  expect(before.bodyWeights).toBeUndefined();
  expect(
    applyFitnessSetup(next, input, "2026-10-01", "starting-weight").bodyWeights,
  ).toHaveLength(1);
});
it("rejects invalid measurements and contradictory targets while allowing nonweight goals", () => {
  expect(() => parseFitnessSetup({ ...input, currentWeight: "0" })).toThrow();
  expect(() => parseFitnessSetup({ ...input, targetWeight: "90" })).toThrow(
    /below/,
  );
  expect(() =>
    parseFitnessSetup({ ...input, kind: "gain", targetWeight: "70" }),
  ).toThrow(/above/);
  expect(() => parseFitnessSetup({ ...input, currentWeight: "" })).toThrow(
    /current weight/,
  );
  expect(
    parseFitnessSetup({
      ...input,
      kind: "strength",
      currentWeight: "",
      targetWeight: "",
    }).goal.targetWeight,
  ).toBeUndefined();
});
it("keeps existing same-day measurements and bases check-ins on real measurement dates", () => {
  const state = applyFitnessSetup(
    initialState(),
    input,
    "2026-10-01",
    "original",
  );
  expect(() => applyFitnessSetup(state, input, "2026-10-01", "new")).toThrow(
    /already saved/,
  );
  expect(
    weightCheckIn(
      state.bodyWeights ?? [],
      state.profile.fitnessGoal,
      "2026-10-07",
    ),
  ).toMatchObject({ due: false, nextDay: "2026-10-08" });
  expect(
    weightCheckIn(
      state.bodyWeights ?? [],
      state.profile.fitnessGoal,
      "2026-10-08",
    ),
  ).toMatchObject({ due: true });
  expect(
    weightCheckIn(
      [],
      { ...state.profile.fitnessGoal!, cadence: "none" },
      "2026-10-01",
    ).due,
  ).toBe(false);
});
it("converts entered units and retains goals plus real weight context through the AI contract", () => {
  expect(
    convertSetupUnit(
      { ...input, currentWeight: "100", targetWeight: "90", unit: "lb" },
      "kg",
    ),
  ).toMatchObject({ currentWeight: "45.36", targetWeight: "40.82" });
  const state = applyFitnessSetup(initialState(), input, "2020-10-01", "first");
  const request = aiRequestSchema.parse(
    buildAIRequest(state, {
      id: "11111111-1111-4111-8111-111111111111",
      role: "user",
      text: "What is my goal?",
      time: "12:00 PM",
    }),
  );
  expect(request.context.fitnessGoal).toEqual(state.profile.fitnessGoal);
  expect(request.context.bodyWeights).toEqual(state.bodyWeights);
  const edited = applyFitnessSetup(
    state,
    { ...input, currentWeight: "", targetWeight: "77", cadence: "daily" },
    "2020-10-02",
    "unused",
  );
  expect(edited.bodyWeights).toEqual(state.bodyWeights);
  expect(edited.profile.fitnessGoal).toMatchObject({
    targetWeight: 77,
    cadence: "daily",
  });
});
