import type { CallToolResult, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { coachingCommandSchema, coachingImportInputSchema } from '../../src/features/coaching/contracts.ts';
import { registerCoachingPrompts } from './coaching-prompts.ts';
import { daySchema, type AgentRequest } from '../../src/features/connections/contracts.ts';
import { COACHING_APP_MIME, COACHING_APP_URI, coachingAppResource } from '../../server/agents/coaching-app.ts';
import { spotNote, spotToolNote, type SpotMoment } from '../../src/features/spot/assistant.ts';

export type CoachingMcpCall = (request: AgentRequest) => Promise<CallToolResult>;

type Row = Record<string, unknown>;
const object = (value: unknown): Row => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : [];
const fields = (value: unknown, keys: readonly string[]): Row => {
  const source = object(value);
  return Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]));
};
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const sessionFields = ['id', 'day', 'sport', 'title', 'minutes', 'details'];
const outcomeFields = ['id', 'sessionId', 'day', 'status', 'actualMinutes', 'effort', 'note'];
const memoryFields = ['id', 'text', 'category'];
const profileFields = ['primaryGoal', 'priorities', 'constraints', 'notes'];
const contentFields = { sessions: sessionFields, outcomes: outcomeFields, memories: memoryFields };
const activityFields = ['source', 'externalId', 'day', 'startTime', 'sport', 'title', 'minutes', 'distanceKm', 'elevationGainM', 'avgPaceSecPerKm', 'avgHeartRate', 'maxHeartRate', 'effort', 'note'];
const nutritionFields = ['source', 'day', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'complete', 'note'];

/** One line per lift keeps a strength session readable without spending the context on set objects. */
function activityView(value: unknown): Row {
  const item = object(value), view = fields(item, activityFields);
  if (view.note === '') delete view.note;
  const unit = typeof item.weightUnit === 'string' ? item.weightUnit : '';
  const exercises = rows(item.exercises).map(exercise => `${String(exercise.name)}: ${rows(exercise.sets).map(set => set.weight === undefined ? String(set.reps) : `${String(set.reps)}x${String(set.weight)}${unit}`).join(', ')}`);
  return exercises.length ? { ...view, exercises } : view;
}
/** Records brought in from other apps: the last two weeks, newest last, with where each source stands. */
function evidenceView(value: unknown): Row {
  const evidence = object(value), activities = rows(evidence.activities), nutritionDays = rows(evidence.nutritionDays), totals = object(evidence.totals);
  return {
    ...fields(evidence, ['startDay', 'endDay', 'week']),
    activities: activities.slice(-20).map(activityView),
    nutritionDays: nutritionDays.slice(-14).map(item => { const view = fields(item, nutritionFields); if (view.note === '') delete view.note; return view; }),
    sources: rows(evidence.sources).slice(0, 20).map(item => fields(item, ['source', 'kind', 'records', 'latestDay'])),
    totals: fields(totals, ['activities', 'nutritionDays']),
    omitted: { activities: Math.max(0, activities.length - 20), nutritionDays: Math.max(0, nutritionDays.length - 14) },
  };
}

/** Review only changed values; unrelated values in a stored snapshot never leave the service. */
function changedValues(left: unknown, right: unknown): { before: Row; after: Row } {
  const original = object(left), proposed = object(right), before: Row = {}, after: Row = {};
  const oldProfile = object(original.profile), newProfile = object(proposed.profile);
  const changedProfile = profileFields.filter(key => !same(oldProfile[key], newProfile[key]));
  if (changedProfile.length) {
    before.profile = fields(oldProfile, changedProfile);
    after.profile = fields(newProfile, changedProfile);
  }
  for (const [field, allowed] of Object.entries(contentFields)) {
    const oldRows = rows(original[field]), newRows = rows(proposed[field]);
    const oldMap = new Map(oldRows.map(item => [item.id, item]));
    const newMap = new Map(newRows.map(item => [item.id, item]));
    const changed = (items: Row[], other: Map<unknown, Row>) => items.flatMap(item => {
      const counterpart = other.get(item.id);
      if (!counterpart) return [fields(item, allowed)];
      const keys = allowed.filter(key => !same(item[key], counterpart[key]));
      if (!keys.length) return [];
      return [{ ...fields(item, ['id', ...keys]), ...(field === 'sessions' && item.title ? { label: item.title } : {}) }];
    });
    const oldChanged = changed(oldRows, newMap), newChanged = changed(newRows, oldMap);
    if (oldChanged.length || newChanged.length) { before[field] = oldChanged; after[field] = newChanged; }
  }
  return { before, after };
}

