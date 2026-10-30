import { describe, expect, it } from 'vitest';
import { RECORD_BOUND_DIALOGS, dialogReducer, initialDialogs, type DialogState } from './dialogs';

// Pure transitions for the dialog record that replaced App.tsx's fourteen
// `*Open` booleans (audit Q2). Independence between dialogs is the contract.

describe('dialogReducer', () => {
  it('opens dialogs independently and closes one without touching the others', () => {
    let state: DialogState = initialDialogs('');
    state = dialogReducer(state, { type: 'open', dialog: { kind: 'pantry', receiptId: '*' } });
    state = dialogReducer(state, { type: 'open', dialog: { kind: 'cloud' } });
    expect(state).toEqual({ pantry: { kind: 'pantry', receiptId: '*' }, cloud: { kind: 'cloud' } });
    state = dialogReducer(state, { type: 'close', kind: 'cloud' });
    expect(state).toEqual({ pantry: { kind: 'pantry', receiptId: '*' } });
  });

  it('replaces the payload when the same kind reopens with a different value', () => {
    let state = dialogReducer({}, { type: 'open', dialog: { kind: 'pantry', receiptId: 'r1' } });
    state = dialogReducer(state, { type: 'open', dialog: { kind: 'pantry', receiptId: 'r2' } });
    expect(state.pantry).toEqual({ kind: 'pantry', receiptId: 'r2' });
    state = dialogReducer(state, { type: 'open', dialog: { kind: 'label', gtin: '0001111040101' } });
    expect(state.label?.gtin).toBe('0001111040101');
  });

  it('returns the same state for no-op opens and closes, like the boolean setters did', () => {
    const open = dialogReducer({}, { type: 'open', dialog: { kind: 'planner' } });
    expect(dialogReducer(open, { type: 'open', dialog: { kind: 'planner' } })).toBe(open);
    expect(dialogReducer(open, { type: 'close', kind: 'voice' })).toBe(open);
    const same = dialogReducer(open, { type: 'open', dialog: { kind: 'pantry', receiptId: 'a' } });
    expect(dialogReducer(same, { type: 'open', dialog: { kind: 'pantry', receiptId: 'a' } })).toBe(same);
    expect(dialogReducer(open, { type: 'close-many', kinds: ['voice', 'scanner'] })).toBe(open);
  });

  it('close-many clears only the listed kinds', () => {
    let state: DialogState = {};
    for (const kind of RECORD_BOUND_DIALOGS) {
      state = dialogReducer(state, {
        type: 'open',
        dialog: kind === 'pantry' ? { kind, receiptId: '*' } : kind === 'label' ? { kind, gtin: '1' } : kind === 'pantryLinks' ? { kind, mealId: 'm1' } : { kind },
      });
    }
    state = dialogReducer(state, { type: 'open', dialog: { kind: 'cloud' } });
    state = dialogReducer(state, { type: 'open', dialog: { kind: 'capture' } });
    state = dialogReducer(state, { type: 'open', dialog: { kind: 'connections' } });
    state = dialogReducer(state, { type: 'open', dialog: { kind: 'headerAccount' } });
    const next = dialogReducer(state, { type: 'close-many', kinds: RECORD_BOUND_DIALOGS });
    expect(Object.keys(next).sort()).toEqual(['capture', 'cloud', 'connections', 'headerAccount']);
  });

  it('opens receipt capture or the connections hub from the deep-link hash', () => {
    expect(initialDialogs('#receipt')).toEqual({ capture: { kind: 'capture' } });
    expect(initialDialogs('#connections')).toEqual({ connections: { kind: 'connections' } });
    expect(initialDialogs('#chat')).toEqual({});
  });
});
