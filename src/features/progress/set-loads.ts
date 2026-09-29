import type { Exercise, AppState } from "../../domain.ts";
export function setLoad(
  exercise: Pick<Exercise, "weight" | "setWeights">,
  index: number,
) {
  return exercise.setWeights?.[index] ?? exercise.weight;
}
/** Preserve every completed legacy set before changing one load. */
export function setWorkoutLoad(
  workout: AppState["workout"],
  exerciseIndex: number,
  setIndex: number,
  weight: number,
): AppState["workout"] {
  const exercise = workout.exercises[exerciseIndex];
  if (
    workout.status !== "active" ||
    !exercise ||
    !Number.isInteger(setIndex) ||
    setIndex < 0 ||
    setIndex >= exercise.sets.length ||
    !Number.isFinite(weight) ||
    weight < 0 ||
    weight > 2000
  )
    throw new Error(
      "Choose a set load between 0 and 2,000 lb in your active workout.",
    );
  return {
    ...workout,
    exercises: workout.exercises.map((item, index) =>
      index === exerciseIndex
        ? {
            ...item,
            setWeights: item.sets.map((reps, i) =>
              i === setIndex
                ? weight
                : (item.setWeights?.[i] ??
                  (reps === null ? null : item.weight)),
            ),
          }
        : item,
    ),
  };
}
export function recordedLoads(
  exercise: Pick<Exercise, "weight" | "setWeights" | "sets">,
) {
  return exercise.sets
    .map((reps, index) =>
      reps === null ? null : `${setLoad(exercise, index)} lb × ${reps}`,
    )
    .filter(Boolean)
    .join(", ");
}
