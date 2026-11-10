import { z } from 'zod';
import {
  COACHING_EVIDENCE_LIMITS, coachingContentSchema, coachingDaySchema, coachingImportInputSchema, coachingProposeInputSchema,
  coachingResolveInputSchema, coachingStateSchema, coachingUndoInputSchema,
  type CoachingActivity, type CoachingBrief, type CoachingCommand, type CoachingContent, type CoachingEvidenceView,
  type CoachingImportInput, type CoachingImportReceipt, type CoachingJournalEntry, type CoachingNutritionDay,
  type CoachingProposeInput, type CoachingProposal, type CoachingReceipt, type CoachingResolveInput,
  type CoachingState, type CoachingUndoInput, type CoachingWeeklyReview,
} from './contracts';

type ErrorCode = 'INVALID_INPUT' | 'CONFLICT' | 'NOT_FOUND' | 'LIMIT' | 'CONFIRMATION_REQUIRED';
export class CoachingError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'CoachingError';
    this.status = code === 'NOT_FOUND' ? 404 : code === 'CONFLICT' ? 409 : code === 'LIMIT' ? 422 : 400;
  }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new CoachingError('INVALID_INPUT', result.error.issues.slice(0, 3).map(issue => `${issue.path.join('.') || 'Input'}: ${issue.message}`).join('; '));
  return result.data;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
