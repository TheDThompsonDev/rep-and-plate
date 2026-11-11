import { z } from 'zod';

export const dailyPreferencesSchema = z.object({
  usualMealIds: z.array(z.string().min(1).max(200)).max(12).default([]),
  dismissedAction: z.object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    key: z.string().min(1).max(240),
  }).optional(),
}).default({ usualMealIds: [] });

export type DailyPreferences = z.infer<typeof dailyPreferencesSchema>;
