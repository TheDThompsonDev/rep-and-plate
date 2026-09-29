import { describe, it, expect } from "vitest";
import { initialState, stateSchema } from "../../domain";
import { bodyWeightTrend, saveBodyWeight } from "./body-weight";
import { setLoad, setWorkoutLoad } from "./set-loads";
import { recordSet, startPlan } from "../../workouts";
import { completedWorkoutContext } from "../workout-planning/history";
describe("optional body measurements", () => {
  it("saves edits by identity and computes change only from actual dated values", () => {
    const first = {
      id: "a",
      day: "2026-09-01",
      value: 100,
      unit: "kg" as const,
    };
    const entries = saveBodyWeight(
      [first],
      { id: "b", day: "2026-09-29", value: 220.462262, unit: "lb" },
      "2026-09-29",
    );
    expect(bodyWeightTrend(entries, "kg", "2026-09-29").change).toBe(0);
    const edited = saveBodyWeight(
      entries,
      { ...first, value: 101 },
      "2026-09-29",
    );
    expect(edited).toHaveLength(2);
    expect(bodyWeightTrend(edited, "kg", "2026-09-29").change).toBe(-1);
    expect(bodyWeightTrend([first], "kg", "2026-09-29").change).toBeNull();
    expect(
      bodyWeightTrend(
        [...entries, { ...first, id: "future", day: "2027-01-01", value: 200 }],
        "kg",
        "2026-09-29",
      ).change,
    ).toBe(0);
  });
  it("rejects invalid values, calendar dates, future dates and duplicate-date insertions", () => {
    const entry = {
      id: "a",
      day: "2026-09-29",
      value: 150,
      unit: "lb" as const,
    };
    for (const changed of [
      { ...entry, value: 0 },
      { ...entry, value: NaN },
      { ...entry, day: "2026-02-30" },
      { ...entry, day: "2026-09-30" },
    ])
      expect(() => saveBodyWeight([], changed, "2026-09-29")).toThrow();
    expect(() =>
      saveBodyWeight([entry], { ...entry, id: "b" }, "2026-09-29"),
    ).toThrow("Edit");
    expect(
      stateSchema.parse({ ...initialState(), bodyWeights: [entry] }).profile,
    ).toEqual(initialState().profile);
  });
});
describe("loads for individual sets", () => {
  it("records varying loads, preserves legacy completed sets, and corrects only the selected set", () => {
    const original = startPlan(initialState().workout, "upper");
    original.exercises[0].weight = 100;
    original.exercises[0].sets[0] = 8; // Existing records predate per-set weights.
    expect(setLoad(original.exercises[0], 0)).toBe(100);
    const second = setWorkoutLoad(original, 0, 1, 110);
    const logged = recordSet(second, 0, 1, 7);
    expect(logged.exercises[0].setWeights).toEqual([100, 110, null]);
    const corrected = setWorkoutLoad(logged, 0, 1, 105);
    expect(corrected.exercises[0].setWeights).toEqual([100, 105, null]);
    expect(original.exercises[0].setWeights).toBeUndefined();
    const finished = {
      ...corrected,
      status: "finished" as const,
      finishedAt: new Date().toISOString(),
    };
    expect(completedWorkoutContext(finished)[0].exercises[0]).toMatchObject({
      sets: [8, 7],
      setWeights: [100, 105],
    });
  });
  it("retains legacy behavior and rejects invalid loads without changing history", () => {
    const workout = startPlan(initialState().workout, "upper");
    for (const weight of [-1, Infinity, 2001])
      expect(() => setWorkoutLoad(workout, 0, 0, weight)).toThrow();
    expect(() =>
      setWorkoutLoad({ ...workout, status: "finished" }, 0, 0, 100),
    ).toThrow();
    expect(setLoad({ weight: 80 }, 0)).toBe(80);
    expect(setLoad({ weight: 80, setWeights: [0] }, 0)).toBe(0);
  });
});
