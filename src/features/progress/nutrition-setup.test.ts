import { describe, expect, it } from 'vitest';
import { initialState } from '../../domain';
import { buildAIRequest } from '../../ai-client';
import { aiRequestSchema } from '../../ai-contract';
import { applyNutritionSetup, estimateTargets, nutritionDraft, parseBaseline } from './nutrition-setup';

const input = { age: '30', height: '180', heightUnit: 'cm' as const, sex: 'male' as const, activity: 'light' as const, eligible: true, adjustment: 'maintain' as const };
describe('onboarding nutrition starting point', () => {
  it('uses real body inputs and explicit units, then requires deliberate target saving', () => {
    const baseline = parseBaseline(input);
    const targets = estimateTargets(input, { value: 80, unit: 'kg' });
    expect(targets).toEqual({ calories: 2850, protein: 143, carbs: 356, fat: 95 });
    const state = initialState();
    const detailsOnly = applyNutritionSetup(state, { baseline });
    expect(nutritionDraft(baseline, 'lose').adjustment).toBe('maintain');
    expect(detailsOnly.profile.targetsConfigured).toBe(false);
    expect(detailsOnly.profile.calories).toBe(state.profile.calories);
    const saved = applyNutritionSetup(state, { baseline, targets });
    expect(saved.profile.targetsConfigured).toBe(true);
    expect(saved.profile.nutritionBaseline).toEqual(baseline);
    const message = { ...saved.messages[0], id: '11111111-1111-4111-8111-111111111111', text: 'How should I think about my day?' };
    const context = aiRequestSchema.parse(buildAIRequest(saved, message)).context;
    expect(context.nutritionBaseline).toEqual(baseline);
    expect(context.goalsConfigured).toBe(true);
    expect(saved.meals).toEqual(state.meals);
    expect(estimateTargets({ ...input, height: String(180 / 2.54), heightUnit: 'in' }, { value: 80 / 0.45359237, unit: 'lb' })).toEqual(targets);
  });
  it('does not guess missing data, use an adult estimate outside its scope or silently clamp it', () => {
    expect(() => estimateTargets(input)).toThrow(/current weight/);
    expect(() => estimateTargets({ ...input, age: '17' }, { value: 80, unit: 'kg' })).toThrow(/adult/);
    expect(() => estimateTargets({ ...input, eligible: false }, { value: 80, unit: 'kg' })).toThrow(/adult/);
    expect(() => estimateTargets({ ...input, sex: 'none' }, { value: 80, unit: 'kg' })).toThrow(/sex/);
    expect(() => parseBaseline({ ...input, height: '' })).toThrow(/height/);
    expect(() => parseBaseline({ ...input, activity: '' })).toThrow(/activity/);
    expect(() => estimateTargets({ ...input, age: '85', height: '130', sex: 'female', activity: 'sedentary', adjustment: 'lose' }, { value: 40, unit: 'kg' })).toThrow(/supported range/);
  });
  it('keeps existing targets when only details are collected and rejects invalid targets', () => {
    const state = initialState();
    state.profile.targetsConfigured = true;
    state.profile.calories = 2100;
    expect(applyNutritionSetup(state, { baseline: parseBaseline(input) }).profile.calories).toBe(2100);
    expect(() => applyNutritionSetup(state, { baseline: parseBaseline(input), targets: { calories: NaN, protein: 100, carbs: 200, fat: 50 } })).toThrow();
    expect(estimateTargets({ ...input, adjustment: 'lose' }, { value: 80, unit: 'kg' }).calories).toBe(2600);
    expect(estimateTargets({ ...input, adjustment: 'gain' }, { value: 80, unit: 'kg' }).calories).toBe(3100);
  });
});
