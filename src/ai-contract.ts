import { z } from "zod";
import { activityProposalSchema } from './activity-contract.ts';
import { workoutCaptureSchema } from './features/spot/contracts.ts';
import { receiptPurchaseSchema, receiptLinePriceSchema } from './features/shopping/contracts.ts';
import { preferenceProposalSchema } from "./features/preferences/proposals.ts";
import { preferencesSchema } from "./features/preferences/contracts.ts";
import { productSchema } from "./features/products/contracts.ts";
import { pantryDatesSchema } from "./features/pantry/date-contract.ts";
import { proposalComponentsSchema } from "./features/meals/proposals.ts";
import { recipePortionProposalSchema } from "./features/recipes/proposal-contract.ts";
import { fitnessGoalSchema } from './features/progress/fitness-goal.ts';
import { nutritionBaselineSchema } from './features/progress/nutrition-setup.ts';
import { bodyWeightEntrySchema } from './features/progress/body-weight.ts';

export const chatActionSchema = z.enum(["pantry", "recipes", "meal-plan", "preferences", "workout", "shopping"]);
export type ChatAction = z.infer<typeof chatActionSchema>;

export const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/i.test(
        url.hostname,
      )
    );
  } catch {
    return false;
  }
};
export const sourceSchema = z.object({
  title: z.string().max(300),
  url: z.string().max(2000).refine(safeUrl),
});
export const aiNutritionSchema = z.object({
  calories: z.number().min(0).max(20000),
  protein: z.number().min(0).max(2000),
  carbs: z.number().min(0).max(5000),
  fat: z.number().min(0).max(2000),
});
export const groceryItemSchema = z.object({
  price: receiptLinePriceSchema.optional(),
  productCandidates: z.array(productSchema).max(3).optional(),
  pantryDates: pantryDatesSchema.optional(),
  productSnapshot: productSchema.optional(),
  id: z.string(),
  receiptText: z.string().max(300),
  name: z.string().max(200),
  quantity: z.string().max(100),
  serving: z.string().max(150),
  servingsPurchased: z.number().positive().max(10000).nullable(),
  nutrition: aiNutritionSchema.nullable(),
  match: z.enum(["exact", "generic", "unresolved", "nonfood", "user"]),
  note: z.string().max(1200),
  sources: z.array(sourceSchema).max(6),
  needsReview: z.boolean(),
  availability: z.enum(["available", "used"]),
});
export type GroceryItem = z.infer<typeof groceryItemSchema>;
export const groceryReceiptSchema = z.object({
  purchase: receiptPurchaseSchema.optional(),
  id: z.string(),
  fingerprint: z.string(),
  store: z.string(),
  date: z.string(),
  items: z.array(groceryItemSchema).max(60),
  note: z.string(),
  sources: z.array(sourceSchema).max(30),
});
export type GroceryReceipt = z.infer<typeof groceryReceiptSchema>;
export const mealProposalSchema = aiNutritionSchema.extend({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  components: proposalComponentsSchema.optional(),
  title: z.string().max(200),
  category: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]),
  portion: z.string().max(300),
  note: z.string().max(1200),
  sources: z.array(sourceSchema).max(6),
});
export type MealProposal = z.infer<typeof mealProposalSchema>;
export const aiResultSchema = z.object({
  activity: activityProposalSchema.nullable().optional(),
  workout: workoutCaptureSchema.nullable().optional(),
  recipePortionProposal: recipePortionProposalSchema.nullable().optional(),
  suggestedAction: chatActionSchema.nullable().optional(),
  preferenceProposal: preferenceProposalSchema.nullable().optional(),
  requestId: z.string(),
  reply: z.string().max(16000),
  sources: z.array(sourceSchema).max(30),
  receipt: groceryReceiptSchema.nullable(),
  meal: mealProposalSchema.nullable(),
  decision: z.enum(["grocery", "meal", "conversation", "uncertain"]),
  warnings: z.array(z.string()).max(10),
});
export type AIResult = z.infer<typeof aiResultSchema>;
export type AIStatus = { available: boolean; jev: boolean; model?: string };
export const aiRequestSchema = z.object({
  captureDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  requestId: z.string().uuid(),
  text: z.string().min(1).max(4000),
  image: z
    .string()
    .max(4500000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
    .optional(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().max(18000),
      }),
    )
    .max(20),
  context: z.object({
    fitnessGoal: fitnessGoalSchema.optional(),
    nutritionBaseline: nutritionBaselineSchema.optional(),
    bodyWeights: z.array(bodyWeightEntrySchema).max(30).optional(),
    goalsConfigured: z.boolean().optional(),
    activities: z.array(activityProposalSchema).max(30).optional(),
    shopping: z.object({
      totals: z.record(z.string().regex(/^[A-Z]{3}$/),z.number().nonnegative()),
      recordedReceipts: z.number().int().nonnegative(), reviewedReceipts:z.number().int().nonnegative(),
      missingOrUncheckedTotals:z.number().int().nonnegative(),
      list:z.array(z.object({name:z.string().max(300),quantity:z.string().max(150),checked:z.boolean()})).max(50),
    }).optional(),
    preparedRecipes: z.array(z.object({
      id: z.string().max(200),
      name: z.string().max(200),
      preparedAt: z.string().max(40),
      remainingPortions: z.number().finite().positive().max(10000),
      nutritionPerPortion: aiNutritionSchema,
    })).max(30).optional(),
    preferences: preferencesSchema.optional(),
    goals: z.object({
      calories: z.number(),
      protein: z.number(),
      carbs: z.number(),
      fat: z.number(),
    }),
    totals: aiNutritionSchema,
    meals: z
      .array(
        z.object({
          title: z.string().max(200),
          category: z.string().max(30),
          calories: z.number(),
          protein: z.number(),
          carbs: z.number(),
          fat: z.number(),
        }),
      )
      .max(30),
    groceries: z
      .array(
        z.object({
          store: z.string().max(200),
          items: z.array(groceryItemSchema).max(60),
        }),
      )
      .max(5),
    workout: z.string().max(3000),
  }),
});
export type AIRequest = z.infer<typeof aiRequestSchema>;
