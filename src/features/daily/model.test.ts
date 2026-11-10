import { describe, expect, it } from 'vitest';
import type { AppState } from '../../domain';
import { dailyPreferencesSchema } from './contracts';
import { dailyPreferences, dismissDailyAction, familiarMeals, selectDailyAction, toggleUsualMeal } from './model';

const day = '2026-11-08';
function meal(id: string, title = 'Eggs and toast', mealDay = '2026-11-06', calories = 350): AppState['meals'][number] {
  return { source: 'Saved photo estimate', id, title, category: 'Breakfast', day: mealDay, time: '08:00', calories, protein: 25, carbs: 35, fat: 12, confidence: 'estimated', note: 'Portions estimated from a photo.' } as AppState['meals'][number];
}
function state(patch: Partial<AppState> = {}): AppState {
  return {
    meals: [], reviews: [],
    workout: { status: 'finished', exercises: [], history: [] },
    ...patch,
  } as unknown as AppState;
}

describe('daily help and familiar meals', () => {
  it('provides preferences for existing accounts without this feature', () => {
    expect(dailyPreferencesSchema.parse(undefined)).toEqual({ usualMealIds: [] });
    expect(dailyPreferences(state())).toEqual({ usualMealIds: [] });
  });

  it('retains an estimated saved meal and its complete chosen snapshot', () => {
    const original = meal('old', 'Eggs and toast', '2026-11-05', 350);
    const newer = meal('new', 'Eggs and toast', '2026-11-07', 510);
    const source = state({ meals: [original, newer] });
    const pinned = toggleUsualMeal(source, original.id);
    const familiar = familiarMeals(pinned, day);
    expect(familiar).toHaveLength(1);
    expect(familiar[0]).toEqual({ meal: original, occurrences: 2, pinned: true });
    expect(familiar[0].meal.confidence).toBe('estimated');
    expect(pinned.meals).toBe(source.meals);
    expect(pinned.meals.map(item => item.calories)).toEqual([350, 510]);
  });

  it('presents the latest whole version when a meal has no chosen usual', () => {
    const original = meal('old', 'Eggs and toast', '2026-11-05', 350);
    const latest = meal('new', 'Eggs and toast', '2026-11-07', 510);
    const familiar = familiarMeals(state({ meals: [original, latest] }), day);
    expect(familiar[0].meal).toEqual(latest);
    expect(familiar[0].occurrences).toBe(2);
  });

  it('replaces a usual with a newly chosen version without hidden duplicate pins', () => {
    const original = meal('old');
    const newer = meal('new', original.title, '2026-11-07', 510);
    const first = toggleUsualMeal(state({ meals: [original, newer] }), original.id);
    const second = toggleUsualMeal(first, newer.id);
    expect(dailyPreferences(second).usualMealIds).toEqual(['new']);
    expect(familiarMeals(second, day)[0].meal.calories).toBe(510);
    expect(dailyPreferences(toggleUsualMeal(second, newer.id)).usualMealIds).toEqual([]);
  });

  it('places an explicit usual before a more frequently recorded meal', () => {
    const chosen = meal('yogurt', 'Yogurt');
    let source = state({ meals: [meal('one'), meal('two'), meal('three'), chosen] });
    source = toggleUsualMeal(source, chosen.id);
    expect(familiarMeals(source, day).map(item => item.meal.title)).toEqual(['Yogurt', 'Eggs and toast']);
  });

  it('resumes a workout before adding another task', () => {
    const source = state({
      workout: { status: 'active', exercises: [], history: [] } as unknown as AppState['workout'],
      reviews: [{ id: 'check', resolved: false }] as AppState['reviews'],
      meals: [meal('one'), meal('two')],
    });
    expect(selectDailyAction(source, day)?.kind).toBe('workout');
    expect(selectDailyAction(source, day)?.label).toBe('Resume workout');
  });

  it('dismisses only that suggestion for that day and preserves food records', () => {
    const source = state({ meals: [meal('one'), meal('two')] });
    const action = selectDailyAction(source, day)!;
    expect(action.kind).toBe('meal');
    const dismissed = dismissDailyAction(source, action.key, day);
    expect(selectDailyAction(dismissed, day)).toBeNull();
    expect(selectDailyAction(dismissed, '2026-11-09')?.kind).toBe('meal');
    expect(dismissed.meals).toBe(source.meals);
    const interrupted = { ...dismissed, reviews: [{ id: 'new-check', resolved: false }] as AppState['reviews'] };
    expect(selectDailyAction(interrupted, day)?.kind).toBe('review');
  });

  it('avoids suggesting the same usual after it was already recorded today', () => {
    const source = state({ meals: [meal('one'), meal('two'), meal('today', 'Eggs and toast', day)] });
    expect(selectDailyAction(source, day)?.kind).toBe('decide');
    expect(source.meals).toHaveLength(3);
  });

  it('does not use future records as evidence for a familiar meal', () => {
    const source = state({ meals: [meal('future', 'Pasta', '2026-12-01')] });
    expect(familiarMeals(source, day)).toEqual([]);
  });

  it('rejects pinning an unknown record and limits the number of saved usuals', () => {
    expect(() => toggleUsualMeal(state(), 'missing')).toThrow('Choose a saved meal');
    const meals = Array.from({ length: 13 }, (_, i) => meal(`meal-${i}`, `Meal ${i}`));
    const source = state({ meals, dailyPreferences: { usualMealIds: meals.slice(0, 12).map(item => item.id) } });
    expect(() => toggleUsualMeal(source, meals[12].id)).toThrow('12 usual meals');
    expect(dailyPreferences(toggleUsualMeal(source, meals[0].id)).usualMealIds).toHaveLength(11);
  });
});
