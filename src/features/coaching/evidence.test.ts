import { describe, expect, it } from 'vitest';
import { COACHING_EVIDENCE_LIMITS, coachingStateSchema, type CoachingCommand, type CoachingImportInput, type CoachingSession, type CoachingState } from './contracts';
import { CoachingError, coachingEvidenceView, coachingNextSteps, emptyCoachingState, importCoachingEvidence, proposeCoaching, resolveCoaching, undoCoaching } from './model';

const now = '2026-11-10T18:00:00.000Z';
const today = '2026-11-10';
const actor = 'connection:test';
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const confirmation = 'SAVE_REPORTED_RECORDS' as const;
const run = (externalId: string, day: string, extra: Partial<CoachingImportInput['activities'] extends (infer T)[] | undefined ? T : never> = {}) => ({ source: 'Strava', externalId, day, sport: 'run' as const, title: 'Morning run', minutes: 46.5, distanceKm: 8.02, avgHeartRate: 148, ...extra });
const macros = (day: string, calories = 2450) => ({ source: 'macrofactor', day, calories, protein: 160, carbs: 290, fat: 70 });
const save = (state: CoachingState, input: Omit<CoachingImportInput, 'confirmation'>) => importCoachingEvidence(state, { ...input, confirmation }, actor, now, today);
const session = (value: number, day: string, sport: CoachingSession['sport'] = 'run'): CoachingSession => ({ id: id(value), day, sport, title: sport === 'run' ? 'Easy run' : 'Lower body', minutes: 45, details: '' });
function agreed(state: CoachingState, command: CoachingCommand, request: number) {
  const proposed = proposeCoaching(state, { requestId: id(request), baseRevision: state.revision, command }, 'app', now, today);
  return resolveCoaching(proposed.state, { proposalId: proposed.proposal.id, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, 'app', now, today);
}
const setup: CoachingCommand = { type: 'setup', profile: { primaryGoal: 'Run a spring half marathon and keep lifting', priorities: ['running', 'strength'], constraints: [], notes: '' }, reason: 'Chosen by the user.' };
function codeOf(fn: () => unknown) {
  try { fn(); } catch (error) { return error instanceof CoachingError ? error.code : 'UNKNOWN'; }
  return undefined;
}

describe('records brought in from other apps', () => {
  it('reads coaching records saved before imports existed', () => {
    const older: Record<string, unknown> = { ...emptyCoachingState() };
    delete older.evidence;
    expect(coachingStateSchema.parse(older).evidence).toEqual({ activities: [], nutritionDays: [] });
  });

  it('saves activities and nutrition days with their source, without touching the plan', () => {
    const before = agreed(emptyCoachingState(), setup, 1).state;
    const result = save(before, { activities: [run('a1', '2026-11-09')], nutritionDays: [macros('2026-11-09')] });
    expect(result.imported).toEqual({ activities: { added: 1, updated: 0, unchanged: 0, removed: 0 }, nutritionDays: { added: 1, updated: 0, unchanged: 0, removed: 0 }, droppedOldest: { activities: 0, nutritionDays: 0 } });
    expect(result.state.evidence.activities[0]).toMatchObject({ source: 'strava', externalId: 'a1', distanceKm: 8.02, actor, recordedAt: now });
    expect(result.state.evidence.nutritionDays[0]).toMatchObject({ source: 'macrofactor', day: '2026-11-09', calories: 2450 });
    // The plan, its revision and reported outcomes are exactly as they were.
    expect(result.state.revision).toBe(before.revision);
    expect(result.state.sessions).toEqual(before.sessions);
    expect(result.state.outcomes).toEqual([]);
  });

  it('updates a record sent again instead of duplicating it, and treats an identical resend as a replay', () => {
    const first = save(emptyCoachingState(), { activities: [run('a1', '2026-11-09')] });
    const again = save(first.state, { activities: [run('a1', '2026-11-09')] });
    expect(again.replayed).toBe(true);
    expect(again.state).toEqual(first.state);
    expect(again.imported.activities).toMatchObject({ added: 0, unchanged: 1 });
    const corrected = save(first.state, { activities: [run('a1', '2026-11-09', { distanceKm: 8.4 })] });
    expect(corrected.imported.activities).toMatchObject({ added: 0, updated: 1 });
    expect(corrected.state.evidence.activities).toHaveLength(1);
    expect(corrected.state.evidence.activities[0].distanceKm).toBe(8.4);
    // The same identifier from a different app is a different record.
    const other = save(corrected.state, { activities: [run('a1', '2026-11-09', { source: 'coros' })] });
    expect(other.state.evidence.activities.map(item => item.source)).toEqual(['coros', 'strava']);
  });

  it('removes a record saved by mistake and reports what was removed', () => {
    const saved = save(emptyCoachingState(), { activities: [run('a1', '2026-11-08'), run('a2', '2026-11-09')], nutritionDays: [macros('2026-11-09')] }).state;
    const result = save(saved, { remove: { activities: [{ source: 'strava', externalId: 'a1' }, { source: 'strava', externalId: 'missing' }], nutritionDays: [{ source: 'macrofactor', day: '2026-11-09' }] } });
    expect(result.imported.activities.removed).toBe(1);
    expect(result.imported.nutritionDays.removed).toBe(1);
    expect(result.state.evidence.activities.map(item => item.externalId)).toEqual(['a2']);
    expect(result.state.evidence.nutritionDays).toEqual([]);
  });

  it('requires the confirmation, real values and a named source', () => {
    const state = emptyCoachingState();
    expect(codeOf(() => importCoachingEvidence(state, { activities: [run('a1', '2026-11-09')] } as unknown as CoachingImportInput, actor, now, today))).toBe('INVALID_INPUT');
    expect(codeOf(() => save(state, {}))).toBe('INVALID_INPUT');
    expect(codeOf(() => save(state, { activities: [run('a1', '2026-11-12')] }))).toBe('INVALID_INPUT');
    expect(codeOf(() => save(state, { activities: [run('a1', '2026-11-09'), run('a1', '2026-11-09')] }))).toBe('CONFLICT');
    expect(codeOf(() => save(state, { activities: [run('a1', '2026-11-09', { source: '' })] }))).toBe('INVALID_INPUT');
    expect(codeOf(() => save(state, { activities: [run('a1', '2026-11-09', { avgHeartRate: 170, maxHeartRate: 150 })] }))).toBe('INVALID_INPUT');
    expect(codeOf(() => save(state, { nutritionDays: [{ source: 'macrofactor', day: '2026-11-09' }] }))).toBe('INVALID_INPUT');
    // Lifted weights need a unit; a guess between kg and lb is not a record.
    expect(codeOf(() => save(state, { activities: [{ source: 'buff', externalId: 'l1', day: '2026-11-09', sport: 'strength', title: 'Lower body', minutes: 50, exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 100 }] }] }] }))).toBe('INVALID_INPUT');
    expect(save(state, { activities: [{ source: 'buff', externalId: 'l1', day: '2026-11-09', sport: 'strength', title: 'Lower body', minutes: 50, weightUnit: 'kg', exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 100 }] }] }] }).imported.activities.added).toBe(1);
  });

  it('never stales a pending proposal and survives apply and undo of plan changes', () => {
    const proposed = proposeCoaching(emptyCoachingState(), { requestId: id(1), baseRevision: 0, command: setup }, 'app', now, today);
    const imported = save(proposed.state, { activities: [run('a1', '2026-11-09')] }).state;
    const applied = resolveCoaching(imported, { proposalId: id(1), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, 'app', now, today);
    expect(applied.state.revision).toBe(1);
    expect(applied.state.evidence.activities).toHaveLength(1);
    const undone = undoCoaching(applied.state, { entryId: applied.entry!.id, baseRevision: 1, requestId: id(2) }, 'app', now);
    expect(undone.state.profile.primaryGoal).toBe('');
    expect(undone.state.evidence.activities).toHaveLength(1);
  });

  it('keeps the newest records inside the retained window and says how many old ones were released', () => {
    let state = emptyCoachingState();
    const day = (offset: number) => { const date = new Date('2025-01-01T12:00:00Z'); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); };
    for (let batch = 0; batch < COACHING_EVIDENCE_LIMITS.activities / 25; batch++) state = save(state, { activities: Array.from({ length: 25 }, (_item, index) => run(`a${batch * 25 + index}`, day(batch * 25 + index))) }).state;
    expect(state.evidence.activities).toHaveLength(COACHING_EVIDENCE_LIMITS.activities);
    const result = save(state, { activities: [run('newest', '2026-11-09'), run('newer', '2026-11-08')] });
    expect(result.imported.droppedOldest.activities).toBe(2);
    expect(result.state.evidence.activities).toHaveLength(COACHING_EVIDENCE_LIMITS.activities);
    expect(result.state.evidence.activities.at(-1)?.externalId).toBe('newest');
    expect(result.state.evidence.activities.some(item => item.externalId === 'a0')).toBe(false);
  });

  it('summarises the last two weeks and where each source stands', () => {
    const state = save(emptyCoachingState(), {
      activities: [run('old', '2026-10-01'), run('a1', '2026-11-05'), run('a2', '2026-11-09', { distanceKm: 12.5, minutes: 70 }), { source: 'buff', externalId: 'l1', day: '2026-11-08', sport: 'strength', title: 'Upper body', minutes: 55 }],
      nutritionDays: [macros('2026-11-08'), macros('2026-11-09', 2600)],
    }).state;
    const view = coachingEvidenceView(state, today);
    expect(view.activities.map(item => item.externalId)).toEqual(['a1', 'l1', 'a2']);
    expect(view.week).toEqual({ activities: 3, minutes: 172, distanceKm: 20.5, bySport: { run: 2, strength: 1 } });
    expect(view.sources).toEqual([
      { source: 'buff', kind: 'activity', records: 1, latestDay: '2026-11-08' },
      { source: 'macrofactor', kind: 'nutrition', records: 2, latestDay: '2026-11-09' },
      { source: 'strava', kind: 'activity', records: 3, latestDay: '2026-11-09' },
    ]);
    expect(view.totals).toEqual({ activities: 4, nutritionDays: 2 });
  });
});

