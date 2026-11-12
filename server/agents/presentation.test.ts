import { describe, expect, it } from 'vitest';
import { presentationView } from './presentation.ts';

describe('card and conversation responsibilities', () => {
  const view = { spot: { says: 'A clipboard and unreasonable confidence.' }, state: { revision: 7, profile: { primaryGoal: '' }, proposals: [] }, brief: { today: [{ title: 'Easy run', minutes: 20 }] } };
  it('keeps the joke UI-only while preserving the facts and one suggested question', () => {
    const result = presentationView(view, true);
    expect(result.cardView.spot).toEqual(view.spot);
    expect(result.modelView.spot).toBeUndefined();
    expect(result.modelView.state).toEqual(view.state);
    expect(result.modelView.brief).toEqual(view.brief);
    expect(result.presentation.suggestedReply).toBe('What would you most like your training to help you achieve?');
    expect(result.presentation.instruction).toContain('Do not recap the card');
  });
  it('prioritizes an outstanding review over a second setup question', () => {
    const result = presentationView({ ...view, state: { ...view.state, proposals: [{ status: 'pending' }] } }, true);
    expect(result.presentation.suggestedReply).toContain('apply the change shown');
  });
  it('retains Spot and complete facts for text-only consumers', () => {
    const result = presentationView(view, false);
    expect(result.modelView.spot).toEqual(view.spot);
    expect(result.modelView.brief).toEqual(view.brief);
    expect(result.presentation.mode).toBe('text');
  });
  it('handles stateless requests without guessing that the host is text-only', () => {
    const result = presentationView(view, undefined);
    expect(result.presentation.mode).toBe('auto');
    expect(result.presentation.instruction).toContain('If no card is displayed');
    expect(result.modelView.spot).toBeUndefined();
    expect(result.modelView.brief).toEqual(view.brief);
    expect(result.cardView.spot).toEqual(view.spot);
  });
  it('still asks the assistant to answer when the basic card displays only Spot', () => {
    const result = presentationView({ spot: view.spot, meals: [{ label: 'Lunch' }] }, true, 'spot');
    expect(result.presentation.instruction).toContain('Answer the actual question');
    expect(result.presentation.instruction).toContain('character line only');
    expect(result.modelView.meals).toEqual([{ label: 'Lunch' }]);
  });
});
