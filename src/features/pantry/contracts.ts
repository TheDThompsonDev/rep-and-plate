import { z } from "zod";

export const pantryEventSchema = z.object({
  id: z.string(),
  lotId: z.string(),
  kind: z.enum(["consumed", "prepared", "adjusted", "discarded", "restored"]),
  servings: z.number().finite().min(-10000).max(10000),
  mealId: z.string().optional(),
  reversesId: z.string().optional(),
  createdAt: z.string(),
  note: z.string().max(500),
});
export type PantryEvent = z.infer<typeof pantryEventSchema>;
