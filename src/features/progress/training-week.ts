import type { AppState } from "../../domain.ts";
import { startSessionTemplate } from "../../workouts.ts";
import { completedWorkoutHistory } from "../workout-planning/history.ts";
import type { TrainingProgram } from "./training-program.ts";

/** Renderer-side helpers. They depend on workouts.ts (and so on app state), which is why
 * they live apart from the schema module that domain.ts imports. */

/** The next session is the one after the finished program sessions since the program began.
 * Only finished sessions carrying a program title count; starter plans and AI workouts do not. */
export function nextProgramSession(program: TrainingProgram, workout: AppState["workout"]) {
  const titles = new Set(program.sessions.map((session) => session.title));
  const finished = completedWorkoutHistory(workout).filter(
    (session) => titles.has(session.title) && session.finishedAt.slice(0, 10) >= program.startedOn,
  ).length;
  return { index: finished % program.sessions.length, finished };
}

/** Starts a program session exactly like a starter plan: empty sets and loads the user confirms. */
export function startProgramSession(
  workout: AppState["workout"],
  program: TrainingProgram,
  index: number,
): AppState["workout"] {
  const session = program.sessions[index];
  if (!session || !Number.isInteger(index)) throw Error("That session is not part of your week.");
  return startSessionTemplate(workout, {
    planId: session.planId,
    title: session.title,
    exercises: session.exercises.map((exercise) => ({
      name: exercise.name,
      weight: 0,
      weightConfirmed: false,
      target: exercise.target,
      previous: [],
      sets: Array.from({ length: exercise.sets }, () => null),
    })),
  });
}
