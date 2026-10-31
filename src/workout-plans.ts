import type { Exercise } from "./domain";

/** Leaf module: the starter plans have no runtime dependency on app state, so the
 * training-program schema (imported by domain.ts) can read them without an import cycle. */
const exercise = (name: string, target: number): Exercise => ({
  name,
  weight: 0,
  weightConfirmed: false,
  target,
  previous: [],
  sets: [null, null, null],
});
export type WorkoutPlan = {
  id: string;
  title: string;
  minutes: number;
  description: string;
  exercises: Exercise[];
};
export const workoutPlans: WorkoutPlan[] = [
  {
    id: "upper",
    title: "Upper Body",
    minutes: 42,
    description: "A balanced session for your chest, back, and arms.",
    exercises: [
      exercise("Bench Press", 8),
      exercise("Incline Dumbbell Press", 10),
      exercise("Seated Cable Row", 12),
      exercise("Triceps Pushdown", 12),
    ],
  },
  {
    id: "lower",
    title: "Lower Body",
    minutes: 35,
    description: "Build your session around legs and glutes.",
    exercises: [
      exercise("Goblet Squat", 10),
      exercise("Dumbbell Romanian Deadlift", 10),
      exercise("Reverse Lunge", 10),
      exercise("Standing Calf Raise", 15),
    ],
  },
  {
    id: "full",
    title: "Full Body",
    minutes: 30,
    description: "A little of everything, with room in your day.",
    exercises: [
      exercise("Goblet Squat", 10),
      exercise("Bench Press", 10),
      exercise("Seated Cable Row", 12),
    ],
  },
];
