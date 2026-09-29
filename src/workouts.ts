import { clockTime, id, type AppState, type Exercise } from "./domain";

export type Workout = AppState["workout"];
export type ExerciseAdjustment = {
  name: string;
  weight: number;
  target: number;
  setCount: number;
};

/** Changes the remaining prescription without rewriting performed work. */
export function adjustWorkoutExercise(
  workout: Workout,
  exerciseIndex: number,
  adjustment: ExerciseAdjustment,
): Workout {
  const current = workout.exercises[exerciseIndex];
  if (
    workout.status !== "active" ||
    !Number.isInteger(exerciseIndex) ||
    !current
  )
    throw new Error(
      "This exercise is no longer active. Open your current workout to adjust it.",
    );
  const name = adjustment.name.trim();
  if (!name || name.length > 100)
    throw new Error("Enter an exercise name with up to 100 characters.");
  if (
    !Number.isFinite(adjustment.weight) ||
    adjustment.weight < 0 ||
    adjustment.weight > 2000
  )
    throw new Error("Choose a weight between 0 and 2,000 lb.");
  if (
    !Number.isInteger(adjustment.target) ||
    adjustment.target < 1 ||
    adjustment.target > 100
  )
    throw new Error("Choose a target from 1 to 100 reps.");
  if (
    !Number.isInteger(adjustment.setCount) ||
    adjustment.setCount < 1 ||
    adjustment.setCount > 10
  )
    throw new Error("Choose between 1 and 10 sets.");
  const hasRecorded = current.sets.some((reps) => reps !== null);
  if (
    hasRecorded &&
    (name !== current.name || adjustment.weight !== current.weight)
  )
    throw new Error(
      "This exercise has recorded sets. Keep its name and weight to preserve what you already did.",
    );
  if (current.sets.slice(adjustment.setCount).some((reps) => reps !== null))
    throw new Error(
      "Keep every recorded set. You can only remove unrecorded sets from the end.",
    );
  const changedIdentity =
    name !== current.name || adjustment.weight !== current.weight;
  return {
    ...workout,
    exercises: workout.exercises.map((exercise, index) =>
      index !== exerciseIndex
        ? exercise
        : {
            ...exercise,
            name,
            weight: adjustment.weight,
            target: adjustment.target,
            previous: changedIdentity ? [] : exercise.previous,
            sets: Array.from(
              { length: adjustment.setCount },
              (_, set) => exercise.sets[set] ?? null,
            ),
          },
    ),
  };
}
const exercise = (
  name: string,
  weight: number,
  target: number,
  previous: number[] = [],
): Exercise => ({ name, weight, target, previous, sets: [null, null, null] });
export const workoutPlans = [
  {
    id: "upper",
    title: "Upper Body",
    minutes: 42,
    description: "A balanced session for your chest, back, and arms.",
    exercises: [
      exercise("Bench Press", 185, 8, [8, 8, 7]),
      exercise("Incline Dumbbell Press", 60, 10, [10, 10, 9]),
      exercise("Seated Cable Row", 120, 12, [12, 11, 10]),
      exercise("Triceps Pushdown", 50, 12, [12, 12, 12]),
    ],
  },
  {
    id: "lower",
    title: "Lower Body",
    minutes: 35,
    description: "Build your session around legs and glutes.",
    exercises: [
      exercise("Goblet Squat", 35, 10),
      exercise("Dumbbell Romanian Deadlift", 30, 10),
      exercise("Reverse Lunge", 20, 10),
      exercise("Standing Calf Raise", 0, 15),
    ],
  },
  {
    id: "full",
    title: "Full Body",
    minutes: 30,
    description: "A little of everything, with room in your day.",
    exercises: [
      exercise("Goblet Squat", 35, 10),
      exercise("Bench Press", 135, 10),
      exercise("Seated Cable Row", 100, 12),
    ],
  },
];
export function startPlan(workout: Workout, planId: string): Workout {
  if (workout.status === "active") return workout;
  const plan = workoutPlans.find((p) => p.id === planId) ?? workoutPlans[0];
  const history = [...(workout.history ?? [])];
  if (workout.startedAt)
    history.push({
      title: workout.title ?? "Upper Body",
      exercises: workout.exercises,
      startedAt: workout.startedAt,
      finishedAt: workout.finishedAt,
    });
  return {
    status: "active",
    planId: plan.id,
    title: plan.title,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    exercises: plan.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.map(() => null),
    })),
    history,
    conversation: [],
  };
}
export function recordSet(
  workout: Workout,
  exerciseIndex: number,
  setIndex: number,
  reps: number,
  text = `Got ${reps}`,
): Workout {
  const ex = workout.exercises[exerciseIndex];
  if (
    workout.status !== "active" ||
    !ex ||
    setIndex < 0 ||
    setIndex >= ex.sets.length ||
    !Number.isInteger(reps) ||
    reps < 0 ||
    reps > 100
  )
    return workout;
  const correction = ex.sets[setIndex] !== null;
  return {
    ...workout,
    exercises: workout.exercises.map((item, i) =>
      i === exerciseIndex
        ? {
            ...item,
            sets: item.sets.map((value, j) => (j === setIndex ? reps : value)),
          }
        : item,
    ),
    conversation: [
      ...(workout.conversation ?? []),
      { id: id(), role: "user", text, time: clockTime(), exerciseIndex },
      {
        id: id(),
        role: "assistant",
        text: `${correction ? "Updated" : "Got it"}. ${ex.name}, set ${setIndex + 1}: ${ex.weight ? `${ex.weight} lb × ` : ""}${reps} reps.`,
        time: clockTime(),
        exerciseIndex,
      },
    ],
  };
}
export function replyToWorkout(workout: Workout, text: string): Workout {
  const exIndex = workout.exercises.findIndex((ex) =>
    ex.sets.some((r) => r === null),
  );
  const match = text
    .trim()
    .match(/^(?:got |did |i got |i did )?(\d{1,3})(?: reps)?[.!]?$/i);
  if (match && exIndex >= 0 && Number(match[1]) <= 100)
    return recordSet(
      workout,
      exIndex,
      workout.exercises[exIndex].sets.indexOf(null),
      Number(match[1]),
      text,
    );
  const correction = text
    .trim()
    .match(
      /^(?:actually |change |edit )?set (\d+) (?:was|to) (\d{1,3})(?: reps)?[.!]?$/i,
    );
  const lastIndex =
    workout.conversation?.filter((m) => m.exerciseIndex !== undefined).at(-1)
      ?.exerciseIndex ?? exIndex;
  if (
    correction &&
    lastIndex >= 0 &&
    Number(correction[1]) >= 1 &&
    Number(correction[1]) <= workout.exercises[lastIndex].sets.length &&
    Number(correction[2]) <= 100
  )
    return recordSet(
      workout,
      lastIndex,
      Number(correction[1]) - 1,
      Number(correction[2]),
      text,
    );
  return {
    ...workout,
    conversation: [
      ...(workout.conversation ?? []),
      { id: id(), role: "user", text, time: clockTime() },
      {
        id: id(),
        role: "assistant",
        text:
          exIndex < 0
            ? "All your planned sets are recorded. Tap Finish workout to save this session."
            : "Tell me the reps for your next set, like “Got 8”. To correct your last exercise, say “Set 2 was 7”. You can also tap a recorded set to edit it.",
        time: clockTime(),
      },
    ],
  };
}
export function workoutPhoto(name: string) {
  if (name === "Bench Press") return 1;
  if (name === "Incline Dumbbell Press") return 2;
  if (name.includes("Row")) return 3;
  if (name.includes("Triceps")) return 4;
  if (name.includes("Squat") || name.includes("Lunge")) return 5;
  return 0;
}
