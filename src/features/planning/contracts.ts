import { z } from 'zod';
export const planIngredientSchema = z.object({lotId:z.string().nullable(),name:z.string().min(1).max(200),servings:z.number().finite().positive().max(1000),servingLabel:z.string().min(1).max(200)});
export const mealCategorySchema=z.enum(['Breakfast','Lunch','Dinner','Snack']);
export type MealCategory=z.infer<typeof mealCategorySchema>;
// Controlled actions reference the ingredient list; provider prose cannot smuggle
// stock assurances, nutrition estimates or extra ingredients into a method.
export const cookingStepSchema=z.object({action:z.enum(['rinse','chop','slice','dice','combine','stir','blend','boil','simmer','saute','bake','steam','microwave','rest','serve']),ingredientIndexes:z.array(z.number().int().min(0).max(24)).min(1).max(25),minutes:z.number().finite().positive().max(240).nullable(),temperatureC:z.number().int().min(30).max(300).nullable()});
export const cookingMethodSchema=z.object({steps:z.array(cookingStepSchema).min(1).max(16),reviewed:z.boolean()});
export type CookingStep=z.infer<typeof cookingStepSchema>;
export const plannedMealSchema = z.object({id:z.string().min(1),title:z.string().min(1).max(200),category:mealCategorySchema.optional(),portions:z.number().int().positive().max(20),minutes:z.number().int().min(1).max(240).nullable(),ingredients:z.array(planIngredientSchema).min(1).max(25),notes:z.string().max(2000),cookingMethod:cookingMethodSchema.nullable().optional()});
export const mealPlanSchema = z.object({id:z.string().min(1),createdAt:z.string(),status:z.enum(['draft','approved']),days:z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),meals:z.array(plannedMealSchema).max(4)})).length(7)});
// Strict structured model output has no optional properties. Saved legacy plans can omit category.
export const mealPlanGenerationSchema=mealPlanSchema.extend({days:z.array(z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),meals:z.array(plannedMealSchema.extend({category:mealCategorySchema,cookingMethod:cookingMethodSchema.nullable()})).min(1).max(4)})).length(7)});
export type PlannedMeal = z.infer<typeof plannedMealSchema>;
export type MealPlan = z.infer<typeof mealPlanSchema>;
