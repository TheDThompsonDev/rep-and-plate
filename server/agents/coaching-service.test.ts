import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AgentAction, AgentConnection, AgentContext, AgentScope, ManageRequest } from '../../src/features/connections/contracts.ts';
import { agentRequestSchema, connectionSchema, manageRequestSchema } from '../../src/features/connections/contracts.ts';
import type { CoachingCommand, CoachingState, CoachingProposal, CoachingJournalEntry } from '../../src/features/coaching/contracts.ts';
import { AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import { createAgentHandler } from './http.ts';

const stores: SqliteAgentStore[] = [];
afterEach(() => { stores.splice(0).forEach(store => store.close()); vi.restoreAllMocks(); });
const owner = 'coaching-owner';
const now = Date.parse('2026-11-08T12:00:00Z');
const setup: CoachingCommand = { type: 'setup', profile: { primaryGoal: 'Run a comfortable 5K', priorities: ['Consistency'], constraints: ['Busy weekdays'], notes: '' }, reason: 'My chosen starting goal.' };
const context: AgentContext = {
  day: '2026-11-08', timezone: 'America/Chicago',
  nutrition: { days: [{ day: '2026-11-08', meals: 1, totals: { calories: 555, protein: 40, carbs: 55, fat: 18 } }], goals: { calories: 2100, protein: 150, carbs: 220, fat: 65 }, goalsConfigured: true },
  pantry: [], preferences: ['PRIVATE FOOD PREFERENCE'], workouts: [],
  activities: [{ id: 'reported-run', title: 'PRIVATE REPORTED RUN', day: '2026-11-07', minutes: 25, note: 'PRIVATE ACTIVITY NOTE' }],
  truncated: ['activities'],
};
type Response = { state: CoachingState; proposal?: CoachingProposal; entry?: CoachingJournalEntry; replayed?: boolean; context?: Partial<AgentContext>; freshness: { ageSeconds: number | null; stale: boolean; dataUpdatedAt: string | null; sourceRevision: number | null; mode: string }; brief: { day: string }; weekly: unknown };
function service(clock = () => now, snapshot?: ConstructorParameters<typeof AgentService>[2]) {
  const store = new SqliteAgentStore(':memory:'); stores.push(store);
  return { store, service: new AgentService(store, clock, snapshot) };
}
async function connect(service: AgentService, scopes: AgentScope[] = ['coaching:read', 'coaching:write'], user = owner, expiresInDays = 30) {
  return await service.manage(user, { operation: 'create', name: 'Coaching assistant', scopes, expiresInDays }) as { token: string; connection: AgentConnection };
}
function proposal(command = setup, requestId = randomUUID(), baseRevision = 0) {
  return { operation: 'coaching.propose' as const, command, requestId, baseRevision };
}
async function accept(service: AgentService, proposalId: string, user = owner) {
  return await service.manage(user, { operation: 'coaching.resolve', proposalId, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }) as Response;
}
async function http(handler: ReturnType<typeof createAgentHandler>, body: unknown, token?: string) {
  const req = Readable.from([JSON.stringify(body)]) as IncomingMessage;
  req.method = 'POST'; req.url = token ? '/api/agents/v1' : '/api/agents/manage';
  req.headers = { host: 'localhost:5173', 'content-type': 'application/json', 'x-rp-client': 'web', 'x-rp-profile': 'a'.repeat(64), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  let output = '';
  const res = { statusCode: 0, setHeader: () => {}, end: (value: string) => { output = value; } } as unknown as ServerResponse;
  await handler(req, res);
  return { status: res.statusCode, body: JSON.parse(output) };
}

describe('canonical coaching service', () => {
  it('keeps new scopes backward compatible and exposes only authorized operations', async () => {
    const all: AgentScope[] = ['nutrition:read', 'pantry:read', 'preferences:read', 'workouts:read', 'meals:propose', 'activities:read', 'coaching:read', 'coaching:write'];
    const { service: app } = service();
    const created = await connect(app, all);
    expect(connectionSchema.safeParse(created.connection).success).toBe(true);
    expect(manageRequestSchema.safeParse({ operation: 'create', name: 'All', scopes: all, expiresInDays: 30 }).success).toBe(true);
    const capabilities = await app.execute(owner, created.token, { operation: 'capabilities' }) as { version: number; operations: string[]; guidance: string };
    expect(capabilities.version).toBe(1);
    expect(capabilities.operations).toEqual(expect.arrayContaining(['coaching.read', 'coaching.propose', 'coaching.resolve', 'coaching.undo']));
    expect(capabilities.guidance).toContain('APPLY_REVIEWED_CHANGE');
    const reader = await connect(app, ['coaching:read']);
    const readerCapabilities = await app.execute(owner, reader.token, { operation: 'capabilities' }) as { operations: string[] };
    expect(readerCapabilities.operations).toContain('coaching.read');
    expect(readerCapabilities.operations).not.toContain('coaching.propose');
    await expect(app.execute(owner, reader.token, proposal())).rejects.toMatchObject({ status: 403, code: 'SCOPE_REQUIRED' });
    const writer = await connect(app, ['coaching:write']);
    await expect(app.execute(owner, writer.token, proposal())).rejects.toMatchObject({ status: 403 });
  });

  it('shares pending, reviewed and persistent coaching between the app and external agents without changing health records', async () => {
    const { service: app, store } = service();
    const connection = await connect(app);
    await app.manage(owner, { operation: 'publish', context, dataUpdatedAt: '2026-11-08T11:59:00Z' });
    const pending = await app.execute(owner, connection.token, proposal()) as Response;
    expect(pending.state.revision).toBe(0);
    expect(pending.state.profile.primaryGoal).toBe('');
    expect(pending.proposal?.status).toBe('pending');
    const reviewed = await accept(app, pending.proposal!.id);
    expect(reviewed.state.profile.primaryGoal).toBe(setup.type === 'setup' ? setup.profile.primaryGoal : '');
    expect(reviewed.state.revision).toBe(1);
    const external = await app.execute(owner, connection.token, { operation: 'coaching.read', day: '2026-11-08' }) as Response;
    expect(external.state).toEqual(reviewed.state);
    expect(external.brief.day).toBe('2026-11-08');
    expect(external.context).toEqual({ day: context.day, timezone: context.timezone, truncated: [] });
    await app.manage(owner, { operation: 'publish', context: { ...context, pantry: [] }, dataUpdatedAt: '2026-11-08T11:58:00Z' });
    expect((await store.read(owner)).document.coaching?.revision).toBe(1);
    expect((await store.read(owner)).document.context?.nutrition.days[0].totals.calories).toBe(555);
  });

  it('filters activity and health context in both ordinary and coaching reads with no coaching leakage', async () => {
    const { service: app } = service();
    await app.manage(owner, { operation: 'publish', context, dataUpdatedAt: '2026-11-08T11:59:00Z' });
    const pending = await app.manage(owner, proposal()) as Response; await accept(app, pending.proposal!.id);
    const healthOnly = await connect(app, ['activities:read']);
    await expect(app.execute(owner, healthOnly.token, { operation: 'coaching.read' })).rejects.toMatchObject({ status: 403 });
    const activity = await app.execute(owner, healthOnly.token, { operation: 'context.read' }) as { context: Partial<AgentContext> };
    expect(activity.context.activities).toEqual(context.activities);
    expect(activity.context).not.toHaveProperty('nutrition');
    expect(JSON.stringify(activity)).not.toContain('comfortable 5K');
    expect(JSON.stringify(activity)).not.toContain('PRIVATE FOOD PREFERENCE');
    const coachOnly = await connect(app, ['coaching:read']);
    const privateRead = await app.execute(owner, coachOnly.token, { operation: 'coaching.read' }) as Response;
    expect(JSON.stringify(privateRead)).not.toContain('PRIVATE');
    expect(privateRead.context).not.toHaveProperty('nutrition');
    const scoped = await connect(app, ['coaching:read', 'activities:read']);
    const scopedRead = await app.execute(owner, scoped.token, { operation: 'coaching.read' }) as Response;
    expect(scopedRead.context?.activities).toEqual(context.activities);
    expect(scopedRead.context).not.toHaveProperty('preferences');
    const userRead = await app.manage(owner, { operation: 'coaching.read' }) as Response;
    expect(userRead.context?.nutrition).toEqual(context.nutrition);
  });

  it('replays stable requests and rejects changed IDs and concurrent accepted revisions', async () => {
    const { service: app, store } = service(); const { token } = await connect(app);
    const input = proposal();
    const results = await Promise.all(Array.from({ length: 6 }, () => app.execute(owner, token, input))) as Response[];
    expect(new Set(results.map(result => result.proposal?.id)).size).toBe(1);
    expect((await store.read(owner)).document.coaching?.proposals).toHaveLength(1);
    const changed = { ...input, command: { ...setup, reason: 'A different command with this ID.' } };
    await expect(app.execute(owner, token, changed)).rejects.toMatchObject({ status: 409 });
    const other = await app.execute(owner, token, proposal({ ...setup, reason: 'Another pending change.' })) as Response;
    await accept(app, results[0].proposal!.id);
    await expect(accept(app, other.proposal!.id)).rejects.toMatchObject({ status: 409 });
    const replay = await app.execute(owner, token, input) as Response;
    expect(replay.replayed).toBe(true);
    expect(replay.state.revision).toBe(1);
  });

  it('requires explicit acceptance and undoes once without a retry resurrecting a reviewed change', async () => {
    const { service: app } = service(); const pending = await app.manage(owner, proposal()) as Response;
    await expect(app.manage(owner, { operation: 'coaching.resolve', proposalId: pending.proposal!.id, status: 'accepted' })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    const applied = await accept(app, pending.proposal!.id);
    const input = { operation: 'coaching.undo' as const, requestId: randomUUID(), entryId: applied.entry!.id, baseRevision: 1 };
    const undone = await app.manage(owner, input) as Response;
    expect(undone.state.revision).toBe(2);
    expect(undone.state.profile.primaryGoal).toBe('');
    const repeated = await app.manage(owner, input) as Response;
    expect(repeated.replayed).toBe(true);
    expect(repeated.state.revision).toBe(2);
    expect((await accept(app, pending.proposal!.id)).state.profile.primaryGoal).toBe('');
  });

  it('rechecks revocation and expiry during compare-and-set retries', async () => {
    let clock = now;
    const { service: app, store } = service(() => clock); const { token, connection } = await connect(app, undefined, owner, 1);
    const original = store.compareAndSet.bind(store); let first = true;
    vi.spyOn(store, 'compareAndSet').mockImplementation(async (user, revision, document) => {
      if (first) { first = false; await app.manage(owner, { operation: 'revoke', connectionId: connection.id }); return false; }
      return original(user, revision, document);
    });
    await expect(app.execute(owner, token, proposal())).rejects.toMatchObject({ status: 401 });
    expect((await store.read(owner)).document.coaching).toBeUndefined();
    vi.restoreAllMocks();
    const second = await connect(app, undefined, owner, 1); let expireOnRetry = true;
    vi.spyOn(store, 'compareAndSet').mockImplementation(async (user, revision, document) => {
      if (expireOnRetry) { expireOnRetry = false; clock += 86_400_000; return false; }
      return original(user, revision, document);
    });
    await expect(app.execute(owner, second.token, proposal())).rejects.toMatchObject({ status: 401 });
  });

  it('uses real source freshness and preserves canonical state when cloud context disappears', async () => {
    const snapshot = vi.fn<() => Promise<{ context: AgentContext; updatedAt: string; revision: number } | null>>(async () => ({ context, updatedAt: '2026-11-08T11:59:00Z', revision: 9 }));
    const { service: app } = service(() => now, snapshot); const { token } = await connect(app, ['coaching:read', 'nutrition:read']);
    await app.manage(owner, { operation: 'publish', context, dataUpdatedAt: '2026-11-08T11:58:00Z' });
    const pending = await app.manage(owner, proposal()) as Response; await accept(app, pending.proposal!.id);
    const fresh = await app.execute(owner, token, { operation: 'coaching.read' }) as Response;
    expect(fresh.freshness).toMatchObject({ mode: 'cloud_snapshot', ageSeconds: 60, sourceRevision: 9, stale: false, dataUpdatedAt: '2026-11-08T11:59:00Z' });
    snapshot.mockResolvedValue(null);
    const unavailable = await app.execute(owner, token, { operation: 'coaching.read' }) as Response;
    expect(unavailable.state.revision).toBe(1);
    expect(unavailable).not.toHaveProperty('context');
    expect(unavailable.freshness).toMatchObject({ ageSeconds: null, sourceRevision: null, dataUpdatedAt: null, stale: true });
    snapshot.mockRejectedValue(new Error('Snapshot temporarily unavailable'));
    expect((await app.manage(owner, { operation: 'coaching.read' }) as Response).freshness.stale).toBe(true);
  });

  it('isolates accounts, rejects invalid request dates and preserves invalid saved state for recovery', async () => {
    const { service: app, store } = service(); const { token } = await connect(app);
    const pending = await app.manage(owner, proposal()) as Response; await accept(app, pending.proposal!.id);
    expect((await app.manage('another-owner', { operation: 'coaching.read' }) as Response).state.revision).toBe(0);
    await expect(app.execute('another-owner', token, { operation: 'coaching.read' })).rejects.toMatchObject({ status: 401 });
    expect(agentRequestSchema.safeParse({ operation: 'coaching.read', day: '2026-02-30' }).success).toBe(false);
    await expect(app.manage(owner, { operation: 'coaching.read', day: '2026-02-30' } as ManageRequest)).rejects.toMatchObject({ status: 400 });
    const current = await store.read(owner);
    current.document.coaching = { broken: true } as unknown as CoachingState;
    await store.compareAndSet(owner, current.version, current.document);
    await expect(app.manage(owner, { operation: 'coaching.read' })).rejects.toMatchObject({ status: 409, code: 'COACHING_STATE_INVALID' });
    expect((await store.read(owner)).document.coaching).toEqual({ broken: true });
  });

  it('returns actionable HTTP validation, confirmation, scope and revision errors instead of a temporary-outage response', async () => {
    const { store } = service(); const handler = createAgentHandler({ store, now: () => now });
    const created = await http(handler, { operation: 'create', name: 'Coach', scopes: ['coaching:read', 'coaching:write'], expiresInDays: 30 });
    const token = created.body.token as string;
    const invalid = await http(handler, { operation: 'coaching.read', day: '2026-02-30' }, token);
    expect(invalid.status).toBe(400);
    const proposed = await http(handler, proposal(), token);
    expect(proposed.status).toBe(200);
    const missingConfirmation = await http(handler, { operation: 'coaching.resolve', proposalId: proposed.body.proposal.id, status: 'accepted' }, token);
    expect(missingConfirmation.status).toBe(400);
    expect(missingConfirmation.body.error.code).toBe('CONFIRMATION_REQUIRED');
    expect((await http(handler, { operation: 'coaching.resolve', proposalId: proposed.body.proposal.id, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' }, token)).status).toBe(200);
    expect((await http(handler, proposal(), token)).status).toBe(409);
    const healthOnly = await http(handler, { operation: 'create', name: 'Food only', scopes: ['nutrition:read'], expiresInDays: 30 });
    expect((await http(handler, { operation: 'coaching.read' }, healthOnly.body.token)).status).toBe(403);
  });

  it('bounds coaching writes atomically without replacing existing health context or request records', async () => {
    const { service: app, store } = service(); const connection = await connect(app);
    await app.manage(owner, { operation: 'publish', context, dataUpdatedAt: '2026-11-08T11:59:00Z' });
    const current = await store.read(owner);
    const action: AgentAction = {
      id: randomUUID(), connectionId: connection.connection.id, connectionName: 'Stored assistant', requestId: randomUUID(),
      meal: { title: 'Recorded estimate', day: '2026-11-08', time: '12:00', category: 'Lunch', portion: 'One portion', calories: 400, protein: 30, carbs: 45, fat: 12, note: '漢'.repeat(2000) },
      status: 'dismissed', createdAt: '2026-11-08T10:00:00Z', expiresAt: '2026-11-15T10:00:00Z', resolvedAt: '2026-11-08T10:01:00Z',
    };
    const bytes = Buffer.byteLength(JSON.stringify(action), 'utf8') + 1;
    const count = Math.ceil((4_300_000 - Buffer.byteLength(JSON.stringify(current.document), 'utf8')) / bytes);
    current.document.actions = Array.from({ length: count }, () => ({ ...action, id: randomUUID(), requestId: randomUUID() }));
    expect(current.document.actions.length).toBeLessThan(1000);
    expect(Buffer.byteLength(JSON.stringify(current.document), 'utf8')).toBeLessThan(4_500_000);
    await store.compareAndSet(owner, current.version, current.document);
    const command: CoachingCommand = { type: 'replace_week', startDay: '2026-11-08', reason: 'A reviewed future week.', sessions: Array.from({ length: 21 }, (_, index) => ({ id: randomUUID(), day: `2026-11-${String(8 + index % 7).padStart(2, '0')}`, sport: 'other', title: `Session ${index + 1}`, minutes: 20, details: '漢'.repeat(2000) })) };
    await expect(app.execute(owner, connection.token, proposal(command))).rejects.toMatchObject({ status: 409, code: 'CAPACITY' });
    const saved = (await store.read(owner)).document;
    expect(saved.coaching).toBeUndefined();
    expect(saved.actions).toHaveLength(count);
    expect(saved.context).toEqual(context);
  });
});
