import { describe, expect, it } from 'vitest';
import type { AppState } from '../../domain';
import { dinnerDecisionPrompt, menuDecisionPrompt, uncertainMealPrompt } from './model';

const state = { preferences: { restrictions: ['peanuts'], dislikes: ['mushrooms'], favorites: ['rice bowls'], householdSize: 2 } } as unknown as AppState;

describe('food decision prompts', () => {
  it('carries selected effort, appetite and exclusions while keeping choices separate from intake', () => {
    const prompt = dinnerDecisionPrompt(state, { minutes: 15, appetite: 'hungry', budget: 'use-stock', note: 'No energy to cook' });
    expect(prompt).toContain('15 minutes');
    expect(prompt).toContain('a substantial meal');
    expect(prompt).toContain('saved food exclusions');
    expect(prompt).toContain('No energy to cook');
    expect(prompt).toContain('I am choosing food, not reporting consumption');
    expect(prompt).toContain('stock may be out of date');
  });
  it('bounds user input and unsupported pricing claims', () => {
    const prompt = dinnerDecisionPrompt(state, { minutes: Infinity, appetite: 'regular', budget: 'economy', note: 'Quick lunch' });
    expect(prompt).toContain('20 minutes');
    expect(prompt).toContain('Do not invent prices');
    expect(() => dinnerDecisionPrompt(state, { minutes: 15, appetite: 'regular', budget: 'economy', note: 'x'.repeat(601) })).toThrow('within 600');
  });
  it('keeps maximum-length menu evidence under the chat limit without dropping text', () => {
    const prompt = menuDecisionPrompt(state, 'm'.repeat(2000), 'n'.repeat(600));
    expect(prompt.length).toBeLessThanOrEqual(4000);
    expect(prompt).toContain('m'.repeat(2000));
    expect(prompt).toContain('n'.repeat(600));
    expect(() => menuDecisionPrompt(state, 'm'.repeat(2001), '')).toThrow('within 2000');
  });
  it('asks for missing menu evidence and never interprets an order as consumed food', () => {
    const prompt = menuDecisionPrompt(state, '', 'Under $20');
    expect(prompt).toContain('image is missing or unreadable');
    expect(prompt).toContain('Under $20');
    expect(prompt).toContain('avoid invented exact calories');
    expect(prompt).toContain('Do not log a purchase or order as eaten food');
  });
  it('distinguishes a rough reviewable estimate from the material-clarification route', () => {
    const rough = uncertainMealPrompt('A plate at a cookout', 'rough');
    const clarify = uncertainMealPrompt('A plate at a cookout', 'clarify');
    expect(rough).toContain('keep confidence estimated');
    expect(clarify).toContain('single question');
    expect(rough).toContain('until I explicitly choose to log it');
    expect(() => uncertainMealPrompt('  ', 'rough')).toThrow();
  });
});
