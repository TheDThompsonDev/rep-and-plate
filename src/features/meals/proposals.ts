import { z } from "zod";
import type { MealComponent } from "./contracts.ts";

const limits = {
  calories: 20000,
  protein: 2000,
  carbs: 5000,
  fat: 2000,
} as const;
const keys = Object.keys(limits) as (keyof typeof limits)[];
export const proposalComponentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  portion: z.string().trim().min(1).max(300),
  nutrition: z.object({
    calories: z.number().finite().nonnegative().max(limits.calories),
    protein: z.number().finite().nonnegative().max(limits.protein),
    carbs: z.number().finite().nonnegative().max(limits.carbs),
    fat: z.number().finite().nonnegative().max(limits.fat),
  }),
});
export type ProposalComponent = z.infer<typeof proposalComponentSchema>;

export const proposalComponentsSchema = z
  .array(proposalComponentSchema)
  .min(1)
  .max(20)
  .superRefine((components, context) => {
    for (const key of keys) {
      const total = components.reduce(
        (sum, component) => sum + component.nutrition[key],
        0,
      );
      if (total > limits[key])
        context.addIssue({
          code: "custom",
          message: `Combined ${key} exceed the meal limit.`,
          path: ["nutrition", key],
        });
    }
  });

const rounded = (value: number) => Math.round(value * 100) / 100;
export function sumProposalComponents(
  input: unknown,
): ProposalComponent["nutrition"] {
  const components = proposalComponentsSchema.parse(input);
  return {
    calories: rounded(
      components.reduce(
        (sum, component) => sum + component.nutrition.calories,
        0,
      ),
    ),
    protein: rounded(
      components.reduce(
        (sum, component) => sum + component.nutrition.protein,
        0,
      ),
    ),
    carbs: rounded(
      components.reduce((sum, component) => sum + component.nutrition.carbs, 0),
    ),
    fat: rounded(
      components.reduce((sum, component) => sum + component.nutrition.fat, 0),
    ),
  };
}

/** Portions are already included in each estimate; they are never scaled a second time. */
export function normalizeProposalComponents(
  input: unknown,
  idPrefix: string,
): MealComponent[] {
  if (!idPrefix.trim() || idPrefix.length > 200)
    throw new Error("A valid meal identifier is required.");
  return proposalComponentsSchema.parse(input).map((component, index) => ({
    id: `${idPrefix}:component:${index}`,
    name: component.name,
    servingLabel: component.portion,
    servings: 1,
    nutrition: component.nutrition,
    sourceUrls: [],
  }));
}
