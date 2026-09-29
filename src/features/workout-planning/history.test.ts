import { describe, expect, it } from "vitest";
import { initialState, type AppState } from "../../domain";
import {
  completedWorkoutContext,
  completedWorkoutContextSchema,
  lastExerciseEvidence,
} from "./history";

type Session = NonNullable<AppState["workout"]["history"]>[number];
const session = (day: number, changes: Partial<Session> = {}): Session => ({
  title: "Upper body",
  startedAt: `2026-09-${String(day).padStart(2, "0")}T12:00:00Z`,
  finishedAt: `2026-09-${String(day).padStart(2, "0")}T13:00:00Z`,
  exercises: [
    {
      name: "Bench Press",
      weight: 95,
      target: 8,
      previous: [99, 99, 99],
      sets: [8, null, 6],
    },
  ],
  ...changes,
});

describe("completed workout evidence", () => {
  it("excludes ready presets, unfinished sessions and example histories", () => {
    const workout = initialState().workout;
    expect(completedWorkoutContext(workout)).toEqual([]);
    workout.history = [
      session(20, { finishedAt: null }),
      session(21, { title: "Sample workout" }),
      session(22, {
        exercises: [{ ...session(22).exercises[0], sets: [null, null] }],
      }),
    ];
    expect(completedWorkoutContext(workout)).toEqual([]);
  });
  it("includes actual recorded sets only, never preset previous values or incomplete placeholders", () => {
    const workout = { ...initialState().workout, history: [session(22)] };
    const context = completedWorkoutContext(workout);
    expect(context[0].exercises[0]).toEqual({
      name: "Bench Press",
      weight: 95,
      sets: [8, 6],
    });
    expect(completedWorkoutContextSchema.safeParse(context[0]).success).toBe(
      true,
    );
    expect(JSON.stringify(context)).not.toContain("previous");
    expect(JSON.stringify(context)).not.toContain("99");
  });
  it("includes current finished sessions, deduplicates and limits recent context", () => {
    const workout = {
      ...initialState().workout,
      ...session(25),
      status: "finished" as const,
      history: Array.from({ length: 8 }, (_, i) => session(18 + i)),
    };
    const context = completedWorkoutContext(workout);
    expect(context).toHaveLength(5);
    expect(context.map((entry) => entry.finishedAt.slice(8, 10))).toEqual([
      "25",
      "24",
      "23",
      "22",
      "21",
    ]);
  });
  it("matches exercise identity conservatively and uses latest actual load", () => {
    const workout = {
      ...initialState().workout,
      history: [
        session(23),
        session(24, {
          exercises: [
            { ...session(24).exercises[0], weight: 100, sets: [8, 7] },
          ],
        }),
      ],
    };
    expect(lastExerciseEvidence(workout, "  bench   press ")?.weight).toBe(100);
    expect(lastExerciseEvidence(workout, "Incline Bench Press")).toBeNull();
    expect(lastExerciseEvidence(workout, "")).toBeNull();
  });
  it("rejects malformed session dates and filters invalid recorded weights and reps", () => {
    const workout = {
      ...initialState().workout,
      history: [
        session(23, { startedAt: "bad" }),
        session(24, { finishedAt: "2026-09-20T10:00:00Z" }),
        session(25, {
          exercises: [
            { ...session(25).exercises[0], weight: NaN },
            {
              ...session(25).exercises[0],
              name: "Push-up",
              weight: 0,
              sets: [0, 10, -1, 101, 1.2],
            },
          ],
        }),
      ],
    };
    expect(completedWorkoutContext(workout)[0].exercises).toEqual([
      { name: "Push-up", weight: 0, sets: [0, 10] },
    ]);
    expect(completedWorkoutContext(workout)).toHaveLength(1);
  });
});
