import { z } from 'zod';

export const householdNutritionSchema = z.object({
  calories: z.number().finite().nonnegative(),
  protein: z.number().finite().nonnegative(),
  carbs: z.number().finite().nonnegative(),
  fat: z.number().finite().nonnegative(),
});
export type HouseholdNutrition = z.infer<typeof householdNutritionSchema>;

export const sharedHouseholdSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isOwner: z.boolean(),
  memberCount: z.number().int().positive(),
  members: z.array(z.object({
    userId: z.string().uuid(), name: z.string(), isOwner: z.boolean(), isMe: z.boolean(),
  })).default([]),
});
export const sharedBatchSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  title: z.string(),
  totalPortions: z.number().finite().positive(),
  remainingPortions: z.number().finite().nonnegative(),
  perPortion: householdNutritionSchema,
  sourceBatchId: z.string().nullable(),
});
export const householdReservationSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  batchId: z.string().uuid(),
  portions: z.number().finite().positive(),
  status: z.enum(['reserved', 'logged', 'released']),
});
export const householdStateSchema = z.object({
  households: z.array(sharedHouseholdSchema),
  batches: z.array(sharedBatchSchema),
  reservations: z.array(householdReservationSchema),
});
export type SharedHousehold = z.infer<typeof sharedHouseholdSchema>;
export type SharedHouseholdBatch = z.infer<typeof sharedBatchSchema>;
export type HouseholdReservation = z.infer<typeof householdReservationSchema>;
export type HouseholdState = z.infer<typeof householdStateSchema>;

/** A prepared personal batch offers only its still-available portions. */
export type HouseholdBatchCandidate = {
  id: string;
  title: string;
  remainingPortions: number;
  perPortion: HouseholdNutrition;
};
export type HouseholdTransfer = {
  sourceBatchId: string;
  householdBatchId: string;
  portions: number;
};
export type HouseholdMealProposal = {
  title: string;
  portions: number;
  nutrition: HouseholdNutrition;
  householdReservationId: string;
  householdBatchId: string;
};
