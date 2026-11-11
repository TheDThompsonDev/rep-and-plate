import { describe, expect, it } from 'vitest';
import { applyAIResult, buildAIRequest } from './ai-client';
import { initialState } from './domain';
import { resultFixture } from '../e2e-shared/ai-fixtures';

describe('pre-meal decision boundary', () => {
  it.each(['menu', 'decide'] as const)('keeps %s decisions out of intake and pantry even when the provider returns a purchase', purpose => {
    const state = initialState();
    const id = crypto.randomUUID();
    state.messages.push({ id, role: 'user', text: 'Help me choose', time: '12:00 PM', ai: true, aiStatus: 'pending', capturePurpose: purpose });
    const next = applyAIResult(state, resultFixture(id));
    expect(next.meals).toEqual([]);
    expect(next.groceries ?? []).toEqual([]);
    expect(next.messages.at(-1)?.mealProposal).toBeUndefined();
    expect(buildAIRequest(next, next.messages[0]).capturePurpose).toBe(purpose);
  });
});