function decisionSummary(value: unknown): Row {
  const entry = object(value), before = object(entry.before), after = object(entry.after);
  const changed = ['profile', 'sessions', 'outcomes', 'memories'].filter(key => !same(before[key], after[key]));
  return {
    ...fields(entry, ['id', 'revision', 'kind', 'at', 'proposalId', 'undoes']), changed,
    // Historical reasons may repeat a preference that has since been forgotten.
    reason: `${entry.kind === 'undo' ? 'Undid' : 'Applied'} a reviewed coaching change${changed.length ? ` to ${changed.join(', ')}` : ''}.`,
  };
}

function proposalPreview(value: unknown, revision: unknown): Row {
  const proposal = object(value);
  const preview = fields(proposal, ['id', 'requestId', 'baseRevision', 'status', 'createdAt', 'resolvedAt']);
  if (proposal.status !== 'pending') return preview;
  const command = object(proposal.command);
  // An older pending command can also refer to values explicitly forgotten later.
  if (proposal.baseRevision !== revision) return { ...preview, needsReview: true };
  return { ...preview, command: fields(command, ['type', 'reason']), ...changedValues(proposal.before, proposal.after) };
}

/** Bounded coaching view for MCP. Durable receipts and historical values stay in the canonical API. */
export function projectCoachingMcpResult(value: unknown): Row {
  const source = object(value);
  if (source.error) return { error: fields(source.error, ['code', 'message', 'retryable']) };
  const state = object(source.state), brief = object(source.brief), weekly = object(source.weekly);
  const day = typeof brief.day === 'string' ? brief.day : typeof source.day === 'string' ? source.day : '';
  const allSessions = rows(state.sessions);
  const today = (Array.isArray(brief.today) ? rows(brief.today) : allSessions.filter(item => item.day === day)).slice(0, 7).map(item => fields(item, sessionFields));
  const upcoming = (Array.isArray(brief.upcoming) ? rows(brief.upcoming) : allSessions.filter(item => typeof item.day === 'string' && item.day > day)).slice(0, 21).map(item => fields(item, sessionFields));
  const sessions = [...new Map([...today, ...upcoming].map(item => [item.id, item])).values()];
  const outcomes = (Array.isArray(brief.outcomes) ? rows(brief.outcomes) : rows(state.outcomes)).slice(-14).map(item => fields(item, outcomeFields));
  const pending = rows(state.proposals).filter(proposal => proposal.status === 'pending');
  const current = pending.filter(proposal => proposal.baseRevision === state.revision);
  const older = pending.filter(proposal => proposal.baseRevision !== state.revision);
  const selected = current.slice(-5);
  if (selected.length < 5) selected.push(...older.slice(-(5 - selected.length)));
  const proposals = selected.map(proposal => proposalPreview(proposal, state.revision));
  const decisions = rows(state.journal).slice(-3).map(decisionSummary);
  const result: Row = {
    state: {
      revision: state.revision, profile: fields(state.profile, profileFields), sessions, outcomes,
      memories: rows(state.memories).slice(0, 60).map(item => fields(item, memoryFields)),
      proposals, journal: decisions,
    },
    brief: { day, today, upcoming, missingData: Array.isArray(brief.missingData) ? brief.missingData.slice(0, 10) : [] },
    weekly: {
      ...fields(weekly, ['startDay', 'endDay', 'plannedMinutes', 'completedActualMinutes', 'completedWithoutMinutes']),
      plannedSessions: rows(weekly.planned).length, completedSessions: rows(weekly.completed).length,
      skippedSessions: rows(weekly.skipped).length, unreportedSessions: rows(weekly.unreported).length,
      observations: Array.isArray(weekly.observations) ? weekly.observations.slice(0, 10) : [],
    },
    freshness: freshnessView(source.freshness),
    omitted: { sessions: Math.max(0, allSessions.length - sessions.length), outcomes: Math.max(0, rows(state.outcomes).length - outcomes.length), pendingProposals: Math.max(0, pending.length - proposals.length) },
  };
  // Which moment this is, so the assistant has something of Spot's to say and not only a list.
  const profile = object(state.profile);
  const moment: SpotMoment = source.imported ? 'imported'
    : pending.length ? 'waiting'
    : !profile.primaryGoal && !allSessions.length ? 'no_goal'
    : outcomes.some(item => item.status === 'completed' && item.day === day) ? 'done'
    : rows(weekly.unreported).length ? 'unreported'
    : today.length ? 'today'
    : 'organised';
  result.spot = spotNote(moment, day);
  if (Array.isArray(source.nextSteps)) result.nextSteps = source.nextSteps.filter((step): step is string => typeof step === 'string').slice(0, 4);
  if (source.evidence) result.evidence = evidenceView(source.evidence);
  if (source.imported) result.imported = source.imported; // Counts only; the saved records are in evidence.
  if (source.context) result.context = source.context; // Already scoped and bounded by the shared service.
  if (source.proposal) result.proposal = proposalPreview(source.proposal, state.revision);
  if (source.entry) result.entry = decisionSummary(source.entry);
  if (typeof source.replayed === 'boolean') result.replayed = source.replayed;
  return result;
}

