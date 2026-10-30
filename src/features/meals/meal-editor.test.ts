import { describe, expect, it } from 'vitest';
import { initialState, type AppState, type Meal } from '../../domain';
import {
  applyProposalCorrection,
  manualMealDraft,
  proposalCorrectionDraft,
  reviewMealDraft,
  saveEditedMeal,
} from './meal-editor';

// Pure meal-editor transitions extracted from App.tsx (audit Q2). The chat echo,
// pantry detachment and review resolution are the consumers that must keep moving together.

const proposal = {
  title: 'Chai latte',
  category: 'Snack' as const,
  portion: '1 mug',
  note: 'Includes milk and syrup.',
  sources: [],
  calories: 180,
  protein: 6,
  carbs: 30,
  fat: 4,
  components: [
    { name: 'Milk', portion: '1 cup', nutrition: { calories: 120, protein: 6, carbs: 12, fat: 4 } },
    { name: 'Syrup', portion: '2 tbsp', nutrition: { calories: 60, protein: 0, carbs: 18, fat: 0 } },
  ],
};

function stateWithProposal(): AppState {
  const state = initialState();
  state.messages.push(
    { id: 'u1', role: 'user', text: 'Chai', time: '9:00 AM', ai: true, aiStatus: 'complete' },
    { id: 'a1', role: 'assistant', text: 'Here is an estimate.', time: '9:00 AM', ai: true, aiStatus: 'complete', mealProposal: proposal },
  );
  return state;
}

const saved: Meal = {
  id: 'meal-1', title: 'Oats', category: 'Breakfast', day: '2026-10-09', time: '8:00 AM',
  source: 'AI estimate · checked by you', confidence: 'estimated', calories: 300, protein: 10, carbs: 50, fat: 6, note: '',
  components: [{ id: 'c1', name: 'Oats', servings: 1, servingLabel: '1 cup', nutrition: { calories: 300, protein: 10, carbs: 50, fat: 6 }, sourceUrls: [] }],
};

describe('meal editor drafts', () => {
  it('starts a manual entry on the chosen day with zero macros the form shows blank', () => {
    const draft = manualMealDraft('2026-10-08');
    expect(draft).toMatchObject({ title: '', category: 'Lunch', day: '2026-10-08', source: 'Manual entry', confidence: 'confirmed', calories: 0, note: '' });
  });

  it('builds the proposal correction from component totals, keyed by the message id', () => {
    const draft = proposalCorrectionDraft(stateWithProposal(), 'a1', '2026-10-10');
    expect(draft).toMatchObject({ id: 'a1', title: 'Chai latte', category: 'Snack', day: '2026-10-10', confidence: 'estimated', calories: 180, protein: 6, carbs: 30, fat: 4, note: 'Includes milk and syrup.' });
    expect(draft?.source).toBe('Unlogged estimate — review before logging');
    expect(proposalCorrectionDraft(stateWithProposal(), 'u1', '2026-10-10')).toBeNull();
  });

  it('prefers the proposal day over the fallback and turns a review item into a meal draft', () => {
    const state = stateWithProposal();
    state.messages[1].mealProposal = { ...proposal, day: '2026-10-01' };
    expect(proposalCorrectionDraft(state, 'a1', '2026-10-10')?.day).toBe('2026-10-01');
    const draft = reviewMealDraft({ id: 'r1', title: 'Photo', question: 'Add a meal estimate?', options: [], source: 'Image · 1:00 PM', image: 'data:image/png;base64,AAAA', kind: 'capture', resolved: false }, '2026-10-10');
    expect(draft).toMatchObject({ id: 'review-meal-r1', day: '2026-10-10', source: 'Image · 1:00 PM: Add a meal estimate?', image: 'data:image/png;base64,AAAA', confidence: 'confirmed' });
  });
});

describe('applyProposalCorrection', () => {
  it('rewrites the proposal without logging it and keeps components when macros are unchanged', () => {
    const state = stateWithProposal();
    const draft = proposalCorrectionDraft(state, 'a1', '2026-10-10')!;
    const next = applyProposalCorrection(state, 'a1', { ...draft, title: 'Chai (oat milk)', note: 'x'.repeat(1300) });
    expect(next.meals).toEqual([]);
    const message = next.messages.find(m => m.id === 'a1')!;
    expect(message.text).toBe('Review your corrected estimate below. It has not been logged yet.');
    expect(message.mealProposal).toMatchObject({ title: 'Chai (oat milk)', portion: '1 mug', calories: 180 });
    expect(message.mealProposal?.components).toHaveLength(2);
    expect(message.mealProposal?.note).toHaveLength(1200);
    expect(next.messages[0]).toBe(state.messages[0]);
  });

  it('drops the breakdown, portion and sources when a macro changes', () => {
    const state = stateWithProposal();
    const draft = proposalCorrectionDraft(state, 'a1', '2026-10-10')!;
    const next = applyProposalCorrection(state, 'a1', { ...draft, calories: 150 });
    expect(next.messages[1].mealProposal).toMatchObject({ calories: 150, components: undefined, portion: 'Your corrected portion', sources: [] });
  });
});

describe('saveEditedMeal', () => {
  it('appends a new meal and resolves the review item it came from', () => {
    const state = initialState();
    state.reviews.push({ id: 'r1', title: 'Photo', question: 'Add?', options: [], source: 'Image', kind: 'capture', resolved: false });
    const meal = { ...reviewMealDraft(state.reviews[0], '2026-10-10'), title: 'Wrap', calories: 400, protein: 20, carbs: 40, fat: 15 };
    const next = saveEditedMeal(state, meal);
    expect(next.meals).toEqual([meal]);
    expect(next.reviews[0]).toMatchObject({ resolved: true, answer: 'Meal added by you' });
  });

  it('replaces an existing meal in place and updates the assistant echo', () => {
    const state = initialState();
    state.meals.push(saved);
    state.messages.push({ id: 'a1', role: 'assistant', text: 'Logged.', time: '8:00 AM', mealId: 'meal-1' }, { id: 'u2', role: 'user', text: 'thanks', time: '8:01 AM', mealId: 'meal-1' });
    const next = saveEditedMeal(state, { ...saved, title: 'Overnight oats' });
    expect(next.meals).toHaveLength(1);
    expect(next.meals[0]).toMatchObject({ title: 'Overnight oats', components: saved.components });
    expect(next.messages[0].text).toBe('Your meal was updated. The saved details below reflect your correction.');
    expect(next.messages[1].text).toBe('thanks');
  });

  it('a macro change drops the components and detaches pantry use', () => {
    const state = initialState();
    state.meals.push(saved);
    state.pantryEvents = [{ id: 'e1', lotId: 'lot-1', kind: 'consumed', mealId: 'meal-1', servings: 1, createdAt: '2026-10-09T08:00:00.000Z', note: '' }];
    const next = saveEditedMeal(state, { ...saved, calories: 350 });
    expect(next.meals[0]).toMatchObject({ calories: 350, components: undefined });
    expect(next.pantryEvents?.at(-1)).toMatchObject({ kind: 'restored', reversesId: 'e1', servings: -1, mealId: 'meal-1' });
  });
});
