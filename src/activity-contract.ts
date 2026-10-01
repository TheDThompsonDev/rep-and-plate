import { z } from 'zod';

/** Duration is user-reported activity, never an inferred calorie-burn allowance. */
export const activityProposalSchema = z.object({
  title: z.string().trim().min(1).max(120),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.number().finite().positive().max(1440),
  note: z.string().max(1000),
});
export const activitySchema = activityProposalSchema.extend({id:z.string()});
export type ActivityProposal = z.infer<typeof activityProposalSchema>;
export type Activity = z.infer<typeof activitySchema>;
