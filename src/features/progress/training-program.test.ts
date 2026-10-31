import { describe, expect, it } from "vitest";
import {
  deriveTrainingProgram,
  programEquipmentText,
  trainingProgramSchema,
  clearTrainingProgram,
} from "./training-program";
import { nextProgramSession, startProgramSession } from "./training-week";
import { applyFitnessSetup, emptyFitnessSetup, fitnessDraft, parseFitnessSetup } from "./fitness-goal";
import { initialState, parseStoredState, type AppState } from "../../domain";
import { workoutPlans, finishWorkout, recordSet } from "../../workouts";
import { setWorkoutLoad } from "./set-loads";
import { parseDraft } from "../onboarding/draft";

const machineOrBarbell = ["Bench Press", "Seated Cable Row", "Triceps Pushdown"];

describe("training program derivation", () => {
  it("builds a week from the starter plans, filtered to the chosen equipment, with unconfirmed loads", () => {
    const program = deriveTrainingProgram(
      { daysPerWeek: 3, equipment: ["dumbbells"], experience: "some" },
      "2026-10-10",
    );
    expect(trainingProgramSchema.parse(program)).toEqual(program);
    expect(program.sessions.map((session) => session.planId)).toEqual(["upper", "lower", "full"]);
    expect(program.sessions.map((session) => session.title)).toEqual([
      "Session 1 · Upper Body",
      "Session 2 · Lower Body",
      "Session 3 · Full Body",
    ]);
    expect(program.equipment).toEqual(["bodyweight", "dumbbells"]);
    const names = program.sessions.flatMap((session) => session.exercises.map((exercise) => exercise.name));
    for (const name of machineOrBarbell) expect(names).not.toContain(name);
    expect(names).toContain("Dumbbell Bench Press");
    expect(names).toContain("Dumbbell Row");
    expect(names).toContain("Goblet Squat");
    expect(program.sessions[0].exercises.every((exercise) => exercise.sets === 3)).toBe(true);
    expect(program.sessions[0].exercises.map((exercise) => exercise.target)).toEqual(
      workoutPlans[0].exercises.map((exercise) => exercise.target),
    );
    expect(programEquipmentText(program)).toBe("Bodyweight · Dumbbells");
  });
  it("keeps the original exercises when the equipment is available and never stores a load", () => {
    const program = deriveTrainingProgram(
      { daysPerWeek: 4, equipment: ["barbell", "machines", "dumbbells"], experience: "experienced" },
      "2026-10-10",
    );
    expect(program.sessions.map((session) => session.planId)).toEqual(["upper", "lower", "upper", "lower"]);
    expect(program.sessions[0].exercises.map((exercise) => exercise.name)).toEqual(
      workoutPlans[0].exercises.map((exercise) => exercise.name),
    );
    for (const session of program.sessions)
      for (const exercise of session.exercises)
        expect(Object.keys(exercise).sort()).toEqual(["name", "sets", "target"]);
  });
  it("uses bodyweight substitutes and two sets for someone new with no equipment", () => {
    const program = deriveTrainingProgram({ daysPerWeek: 2, equipment: [], experience: "new" }, "2026-10-10");
    expect(program.equipment).toEqual(["bodyweight"]);
    expect(program.sessions.map((session) => session.planId)).toEqual(["full", "full"]);
    expect(program.sessions[0].exercises.map((exercise) => exercise.name)).toEqual([
      "Bodyweight Squat",
      "Push-Up",
      "Prone Back Extension",
    ]);
    expect(program.sessions[0].exercises.every((exercise) => exercise.sets === 2)).toBe(true);
    const sixDays = deriveTrainingProgram({ daysPerWeek: 6, equipment: ["bands"] }, "2026-10-10");
    expect(sixDays.sessions).toHaveLength(6);
    expect(sixDays.experience).toBeUndefined();
    expect(sixDays.sessions[0].exercises.every((exercise) => exercise.sets === 2)).toBe(true);
    expect(() => deriveTrainingProgram({ daysPerWeek: 7, equipment: [] }, "2026-10-10")).toThrow();
  });
});

