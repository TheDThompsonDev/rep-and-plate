import { z } from 'zod';

export const coachingDaySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date.');
const id = z.string().uuid();
const actor = z.string().trim().min(1).max(160);
const reason = z.string().trim().min(1).max(1000);
const timestamp = z.string().datetime({ offset: true });
const boundedList = z.array(z.string().trim().min(1).max(300)).max(20);

export const coachingProfileSchema = z.object({
  primaryGoal: z.string().trim().max(300),
  priorities: boundedList.default([]),
  constraints: boundedList.default([]),
  notes: z.string().trim().max(2000).default(''),
}).strict();
export const coachingSessionSchema = z.object({
  id,
  day: coachingDaySchema,
  sport: z.enum(['run', 'strength', 'recovery', 'other']),
  title: z.string().trim().min(1).max(160),
  minutes: z.number().int().min(1).max(480),
  details: z.string().trim().max(2000).default(''),
}).strict();
export const coachingOutcomeSchema = z.object({
  id,
  sessionId: id,
  day: coachingDaySchema,
  status: z.enum(['completed', 'skipped']),
  actualMinutes: z.number().int().min(0).max(1440).optional(),
  effort: z.number().int().min(1).max(10).optional(),
  note: z.string().trim().max(2000).default(''),
}).strict();
export const coachingMemoryInputSchema = z.object({
  id,
  text: z.string().trim().min(1).max(1200),
  category: z.enum(['preference', 'constraint', 'context', 'other']),
}).strict();
export const coachingMemorySchema = coachingMemoryInputSchema.extend({
  actor,
  recordedAt: timestamp,
}).strict();
/**
 * Records the user brought in from another app (Strava, Coros, MacroFactor…). They are evidence
 * with a named source: never the agreed plan, a session outcome, or the Rep & Plate food diary.
 */
export const coachingSourceSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9 _.-]{0,39}$/, 'Name the app the record came from, for example "strava".');
const metric = (max: number) => z.number().finite().min(0).max(max);
export const coachingActivityInputSchema = z.object({
  source: coachingSourceSchema,
  externalId: z.string().trim().min(1).max(200),
  day: coachingDaySchema,
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  sport: z.enum(['run', 'ride', 'swim', 'walk', 'hike', 'strength', 'mobility', 'other']),
  title: z.string().trim().min(1).max(160),
  minutes: z.number().finite().positive().max(1440),
  distanceKm: metric(1000).optional(),
  elevationGainM: metric(20000).optional(),
  avgPaceSecPerKm: z.number().finite().min(60).max(3600).optional(),
  avgHeartRate: z.number().int().min(20).max(260).optional(),
  maxHeartRate: z.number().int().min(20).max(260).optional(),
  effort: z.number().int().min(1).max(10).optional(),
  weightUnit: z.enum(['kg', 'lb']).optional(),
  exercises: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    sets: z.array(z.object({ reps: z.number().int().min(0).max(1000), weight: metric(2000).optional() }).strict()).min(1).max(12),
  }).strict()).max(15).optional(),
  note: z.string().trim().max(1000).default(''),
}).strict().refine(value => !value.exercises?.some(exercise => exercise.sets.some(set => set.weight !== undefined)) || value.weightUnit !== undefined, { path: ['weightUnit'], message: 'Say whether lifted weights are kg or lb.' });
export const coachingNutritionDayInputSchema = z.object({
  source: coachingSourceSchema,
  day: coachingDaySchema,
  calories: metric(20000).optional(),
  protein: metric(2000).optional(),
  carbs: metric(3000).optional(),
  fat: metric(2000).optional(),
  fiber: metric(500).optional(),
  complete: z.boolean().optional().describe('True only when the source shows the whole day was logged. Absent means unknown.'),
  note: z.string().trim().max(500).default(''),
}).strict().refine(value => [value.calories, value.protein, value.carbs, value.fat, value.fiber].some(item => item !== undefined), 'Include at least one recorded total.');
const recorded = { actor, recordedAt: timestamp };
export const coachingActivitySchema = coachingActivityInputSchema.safeExtend(recorded);
export const coachingNutritionDaySchema = coachingNutritionDayInputSchema.safeExtend(recorded);
export const COACHING_EVIDENCE_LIMITS = { activities: 400, nutritionDays: 180 } as const;
export const coachingEvidenceSchema = z.object({
  activities: z.array(coachingActivitySchema).max(COACHING_EVIDENCE_LIMITS.activities).default([]),
  nutritionDays: z.array(coachingNutritionDaySchema).max(COACHING_EVIDENCE_LIMITS.nutritionDays).default([]),
}).strict();
export const SAVE_REPORTED_RECORDS = 'SAVE_REPORTED_RECORDS';
export const coachingImportInputSchema = z.object({
  activities: z.array(coachingActivityInputSchema).max(25).default([]),
  nutritionDays: z.array(coachingNutritionDayInputSchema).max(31).default([]),
  remove: z.object({
    activities: z.array(z.object({ source: coachingSourceSchema, externalId: z.string().trim().min(1).max(200) }).strict()).max(25).default([]),
    nutritionDays: z.array(z.object({ source: coachingSourceSchema, day: coachingDaySchema }).strict()).max(31).default([]),
  }).strict().optional(),
  confirmation: z.literal(SAVE_REPORTED_RECORDS),
}).strict().refine(value => value.activities.length + value.nutritionDays.length + (value.remove?.activities.length ?? 0) + (value.remove?.nutritionDays.length ?? 0) > 0, 'Include at least one record to save or remove.');

