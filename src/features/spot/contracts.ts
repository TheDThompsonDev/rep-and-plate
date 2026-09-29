import { z } from "zod";

export const spotPreferencesSchema = z.object({
  visuals: z.boolean().optional(),
  introSeen: z.boolean().optional(),
  lastVisit: z.string().optional(),
});

export const workoutCaptureSchema = z.object({
  title: z.string().trim().min(1).max(120),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().max(1000),
  exercises: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        weight: z.number().finite().min(0).max(2000),
        reps: z.array(z.number().int().min(1).max(100)).min(1).max(20),
      }),
    )
    .min(1)
    .max(20),
});
export type WorkoutCapture = z.infer<typeof workoutCaptureSchema>;