function contentOf(state: CoachingState): CoachingContent {
  return parse(coachingContentSchema, { profile: state.profile, sessions: state.sessions, outcomes: state.outcomes, memories: state.memories });
}
function unique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length) throw new CoachingError('CONFLICT', `Duplicate ${label} identifiers are not allowed.`);
}
function checkedState(value: CoachingState): CoachingState {
  const state = parse(coachingStateSchema, value);
  unique(state.sessions.map(item => item.id), 'session');
  unique(state.outcomes.map(item => item.id), 'outcome');
  unique(state.outcomes.map(item => item.sessionId), 'session outcome');
  unique(state.memories.map(item => item.id), 'memory');
  unique(state.proposals.map(item => item.id), 'proposal');
  unique(state.journal.map(item => item.id), 'journal entry');
  unique(state.receipts.map(item => item.requestId), 'request receipt');
  unique(state.evidence.activities.map(activityKey), 'imported activity');
  unique(state.evidence.nutritionDays.map(nutritionKey), 'imported nutrition day');
  if (state.outcomes.some(outcome => !state.sessions.some(session => session.id === outcome.sessionId))) throw new CoachingError('CONFLICT', 'A reported outcome has no matching planned session.');
  return state;
}
const activityKey = (item: { source: string; externalId: string }) => `${item.source}\u0000${item.externalId}`;
const nutritionKey = (item: { source: string; day: string }) => `${item.source}\u0000${item.day}`;
function timestamp(now: string | Date) {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new CoachingError('INVALID_INPUT', 'Use a valid operation timestamp.');
  return date.toISOString();
}
function actorName(actor: string) { return parse(z.string().trim().min(1).max(160), actor); }
function addDays(day: string, days: number) {
  const date = new Date(`${parse(coachingDaySchema, day)}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
function revision(state: CoachingState, expected: number) {
  if (state.revision !== expected) throw new CoachingError('CONFLICT', 'The agreed plan changed. Refresh and review a new proposal.');
}
function alreadyProcessed(): never { throw new CoachingError('CONFLICT', 'This request was already processed. Refresh the coaching brief to see the agreed result.'); }
function compactProposals(proposals: CoachingProposal[]) {
  const pending = proposals.filter(item => item.status === 'pending');
  if (pending.length > 40) throw new CoachingError('LIMIT', 'Review or dismiss a pending proposal before creating another.');
  const slots = Math.max(0, 40 - pending.length);
  const terminal = proposals.filter(item => item.status !== 'pending');
  return [...(slots ? terminal.slice(-slots) : []), ...pending];
}
function putReceipt(receipts: CoachingReceipt[], receipt: CoachingReceipt) {
  const next = [...receipts.filter(item => item.requestId !== receipt.requestId), receipt];
  const pending = next.filter(item => item.status === 'pending');
  const terminal = next.filter(item => item.status !== 'pending');
  const slots = Math.max(0, 2000 - pending.length);
  return [...(slots ? terminal.slice(-slots) : []), ...pending];
}
function sorted(content: CoachingContent) {
  return { ...content, sessions: [...content.sessions].sort((a, b) => a.day.localeCompare(b.day) || a.id.localeCompare(b.id)) };
}
function applyCommand(before: CoachingContent, command: CoachingCommand, actor: string, at: string, calendarDay: string): CoachingContent {
  let after: CoachingContent = before;
  switch (command.type) {
    case 'setup': after = { ...before, profile: command.profile }; break;
    case 'replace_week': {
      unique(command.sessions.map(item => item.id), 'proposed session');
      const end = addDays(command.startDay, 6);
      if (command.sessions.some(item => item.day < command.startDay || item.day > end)) throw new CoachingError('INVALID_INPUT', 'Every replacement session must be inside the selected seven-day week.');
      const protectedIds = new Set(before.outcomes.map(item => item.sessionId));
      const retained = before.sessions.filter(item => item.day < command.startDay || item.day > end || protectedIds.has(item.id));
      const added = command.sessions.filter(session => {
        const existing = retained.find(item => item.id === session.id);
        if (!existing) return true;
        if (canonical(existing) !== canonical(session)) throw new CoachingError('CONFLICT', 'A replacement cannot rewrite a reported session or a session outside this week.');
        return false;
      });
      after = sorted({ ...before, sessions: [...retained, ...added] });
      break;
    }
    case 'update_session': {
      const existing = before.sessions.find(item => item.id === command.sessionId);
      if (!existing) throw new CoachingError('NOT_FOUND', 'That planned session could not be found.');
      if (before.outcomes.some(item => item.sessionId === existing.id)) throw new CoachingError('CONFLICT', 'A reported session keeps its agreed details. Create a new planned session instead.');
      after = sorted({ ...before, sessions: before.sessions.map(item => item.id === existing.id ? { ...item, ...command.changes } : item) });
      break;
    }
    case 'record_outcome': {
      const outcome = command.outcome;
      if (!before.sessions.some(item => item.id === outcome.sessionId)) throw new CoachingError('NOT_FOUND', 'Choose an existing planned session before reporting its outcome.');
      if (outcome.day > calendarDay) throw new CoachingError('INVALID_INPUT', 'A completed or skipped outcome cannot be dated in the future.');
      const existing = before.outcomes.find(item => item.sessionId === outcome.sessionId || item.id === outcome.id);
      if (existing) {
        if (canonical({ ...existing, id: undefined }) === canonical({ ...outcome, id: undefined })) break;
        if (existing.id !== outcome.id || existing.sessionId !== outcome.sessionId) throw new CoachingError('CONFLICT', 'This session already has a different reported outcome. Review a correction using its existing outcome identifier.');
        after = { ...before, outcomes: before.outcomes.map(item => item.id === existing.id ? outcome : item) };
        break;
      }
      after = { ...before, outcomes: [...before.outcomes, outcome] };
      break;
    }
    case 'remember': {
      const existing = before.memories.find(item => item.id === command.memory.id);
      if (existing && (existing.text !== command.memory.text || existing.category !== command.memory.category)) throw new CoachingError('CONFLICT', 'That memory identifier already belongs to different details.');
      if (!existing && !before.memories.some(item => item.text === command.memory.text && item.category === command.memory.category)) after = { ...before, memories: [...before.memories, { ...command.memory, actor, recordedAt: at }] };
      break;
    }
    case 'forget_memory': {
      if (!before.memories.some(item => item.id === command.memoryId)) throw new CoachingError('NOT_FOUND', 'That saved memory could not be found.');
      after = { ...before, memories: before.memories.filter(item => item.id !== command.memoryId) };
      break;
    }
  }
  if (after.sessions.length > 90 || after.outcomes.length > 180 || after.memories.length > 60) throw new CoachingError('LIMIT', 'The retained coaching history has reached its current limit. Export and archive older records before adding more.');
  return parse(coachingContentSchema, after);
}

export function emptyCoachingState(): CoachingState {
  return { revision: 0, profile: { primaryGoal: '', priorities: [], constraints: [], notes: '' }, sessions: [], outcomes: [], memories: [], proposals: [], journal: [], receipts: [], evidence: { activities: [], nutritionDays: [] } };
}
export function proposeCoaching(rawState: CoachingState, rawInput: CoachingProposeInput, rawActor: string, now: string | Date, calendarDay?: string) {
  const state = checkedState(rawState), input = parse(coachingProposeInputSchema, rawInput), actor = actorName(rawActor), at = timestamp(now);
  const day = parse(coachingDaySchema, calendarDay ?? at.slice(0, 10));
  const signature = canonical({ ...input, actor });
  const receipt = state.receipts.find(item => item.requestId === input.requestId);
  const existing = state.proposals.find(item => item.requestId === input.requestId);
  if (receipt) {
    if (receipt.operation !== 'propose' || receipt.canonicalInput !== signature) throw new CoachingError('CONFLICT', 'This request identifier already belongs to different details.');
    if (!existing) alreadyProcessed();
    return { state, proposal: existing!, replayed: true };
  }
  if (existing) {
    if (canonical({ requestId: existing.requestId, baseRevision: existing.baseRevision, command: existing.command, actor: existing.actor }) !== signature) throw new CoachingError('CONFLICT', 'This request identifier already belongs to different details.');
    return { state, proposal: existing, replayed: true };
  }
  if (state.journal.some(item => item.requestId === input.requestId)) alreadyProcessed();
  revision(state, input.baseRevision);
  const before = contentOf(state);
  const proposal: CoachingProposal = { id: input.requestId, requestId: input.requestId, baseRevision: state.revision, command: input.command, status: 'pending', actor, createdAt: at, before, after: applyCommand(before, input.command, actor, at, day) };
  const next = { ...state, proposals: compactProposals([...state.proposals, proposal]), receipts: putReceipt(state.receipts, { requestId: input.requestId, operation: 'propose', canonicalInput: signature, status: 'pending', proposalId: proposal.id, at }) };
  return { state: checkedState(next), proposal, replayed: false };
}
export function resolveCoaching(rawState: CoachingState, rawInput: CoachingResolveInput, rawActor: string, now: string | Date, calendarDay?: string) {
  const state = checkedState(rawState), input = parse(coachingResolveInputSchema, rawInput), actor = actorName(rawActor), at = timestamp(now);
  const day = parse(coachingDaySchema, calendarDay ?? at.slice(0, 10));
  const proposal = state.proposals.find(item => item.id === input.proposalId);
  if (!proposal) {
    if (state.receipts.some(item => item.proposalId === input.proposalId)) alreadyProcessed();
    throw new CoachingError('NOT_FOUND', 'That coaching proposal could not be found.');
  }
  if (proposal.status !== 'pending') {
    if (proposal.status !== input.status) throw new CoachingError('CONFLICT', 'That proposal was already resolved differently.');
    return { state, proposal, entry: state.journal.find(item => item.proposalId === proposal.id && item.kind === 'apply'), replayed: true };
  }
  let entry: CoachingJournalEntry | undefined;
  let content = contentOf(state);
  if (input.status === 'accepted') {
    if (input.confirmation !== 'APPLY_REVIEWED_CHANGE') throw new CoachingError('CONFIRMATION_REQUIRED', 'Review the before and after details before applying this change.');
    revision(state, proposal.baseRevision);
    if (canonical(content) !== canonical(proposal.before)) throw new CoachingError('CONFLICT', 'The agreed details changed. Refresh and create a new proposal.');
    const recomputed = applyCommand(content, proposal.command, proposal.actor, proposal.createdAt, day);
    if (canonical(recomputed) !== canonical(proposal.after)) throw new CoachingError('CONFLICT', 'The proposal no longer matches its reviewed details. Create a new proposal.');
    content = recomputed;
    entry = { id: proposal.id, revision: state.revision + 1, kind: 'apply', proposalId: proposal.id, requestId: proposal.requestId, baseRevision: state.revision, actor, at, reason: proposal.command.reason, before: proposal.before, after: content };
  }
  const resolved: CoachingProposal = { ...proposal, status: input.status, resolvedAt: at, resolvedBy: actor };
  const oldReceipt = state.receipts.find(item => item.requestId === proposal.requestId);
  const next: CoachingState = {
    ...state, ...content, revision: entry?.revision ?? state.revision,
    proposals: compactProposals(state.proposals.map(item => item.id === proposal.id ? resolved : item)),
    journal: entry ? [...state.journal, entry].slice(-20) : state.journal,
    receipts: putReceipt(state.receipts, { requestId: proposal.requestId, operation: 'propose', canonicalInput: oldReceipt?.canonicalInput ?? canonical({ requestId: proposal.requestId, baseRevision: proposal.baseRevision, command: proposal.command, actor: proposal.actor }), status: input.status, proposalId: proposal.id, ...(entry ? { entryId: entry.id } : {}), at }),
  };
  return { state: checkedState(next), proposal: resolved, entry, replayed: false };
}
export function undoCoaching(rawState: CoachingState, rawInput: CoachingUndoInput, rawActor: string, now: string | Date) {
  const state = checkedState(rawState), input = parse(coachingUndoInputSchema, rawInput), actor = actorName(rawActor), at = timestamp(now);
  const signature = canonical({ ...input, actor });
  const receipt = state.receipts.find(item => item.requestId === input.requestId);
  if (receipt) {
    if (receipt.operation !== 'undo' || receipt.canonicalInput !== signature) throw new CoachingError('CONFLICT', 'This request identifier already belongs to different details.');
    const existing = state.journal.find(item => item.id === receipt.entryId);
    if (!existing) alreadyProcessed();
    return { state, entry: existing!, replayed: true };
  }
  if (state.proposals.some(item => item.requestId === input.requestId) || state.journal.some(item => item.requestId === input.requestId)) throw new CoachingError('CONFLICT', 'Choose a new request identifier for this undo.');
  revision(state, input.baseRevision);
  const previous = state.journal.at(-1);
  if (!previous || previous.id !== input.entryId || previous.kind !== 'apply' || previous.revision !== state.revision) throw new CoachingError('CONFLICT', 'Only the latest agreed change can be undone. Refresh the coaching brief.');
  const before = contentOf(state);
  if (canonical(before) !== canonical(previous.after)) throw new CoachingError('CONFLICT', 'The current details changed. Refresh before undoing.');
  const entry: CoachingJournalEntry = { id: input.requestId, requestId: input.requestId, baseRevision: state.revision, revision: state.revision + 1, kind: 'undo', actor, at, reason: `Undo: ${previous.reason}`.slice(0, 1000), before, after: previous.before, undoes: previous.id };
  const next: CoachingState = { ...state, ...previous.before, revision: entry.revision, journal: [...state.journal, entry].slice(-20), receipts: putReceipt(state.receipts, { requestId: input.requestId, operation: 'undo', canonicalInput: signature, status: 'undone', entryId: entry.id, at }) };
  return { state: checkedState(next), entry, replayed: false };
}

export function coachingBrief(rawState: CoachingState, rawDay: string, context?: unknown): CoachingBrief {
  const state = checkedState(rawState), day = parse(coachingDaySchema, rawDay);
  void context; // External context is returned separately by the authorized service; it is never imported silently.
  const missingData: string[] = [];
  if (!state.profile.primaryGoal) missingData.push('Your primary goal has not been agreed yet.');
  const today = state.sessions.filter(item => item.day === day);
  if (!today.length) missingData.push('No session is planned for this date.');
  if (!state.outcomes.length) missingData.push('No completed or skipped outcomes have been reported.');
  const reported = new Set(state.outcomes.map(item => item.sessionId));
  const unreported = state.sessions.filter(item => item.day < day && !reported.has(item.id));
  if (unreported.length) missingData.push(`${unreported.length} earlier planned ${unreported.length === 1 ? 'session has' : 'sessions have'} no reported outcome. An absent report does not mean skipped.`);
  return { day, revision: state.revision, profile: state.profile, today, upcoming: state.sessions.filter(item => item.day > day && item.day <= addDays(day, 13)).slice(0, 21), recentChanges: [...state.journal].reverse().slice(0, 3), memories: state.memories, outcomes: state.outcomes.filter(item => item.day <= day).slice(-14), missingData };
}
export function coachingWeeklyReview(rawState: CoachingState, rawEndDay: string): CoachingWeeklyReview {
  const state = checkedState(rawState), endDay = parse(coachingDaySchema, rawEndDay), startDay = addDays(endDay, -6);
  const planned = state.sessions.filter(item => item.day >= startDay && item.day <= endDay);
  const outcomes = state.outcomes.filter(item => item.day >= startDay && item.day <= endDay);
  const completed = outcomes.filter(item => item.status === 'completed'), skipped = outcomes.filter(item => item.status === 'skipped');
  const reported = new Set(state.outcomes.map(item => item.sessionId));
  const unreported = planned.filter(item => !reported.has(item.id));
  const completedWithoutMinutes = completed.filter(item => item.actualMinutes === undefined).length;
  const observations = [`${planned.length} planned sessions; ${completed.length} explicitly reported completed and ${skipped.length} explicitly reported skipped. Outcomes are grouped by the date reported for the activity.`];
  if (unreported.length) observations.push(`${unreported.length} planned sessions have no reported outcome. Missing reports are unknown, not missed workouts.`);
  if (completedWithoutMinutes) observations.push(`${completedWithoutMinutes} completed sessions have no reported actual duration; planned minutes are not substituted.`);
  if (!outcomes.length) observations.push('No actual outcomes were reported for this period.');
  return { startDay, endDay, planned, outcomes, completed, skipped, unreported, plannedMinutes: planned.reduce((sum, item) => sum + item.minutes, 0), completedActualMinutes: completed.reduce((sum, item) => sum + (item.actualMinutes ?? 0), 0), completedWithoutMinutes, observations };
}

/** Upsert one keyed evidence list. Identical resubmissions change nothing, so retries are safe without a request id. */
function mergeEvidence<T extends { day: string; actor: string; recordedAt: string }, I>(existing: T[], incoming: I[], removed: Set<string>, key: (item: T | I) => string, stamp: (item: I) => T, limit: number) {
  const counts = { added: 0, updated: 0, unchanged: 0, removed: 0 };
  const map = new Map(existing.map(item => [key(item), item]));
  for (const id of removed) if (map.delete(id)) counts.removed++;
  for (const item of incoming) {
    const id = key(item), previous = map.get(id), next = stamp(item);
    if (!previous) counts.added++;
    else if (canonical({ ...previous, actor: undefined, recordedAt: undefined }) === canonical({ ...next, actor: undefined, recordedAt: undefined })) { counts.unchanged++; continue; }
    else counts.updated++;
    map.set(id, next);
  }
  const ordered = [...map.values()].sort((a, b) => a.day.localeCompare(b.day) || key(a).localeCompare(key(b)));
  const dropped = Math.max(0, ordered.length - limit);
  return { items: ordered.slice(dropped), counts, dropped };
}
/**
 * Save records the user asked to bring in from another app. They never change the agreed plan,
 * mark a session done, or write the food diary, so the plan revision and pending proposals are untouched.
 */
export function importCoachingEvidence(rawState: CoachingState, rawInput: CoachingImportInput, rawActor: string, now: string | Date, calendarDay?: string) {
  const state = checkedState(rawState), input = parse(coachingImportInputSchema, rawInput), actor = actorName(rawActor), at = timestamp(now);
  const day = parse(coachingDaySchema, calendarDay ?? at.slice(0, 10));
  unique(input.activities.map(activityKey), 'submitted activity');
  unique(input.nutritionDays.map(nutritionKey), 'submitted nutrition day');
  // One day of slack covers a user whose device is ahead of the server's calendar day.
  if ([...input.activities, ...input.nutritionDays].some(item => item.day > addDays(day, 1))) throw new CoachingError('INVALID_INPUT', 'A reported record cannot be dated in the future.');
  if (input.activities.some(item => item.maxHeartRate !== undefined && item.avgHeartRate !== undefined && item.maxHeartRate < item.avgHeartRate)) throw new CoachingError('INVALID_INPUT', 'Maximum heart rate cannot be lower than the average.');
  const activities = mergeEvidence<CoachingActivity, typeof input.activities[number]>(state.evidence.activities, input.activities, new Set((input.remove?.activities ?? []).map(activityKey)), activityKey, item => ({ ...item, actor, recordedAt: at }), COACHING_EVIDENCE_LIMITS.activities);
  const nutritionDays = mergeEvidence<CoachingNutritionDay, typeof input.nutritionDays[number]>(state.evidence.nutritionDays, input.nutritionDays, new Set((input.remove?.nutritionDays ?? []).map(nutritionKey)), nutritionKey, item => ({ ...item, actor, recordedAt: at }), COACHING_EVIDENCE_LIMITS.nutritionDays);
  const imported: CoachingImportReceipt = { activities: activities.counts, nutritionDays: nutritionDays.counts, droppedOldest: { activities: activities.dropped, nutritionDays: nutritionDays.dropped } };
  const changed = [activities, nutritionDays].some(part => part.counts.added + part.counts.updated + part.counts.removed + part.dropped > 0);
  if (!changed) return { state, imported, replayed: true };
  return { state: checkedState({ ...state, evidence: { activities: activities.items, nutritionDays: nutritionDays.items } }), imported, replayed: false };
}
/** Recent imported records plus where each source stands, so a coach can see what is current and what is missing. */
export function coachingEvidenceView(rawState: CoachingState, rawEndDay: string, days = 14): CoachingEvidenceView {
  const state = checkedState(rawState), endDay = parse(coachingDaySchema, rawEndDay), startDay = addDays(endDay, -(days - 1)), weekStart = addDays(endDay, -6);
  const inWindow = <T extends { day: string }>(items: T[]) => items.filter(item => item.day >= startDay && item.day <= endDay);
  const activities = inWindow(state.evidence.activities).slice(-40), nutritionDays = inWindow(state.evidence.nutritionDays).slice(-40);
  const weekActivities = state.evidence.activities.filter(item => item.day >= weekStart && item.day <= endDay);
  const sources = new Map<string, CoachingEvidenceView['sources'][number]>();
  const track = (kind: 'activity' | 'nutrition', item: { source: string; day: string }) => {
    const id = `${kind}:${item.source}`, entry = sources.get(id) ?? { source: item.source, kind, records: 0, latestDay: item.day };
    entry.records++; if (item.day > entry.latestDay) entry.latestDay = item.day;
    sources.set(id, entry);
  };
  state.evidence.activities.forEach(item => track('activity', item));
  state.evidence.nutritionDays.forEach(item => track('nutrition', item));
  const bySport: Record<string, number> = {};
  for (const item of weekActivities) bySport[item.sport] = (bySport[item.sport] ?? 0) + 1;
  return {
    startDay, endDay, activities, nutritionDays,
    week: { activities: weekActivities.length, minutes: Math.round(weekActivities.reduce((sum, item) => sum + item.minutes, 0)), distanceKm: Math.round(weekActivities.reduce((sum, item) => sum + (item.distanceKm ?? 0), 0) * 10) / 10, bySport },
    sources: [...sources.values()].sort((a, b) => a.source.localeCompare(b.source) || a.kind.localeCompare(b.kind)),
    totals: { activities: state.evidence.activities.length, nutritionDays: state.evidence.nutritionDays.length },
  };
}
const plannedSport: Record<string, readonly string[]> = { run: ['run'], strength: ['strength'], recovery: ['walk', 'mobility', 'swim', 'ride', 'hike'], other: ['ride', 'swim', 'walk', 'hike', 'mobility', 'other'] };
const sourceNames: Record<string, string> = { macrofactor: 'MacroFactor', coros: 'COROS', myfitnesspal: 'MyFitnessPal', trainingpeaks: 'TrainingPeaks', whoop: 'WHOOP' };
export const coachingSourceLabel = (source: string) => sourceNames[source] ?? source.replace(/(^|[ _.-])([a-z])/g, (_match, gap: string, letter: string) => `${gap ? ' ' : ''}${letter.toUpperCase()}`);
/**
 * The one to four most useful things to do next, in priority order. Facts only: an imported record
 * is a reason to ask about a planned session, never proof that the session happened.
 */
export function coachingNextSteps(rawState: CoachingState, rawDay: string): string[] {
  const state = checkedState(rawState), day = parse(coachingDaySchema, rawDay), steps: string[] = [];
  const pending = state.proposals.filter(item => item.status === 'pending');
  const current = pending.filter(item => item.baseRevision === state.revision), outdated = pending.length - current.length;
  if (current.length) steps.push(`${current.length} proposed ${current.length === 1 ? 'change is' : 'changes are'} waiting for a decision. Show the before and after, then ask whether to apply or dismiss.`);
  if (outdated) steps.push(`${outdated} older ${outdated === 1 ? 'proposal was' : 'proposals were'} prepared against an earlier plan. Dismiss and prepare again if still wanted.`);
  if (!state.profile.primaryGoal) steps.push('No primary goal is agreed yet. Ask what the plan should support, then propose a setup change.');
  const reported = new Set(state.outcomes.map(item => item.sessionId));
  const unreported = state.sessions.filter(item => item.day < day && item.day >= addDays(day, -7) && !reported.has(item.id));
  if (unreported.length) {
    const session = unreported.at(-1)!;
    const match = state.evidence.activities.find(item => item.day === session.day && (plannedSport[session.sport] ?? []).includes(item.sport));
    const lead = unreported.length === 1 ? '' : `${unreported.length} recent sessions have no reported outcome. Start with the latest. `;
    const ask = match
      ? ` A ${coachingSourceLabel(match.source)} ${match.sport} ("${match.title}", ${Math.round(match.minutes)} min) was brought in for that day. Ask whether it was this session before recording anything.`
      : ' Ask how it went. No report is unknown, not skipped.';
    steps.push(`${lead}"${session.title}" on ${session.day} has no reported outcome.${ask}`);
  }
  const today = state.sessions.filter(item => item.day === day && !reported.has(item.id));
  if (today.length) steps.push(`Today: ${today.map(item => `"${item.title}" (${item.sport}, ${item.minutes} min)`).join(' and ')}.`);
  else if (state.profile.primaryGoal && !state.sessions.some(item => item.day > day && item.day <= addDays(day, 7))) steps.push('Nothing is planned for the next seven days. Offer to plan the week around the agreed goal and constraints.');
  const latestBySource = new Map<string, string>();
  for (const item of [...state.evidence.activities, ...state.evidence.nutritionDays]) if ((latestBySource.get(item.source) ?? '') < item.day) latestBySource.set(item.source, item.day);
  const behind = [...latestBySource].filter(([, latest]) => latest < addDays(day, -2)).sort(([a], [b]) => a.localeCompare(b));
  if (behind.length) steps.push(`Records from ${behind.map(([source, latest]) => `${coachingSourceLabel(source)} stop at ${latest}`).join('; ')}. If you can reach ${behind.length === 1 ? 'that app' : 'those apps'}, offer to bring in what is new.`);
  else if (!latestBySource.size) steps.push('Nothing has been brought in from other apps. If the user tracks runs, lifting or nutrition elsewhere and you can reach it, offer to bring in the last week.');
  return steps.slice(0, 4);
}
