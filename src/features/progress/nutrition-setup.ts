import { z } from 'zod';
import type { AppState } from '../../domain.ts';
import type { NutritionSession } from '../onboarding/draft.ts';

export const activityLabels = {
  sedentary: 'Mostly sitting · little activity',
  light: 'Mostly sitting · some walking or exercise',
  moderate: 'On my feet often · regular exercise',
  active: 'Physically demanding days · frequent exercise',
} as const;
export const sexLabels = { none: 'Prefer not to use an estimate', female: 'Female', male: 'Male' } as const;
export const adjustmentLabels = { maintain: 'Maintain · no adjustment', lose: 'Lose · 250 fewer calories per day', gain: 'Gain · 250 more calories per day' } as const;
export const nutritionBaselineSchema = z.object({
  age: z.number().int().min(1).max(120),
  heightCm: z.number().finite().min(50).max(250),
  sex: z.enum(['female', 'male', 'none']),
  activity: z.enum(['sedentary', 'light', 'moderate', 'active']),
  calorieApproach: z.enum(['maintain', 'lose', 'gain']).optional(),
});
export type NutritionBaseline = z.infer<typeof nutritionBaselineSchema>;
const targetsSchema = z.object({
  calories: z.number().finite().min(1).max(10000),
  protein: z.number().finite().min(1).max(1000),
  carbs: z.number().finite().min(1).max(2000),
  fat: z.number().finite().min(1).max(1000),
});
export type DailyTargets = z.infer<typeof targetsSchema>;
const setupSchema = z.object({ baseline: nutritionBaselineSchema, targets: targetsSchema.optional() });
export type NutritionSetupResult = z.infer<typeof setupSchema>;
export type NutritionSetupDraft = {
  age: string; height: string; heightUnit: 'cm' | 'in';
  sex: NutritionBaseline['sex']; activity: NutritionBaseline['activity'] | '';
  eligible: boolean; adjustment: keyof typeof adjustmentLabels;
};
export type NutritionSetupProps = {
  baseline?: NutritionBaseline; kind?: string; initialDraft?: NutritionSetupDraft;
  existingTargets?: DailyTargets; weight?: { value: number; unit: 'lb' | 'kg' };
  onSave: (result: NutritionSetupResult) => void; onSkip?: () => void;
  onDraftChange?: (draft: NutritionSetupDraft) => void; busy?: boolean;
  initialSession?: NutritionSession; onSessionChange?: (session: NutritionSession) => void;
};
export function nutritionDraft(baseline?: NutritionBaseline, kind?: string): NutritionSetupDraft {
  return { age: baseline ? String(baseline.age) : '', height: baseline ? String(baseline.heightCm) : '', heightUnit: 'cm', sex: baseline?.sex ?? 'none', activity: baseline?.activity ?? '', eligible: false, adjustment: baseline?.calorieApproach ?? (kind === 'lose' || kind === 'gain' ? kind : 'maintain') };
}
export function parseBaseline(draft: NutritionSetupDraft): NutritionBaseline {
  const age = Number(draft.age), heightCm = Number(draft.height) * (draft.heightUnit === 'in' ? 2.54 : 1);
  if (!draft.age.trim() || !Number.isInteger(age) || age < 1 || age > 120) throw Error('Enter your age in whole years, from 1 to 120.');
  if (!draft.height.trim() || !Number.isFinite(heightCm) || heightCm < 50 || heightCm > 250) throw Error('Enter a height between 50 and 250 cm (about 20 to 98 inches).');
  if (!draft.activity) throw Error('Choose the activity level that describes your usual day.');
  return nutritionBaselineSchema.parse({ age, heightCm, sex: draft.sex, activity: draft.activity, calorieApproach: draft.adjustment });
}
export function convertHeight(draft: NutritionSetupDraft, heightUnit: NutritionSetupDraft['heightUnit']): NutritionSetupDraft {
  if (heightUnit === draft.heightUnit) return draft;
  const value = Number(draft.height);
  return { ...draft, heightUnit, height: draft.height.trim() && Number.isFinite(value) ? String(Math.round(value * (heightUnit === 'cm' ? 2.54 : 1 / 2.54) * 100) / 100) : draft.height };
}
export function estimateTargets(draft: NutritionSetupDraft, weight?: { value: number; unit: 'lb' | 'kg' }): DailyTargets {
  const baseline = parseBaseline(draft);
  if (!draft.eligible || baseline.age < 18) throw Error('This standard adult estimate is for adults 18 or older who are not pregnant or breastfeeding. You can save your details without an estimate.');
  if (baseline.sex === 'none') throw Error('Choose the sex used by the equation, or enter your own targets.');
  if (!weight || !Number.isFinite(weight.value) || weight.value <= 0) throw Error('Add your current weight in the previous step before estimating targets.');
  const kg = weight.value * (weight.unit === 'lb' ? 0.45359237 : 1);
  // Mifflin–St Jeor resting energy × a coarse activity assumption; not the NIH dynamic planner.
  const resting = 10 * kg + 6.25 * baseline.heightCm - 5 * baseline.age + (baseline.sex === 'male' ? 5 : -161);
  const factors = { sedentary: 1.4, light: 1.6, moderate: 1.8, active: 2.0 };
  const adjustment = draft.adjustment === 'lose' ? -250 : draft.adjustment === 'gain' ? 250 : 0;
  const calories = Math.round((resting * factors[baseline.activity] + adjustment) / 10) * 10;
  // Product support bounds, not a claim that every target in this range suits every person.
  if (calories < 1200 || calories > 6000) throw Error('This estimate is outside our supported range. Save your details and use targets appropriate for your needs instead.');
  return { calories, protein: Math.round(calories * .2 / 4), carbs: Math.round(calories * .5 / 4), fat: Math.round(calories * .3 / 9) };
}
export function applyNutritionSetup(state: AppState, input: NutritionSetupResult): AppState {
  const setup = setupSchema.parse(input);
  return { ...state, profile: { ...state.profile, nutritionBaseline: setup.baseline, ...(setup.targets ? { ...setup.targets, targetsConfigured: true } : {}) } };
}