/** Roughly how long ago, in the words a person would use. */
const ago = (seconds: number) => seconds < 120 ? 'under two minutes' : seconds < 5400 ? `${Math.round(seconds / 60)} minutes` : seconds < 172800 ? `${Math.round(seconds / 3600)} hours` : `${Math.round(seconds / 86400)} days`;

/**
 * "stale" describes only food and workouts recorded in the Rep & Plate app. Read bare, an assistant
 * told an assistant-only user their plan was out of date on every check-in, so the result says in
 * words what is current and what is not.
 */
export function freshnessView(raw: unknown): Row {
  const freshness = fields(raw, ['mode', 'publishedAt', 'dataUpdatedAt', 'sourceRevision', 'ageSeconds', 'stale']);
  const age = typeof freshness.ageSeconds === 'number' ? freshness.ageSeconds : null;
  const current = 'The coaching plan, reported outcomes, memories and records from other apps shown here are current.';
  const summary = !freshness.dataUpdatedAt || age === null
    ? `${current} No food or workouts recorded in the Rep & Plate app are available to this connection, so those are unknown, not zero. That is normal for someone who works mainly through an assistant; do not describe the plan as stale or out of date.`
    : freshness.stale
      ? `${current} Food and workouts recorded in the Rep & Plate app were last saved ${ago(age)} ago and may miss newer entries. Mention that only when your advice depends on them.`
      : `${current} Food and workouts recorded in the Rep & Plate app were saved ${ago(age)} ago.`;
  return { appliesTo: 'Food and workouts recorded in the Rep & Plate app only, never the coaching plan.', summary, ...freshness };
}

