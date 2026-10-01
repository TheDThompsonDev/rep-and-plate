import { z } from 'zod';

export const scopeSchema = z.enum(['nutrition:read', 'pantry:read', 'preferences:read', 'workouts:read', 'meals:propose']);
export type AgentScope = z.infer<typeof scopeSchema>;
export const agentScopes = scopeSchema.options;
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a real calendar date (YYYY-MM-DD).');
const nutrient = z.number().finite().min(0).max(20000);
export const agentMealSchema = z.object({
  title: z.string().trim().min(1).max(160),
  day: daySchema,
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  category: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snack']),
  portion: z.string().trim().min(1).max(200),
  calories: nutrient, protein: nutrient, carbs: nutrient, fat: nutrient,
  note: z.string().max(2000),
}).strict();
export type AgentMeal = z.infer<typeof agentMealSchema>;
const short = z.string().max(300);
const totals = z.object({ calories: z.number().finite().nonnegative(), protein: z.number().finite().nonnegative(), carbs: z.number().finite().nonnegative(), fat: z.number().finite().nonnegative() }).strict();
export const agentContextSchema = z.object({
  day: daySchema,
  timezone: z.string().max(100),
  nutrition: z.object({ days: z.array(z.object({ day: daySchema, meals: z.number().int().nonnegative(), totals }).strict()).max(7), goals: totals, goalsConfigured: z.boolean().optional().describe('Only true means the user explicitly chose these targets. Otherwise goals are compatibility defaults; describe recorded totals without target judgments.') }).strict(),
  pantry: z.array(z.object({ id: short, name: short, remainingServings: z.number().finite().nonnegative().nullable(), serving: short, needsReview: z.boolean() }).strict()).max(200),
  preferences: z.array(short).max(60),
  workouts: z.array(z.object({ title: short, finishedAt: z.string().max(60), exercises: z.array(z.object({ name: short, weightUnit: z.literal('lb'), sets: z.array(z.object({ reps: z.number().int().nonnegative(), weight: z.number().finite().nonnegative() }).strict()).max(100) }).strict()).max(50) }).strict()).max(10),
  truncated: z.array(z.enum(['pantry', 'preferences', 'workouts'])).max(3),
}).strict();
export type AgentContext = z.infer<typeof agentContextSchema>;
export const connectionSchema = z.object({
  id: z.string().uuid(), name: z.string().min(1).max(80), scopes: z.array(scopeSchema).min(1).max(5),
  createdAt: z.string().datetime(), expiresAt: z.string().datetime(), revokedAt: z.string().datetime().nullable(),
});
export type AgentConnection = z.infer<typeof connectionSchema>;
export const agentActionSchema = z.object({
  id: z.string().uuid(), connectionId: z.string().uuid(), connectionName: z.string().max(80),
  requestId: z.string().uuid(), meal: agentMealSchema,
  status: z.enum(['pending', 'accepted', 'dismissed', 'revoked', 'expired']),
  createdAt: z.string().datetime(), expiresAt: z.string().datetime(), resolvedAt: z.string().datetime().nullable(),
});
export type AgentAction = z.infer<typeof agentActionSchema>;
export const agentResolutionSchema = z.object({ actionId: z.string().uuid(), status: z.enum(['accepted', 'dismissed']), resolvedAt: z.string().datetime() });
export const agentRequestSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('capabilities') }).strict(),
  z.object({ operation: z.literal('context.read') }).strict(),
  z.object({ operation: z.literal('meals.propose'), requestId: z.string().uuid(), meal: agentMealSchema }).strict(),
  z.object({ operation: z.literal('actions.get'), actionId: z.string().uuid() }).strict(),
]);
export type AgentRequest = z.infer<typeof agentRequestSchema>;
export const manageRequestSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('list') }).strict(),
  z.object({ operation: z.literal('create'), name: z.string().trim().min(1).max(80), scopes: z.array(scopeSchema).min(1).max(5), expiresInDays: z.number().int().min(1).max(90) }).strict(),
  z.object({ operation: z.literal('revoke'), connectionId: z.string().uuid() }).strict(),
  z.object({ operation: z.literal('publish'), context: agentContextSchema, dataUpdatedAt: z.string().datetime().nullable() }).strict(),
  z.object({ operation: z.literal('resolve'), actionId: z.string().uuid(), status: z.enum(['accepted', 'dismissed']) }).strict(),
]);
export type ManageRequest = z.infer<typeof manageRequestSchema>;
export type AgentOverview = { connections: AgentConnection[]; actions: AgentAction[]; publishedAt: string | null };
export type AgentErrorBody = { error: { code: string; message: string; retryable: boolean } };
