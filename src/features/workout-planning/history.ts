import { z } from "zod";
import type { AppState } from "../../domain.ts";
import { setLoad } from '../progress/set-loads.ts';

export const completedWorkoutContextSchema = z.object({
  title: z.string().max(100),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }),
  exercises: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        weight: z.number().finite().min(0).max(2000),
        sets: z.array(z.number().int().min(0).max(100)).min(1).max(10),
        setWeights: z.array(z.number().finite().min(0).max(2000)).max(10).optional(),
      }),
    )
    .min(1)
    .max(8),
});
export type CompletedWorkoutContext = z.infer<
  typeof completedWorkoutContextSchema
>;
const normalizedName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

/** Recorded sets only: preset targets and `previous` example values are not evidence. */
export function completedWorkoutContext(
  workout: AppState["workout"],
): CompletedWorkoutContext[] {
  const sessions = [
    ...(workout.history ?? []),
    ...(workout.status === "finished"
      ? [
          {
            title: workout.title ?? "Workout",
            startedAt: workout.startedAt,
            finishedAt: workout.finishedAt,
            exercises: workout.exercises,
          },
        ]
      : []),
  ];
  const seen = new Set<string>();
  return sessions
    .filter((session) => {
      if (
        !session.startedAt ||
        !session.finishedAt ||
        /\b(sample|demo|example)\b/i.test(session.title)
      )
        return false;
      const start = Date.parse(session.startedAt),
        end = Date.parse(session.finishedAt);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
        return false;
      const key = `${session.startedAt}:${session.finishedAt}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((session) => ({
      title: session.title.slice(0, 100),
      startedAt: new Date(session.startedAt!).toISOString(),
      finishedAt: new Date(session.finishedAt!).toISOString(),
      exercises: session.exercises
        .filter(
          (exercise) =>
            exercise.name.trim() &&
            Number.isFinite(exercise.weight) &&
            exercise.weight >= 0 &&
            exercise.weight <= 2000,
        )
        .map((exercise) => ({
          name: exercise.name.trim().slice(0, 100),
          weight: exercise.weight,
          ...(exercise.setWeights?{setWeights:exercise.sets.map((reps,index)=>({reps,weight:setLoad(exercise,index)})).filter(({reps})=>reps!==null&&Number.isInteger(reps)&&reps>=0&&reps<=100).slice(0,10).map(({weight})=>weight)}:{}),
          sets: exercise.sets
            .filter(
              (reps): reps is number =>
                reps !== null &&
                Number.isInteger(reps) &&
                reps >= 0 &&
                reps <= 100,
            )
            .slice(0, 10),
        }))
        .filter((exercise) => exercise.sets.length > 0)
        .slice(0, 8),
    }))
    .filter((session) => session.exercises.length > 0)
    .sort((a, b) => Date.parse(b.finishedAt) - Date.parse(a.finishedAt))
    .slice(0, 5);
}

export function lastExerciseEvidence(
  workout: AppState["workout"],
  name: string,
) {
  const target = normalizedName(name);
  if (!target) return null;
  for (const session of completedWorkoutContext(workout)) {
    const exercise = session.exercises.find(
      (entry) => normalizedName(entry.name) === target,
    );
    if (exercise)
      return {
        ...exercise,
        sessionTitle: session.title,
        finishedAt: session.finishedAt,
      };
  }
  return null;
}
