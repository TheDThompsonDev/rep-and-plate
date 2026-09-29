import { describe, expect, it } from "vitest";
import { initialState, stateSchema } from "./domain";
import {
  adjustWorkoutExercise,
  recordSet,
  startPlan,
  type ExerciseAdjustment,
} from "./workouts";

const started = () =>
  startPlan({ ...initialState().workout, status: "ready" }, "upper");
const change: ExerciseAdjustment = {
  name: "Dumbbell Floor Press",
  weight: 40,
  target: 10,
  setCount: 4,
};

describe("active workout adjustments", () => {
  it("permits a deliberate substitution before logging and clears unrelated past reps", () => {
    const workout = started();
    const adjusted = adjustWorkoutExercise(workout, 0, change);
    expect(adjusted.exercises[0]).toMatchObject({
      name: change.name,
      weight: 40,
      target: 10,
      previous: [],
      sets: [null, null, null, null],
    });
    expect(workout.exercises[0].name).toBe("Bench Press");
    expect(adjusted.exercises[1]).toBe(workout.exercises[1]);
    expect(adjusted.startedAt).toBe(workout.startedAt);
    const logged = recordSet(adjusted, 0, 0, 9);
    expect(logged.exercises[0].sets).toEqual([9, null, null, null]);
    expect(logged.conversation?.at(-1)?.text).toContain(
      "Dumbbell Floor Press, set 1: 40 lb × 9 reps",
    );
  });
  it("preserves recorded work when adding sets and changing future targets", () => {
    const logged = recordSet(
      adjustWorkoutExercise(started(), 0, change),
      0,
      0,
      9,
    );
    const expanded = adjustWorkoutExercise(logged, 0, {
      ...change,
      setCount: 5,
      target: 12,
    });
    expect(expanded.exercises[0].sets).toEqual([9, null, null, null, null]);
    expect(expanded.conversation).toBe(logged.conversation);
    expect(expanded.exercises[0].weight).toBe(40);
    const reloaded = stateSchema.parse({
      ...initialState(),
      workout: expanded,
    });
    expect(reloaded.workout.exercises[0].sets[0]).toBe(9);
    expect(() =>
      adjustWorkoutExercise(logged, 0, { ...change, name: "Push-up" }),
    ).toThrow(/recorded sets/);
    expect(() =>
      adjustWorkoutExercise(logged, 0, { ...change, weight: 45 }),
    ).toThrow(/recorded sets/);
  });
  it("never truncates a logged position, including zero reps or a gap", () => {
    const recorded = recordSet(started(), 0, 2, 0);
    const same = { name: "Bench Press", weight: 185, target: 8, setCount: 2 };
    expect(() => adjustWorkoutExercise(recorded, 0, same)).toThrow(
      /every recorded set/,
    );
    expect(() =>
      adjustWorkoutExercise(recorded, 0, { ...same, setCount: 3, weight: 190 }),
    ).toThrow(/recorded sets/);
    expect(
      adjustWorkoutExercise(recorded, 0, { ...same, setCount: 4 }).exercises[0]
        .sets,
    ).toEqual([null, null, 0, null]);
    const trailing = recordSet(started(), 0, 0, 8);
    expect(
      adjustWorkoutExercise(trailing, 0, { ...same, setCount: 1 }).exercises[0]
        .sets,
    ).toEqual([8]);
  });
  it.each([
    { setCount: 0 },
    { setCount: 11 },
    { setCount: 1.5 },
    { target: 0 },
    { target: 101 },
    { target: 1.5 },
    { weight: -1 },
    { weight: 2001 },
    { weight: NaN },
    { name: " " },
    { name: "a".repeat(101) },
  ])("rejects invalid adjustment %j", (invalid) => {
    expect(() =>
      adjustWorkoutExercise(started(), 0, { ...change, ...invalid }),
    ).toThrow();
  });
  it("accepts boundary values and refuses stale finished or missing exercise edits", () => {
    const workout = started();
    expect(
      adjustWorkoutExercise(workout, 0, {
        ...change,
        weight: 0,
        target: 1,
        setCount: 1,
      }).exercises[0].weight,
    ).toBe(0);
    expect(
      adjustWorkoutExercise(workout, 0, {
        ...change,
        weight: 2000,
        target: 100,
        setCount: 10,
      }).exercises[0].sets,
    ).toHaveLength(10);
    expect(() =>
      adjustWorkoutExercise({ ...workout, status: "finished" }, 0, change),
    ).toThrow(/no longer active/);
    expect(() => adjustWorkoutExercise(workout, 200, change)).toThrow(
      /no longer active/,
    );
  });
});
