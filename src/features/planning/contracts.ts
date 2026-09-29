import { z } from 'zod';
export const planIngredientSchema = z.object({lotId:z.string().nullable(),name:z.string().min(1).max(200),servings:z.number().finite().positive().max(1000),servingLabel:z.string().min(1).max(200)});
export const mealCategorySchema=z.enum(['Breakfast','Lunch','Dinner','Snack']);
export type MealCategory=z.infer<typeof mealCategorySchema>;
export const plannedMealSchema = z.object({id:z.string().min(1),title:z.string().min(1).max(200),category:mealCategorySchema.optional(),portions:z.number().int().positive().max(20),minutes:z.number().int().min(1).max(240).nullable(),ingredients:z.array(planIngredientSchema).min(1).max(25),notes:z.string().max(2000)});
export const mealPlanSchema = z.object({id:z.string().min(1),createdAt:z.string(),status:z.enum(['draft','approved']),days:z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),meals:z.array(plannedMealSchema).max(4)})).length(7)});
// Strict structured model output has no optional properties. Saved legacy plans can omit category.
export const mealPlanGenerationSchema=mealPlanSchema.extend({days:z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),meals:z.array(plannedMealSchema.extend({category:mealCategorySchema})).min(1).max(4)})).length(7)});
export type PlannedMeal = z.infer<typeof plannedMealSchema>;
export type MealPlan = z.infer<typeof mealPlanSchema>;