const sessionChanges = z.object({
  day: coachingDaySchema.optional(),
  sport: z.enum(['run', 'strength', 'recovery', 'other']).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  minutes: z.number().int().min(1).max(480).optional(),
  details: z.string().trim().max(2000).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'Choose at least one session detail to change.');
export const coachingCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setup'), profile: coachingProfileSchema.refine(value => value.primaryGoal.length > 0, 'Describe your primary goal.'), reason }).strict(),
  z.object({ type: z.literal('replace_week'), startDay: coachingDaySchema, sessions: z.array(coachingSessionSchema).max(21), reason }).strict(),
  z.object({ type: z.literal('update_session'), sessionId: id, changes: sessionChanges, reason }).strict(),
  z.object({ type: z.literal('record_outcome'), outcome: coachingOutcomeSchema, reason }).strict(),
  z.object({ type: z.literal('remember'), memory: coachingMemoryInputSchema, reason }).strict(),
  z.object({ type: z.literal('forget_memory'), memoryId: id, reason }).strict(),
]);

export const coachingContentSchema = z.object({
  profile: coachingProfileSchema,
  sessions: z.array(coachingSessionSchema).max(90),
  outcomes: z.array(coachingOutcomeSchema).max(180),
  memories: z.array(coachingMemorySchema).max(60),
}).strict();
export const coachingProposalSchema = z.object({
  id,
  requestId: id,
  baseRevision: z.number().int().nonnegative(),
  command: coachingCommandSchema,
  status: z.enum(['pending', 'accepted', 'dismissed']),
  actor,
  createdAt: timestamp,
  resolvedAt: timestamp.optional(),
  resolvedBy: actor.optional(),
  before: coachingContentSchema,
  after: coachingContentSchema,
}).strict();
export const coachingJournalEntrySchema = z.object({
  id,
  revision: z.number().int().positive(),
  kind: z.enum(['apply', 'undo']),
  proposalId: id.optional(),
  requestId: id,
  baseRevision: z.number().int().nonnegative(),
  actor,
  at: timestamp,
  reason,
  before: coachingContentSchema,
  after: coachingContentSchema,
  undoes: id.optional(),
}).strict();
export const coachingReceiptSchema = z.object({
  requestId: id,
  operation: z.enum(['propose', 'undo']),
  canonicalInput: z.string().max(60000),
  status: z.enum(['pending', 'accepted', 'dismissed', 'undone']),
  proposalId: id.optional(),
  entryId: id.optional(),
  at: timestamp,
}).strict();
export const coachingStateSchema = coachingContentSchema.extend({
  revision: z.number().int().nonnegative(),
  proposals: z.array(coachingProposalSchema).max(40),
  journal: z.array(coachingJournalEntrySchema).max(20),
  receipts: z.array(coachingReceiptSchema).max(2000).default([]),
  // Outside the reviewed plan content, so imports never stale a pending proposal or enter undo snapshots.
  evidence: coachingEvidenceSchema.default({ activities: [], nutritionDays: [] }),
}).strict();
export const coachingProposeInputSchema = z.object({ requestId: id, baseRevision: z.number().int().nonnegative(), command: coachingCommandSchema }).strict();
export const coachingResolveInputSchema = z.object({ proposalId: id, status: z.enum(['accepted', 'dismissed']), confirmation: z.literal('APPLY_REVIEWED_CHANGE').optional() }).strict();
export const coachingUndoInputSchema = z.object({ entryId: id, baseRevision: z.number().int().nonnegative(), requestId: id }).strict();

