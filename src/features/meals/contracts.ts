import { z } from "zod";
import { productSchema } from "../products/contracts";

export const mealComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  lotId: z.string().optional(),
  servings: z.number().positive().max(10000),
  servingLabel: z.string(),
  nutrition: z.object({
    calories: z.number().nonnegative(),
    protein: z.number().nonnegative(),
    carbs: z.number().nonnegative(),
    fat: z.number().nonnegative(),
  }),
  sourceUrls: z.array(z.string()),
  productSnapshot: productSchema.optional(),
});
export type MealComponent = z.infer<typeof mealComponentSchema>;
