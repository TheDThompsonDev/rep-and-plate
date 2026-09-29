import { z } from "zod";
import { mealComponentSchema } from "../meals/contracts";

const batchAmount = z.number().finite().nonnegative().max(200000000);
export const recipeBatchSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  createdAt: z.string(),
  totalPortions: z.number().finite().min(0.0001).max(1000),
  ingredients: z.array(mealComponentSchema).min(1).max(40),
  nutrition: z.object({
    calories: batchAmount,
    protein: batchAmount,
    carbs: batchAmount,
    fat: batchAmount,
  }),
  preparationEventIds: z.array(z.string()).min(1).max(40),
  consumptions: z.array(
    z.object({
      id: z.string(),
      mealId: z.string(),
      portions: z.number().finite().positive().max(1000),
      createdAt: z.string(),
      reversedAt: z.string().optional(),
    }),
  ),
  undoneAt: z.string().optional(),
});
export type RecipeBatch = z.infer<typeof recipeBatchSchema>;
