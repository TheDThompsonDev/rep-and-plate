import { z } from 'zod';

export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export const lifeDaySchema = z.string().refine(isCalendarDay, 'Choose a valid date.');
export const lifeModeKinds = ['conference', 'travel', 'busy-week', 'limited-kitchen', 'custom'] as const;
export const lifeModeLabels: Record<(typeof lifeModeKinds)[number], string> = {
  conference: 'Conference', travel: 'Travel', 'busy-week': 'Busy week',
  'limited-kitchen': 'Limited kitchen', custom: 'Something else',
};
export const lifeModeSchema = z.object({
  id: z.string().min(1).max(100), kind: z.enum(lifeModeKinds),
  name: z.string().trim().min(1).max(80), startDay: lifeDaySchema, endDay: lifeDaySchema,
  details: z.string().trim().max(1000).default(''),
  availableMinutes: z.number().int().min(5).max(180).optional(),
  equipment: z.string().trim().max(240).optional(),
}).refine(value => value.startDay <= value.endDay, {
  message: 'The end date must be on or after the start date.', path: ['endDay'],
});
export type LifeMode = z.infer<typeof lifeModeSchema>;
export const experimentFeedbackSchema = z.object({
  helpful: z.boolean(), effort: z.enum(['easy', 'manageable', 'too-much']),
  enjoyed: z.boolean(), note: z.string().trim().max(500).default(''),
});
export type ExperimentFeedback = z.infer<typeof experimentFeedbackSchema>;
export const lifeExperimentSchema = z.object({
  id: z.string().min(1).max(100), action: z.string().trim().min(1).max(180),
  startDay: lifeDaySchema, endDay: lifeDaySchema, timesPerWeek: z.number().int().min(1).max(7),
  status: z.enum(['active', 'completed']), feedback: experimentFeedbackSchema.optional(),
  completedAt: z.string().datetime().optional(),
}).refine(value => value.startDay <= value.endDay, {
  message: 'The end date must be on or after the start date.', path: ['endDay'],
});
export type LifeExperiment = z.infer<typeof lifeExperimentSchema>;
export const localEventKinds = ['visit', 'capture_started', 'capture_completed', 'capture_failed', 'meal_logged', 'meal_corrected', 'usual_used', 'guidance_used'] as const;
export const localEventSchema = z.object({
  id: z.string().min(1).max(160), kind: z.enum(localEventKinds),
  at: z.string().datetime(), durationMs: z.number().finite().min(0).max(3600000).optional(),
  source: z.enum(['web', 'native']).optional(),
});
export type LocalEvent = z.infer<typeof localEventSchema>;
export const lifeContextSchema = z.object({
  mode: lifeModeSchema.optional(), experiments: z.array(lifeExperimentSchema).max(30).default([]),
  research: z.object({ enabled: z.boolean().default(false), events: z.array(localEventSchema).max(300).default([]) }).default({ enabled: false, events: [] }),
});
export const lifeAIContextSchema = z.object({
  temporaryMode: z.object({ kind: z.enum(lifeModeKinds), name: z.string().max(80), startDay: lifeDaySchema, endDay: lifeDaySchema, details: z.string().max(1000), availableMinutes: z.number().min(5).max(180).optional(), equipment: z.string().max(240).optional() }).optional(),
  experiments: z.array(z.object({ action: z.string().max(180), timesPerWeek: z.number().int().min(1).max(7), endDay: lifeDaySchema })).max(30),
});
export type LifeContext = z.infer<typeof lifeContextSchema>;
export function normalizeLifeContext(value: unknown): LifeContext {
  const parsed = lifeContextSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { experiments: [], research: { enabled: false, events: [] } };
}
