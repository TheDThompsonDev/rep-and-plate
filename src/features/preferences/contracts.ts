import { z } from 'zod';
const list = z.array(z.string().trim().min(1).max(150)).max(30);
export const preferencesSchema = z.object({
  shoppingPriority: z.enum(['balanced','budget','protein','calories','less-sugar','convenience']).optional(),
  weeklyBudget: z.number().positive().max(100000).nullable().optional(),
  shoppingCurrency: z.string().regex(/^[A-Z]{3}$/).optional(),
  preferredStores: list.optional(),
  brandFlexibility: z.enum(['open','usual']).optional(),
  restrictions: list, dislikes: list, favorites: list,
  cookingMinutes: z.number().int().min(5).max(240).nullable(),
  householdSize: z.number().int().min(1).max(20),
  budget: z.enum(['unknown','economy','flexible']), equipment: list,
  workoutPreferences: z.string().max(2000), updatedAt: z.string(),
});
export type FoodPreferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences = (): FoodPreferences => ({restrictions:[],dislikes:[],favorites:[],cookingMinutes:null,householdSize:1,budget:'unknown',equipment:[],workoutPreferences:'',updatedAt:new Date().toISOString()});