describe("starting and advancing program sessions", () => {
  const program = deriveTrainingProgram(
    { daysPerWeek: 3, equipment: ["dumbbells"], experience: "some" },
    "2026-10-01",
  );
  it("starts the next session with empty sets and loads the user must confirm", () => {
    const state = initialState();
    const started = startProgramSession(state.workout, program, 0);
    expect(started.status).toBe("active");
    expect(started.title).toBe("Session 1 · Upper Body");
    expect(started.planId).toBe("upper");
    expect(started.exercises).toHaveLength(4);
    for (const exercise of started.exercises) {
      expect(exercise.weight).toBe(0);
      expect(exercise.weightConfirmed).toBe(false);
      expect(exercise.previous).toEqual([]);
      expect(exercise.sets).toEqual([null, null, null]);
    }
    expect(startProgramSession(started, program, 1)).toBe(started);
    expect(() => startProgramSession(state.workout, program, 3)).toThrow();
  });
  it("advances to the next session only from finished program sessions since the program started", () => {
    const state = initialState();
    expect(nextProgramSession(program, state.workout)).toEqual({ index: 0, finished: 0 });
    let workout = startProgramSession(state.workout, program, 0);
    workout = setWorkoutLoad(workout, 0, 0, 40);
    workout = recordSet(workout, 0, 0, 8);
    expect(nextProgramSession(program, workout)).toEqual({ index: 0, finished: 0 });
    workout = finishWorkout(workout);
    expect(nextProgramSession(program, workout)).toEqual({ index: 1, finished: 1 });
    const older: AppState["workout"] = {
      ...workout,
      history: [
        ...(workout.history ?? []),
        {
          title: "Session 2 · Lower Body",
          startedAt: "2026-09-20T10:00:00.000Z",
          finishedAt: "2026-09-20T11:00:00.000Z",
          exercises: workout.exercises,
        },
        {
          title: "Upper Body",
          startedAt: "2026-10-03T10:00:00.000Z",
          finishedAt: "2026-10-03T11:00:00.000Z",
          exercises: workout.exercises,
        },
      ],
    };
    expect(nextProgramSession(program, older)).toEqual({ index: 1, finished: 1 });
    const wrapped: AppState["workout"] = {
      ...workout,
      history: [1, 2, 3].map((n) => ({
        title: `Session ${n} · ${["Upper Body", "Lower Body", "Full Body"][n - 1]}`,
        startedAt: `2026-10-0${n + 3}T10:00:00.000Z`,
        finishedAt: `2026-10-0${n + 3}T11:00:00.000Z`,
        exercises: workout.exercises,
      })),
    };
    expect(nextProgramSession(program, wrapped)).toEqual({ index: 1, finished: 4 });
  });
});

describe("fitness setup with a training week", () => {
  const goalOnly = { ...emptyFitnessSetup, kind: "strength" as const };
  it("skipping the week preserves the original state and an existing program", () => {
    const before = initialState();
    const skipped = applyFitnessSetup(before, goalOnly, "2026-10-10", "entry");
    expect(skipped.profile.trainingProgram).toBeUndefined();
    expect(skipped.workout).toEqual(before.workout);
    const withProgram = applyFitnessSetup(
      before,
      { ...goalOnly, trainingDays: "3", equipment: ["dumbbells"], experience: "some" },
      "2026-10-10",
      "entry",
    );
    expect(withProgram.profile.trainingProgram?.sessions).toHaveLength(3);
    expect(withProgram.profile.trainingProgram?.startedOn).toBe("2026-10-10");
    expect(withProgram.workout).toEqual(before.workout);
    const resaved = applyFitnessSetup(withProgram, goalOnly, "2026-10-11", "entry-2");
    expect(resaved.profile.trainingProgram).toEqual(withProgram.profile.trainingProgram);
    expect(clearTrainingProgram(withProgram).profile.trainingProgram).toBeUndefined();
    expect(fitnessDraft(withProgram.profile.fitnessGoal, withProgram.profile.trainingProgram)).toMatchObject({
      trainingDays: "3",
      equipment: ["dumbbells"],
      experience: "some",
    });
    expect(fitnessDraft(withProgram.profile.fitnessGoal)).toMatchObject({ trainingDays: "", equipment: [], experience: "" });
  });
  it("rejects out-of-range answers", () => {
    expect(() => parseFitnessSetup({ ...goalOnly, trainingDays: "1" })).toThrow(/2 and 6/);
    expect(() => parseFitnessSetup({ ...goalOnly, trainingDays: "2.5" })).toThrow(/2 and 6/);
    expect(parseFitnessSetup({ ...goalOnly, trainingDays: "6", experience: "" }).program).toMatchObject({ daysPerWeek: 6 });
    expect(parseFitnessSetup(goalOnly).program).toBeUndefined();
  });
  it("parses legacy snapshots without a program and old onboarding drafts", () => {
    const legacy = initialState();
    expect(parseStoredState(JSON.stringify(legacy)).ok).toBe(true);
    const stored = applyFitnessSetup(legacy, { ...goalOnly, trainingDays: "2" }, "2026-10-10", "entry");
    const reparsed = parseStoredState(JSON.stringify(stored));
    expect(reparsed.ok && reparsed.state.profile.trainingProgram).toEqual(stored.profile.trainingProgram);
    expect(
      parseStoredState(
        JSON.stringify({ ...legacy, profile: { ...legacy.profile, trainingProgram: { daysPerWeek: 9 } } }),
      ),
    ).toEqual({ ok: false, reason: "invalid" });
    const oldDraft = parseDraft(
      JSON.stringify({
        version: 1,
        step: "goals",
        slide: 0,
        name: "Alex",
        focus: "A little of all three",
        localMode: true,
        weightEntry: "entry",
        fitness: null,
        fitnessInput: { kind: "habits", unit: "lb", cadence: "weekly", currentWeight: "", targetWeight: "" },
        nutrition: null,
      }),
    );
    expect(oldDraft?.fitnessInput).toMatchObject({ trainingDays: "", equipment: [], experience: "" });
  });
});
