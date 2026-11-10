import { describe, expect, it } from 'vitest';
import { lifeContextSchema, lifeModeSchema, normalizeLifeContext, type LifeContext, type LifeMode, type LocalEvent } from './contracts';
import { activeLifeMode, cancelLifeMode, finishExperiment, lifeContextForAI, recordLocalEvent, repeatExperiment, saveExperiment, saveLifeMode, setResearchEnabled, summarizeLocalEvidence } from './model';

const mode: LifeMode = { id: 'conference', kind: 'conference', name: 'Conference week', startDay: '2026-11-08', endDay: '2026-11-13', details: 'Hotel gym and restaurant meals', availableMinutes: 25, equipment: 'Dumbbells' };
const initial = () => ({ preferences: { cookingMinutes: 45 }, lifeContext: normalizeLifeContext(undefined) });
const event = (id: string, kind: LocalEvent['kind'], at = '2026-11-08T12:00:00.000Z'): LocalEvent => ({ id, kind, at, source: 'web' });

describe('temporary life context', () => {
  it('activates only on its inclusive local dates without changing enduring preferences', () => {
    const before = initial(); const state = saveLifeMode(before, mode, '2026-11-08');
    expect(activeLifeMode(state.lifeContext, '2026-11-07')).toBeUndefined();
    expect(activeLifeMode(state.lifeContext, '2026-11-08')?.name).toBe('Conference week');
    expect(activeLifeMode(state.lifeContext, '2026-11-13')?.name).toBe('Conference week');
    expect(activeLifeMode(state.lifeContext, '2026-11-14')).toBeUndefined();
    expect(state.preferences).toBe(before.preferences);
    expect(cancelLifeMode(state).lifeContext.mode).toBeUndefined();
  });
  it('rejects impossible dates, reversed windows, and saving an already expired mode', () => {
    expect(lifeModeSchema.safeParse({ ...mode, endDay: '2026-02-30' }).success).toBe(false);
    expect(lifeModeSchema.safeParse({ ...mode, endDay: '2026-11-07' }).success).toBe(false);
    expect(() => saveLifeMode(initial(), mode, '2026-11-14')).toThrow('today or later');
  });
  it('keeps optional contexts compatible with old records', () => {
    expect(lifeContextSchema.parse({})).toEqual({ experiments: [], research: { enabled: false, events: [] } });
    expect(lifeContextForAI(undefined, '2026-11-08')).toEqual({ experiments: [] });
  });
  it('sends only active assistance context and excludes usage evidence and completed feedback', () => {
    let state = saveLifeMode(initial(), mode, '2026-11-08');
    state = setResearchEnabled(state, true);
    state = recordLocalEvent(state, event('visit', 'visit'));
    const context = lifeContextForAI(state.lifeContext, '2026-11-09');
    expect(context.temporaryMode?.availableMinutes).toBe(25);
    expect(JSON.stringify(context)).not.toMatch(/research|events|capture_started/);
    expect(lifeContextForAI(state.lifeContext, '2026-11-14')).toEqual({ experiments: [] });
  });
});

describe('chosen experiments', () => {
  const experiment = { id: 'lunch', action: 'Prepare lunches', startDay: '2026-11-08', endDay: '2026-11-14', timesPerWeek: 2, status: 'active' as const };
  it('records a reflection once and repeats as a new round without rewriting history', () => {
    let state = saveExperiment(initial(), experiment);
    const feedback = { helpful: true, effort: 'manageable' as const, enjoyed: true, note: 'Cook on Sunday' };
    state = finishExperiment(state, 'lunch', feedback, '2026-11-14T12:00:00.000Z');
    expect(finishExperiment(state, 'lunch', feedback)).toBe(state);
    const repeated = repeatExperiment(state, 'lunch', 'lunch-next', '2026-11-15');
    expect(repeated.lifeContext.experiments[0].feedback).toEqual(feedback);
    expect(repeated.lifeContext.experiments[1]).toEqual({ ...experiment, id: 'lunch-next', startDay: '2026-11-15', endDay: '2026-11-21' });
    expect(lifeContextForAI(repeated.lifeContext, '2026-11-15').experiments).toHaveLength(1);
  });
  it('prevents duplicate active rounds and invalid frequency', () => {
    const state = saveExperiment(initial(), experiment);
    expect(() => saveExperiment(state, { ...experiment, id: 'again' })).toThrow('already active');
    expect(() => saveExperiment(initial(), { ...experiment, timesPerWeek: 0 })).toThrow();
    expect(() => repeatExperiment(state, 'lunch', 'again')).toThrow('Finish');
  });
});

describe('private optional usage evidence', () => {
  it('starts disabled, strips unrecognized content, deduplicates a phase, and clears on opt-out', () => {
    const before = initial(); expect(recordLocalEvent(before, event('first', 'visit'))).toBe(before);
    let state = setResearchEnabled(before, true);
    state = recordLocalEvent(state, { ...event('capture', 'capture_started'), text: 'Do not retain this' } as LocalEvent);
    expect(JSON.stringify(state.lifeContext.research.events)).not.toContain('Do not retain');
    expect(recordLocalEvent(state, event('capture', 'capture_started'))).toBe(state);
    state = recordLocalEvent(state, { ...event('capture', 'capture_completed'), durationMs: 1500 });
    expect(state.lifeContext.research.events).toHaveLength(2);
    expect(setResearchEnabled(state, false).lifeContext.research).toEqual({ enabled: false, events: [] });
  });
  it('summarizes actual observations without filling in absent measurements', () => {
    const empty = summarizeLocalEvidence(undefined); expect(empty.medianCaptureMs).toBeNull(); expect(empty.returnedInSecondWeek).toBeNull();
    let state = setResearchEnabled(initial(), true);
    state = recordLocalEvent(state, event('first', 'visit', '2026-11-01T12:00:00.000Z'));
    state = recordLocalEvent(state, event('second', 'visit', '2026-11-09T12:00:00.000Z'));
    state = recordLocalEvent(state, { ...event('fast', 'capture_completed'), durationMs: 1000 });
    state = recordLocalEvent(state, { ...event('slow', 'capture_completed'), durationMs: 3000 });
    const result = summarizeLocalEvidence(state.lifeContext);
    expect(result.returnedInSecondWeek).toBe(true); expect(result.comebacks).toBe(1);
    expect(result.medianCaptureMs).toBe(2000); expect(result.p90CaptureMs).toBe(3000); expect(result.timedCaptures).toBe(2);
  });
  it('bounds event history and ignores invalid instrumentation', () => {
    let state = setResearchEnabled(initial(), true);
    for (let i = 0; i < 305; i++) state = recordLocalEvent(state, event(String(i), 'meal_logged'));
    expect(state.lifeContext.research.events).toHaveLength(300);
    expect(state.lifeContext.research.events[0].id).toBe('5');
    expect(recordLocalEvent(state, { ...event('invalid', 'capture_completed'), durationMs: -1 })).toBe(state);
    expect(normalizeLifeContext(state.lifeContext) as LifeContext).toEqual(state.lifeContext);
  });
});