export type CoachingProfile = z.infer<typeof coachingProfileSchema>;
export type CoachingSession = z.infer<typeof coachingSessionSchema>;
export type CoachingOutcome = z.infer<typeof coachingOutcomeSchema>;
export type CoachingMemory = z.infer<typeof coachingMemorySchema>;
export type CoachingCommand = z.infer<typeof coachingCommandSchema>;
export type CoachingContent = z.infer<typeof coachingContentSchema>;
export type CoachingProposal = z.infer<typeof coachingProposalSchema>;
export type CoachingJournalEntry = z.infer<typeof coachingJournalEntrySchema>;
export type CoachingReceipt = z.infer<typeof coachingReceiptSchema>;
export type CoachingState = z.infer<typeof coachingStateSchema>;
export type CoachingProposeInput = z.infer<typeof coachingProposeInputSchema>;
export type CoachingResolveInput = z.infer<typeof coachingResolveInputSchema>;
export type CoachingUndoInput = z.infer<typeof coachingUndoInputSchema>;
export type CoachingActivity = z.infer<typeof coachingActivitySchema>;
export type CoachingNutritionDay = z.infer<typeof coachingNutritionDaySchema>;
export type CoachingEvidence = z.infer<typeof coachingEvidenceSchema>;
export type CoachingImportInput = z.input<typeof coachingImportInputSchema>;
export type CoachingImportReceipt = {
  activities: { added: number; updated: number; unchanged: number; removed: number };
  nutritionDays: { added: number; updated: number; unchanged: number; removed: number };
  /** Oldest records released to stay inside the retained window. Reported, never silent. */
  droppedOldest: { activities: number; nutritionDays: number };
};
export type CoachingEvidenceView = {
  startDay: string;
  endDay: string;
  activities: CoachingActivity[];
  nutritionDays: CoachingNutritionDay[];
  week: { activities: number; minutes: number; distanceKm: number; bySport: Record<string, number> };
  sources: { source: string; kind: 'activity' | 'nutrition'; records: number; latestDay: string }[];
  totals: { activities: number; nutritionDays: number };
};
export type CoachingBrief = {
  day: string;
  revision: number;
  profile: CoachingProfile;
  today: CoachingSession[];
  upcoming: CoachingSession[];
  recentChanges: CoachingJournalEntry[];
  memories: CoachingMemory[];
  outcomes: CoachingOutcome[];
  missingData: string[];
};
export type CoachingWeeklyReview = {
  startDay: string;
  endDay: string;
  planned: CoachingSession[];
  outcomes: CoachingOutcome[];
  completed: CoachingOutcome[];
  skipped: CoachingOutcome[];
  unreported: CoachingSession[];
  plannedMinutes: number;
  completedActualMinutes: number;
  completedWithoutMinutes: number;
  observations: string[];
};
export const coachingBriefSchema = z.object({
  day: coachingDaySchema,
  revision: z.number().int().nonnegative(),
  profile: coachingProfileSchema,
  today: z.array(coachingSessionSchema).max(90),
  upcoming: z.array(coachingSessionSchema).max(21),
  recentChanges: z.array(coachingJournalEntrySchema).max(3),
  memories: z.array(coachingMemorySchema).max(60),
  outcomes: z.array(coachingOutcomeSchema).max(14),
  missingData: z.array(z.string().max(2000)).max(10),
}).strict();
export const coachingWeeklyReviewSchema = z.object({
  startDay: coachingDaySchema,
  endDay: coachingDaySchema,
  planned: z.array(coachingSessionSchema).max(90),
  outcomes: z.array(coachingOutcomeSchema).max(180),
  completed: z.array(coachingOutcomeSchema).max(180),
  skipped: z.array(coachingOutcomeSchema).max(180),
  unreported: z.array(coachingSessionSchema).max(90),
  plannedMinutes: z.number().int().nonnegative(),
  completedActualMinutes: z.number().int().nonnegative(),
  completedWithoutMinutes: z.number().int().min(0).max(180),
  observations: z.array(z.string().max(2000)).max(10),
}).strict();
