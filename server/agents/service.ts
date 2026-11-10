import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AgentAction, AgentRequest, ManageRequest, AgentConnection, AgentContext } from '../../src/features/connections/contracts.ts';
import type { AgentStore, Document, StoredConnection } from './store.ts';
import { agentRequestSchema, manageRequestSchema, type AgentScope } from '../../src/features/connections/contracts.ts';
import { coachingStateSchema, type CoachingState } from '../../src/features/coaching/contracts.ts';
import { CoachingError, emptyCoachingState, proposeCoaching, resolveCoaching, undoCoaching, importCoachingEvidence, coachingBrief, coachingWeeklyReview, coachingEvidenceView, coachingNextSteps } from '../../src/features/coaching/model.ts';
import { ZodError } from 'zod';

const DAY = 86_400_000;
type Snapshot = { context: AgentContext; updatedAt: string; revision: number };
type CoachingOperation = Extract<AgentRequest, { operation: 'coaching.read' | 'coaching.propose' | 'coaching.resolve' | 'coaching.undo' | 'coaching.import' }>;
export type CoachingFreshness = {
  mode: 'cloud_snapshot' | 'published_snapshot';
  publishedAt: string | null;
  dataUpdatedAt: string | null;
  sourceRevision: number | null;
  ageSeconds: number | null;
  stale: boolean;
};
const contextFields = ['nutrition', 'pantry', 'preferences', 'workouts', 'activities'] as const;
const isCoaching = (request: AgentRequest | ManageRequest): request is CoachingOperation => request.operation.startsWith('coaching.');

/** Scope filtering is shared by reads and derived coaching responses. */
export function projectAgentContext(context: AgentContext | null | undefined, scopes?: readonly AgentScope[]) {
  if (!context) return undefined;
  const result: Partial<AgentContext> = { day: context.day, timezone: context.timezone };
  for (const field of contextFields) if ((!scopes || scopes.includes(`${field}:read`)) && context[field] !== undefined) {
    Object.assign(result, { [field]: context[field] });
  }
  result.truncated = context.truncated.filter(field => !scopes || scopes.includes(`${field}:read`));
  return result;
}

function coachingDay(now: number, timezone?: string) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now)); }
  catch { return new Date(now).toISOString().slice(0, 10); }
}
export class AgentError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) { super(message); }
}
const error = (status: number, code: string, message: string): never => { throw new AgentError(status, code, message); };
const publicConnection = ({ tokenHash: _hash, ...connection }: StoredConnection): AgentConnection => connection;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function authenticate(document: Document, token: string, now: number) {
  const connection = document.connections.find(c => c.id === token.split('.')[1]);
  if (!connection || connection.revokedAt || Date.parse(connection.expiresAt) <= now || !timingSafeEqual(Buffer.from(hash(token), 'hex'), Buffer.from(connection.tokenHash, 'hex')))
    return error(401, 'INVALID_TOKEN', 'This connection is expired, revoked, or invalid. Connect again.');
  return connection;
}
function expire(document: Document, now: number) {
  for (const action of document.actions) if (action.status === 'pending' && Date.parse(action.expiresAt) <= now) { action.status = 'expired'; action.resolvedAt = action.expiresAt; }
}
function checkContentCapacity(document: Document) {
  // Reserve room below the SQL limit for later resolution/revocation timestamps.
  if (Buffer.byteLength(JSON.stringify(document), 'utf8') > 4_500_000)
    return error(409, 'CAPACITY', 'This profile has reached its connection storage limit. Existing proposals and request receipts remain available.');
}

