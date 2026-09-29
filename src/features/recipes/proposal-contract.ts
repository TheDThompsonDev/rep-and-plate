import { z } from "zod";

export const recipePortionProposalSchema = z.object({
  batchId: z.string().trim().min(1),
  portions: z.number().finite().positive().max(1000),
  category: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]),
  evidence: z.string().trim().min(1).max(500),
});

export type RecipePortionProposal = z.infer<typeof recipePortionProposalSchema>;
export type RecipePortionProposalStatus = "pending" | "accepted" | "dismissed";
