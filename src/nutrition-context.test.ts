import { expect, it } from 'vitest';
import { demoState, sumNutrition, today } from './domain';
import { buildAIRequest } from './ai-client';
import { weeklyReview } from './features/reviews/weekly-review';

it('AI, totals, and weekly review share the same personal meal boundary', () => {
  const state = demoState();
  const real = { ...state.meals[0], id: 'breakfast', source: 'Food from Sample Market', title: 'My breakfast', calories: 795 };
  const legacyDemo = { ...real, id: 'legacy-demo', source: 'Text: a protein shake', note: 'Demo estimate for one scoop with water. Edit to match your brand and portion.', calories: 160 };
  state.meals.push(real, legacyDemo);
  state.meals.push({ ...real, id: 'historical-real', day: '2020-01-01', calories: 400 });
  const request = buildAIRequest(state, { id: 'new-request', role: 'user', text: 'How am I doing?', time: 'now' });
  expect(request.day).toBe(today());
  expect(request.context.meals.map(meal => meal.title)).toEqual(['My breakfast']);
  expect(request.context.totals.calories).toBe(795);
  expect(sumNutrition(state.meals).calories).toBe(795);
  expect(weeklyReview(state).meals).toEqual([real]);
  expect(state.meals).toHaveLength(7);
});