describe('what to raise next', () => {
  it('starts a new user with a goal and an offer to bring in their other apps', () => {
    const steps = coachingNextSteps(emptyCoachingState(), today);
    expect(steps[0]).toContain('No primary goal');
    expect(steps.at(-1)).toContain('Nothing has been brought in from other apps');
  });

  it('puts a waiting decision first', () => {
    const proposed = proposeCoaching(emptyCoachingState(), { requestId: id(1), baseRevision: 0, command: setup }, 'app', now, today);
    expect(coachingNextSteps(proposed.state, today)[0]).toContain('1 proposed change is waiting');
  });

  it('asks about an unreported session and points at a matching imported run without assuming it was that session', () => {
    let state = agreed(emptyCoachingState(), setup, 1).state;
    state = agreed(state, { type: 'replace_week', startDay: '2026-11-08', sessions: [session(10, '2026-11-09'), session(11, today, 'strength')], reason: 'Agreed week.' }, 2).state;
    const plain = coachingNextSteps(state, today);
    expect(plain.find(step => step.includes('Easy run'))).toContain('No report is unknown, not skipped');
    expect(plain).toContain('Today: "Lower body" (strength, 45 min).');
    const withRun = save(state, { activities: [run('a2', '2026-11-09')] }).state;
    const step = coachingNextSteps(withRun, today).find(item => item.includes('Easy run'))!;
    expect(step).toContain('A Strava run ("Morning run", 47 min) was brought in for that day');
    expect(step).toContain('Ask whether it was this session before recording anything');
    // Pointing at a record is not a report: the outcome list is still empty.
    expect(withRun.outcomes).toEqual([]);
  });

  it('notices when an app has gone quiet and when the week ahead is empty', () => {
    let state = agreed(emptyCoachingState(), setup, 1).state;
    state = save(state, { activities: [run('a1', '2026-11-03')], nutritionDays: [macros('2026-11-09')] }).state;
    const steps = coachingNextSteps(state, today);
    expect(steps).toContain('Nothing is planned for the next seven days. Offer to plan the week around the agreed goal and constraints.');
    expect(steps.at(-1)).toBe('Records from Strava stop at 2026-11-03. If you can reach that app, offer to bring in what is new.');
  });
});
