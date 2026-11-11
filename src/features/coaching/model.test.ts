import { describe, expect, it } from 'vitest';
import { coachingCommandSchema, coachingDaySchema, type CoachingCommand, type CoachingSession, type CoachingState } from './contracts';
import { CoachingError, coachingBrief, coachingWeeklyReview, emptyCoachingState, proposeCoaching, resolveCoaching, undoCoaching } from './model';

const now = '2026-11-08T18:00:00.000Z';
const actor = 'test-user';
const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const setup = (goal = 'Run consistently'): CoachingCommand => ({ type: 'setup', profile: { primaryGoal: goal, priorities: ['Consistency'], constraints: ['Busy weekdays'], notes: '' }, reason: 'A goal explicitly chosen by the user.' });
const session = (value: number, day = '2026-11-08'): CoachingSession => ({ id: id(value), day, sport: 'run', title: 'Easy run', minutes: 30, details: 'User-agreed session.' });
function proposal(state: CoachingState, command: CoachingCommand, request: number) {
  return proposeCoaching(state, { requestId: id(request), baseRevision: state.revision, command }, actor, now);
}
function accept(state: CoachingState, command: CoachingCommand, request: number) {
  const proposed = proposal(state, command, request);
  return resolveCoaching(proposed.state, { proposalId: proposed.proposal.id, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, now);
}
function planned() {
  return accept(emptyCoachingState(), { type: 'replace_week', startDay: '2026-11-02', sessions: [session(100, '2026-11-07'), session(101)], reason: 'The user agreed these sessions.' }, 1).state;
}
function codeOf(fn: () => unknown) {
  try { fn(); } catch (error) { return error instanceof CoachingError ? error.code : 'UNKNOWN'; }
  return undefined;
}

describe('persistent coaching decisions', () => {
  it('begins with unknown actuals and does not import external context silently', () => {
    const state = emptyCoachingState();
    const brief = coachingBrief(state, '2026-11-08', { workouts: [{ minutes: 90 }], readiness: 100 });
    expect(brief.today).toEqual([]);
    expect(brief.outcomes).toEqual([]);
    expect(brief.profile.primaryGoal).toBe('');
    expect(brief.missingData.join(' ')).toContain('not been agreed');
    const review = coachingWeeklyReview(state, '2026-11-08');
    expect(review.completed).toEqual([]);
    expect(review.observations.join(' ')).toContain('No actual outcomes');
    expect(state.revision).toBe(0);
  });

  it('requires review and explicit confirmation before applying proposed setup', () => {
    const original = emptyCoachingState();
    const proposed = proposal(original, setup(), 1);
    expect(proposed.state.profile.primaryGoal).toBe('');
    expect(proposed.state.revision).toBe(0);
    expect(proposed.proposal.before.profile.primaryGoal).toBe('');
    expect(proposed.proposal.after.profile.primaryGoal).toBe('Run consistently');
    expect(codeOf(() => resolveCoaching(proposed.state, { proposalId: id(1), status: 'accepted' }, actor, now))).toBe('CONFIRMATION_REQUIRED');
    expect(original.proposals).toEqual([]);
    const applied = resolveCoaching(proposed.state, { proposalId: id(1), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, now);
    expect(applied.state.profile.primaryGoal).toBe('Run consistently');
    expect(applied.state.revision).toBe(1);
    expect(applied.entry?.reason).toBe('A goal explicitly chosen by the user.');
  });

  it('dismisses a proposal without changing the agreed content', () => {
    const proposed = proposal(emptyCoachingState(), setup(), 1);
    const dismissed = resolveCoaching(proposed.state, { proposalId: id(1), status: 'dismissed' }, actor, now);
    expect(dismissed.state.profile.primaryGoal).toBe('');
    expect(dismissed.state.revision).toBe(0);
    expect(dismissed.state.journal).toEqual([]);
    expect(codeOf(() => resolveCoaching(dismissed.state, { proposalId: id(1), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, now))).toBe('CONFLICT');
  });

  it('replays accepted requests before checking their now-stale base revision', () => {
    const input = { requestId: id(1), baseRevision: 0, command: setup() };
    const proposed = proposeCoaching(emptyCoachingState(), input, actor, now);
    const applied = resolveCoaching(proposed.state, { proposalId: id(1), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, now);
    const replay = proposeCoaching(applied.state, input, actor, now);
    expect(replay.replayed).toBe(true);
    expect(replay.state.revision).toBe(1);
    expect(replay.state.journal).toHaveLength(1);
    expect(resolveCoaching(applied.state, { proposalId: id(1), status: 'accepted' }, actor, now).replayed).toBe(true);
    expect(codeOf(() => proposeCoaching(applied.state, { ...input, command: setup('Different goal') }, actor, now))).toBe('CONFLICT');
  });

  it('rejects stale concurrent acceptance atomically', () => {
    const first = proposal(emptyCoachingState(), setup('First goal'), 1);
    const second = proposal(first.state, setup('Second goal'), 2);
    const applied = resolveCoaching(second.state, { proposalId: id(1), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, now);
    const before = JSON.stringify(applied.state);
    expect(codeOf(() => resolveCoaching(applied.state, { proposalId: id(2), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, now))).toBe('CONFLICT');
    expect(JSON.stringify(applied.state)).toBe(before);
    expect(applied.state.profile.primaryGoal).toBe('First goal');
  });

  it('validates real calendar dates, bounded commands, and unknown input keys', () => {
    expect(coachingDaySchema.safeParse('2026-02-30').success).toBe(false);
    expect(coachingDaySchema.safeParse('2028-02-29').success).toBe(true);
    expect(coachingCommandSchema.safeParse({ ...setup(), readiness: 100 }).success).toBe(false);
    const outOfWeek: CoachingCommand = { type: 'replace_week', startDay: '2026-11-02', sessions: [session(100, '2026-11-09')], reason: 'Proposed week.' };
    expect(codeOf(() => proposal(emptyCoachingState(), outOfWeek, 1))).toBe('INVALID_INPUT');
    const duplicate: CoachingCommand = { type: 'replace_week', startDay: '2026-11-02', sessions: [session(100), session(100)], reason: 'Duplicate sessions.' };
    expect(codeOf(() => proposal(emptyCoachingState(), duplicate, 1))).toBe('CONFLICT');
  });

  it('keeps planned sessions separate from explicit outcomes and unknown durations', () => {
    let state = planned();
    let review = coachingWeeklyReview(state, '2026-11-08');
    expect(review.plannedMinutes).toBe(60);
    expect(review.completed).toEqual([]);
    expect(review.unreported).toHaveLength(2);
    const command: CoachingCommand = { type: 'record_outcome', outcome: { id: id(200), sessionId: id(100), day: '2026-11-07', status: 'completed', note: 'I finished the session.' }, reason: 'The user reported completion.' };
    const proposed = proposal(state, command, 2);
    expect(proposed.state.outcomes).toEqual([]);
    state = resolveCoaching(proposed.state, { proposalId: id(2), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, now).state;
    review = coachingWeeklyReview(state, '2026-11-08');
    expect(review.completed).toHaveLength(1);
    expect(review.skipped).toEqual([]);
    expect(review.completedWithoutMinutes).toBe(1);
    expect(review.completedActualMinutes).toBe(0);
    expect(review.observations.join(' ')).toContain('planned minutes are not substituted');
    expect(review.unreported).toHaveLength(1);
    expect(coachingBrief(state, '2026-11-08').today.map(item => item.id)).toEqual([id(101)]);
  });

  it('deduplicates outcomes and rejects contradictory or unknown-session reports', () => {
    const command: CoachingCommand = { type: 'record_outcome', outcome: { id: id(200), sessionId: id(100), day: '2026-11-07', status: 'completed', actualMinutes: 24, effort: 4, note: '' }, reason: 'User report.' };
    const state = accept(planned(), command, 2).state;
    const repeated = accept(state, { ...command, outcome: { ...command.outcome, id: id(201) } }, 3).state;
    expect(repeated.outcomes).toHaveLength(1);
    expect(repeated.outcomes[0].actualMinutes).toBe(24);
    expect(codeOf(() => proposal(state, { ...command, outcome: { ...command.outcome, id: id(203), status: 'skipped' } }, 4))).toBe('CONFLICT');
    expect(codeOf(() => proposal(state, { ...command, outcome: { ...command.outcome, id: id(202), sessionId: id(999) } }, 5))).toBe('NOT_FOUND');
    expect(codeOf(() => proposal(planned(), { ...command, outcome: { ...command.outcome, day: '2026-11-09' } }, 6))).toBe('INVALID_INPUT');
  });

  it('reviews a correction under the existing outcome identity and undo restores the original facts', () => {
    const original: CoachingCommand = { type: 'record_outcome', outcome: { id: id(200), sessionId: id(100), day: '2026-11-07', status: 'completed', actualMinutes: 24, effort: 4, note: 'Original report.' }, reason: 'User report.' };
    const state = accept(planned(), original, 2).state;
    const correction: CoachingCommand = { ...original, outcome: { ...original.outcome, actualMinutes: 18, effort: 6, note: 'Corrected duration and effort.' }, reason: 'The user corrected their report.' };
    const proposed = proposal(state, correction, 3);
    expect(proposed.state.outcomes[0].actualMinutes).toBe(24);
    expect(proposed.proposal.before.outcomes[0].actualMinutes).toBe(24);
    expect(proposed.proposal.after.outcomes[0].actualMinutes).toBe(18);
    const corrected = resolveCoaching(proposed.state, { proposalId: id(3), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, now);
    expect(corrected.state.outcomes).toHaveLength(1);
    expect(corrected.state.outcomes[0]).toMatchObject({ id: id(200), sessionId: id(100), actualMinutes: 18, effort: 6 });
    expect(corrected.entry?.before.outcomes).toEqual(state.outcomes);
    const undone = undoCoaching(corrected.state, { entryId: corrected.entry!.id, baseRevision: corrected.state.revision, requestId: id(4) }, actor, now);
    expect(undone.state.outcomes).toEqual(state.outcomes);
    expect(codeOf(() => proposal(state, { ...correction, outcome: { ...correction.outcome, sessionId: id(101) } }, 5))).toBe('CONFLICT');
  });

  it('uses the caller local calendar day for future-outcome guards across midnight', () => {
    const state = planned();
    const command: CoachingCommand = { type: 'record_outcome', outcome: { id: id(200), sessionId: id(100), day: '2026-11-09', status: 'completed', note: 'Completed after local midnight.' }, reason: 'User report.' };
    const input = { requestId: id(2), baseRevision: state.revision, command };
    const beforeUtcMidnight = '2026-11-08T23:30:00.000Z';
    expect(codeOf(() => proposeCoaching(state, input, actor, beforeUtcMidnight))).toBe('INVALID_INPUT');
    const proposed = proposeCoaching(state, input, actor, beforeUtcMidnight, '2026-11-09');
    const accepted = resolveCoaching(proposed.state, { proposalId: id(2), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, beforeUtcMidnight, '2026-11-09');
    expect(accepted.state.outcomes[0].day).toBe('2026-11-09');
    expect(codeOf(() => proposeCoaching(state, input, actor, '2026-11-09T02:30:00.000Z', '2026-11-08'))).toBe('INVALID_INPUT');
  });

  it('preserves the original plan anchor after an outcome has been recorded', () => {
    const state = accept(planned(), { type: 'record_outcome', outcome: { id: id(200), sessionId: id(100), day: '2026-11-07', status: 'completed', note: '' }, reason: 'User report.' }, 2).state;
    expect(codeOf(() => proposal(state, { type: 'update_session', sessionId: id(100), changes: { minutes: 90 }, reason: 'Rewrite completed plan.' }, 3))).toBe('CONFLICT');
    const replaced = accept(state, { type: 'replace_week', startDay: '2026-11-02', sessions: [], reason: 'Remove remaining plans this week.' }, 4).state;
    expect(replaced.sessions.map(item => item.id)).toEqual([id(100)]);
    expect(replaced.outcomes).toEqual(state.outcomes);
  });

  it('changes only requested session fields without filling omitted defaults', () => {
    const state = planned();
    const changed = accept(state, { type: 'update_session', sessionId: id(100), changes: { minutes: 20 }, reason: 'The user has less time.' }, 2).state;
    expect(changed.sessions.find(item => item.id === id(100))).toMatchObject({ minutes: 20, details: 'User-agreed session.', title: 'Easy run', day: '2026-11-07' });
    expect(codeOf(() => proposal(state, { type: 'update_session', sessionId: id(999), changes: { minutes: 20 }, reason: 'Unknown session.' }, 3))).toBe('NOT_FOUND');
  });

  it('undoes only the latest accepted change with immutable history and replay protection', () => {
    const accepted = accept(emptyCoachingState(), setup(), 1);
    const originalEntry = JSON.stringify(accepted.state.journal[0]);
    const input = { entryId: accepted.entry!.id, baseRevision: 1, requestId: id(2) };
    const undone = undoCoaching(accepted.state, input, actor, now);
    expect(undone.state.profile.primaryGoal).toBe('');
    expect(undone.state.revision).toBe(2);
    expect(undone.state.journal[1].kind).toBe('undo');
    expect(undone.state.journal[1].undoes).toBe(accepted.entry!.id);
    expect(JSON.stringify(undone.state.journal[0])).toBe(originalEntry);
    const replay = undoCoaching(undone.state, input, actor, now);
    expect(replay.replayed).toBe(true);
    expect(replay.state.revision).toBe(2);
    expect(codeOf(() => undoCoaching(undone.state, { ...input, baseRevision: 2 }, actor, now))).toBe('CONFLICT');
  });

  it('rejects undo of an older change after another agreement', () => {
    const first = accept(emptyCoachingState(), setup('First'), 1);
    const second = accept(first.state, setup('Second'), 2);
    expect(codeOf(() => undoCoaching(second.state, { entryId: first.entry!.id, baseRevision: 2, requestId: id(3) }, actor, now))).toBe('CONFLICT');
    expect(second.state.profile.primaryGoal).toBe('Second');
  });

  it('adds and forgets only explicit reviewed memories and restores a forgotten memory on undo', () => {
    const memory = { id: id(300), text: 'I prefer shorter weekday sessions.', category: 'preference' as const };
    const proposed = proposal(emptyCoachingState(), { type: 'remember', memory, reason: 'The user explicitly asked to remember this.' }, 1);
    expect(proposed.state.memories).toEqual([]);
    const remembered = resolveCoaching(proposed.state, { proposalId: id(1), status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, actor, now).state;
    expect(remembered.memories[0]).toMatchObject({ ...memory, actor, recordedAt: now });
    const forgotten = accept(remembered, { type: 'forget_memory', memoryId: memory.id, reason: 'The user asked to forget this.' }, 2);
    expect(forgotten.state.memories).toEqual([]);
    const undone = undoCoaching(forgotten.state, { entryId: forgotten.entry!.id, baseRevision: forgotten.state.revision, requestId: id(3) }, actor, now);
    expect(undone.state.memories).toEqual(remembered.memories);
  });

  it('compacts history without losing pending proposals or replay protection', () => {
    let state = proposal(emptyCoachingState(), setup('Pending user choice'), 900).state;
    for (let i = 1; i <= 45; i += 1) state = accept(state, setup(`Agreed goal ${i}`), i).state;
    expect(state.revision).toBe(45);
    expect(state.journal).toHaveLength(20);
    expect(state.proposals.length).toBeLessThanOrEqual(40);
    expect(state.proposals.some(item => item.id === id(900) && item.status === 'pending')).toBe(true);
    expect(state.receipts.find(item => item.requestId === id(1))?.status).toBe('accepted');
    expect(codeOf(() => proposeCoaching(state, { requestId: id(1), baseRevision: 0, command: setup('Agreed goal 1') }, actor, now))).toBe('CONFLICT');
    expect(state.profile.primaryGoal).toBe('Agreed goal 45');
  });
});
