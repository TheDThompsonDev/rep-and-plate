import { z } from "zod";
export const workoutProposalSchema = z.object({
  title:z.string().min(1).max(100), minutes:z.number().int().min(5).max(120),reason:z.string().max(1500),
  exercises:z.array(z.object({name:z.string().min(1).max(100),sets:z.number().int().min(1).max(5),reps:z.number().int().min(1).max(30),note:z.string().max(600)})).min(1).max(8),
});
export type WorkoutProposal = z.infer<typeof workoutProposalSchema>;
