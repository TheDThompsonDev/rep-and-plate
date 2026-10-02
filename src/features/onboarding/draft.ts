import { z } from "zod";
import { defaultFocus, focusChoices } from "./model";
import { nutritionBaselineSchema } from "../progress/nutrition-setup";

const text = z.string().max(80);
const fitness = z
  .object({
    kind: z.enum(["lose", "gain", "maintain", "strength", "habits"]),
    unit: z.enum(["lb", "kg"]),
    cadence: z.enum(["weekly", "daily", "none"]),
    currentWeight: text,
    targetWeight: text,
  })
  .strict();
const nutritionInput = z
  .object({
    age: text,
    height: text,
    heightUnit: z.enum(["cm", "in"]),
    sex: z.enum(["female", "male", "none"]),
    activity: z.enum(["", "sedentary", "light", "moderate", "active"]),
    eligible: z.boolean(),
    adjustment: z.enum(["maintain", "lose", "gain"]),
  })
  .strict();
const targets = z
  .object({ calories: text, protein: text, carbs: text, fat: text })
  .strict();
export const nutritionSessionSchema = z
  .object({ review: z.enum(["estimate", "manual"]).nullable(), targets })
  .strict();
export type NutritionSession = z.infer<typeof nutritionSessionSchema>;
const approvedTargets = z
  .object({
    calories: z.number().min(1).max(10000),
    protein: z.number().min(1).max(1000),
    carbs: z.number().min(1).max(2000),
    fat: z.number().min(1).max(1000),
  })
  .strict();
const schema = z
  .object({
    version: z.literal(1),
    step: z.enum([
      "welcome",
      "intro",
      "guide",
      "account",
      "setup",
      "goals",
      "nutrition",
      "ready",
    ]),
    slide: z.number().int().min(0).max(4),
    name: z.string().max(60),
    focus: z.string().refine((value) => focusChoices.includes(value)),
    localMode: z.boolean(),
    weightEntry: z.string().min(1).max(100),
    fitness: fitness.nullable(),
    fitnessInput: fitness.optional(),
    nutrition: z
      .object({
        baseline: nutritionBaselineSchema,
        targets: approvedTargets.optional(),
      })
      .strict()
      .nullable(),
    nutritionInput: nutritionInput.optional(),
    nutritionSession: nutritionSessionSchema.optional(),
  })
  .strict();
export type OnboardingDraft = z.infer<typeof schema>;
export const draftKey = (userId: string | null) =>
  `rep-and-plate.onboarding.draft.v1.${userId ? `account:${encodeURIComponent(userId)}` : "guest"}`;
export function emptyDraft(weightEntry: string): OnboardingDraft {
  return {
    version: 1,
    step: "welcome",
    slide: 0,
    name: "",
    focus: defaultFocus,
    localMode: false,
    weightEntry,
    fitness: null,
    nutrition: null,
  };
}
export function parseDraft(raw: string | null): OnboardingDraft | null {
  if (!raw || raw.length > 12000) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw || "null"));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