export class AgentService {
  constructor(public store: AgentStore, private clock = Date.now, private snapshot?: (owner: string) => Promise<{ context: AgentContext; updatedAt: string; revision: number } | null>) {}
  async tokenOwner(token: string) {
    if (!/^rpagent\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.[A-Za-z0-9_-]{43}$/.test(token)) return error(401, 'INVALID_TOKEN', 'Supply a valid connection token.');
    const owner = await this.store.owner(token.split('.')[1]);
    if (!owner) return error(401, 'INVALID_TOKEN', 'This connection is invalid.');
    authenticate((await this.store.read(owner)).document, token, this.clock());
    return owner;
  }
  private async update<T>(owner: string, operation: (document: Document, now: number) => T) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { document, version } = await this.store.read(owner);
      const before = JSON.stringify(document);
      const now = this.clock();
      expire(document, now);
      const result = operation(document, now);
      if (JSON.stringify(document) === before || await this.store.compareAndSet(owner, version, document)) return result;
    }
    throw new AgentError(409, 'BUSY', 'Another request changed these records. Retry the same request.', true);
  }
  private async coachingSnapshot(owner: string) {
    // Coaching remains readable if a health snapshot is temporarily unavailable.
    // No stale browser publication or synthetic zero totals replace a missing cloud source.
    if (!this.snapshot) return undefined;
    try { return await this.snapshot(owner); }
    catch { return null; }
  }
  private coachingResponse(document: Document, state: CoachingState, snapshot: Snapshot | null | undefined, now: number, day?: string, scopes?: readonly AgentScope[]) {
    const source = this.snapshot ? snapshot?.context : document.context;
    const context = projectAgentContext(source, scopes);
    const rawUpdatedAt = this.snapshot ? snapshot?.updatedAt : document.dataUpdatedAt;
    const updated = rawUpdatedAt ? Date.parse(rawUpdatedAt) : NaN;
    const validTimestamp = Number.isFinite(updated) && updated <= now + 60_000;
    const ageSeconds = validTimestamp ? Math.max(0, Math.floor((now - updated) / 1000)) : null;
    const freshness: CoachingFreshness = {
      mode: this.snapshot ? 'cloud_snapshot' : 'published_snapshot',
      publishedAt: document.publishedAt,
      dataUpdatedAt: Number.isFinite(updated) ? rawUpdatedAt! : null,
      sourceRevision: this.snapshot && snapshot && Number.isSafeInteger(snapshot.revision) && snapshot.revision >= 0 ? snapshot.revision : null,
      ageSeconds,
      stale: !source || ageSeconds === null || ageSeconds > 300,
    };
    const targetDay = day ?? coachingDay(now, source?.timezone ?? document.context?.timezone);
    // Imported records and next steps follow the same day as the brief, so one read answers "what now?".
    return { state, brief: coachingBrief(state, targetDay, context), weekly: coachingWeeklyReview(state, targetDay), evidence: coachingEvidenceView(state, targetDay), nextSteps: coachingNextSteps(state, targetDay), freshness, ...(context ? { context } : {}) };
  }
  private coachingOperation(document: Document, request: CoachingOperation, actor: string, now: number, snapshot: Snapshot | null | undefined, scopes?: readonly AgentScope[]) {
    const parsed = coachingStateSchema.safeParse(document.coaching ?? emptyCoachingState());
    if (!parsed.success) return error(409, 'COACHING_STATE_INVALID', 'Saved coaching records could not be read. They have not been replaced.');
    try {
      const state = parsed.data;
      if (request.operation === 'coaching.read') return this.coachingResponse(document, state, snapshot, now, request.day, scopes);
      const at = new Date(now).toISOString();
      const calendarDay = coachingDay(now, snapshot?.context.timezone ?? document.context?.timezone);
      if (request.operation === 'coaching.import') {
        const saved = importCoachingEvidence(state, { activities: request.activities, nutritionDays: request.nutritionDays, remove: request.remove, confirmation: request.confirmation }, actor, at, calendarDay);
        document.coaching = saved.state;
        checkContentCapacity(document);
        return { ...this.coachingResponse(document, saved.state, snapshot, now, undefined, scopes), imported: saved.imported, replayed: saved.replayed };
      }
      const result = request.operation === 'coaching.propose'
        ? proposeCoaching(state, { requestId: request.requestId, baseRevision: request.baseRevision, command: request.command }, actor, at, calendarDay)
        : request.operation === 'coaching.resolve'
          ? resolveCoaching(state, { proposalId: request.proposalId, status: request.status, confirmation: request.confirmation }, actor, at, calendarDay)
          : undoCoaching(state, { requestId: request.requestId, entryId: request.entryId, baseRevision: request.baseRevision }, actor, at);
      document.coaching = result.state;
      checkContentCapacity(document);
      return { ...this.coachingResponse(document, result.state, snapshot, now, undefined, scopes), ...result };
    } catch (cause) {
      if (cause instanceof CoachingError) return error(cause.status, cause.code, cause.message);
      if (cause instanceof ZodError) return error(400, 'INVALID_INPUT', 'Check the coaching command, dates, and required fields.');
      throw cause;
    }
  }
  async manage(owner: string, request: ManageRequest) {
    const validated = manageRequestSchema.safeParse(request);
    if (!validated.success) return error(400, 'INVALID_REQUEST', 'Management request does not match its schema.');
    request = validated.data;
    const snapshot = isCoaching(request) ? await this.coachingSnapshot(owner) : undefined;
    return this.update(owner, (document, now): unknown => {
      const at = new Date(now).toISOString();
      if (isCoaching(request)) return this.coachingOperation(document, request, 'app', now, snapshot);
      switch (request.operation) {
        case 'list': return { connections: document.connections.map(publicConnection), actions: document.actions, publishedAt: document.publishedAt };
        case 'create': {
          if (document.connections.length >= 100) return error(409, 'CAPACITY', 'This profile has reached its connection limit (100).');
          const id = randomUUID();
          const token = `rpagent.${id}.${randomBytes(32).toString('base64url')}`;
          const connection: StoredConnection = { id, name: request.name, scopes: [...new Set(request.scopes)], createdAt: at, expiresAt: new Date(now + request.expiresInDays * DAY).toISOString(), revokedAt: null, tokenHash: hash(token) };
          document.connections.push(connection);
          checkContentCapacity(document);
          return { connection: publicConnection(connection), token };
        }
        case 'publish': {
          if (request.dataUpdatedAt && Date.parse(request.dataUpdatedAt) > now + 60_000) return error(400, 'INVALID_TIMESTAMP', 'Data update time cannot be in the future. Check your device clock.');
          document.context = request.context; document.publishedAt = at; document.dataUpdatedAt = request.dataUpdatedAt;
          checkContentCapacity(document);
          return { publishedAt: at };
        }
        case 'revoke': {
          const connection = document.connections.find(c => c.id === request.connectionId);
          if (!connection) return error(404, 'NOT_FOUND', 'Connection not found.');
          connection.revokedAt ??= at;
          for (const action of document.actions) if (action.connectionId === connection.id && action.status === 'pending') { action.status = 'revoked'; action.resolvedAt = at; }
          return { connection: publicConnection(connection) };
        }
        case 'resolve': {
          const action = document.actions.find(a => a.id === request.actionId);
          if (!action) return error(404, 'NOT_FOUND', 'Proposal not found.');
          if (action.status === request.status) return { action };
          if (action.status !== 'pending') return error(409, 'ALREADY_RESOLVED', `This proposal is ${action.status}.`);
          action.status = request.status; action.resolvedAt = at;
          return { action };
        }
      }
    });
  }
  async execute(owner: string, token: string, request: AgentRequest) {
    const validated = agentRequestSchema.safeParse(request);
    if (!validated.success) return error(400, 'INVALID_REQUEST', 'Request does not match its operation schema.');
    request = validated.data;
    if (request.operation === 'context.read' || isCoaching(request)) {
      const connection = authenticate((await this.store.read(owner)).document, token, this.clock());
      if (isCoaching(request)) {
        if (!connection.scopes.includes('coaching:read') || (request.operation !== 'coaching.read' && !connection.scopes.includes('coaching:write')))
          return error(403, 'SCOPE_REQUIRED', 'Reading coaching requires coaching:read; changing it also requires coaching:write.');
      } else if (!connection.scopes.some(s => s.endsWith(':read'))) return error(403, 'SCOPE_REQUIRED', 'This connection does not have read access.');
    }
    const snapshot = isCoaching(request) ? await this.coachingSnapshot(owner) : request.operation === 'context.read' && this.snapshot ? await this.snapshot(owner) : null;
    return this.update(owner, (document, now): unknown => {
      const connection = authenticate(document, token, now);
      const canPropose = connection.scopes.includes('meals:propose');
      if (isCoaching(request)) {
        if (!connection.scopes.includes('coaching:read') || (request.operation !== 'coaching.read' && !connection.scopes.includes('coaching:write')))
          return error(403, 'SCOPE_REQUIRED', 'Reading coaching requires coaching:read; changing it also requires coaching:write.');
        return this.coachingOperation(document, request, `connection:${connection.id}`, now, snapshot, connection.scopes);
      }
      switch (request.operation) {
        case 'capabilities': return { version: 1, connection: publicConnection(connection), scopes: connection.scopes, operations: ['capabilities', ...(connection.scopes.some(s => s.endsWith(':read')) ? ['context.read'] : []), ...(canPropose ? ['meals.propose', 'actions.get'] : []), ...(connection.scopes.includes('coaching:read') ? ['coaching.read', ...(connection.scopes.includes('coaching:write') ? ['coaching.propose', 'coaching.resolve', 'coaching.undo', 'coaching.import'] : [])] : [])], context: { mode: this.snapshot ? 'cloud_snapshot' : 'published_snapshot', publishedAt: document.publishedAt }, limits: { proposalExpiresInDays: 7, maxActions: 1000 }, guidance: 'Meal proposals require review in Rep & Plate. Proposing never logs consumption. Context is a saved snapshot, not a live device feed. Accepted means logged on the reviewing device; cloud synchronization may follow separately.' + (connection.scopes.includes('coaching:read') ? ' Coaching proposals remain pending until explicitly accepted with APPLY_REVIEWED_CHANGE. Coaching never automatically logs food or exercise completion. A reported outcome requires its own reviewed command. Records brought in from other apps with coaching.import are evidence with a named source: they never change the plan, complete a session or log food, and need SAVE_REPORTED_RECORDS after the user agrees. Read freshness before using health context; missing records remain unknown.' : '') };
        case 'context.read': {
          if (!connection.scopes.some(s => s.endsWith(':read'))) return error(403, 'SCOPE_REQUIRED', 'This connection does not have read access.');
          const context = this.snapshot ? snapshot?.context : document.context;
          if (!context) return error(409, 'CONTEXT_UNAVAILABLE', this.snapshot ? 'Open Rep & Plate and synchronize your records to the cloud.' : 'Open Connections in Rep & Plate and publish current context.');
          const result = projectAgentContext(context, connection.scopes);
          const dataUpdatedAt = snapshot?.updatedAt ?? document.dataUpdatedAt ?? null;
          const ageSeconds = dataUpdatedAt ? Math.max(0, Math.floor((now - Date.parse(dataUpdatedAt)) / 1000)) : null;
          return { context: result, publishedAt: document.publishedAt, mode: this.snapshot ? 'cloud_snapshot' : 'published_snapshot', ageSeconds, dataUpdatedAt, sourceRevision: snapshot?.revision ?? null, stale: ageSeconds === null || ageSeconds > 300 };
        }
        case 'meals.propose': {
          if (!canPropose) return error(403, 'SCOPE_REQUIRED', 'This connection cannot propose meals.');
          const previous = document.actions.find(a => a.connectionId === connection.id && a.requestId === request.requestId);
          if (previous) {
            if (JSON.stringify(previous.meal) !== JSON.stringify(request.meal)) return error(409, 'REQUEST_CONFLICT', 'This request ID was used for a different meal. Use a new request ID.');
            return { action: previous, replayed: true };
          }
          if (document.actions.length >= 1000) return error(409, 'CAPACITY', 'This profile has reached its proposal limit (1000). Previous requests remain available.');
          const action: AgentAction = { id: randomUUID(), connectionId: connection.id, connectionName: connection.name, requestId: request.requestId, meal: request.meal, status: 'pending', createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 7 * DAY).toISOString(), resolvedAt: null };
          document.actions.push(action);
          checkContentCapacity(document);
          return { action, replayed: false };
        }
        case 'actions.get': {
          if (!canPropose) return error(403, 'SCOPE_REQUIRED', 'This connection cannot read meal proposals.');
          const action = document.actions.find(a => a.id === request.actionId && a.connectionId === connection.id);
          if (!action) return error(404, 'NOT_FOUND', 'Proposal not found.');
          return { action };
        }
      }
    });
  }
}
