import { describe, expect, it } from 'vitest';
import type { AppState } from '../../domain';
import { weeklyActionInsights } from './weekly-actions';

function meal(id: string, day: string, title = 'Egg toast', protein = 25, calories = 400) {
  return { id, day, title, protein, calories, carbs: 30, fat: 18, category: 'Breakfast', time: '08:00', confidence: 'confirmed', source: 'manual' } as AppState['meals'][number];
}
function state(meals: AppState['meals'], configured = false) {
  return { meals, profile: { targetsConfigured: configured, protein: 140 } } as Pick<AppState, 'meals' | 'profile'>;
}
describe('actionable weekly food evidence', () => {
  it('needs records from different days before suggesting a familiar repeat', () => {
    expect(weeklyActionInsights(state([meal('a', '2026-11-08'), meal('b', '2026-11-08')]), '2026-11-08')).toEqual([]);
    const insights = weeklyActionInsights(state([meal('a', '2026-11-07'), meal('b', '2026-11-08')]), '2026-11-08');
    expect(insights).toHaveLength(1);
    expect(insights[0].description).toContain('2 different days');
    expect(insights[0].action.mealId).toBe('b');
    expect(insights[0].detail).toContain('Review the portion');
  });
  it('does not assume matching titles have matching portions', () => {
    expect(weeklyActionInsights(state([meal('a', '2026-11-07'), meal('b', '2026-11-08', 'Egg toast', 40, 650)]), '2026-11-08')).toEqual([]);
  });
  it('excludes future and older records from current evidence', () => {
    expect(weeklyActionInsights(state([meal('a', '2026-10-20'), meal('b', '2026-11-09')]), '2026-11-08')).toEqual([]);
    expect(weeklyActionInsights(state([]), 'invalid')).toEqual([]);
  });
  it('compares saved portions only when a protein target is configured', () => {
    const entries = [meal('a', '2026-11-07', 'Toast', 10, 300), meal('b', '2026-11-08', 'Yogurt bowl', 30, 500)];
    expect(weeklyActionInsights(state(entries), '2026-11-08')).toEqual([]);
    const insights = weeklyActionInsights(state(entries, true), '2026-11-08');
    expect(insights[0].description).toContain('20g more recorded protein');
    expect(insights[0].detail).toContain('not a claim that one meal caused a result');
    expect(insights[0].action.mealId).toBe('b');
  });
});