function dailyText(view: Row): string {
  if (view.error) return JSON.stringify(view, null, 2);
  const state = object(view.state), brief = object(view.brief);
  return JSON.stringify({
    ...(view.spot ? { spot: view.spot } : {}), ...(view.imported ? { imported: view.imported } : {}), ...(view.nextSteps ? { nextSteps: view.nextSteps } : {}),
    day: brief.day, revision: state.revision, profile: state.profile, activeMemories: state.memories,
    today: brief.today, upcoming: brief.upcoming, recentOutcomes: state.outcomes,
    missingData: brief.missingData, recentDecisions: state.journal,
    pendingProposals: rows(state.proposals).filter(proposal => proposal.id !== object(view.proposal).id),
    weekly: view.weekly, ...(view.evidence ? { recordsFromOtherApps: view.evidence } : {}), freshness: view.freshness, ...(view.context ? { context: view.context } : {}),
    ...(view.proposal ? { proposal: view.proposal } : {}), ...(view.entry ? { entry: view.entry } : {}),
    ...(view.replayed !== undefined ? { replayed: view.replayed } : {}), omitted: view.omitted,
  }, null, 2);
}

/** Undefined means registration precedes MCP initialization; UI remains an optional hint. */
export function coachingAppSupported(capabilities: unknown): boolean | undefined {
  if (capabilities === undefined) return undefined;
  if (!capabilities || typeof capabilities !== 'object') return false;
  const extensions = (capabilities as { extensions?: Record<string, unknown> }).extensions;
  const ui = extensions?.['io.modelcontextprotocol/ui'];
  return !!ui && typeof ui === 'object' && Array.isArray((ui as { mimeTypes?: unknown }).mimeTypes)
    && (ui as { mimeTypes: unknown[] }).mimeTypes.includes(COACHING_APP_MIME);
}

/** Works with stdio and HTTP; authorization and canonical mutations remain in the shared service. */
export function registerCoachingTools(server: McpServer, call: CoachingMcpCall, operations: readonly string[]) {
  if (!operations.some(operation => operation.startsWith('coaching.'))) return;
  const supported = coachingAppSupported(server.server.getClientCapabilities());
  const ui = supported === false ? {} : { _meta: { ui: { resourceUri: COACHING_APP_URI, visibility: ['model', 'app'] } } };
  const appVisibility = { _meta: { ui: { visibility: ['model', 'app'] } } };
  const read = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const propose = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false };
  const mutate = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false };

  const invoke = async (request: AgentRequest, explanation: string): Promise<CallToolResult> => {
    const result = await call(request);
    const text = result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
    let supplied = result.structuredContent;
    if (supplied === undefined) { try { supplied = JSON.parse(text) as Row; } catch { /* A plain error message is still useful. */ } }
    const view = supplied === undefined ? undefined : projectCoachingMcpResult(supplied);
    const details = view ? dailyText(view) : text.slice(0, 12000);
    return { ...result, ...(view ? { structuredContent: view } : {}), content: [{ type: 'text', text: `${explanation}\n${details}` }], _meta: { ...result._meta, coachingOperations: operations.filter(operation => operation.startsWith('coaching.')) } };
  };

  if (supported !== false) server.registerResource('rep-and-plate-coaching', COACHING_APP_URI, {
    title: 'Rep & Plate coaching', description: 'Canonical coaching day, upcoming sessions, and reviewed change proposals.',
    mimeType: COACHING_APP_MIME,
    _meta: { ui: {} },
  }, () => ({ contents: [coachingAppResource] }));

  registerCoachingPrompts(server, operations);

  if (operations.includes('coaching.read')) server.registerTool('get_coaching_day', {
    title: 'Your coaching day',
    description: spotToolNote + ' Start here, and use this whenever the user talks about their training, a workout they did, eating around training or how their week is going, even if they do not name Rep & Plate. Read the saved coaching plan, today/upcoming sessions, weekly brief, pending proposals, records brought in from other apps, and nextSteps: the most useful things to raise now, in priority order. The plan itself is always current. freshness describes only food and workouts recorded in the app, which are a saved snapshot and not a live device feed; read its summary before relying on them.',
    inputSchema: z.object({ day: daySchema.optional() }).strict(), annotations: read, ...ui,
  }, ({ day }) => invoke({ operation: 'coaching.read', ...(day ? { day } : {}) }, 'Saved coaching plan and next steps are shown below and are current. freshness covers app-recorded food and workouts only. Pending proposals have not been applied.'));

  if (operations.includes('coaching.propose')) server.registerTool('propose_coaching_change', {
    title: 'Review a coaching change',
    description: spotToolNote + ' Prepare a change with before/after details. This never applies it. Read the current revision first; use that baseRevision. Generate a UUID requestId once and reuse it with the identical command on retries. Present the proposal and obtain explicit user approval before resolving it.',
    inputSchema: z.object({ requestId: z.string().uuid(), baseRevision: z.number().int().nonnegative(), command: coachingCommandSchema }).strict(),
    annotations: propose, ...ui,
  }, ({ requestId, baseRevision, command }) => invoke({ operation: 'coaching.propose', requestId, baseRevision, command }, 'This is a proposed coaching change. It remains pending until explicitly approved.'));

  if (operations.includes('coaching.resolve')) server.registerTool('resolve_coaching_change', {
    title: 'Apply or dismiss a reviewed change',
    description: spotToolNote + ' Resolve a specific pending proposal. Applying requires the user to explicitly approve the displayed before/after change and confirmation="APPLY_REVIEWED_CHANGE". Never infer approval from a request to propose, plan, inspect or log feedback. Dismissal does not apply the proposal. Stale revisions must be read and reviewed again.',
    inputSchema: z.object({ proposalId: z.string().uuid(), status: z.enum(['accepted', 'dismissed']), confirmation: z.literal('APPLY_REVIEWED_CHANGE').optional() }).strict().superRefine((value, context) => {
      if (value.status === 'accepted' && value.confirmation !== 'APPLY_REVIEWED_CHANGE') context.addIssue({ code: 'custom', path: ['confirmation'], message: 'Explicit approval of the reviewed change is required.' });
    }), annotations: mutate, ...appVisibility,
  }, ({ proposalId, status, confirmation }) => invoke({ operation: 'coaching.resolve', proposalId, status, ...(confirmation ? { confirmation } : {}) }, 'Coaching proposal resolution. Only an accepted result confirms the reviewed change was applied.'));

  if (operations.includes('coaching.undo')) server.registerTool('undo_coaching_change', {
    title: 'Undo a coaching change',
    description: spotToolNote + ' Undo a recorded coaching change only after the user explicitly requests undo of that entry. Read the latest revision first and pass it as baseRevision. Generate one UUID requestId and reuse it on identical retries. The service refuses unsafe undo when newer changes would be overwritten.',
    inputSchema: z.object({ requestId: z.string().uuid(), entryId: z.string().uuid(), baseRevision: z.number().int().nonnegative() }).strict(), annotations: mutate, ...appVisibility,
  }, ({ requestId, entryId, baseRevision }) => invoke({ operation: 'coaching.undo', requestId, entryId, baseRevision }, 'Guarded undo result. Consult the returned revision and history for the saved state.'));

  if (operations.includes('coaching.import')) server.registerTool('import_records', {
    title: 'Bring in records from other apps',
    description: spotToolNote + ' Save activities (runs, rides, lifts) and daily nutrition totals the user asked you to bring in from another app such as Strava, Coros, Garmin, Buff or MacroFactor, so everything lives in one place. Name the real source and use that app’s own identifier as externalId: saving the same record again updates it instead of duplicating it. Show the user a short summary first and call this once they agree, with confirmation="SAVE_REPORTED_RECORDS". These are records with a named source: this never changes the agreed plan, never marks a planned session done, and never writes the Rep & Plate food diary. Send only values the source actually reported; leave a field out when it is unknown, never estimate it. Use remove to take back a record saved by mistake.',
    inputSchema: coachingImportInputSchema, annotations: propose, ...appVisibility,
  }, input => invoke({ operation: 'coaching.import', ...input }, 'Saved as reported records from the named apps. The agreed plan, session outcomes and food diary are unchanged. Counts are under imported.'));
}
