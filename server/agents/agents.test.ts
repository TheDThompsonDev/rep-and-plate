import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { agentRequestSchema, type AgentAction, type AgentConnection, type AgentContext, type AgentScope } from '../../src/features/connections/contracts.ts';
import { AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import { createAgentHandler, type AgentDependencies } from './http.ts';

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).reverse().forEach(fn => fn()));
const meal = { title: 'Chili', day: '2026-09-29', time: '18:30', category: 'Dinner' as const, portion: 'One bowl', calories: 450, protein: 30, carbs: 45, fat: 15, note: 'Estimated.' };
const context: AgentContext = { day: '2026-09-29', timezone: 'America/Chicago', nutrition: { days: [], goals: { calories: 2000, protein: 100, carbs: 200, fat: 60 } }, pantry: [{ id: '1', name: 'Beans', remainingServings: 2, serving: '1 cup', needsReview: false }], preferences: ['No peanuts'], workouts: [], truncated: ['preferences'] };
const owner = `local:${'a'.repeat(64)}`;
const baseHeaders = { host: 'localhost:5173', 'content-type': 'application/json', 'x-rp-client': 'web', 'x-rp-profile': 'a'.repeat(64) };
const makeStore = () => { const store = new SqliteAgentStore(':memory:'); cleanup.push(() => store.close()); return store; };
async function create(service: AgentService, scopes: AgentScope[] = ['pantry:read', 'meals:propose'], user = owner, expiresInDays = 30) {
  return await service.manage(user, { operation: 'create', name: 'Terminal', scopes, expiresInDays }) as { connection: AgentConnection; token: string };
}
function propose(requestId = randomUUID()) { return agentRequestSchema.parse({ operation: 'meals.propose', requestId, meal }); }
async function request(handler: ReturnType<typeof createAgentHandler>, body: unknown, headers: Record<string, string> = {}, path = '/api/agents/manage', method = 'POST', raw?: string) {
  const req = Readable.from([raw ?? JSON.stringify(body)]) as IncomingMessage;
  req.headers = { ...baseHeaders, ...headers }; req.url = path; req.method = method;
  let output = ''; const responseHeaders: Record<string, unknown> = {};
  const res = { statusCode: 0, setHeader: (key: string, value: unknown) => { responseHeaders[key] = value; }, end: (value: string) => { output = value; } } as unknown as ServerResponse;
  await handler(req, res);
  return { status: res.statusCode, body: JSON.parse(output), headers: responseHeaders };
}

describe('durable agent service', () => {
  it('hashes credentials and filters capabilities and context by exact scopes', async () => {
    const store = makeStore(); const service = new AgentService(store);
    const { connection, token } = await create(service, ['pantry:read']);
    await service.manage(owner, { operation: 'publish', context, dataUpdatedAt: null });
    const capabilities = await service.execute(owner, token, { operation: 'capabilities' }) as { operations: string[] };
    expect(capabilities.operations).toEqual(['capabilities', 'context.read']);
    const result = await service.execute(owner, token, { operation: 'context.read' }) as { context: unknown; stale: boolean };
    expect(result.context).toEqual({ day: context.day, timezone: context.timezone, pantry: context.pantry, truncated: [] });
    expect(result.stale).toBe(true);
    expect(JSON.stringify(await service.manage(owner, { operation: 'list' }))).not.toContain('tokenHash');
    const stored = (await store.read(owner)).document.connections[0];
    expect(stored.id).toBe(connection.id); expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(token);
    await expect(service.execute(owner, token, propose())).rejects.toMatchObject({ status: 403 });
  });
  it('replays canonical payload, rejects changed requests, and saves one proposal under races', async () => {
    const store = makeStore(); const service = new AgentService(store);
    const { token } = await create(service); const input = propose();
    const results = await Promise.all(Array.from({ length: 6 }, () => service.execute(owner, token, input))) as { action: AgentAction }[];
    expect(new Set(results.map(r => r.action.id)).size).toBe(1);
    expect((await store.read(owner)).document.actions).toHaveLength(1);
    if (input.operation !== 'meals.propose') throw Error('test');
    const reordered = agentRequestSchema.parse({ operation: 'meals.propose', requestId: input.requestId, meal: { ...meal, title: '  Chili ' } });
    expect(await service.execute(owner, token, reordered)).toMatchObject({ replayed: true });
    await expect(service.execute(owner, token, { ...input, meal: { ...meal, calories: 451 } })).rejects.toMatchObject({ status: 409, code: 'REQUEST_CONFLICT' });
    expect((await store.read(owner)).document.context).toBeNull();
  });
  it('rechecks revoked tokens during compare-and-set retries', async () => {
    const store = makeStore(); const service = new AgentService(store);
    const { token, connection } = await create(service);
    const original = store.compareAndSet.bind(store); let first = true;
    vi.spyOn(store, 'compareAndSet').mockImplementation(async (user, version, document) => {
      if (first) { first = false; await service.manage(owner, { operation: 'revoke', connectionId: connection.id }); return false; }
      return original(user, version, document);
    });
    await expect(service.execute(owner, token, propose())).rejects.toMatchObject({ status: 401 });
    expect((await store.read(owner)).document.actions).toHaveLength(0);
  });
  it('isolates owner and connection status reads, revokes pending proposals, expires credentials', async () => {
    let now = Date.parse('2026-09-29T12:00:00Z');
    const service = new AgentService(makeStore(), () => now);
    const first = await create(service); const second = await create(service); const other = await create(service, ['meals:propose'], 'other', 1);
    const { action } = await service.execute(owner, first.token, propose()) as { action: AgentAction };
    await expect(service.execute(owner, second.token, { operation: 'actions.get', actionId: action.id })).rejects.toMatchObject({ status: 404 });
    await expect(service.manage('other', { operation: 'resolve', actionId: action.id, status: 'accepted' })).rejects.toMatchObject({ status: 404 });
    await service.manage(owner, { operation: 'revoke', connectionId: first.connection.id });
    expect(await service.manage(owner, { operation: 'list' })).toMatchObject({ actions: [{ status: 'revoked' }] });
    await expect(service.tokenOwner(first.token)).rejects.toMatchObject({ status: 401 });
    now += 86_400_000;
    await expect(service.tokenOwner(other.token)).rejects.toMatchObject({ status: 401 });
  });
  it('keeps replay records after expiry and safely resolves a proposal only once', async () => {
    let now = Date.parse('2026-09-29T12:00:00Z'); const service = new AgentService(makeStore(), () => now);
    const { token } = await create(service); const input = propose();
    const { action } = await service.execute(owner, token, input) as { action: AgentAction };
    await service.manage(owner, { operation: 'resolve', actionId: action.id, status: 'accepted' });
    expect(await service.manage(owner, { operation: 'resolve', actionId: action.id, status: 'accepted' })).toMatchObject({ action: { status: 'accepted' } });
    await expect(service.manage(owner, { operation: 'resolve', actionId: action.id, status: 'dismissed' })).rejects.toMatchObject({ status: 409 });
    const expiring = propose(); await service.execute(owner, token, expiring);
    now += 7 * 86_400_000;
    expect(await service.execute(owner, token, expiring)).toMatchObject({ action: { status: 'expired' }, replayed: true });
  });
  it('survives closing and reopening real SQLite without persisting plaintext tokens', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rp-agents-')); cleanup.push(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'agents.sqlite'); const first = new SqliteAgentStore(path);
    const service = new AgentService(first); const { token } = await create(service); const input = propose();
    const result = await service.execute(owner, token, input); first.close();
    expect(readFileSync(path).includes(Buffer.from(token))).toBe(false);
    const second = new SqliteAgentStore(path); cleanup.push(() => second.close());
    const restarted = new AgentService(second);
    expect(await restarted.tokenOwner(token)).toBe(owner);
    expect(await restarted.execute(owner, token, input)).toEqual({ ...(result as object), replayed: true });
  });
  it('uses current cloud snapshot metadata instead of stale browser publication', async () => {
    const now = Date.parse('2026-09-29T12:00:00Z');
    const snapshot = vi.fn(async () => ({ context: { ...context, pantry: [] }, revision: 21, updatedAt: '2026-09-29T11:59:00Z' }));
    const service = new AgentService(makeStore(), () => now, snapshot); const { token } = await create(service);
    await service.manage(owner, { operation: 'publish', context, dataUpdatedAt: null });
    expect(await service.execute(owner, token, { operation: 'context.read' })).toMatchObject({ context: { pantry: [] }, mode: 'cloud_snapshot', sourceRevision: 21, dataUpdatedAt: '2026-09-29T11:59:00Z', ageSeconds: 60, stale: false });
  });
  it('bounds storage without pruning prior idempotency receipts', async () => {
    const store = makeStore(); const service = new AgentService(store); const { token } = await create(service);
    const input = propose(); const { action } = await service.execute(owner, token, input) as { action: AgentAction };
    const current = await store.read(owner);
    current.document.actions = [action, ...Array.from({ length: 999 }, () => ({ ...action, id: randomUUID(), requestId: randomUUID() }))];
    await store.compareAndSet(owner, current.version, current.document);
    await expect(service.execute(owner, token, propose())).rejects.toMatchObject({ status: 409, code: 'CAPACITY' });
    expect(await service.execute(owner, token, input)).toMatchObject({ replayed: true, action: { id: action.id } });
    expect((await store.read(owner)).document.actions).toHaveLength(1000);
  });
  it('does not refresh data age when republishing unchanged records or use stale cache if cloud snapshot disappears', async () => {
    let now = Date.parse('2026-09-29T12:00:00Z'); const store = makeStore(); const service = new AgentService(store, () => now);
    const { token } = await create(service);
    await service.manage(owner, { operation: 'publish', context, dataUpdatedAt: '2026-09-29T12:00:00Z' });
    now += 600_000;
    await service.manage(owner, { operation: 'publish', context, dataUpdatedAt: '2026-09-29T12:00:00Z' });
    expect(await service.execute(owner, token, { operation: 'context.read' })).toMatchObject({ ageSeconds: 600, stale: true });
    const hosted = new AgentService(store, () => now, async () => null);
    await expect(hosted.execute(owner, token, { operation: 'context.read' })).rejects.toMatchObject({ code: 'CONTEXT_UNAVAILABLE' });
  });
  it('bounds multibyte payload storage while keeping resolution available', async () => {
    const store = makeStore(); const service = new AgentService(store); const { token } = await create(service);
    const { action } = await service.execute(owner, token, propose()) as { action: AgentAction };
    const current = await store.read(owner);
    const exemplar = { ...action, meal: { ...meal, note: '餐'.repeat(2000) } };
    const entryBytes = Buffer.byteLength(JSON.stringify(exemplar), 'utf8') + 1;
    const count = Math.ceil((4_495_000 - Buffer.byteLength(JSON.stringify(current.document), 'utf8')) / entryBytes);
    current.document.actions.push(...Array.from({ length: count }, () => ({ ...exemplar, id: randomUUID(), requestId: randomUUID() })));
    expect(Buffer.byteLength(JSON.stringify(current.document), 'utf8')).toBeGreaterThanOrEqual(4_495_000);
    expect(current.document.actions.length).toBeLessThan(1000);
    await store.compareAndSet(owner, current.version, current.document);
    await expect(service.execute(owner, token, { operation: 'meals.propose', requestId: randomUUID(), meal: { ...meal, note: '餐'.repeat(2000) } })).rejects.toMatchObject({ code: 'CAPACITY' });
    expect(await service.manage(owner, { operation: 'resolve', actionId: action.id, status: 'dismissed' })).toMatchObject({ action: { status: 'dismissed' } });
  });
});

describe('agent HTTP boundary', () => {
  it('rejects foreign origins, hosts, missing profile/client and local cloud credentials', async () => {
    const handler = createAgentHandler({ store: makeStore() });
    for (const headers of [{ origin: 'https://evil.example' }, { host: 'evil.example' }, { 'x-rp-client': '' }, { authorization: 'Bearer cloud' }] as Record<string, string>[]) {
      expect((await request(handler, { operation: 'list' }, headers)).status).toBe(403);
    }
    expect((await request(handler, { operation: 'list' }, { 'x-rp-profile': '' })).status).toBe(400);
    expect((await request(handler, { operation: 'list' })).status).toBe(200);
    const other = await request(handler, { operation: 'list' }, { 'x-rp-profile': 'b'.repeat(64) });
    expect(other.body.connections).toEqual([]);
  });
  it('returns structured errors for malformed inputs and forbids foreign-origin agent requests', async () => {
    const store = makeStore(); const handler = createAgentHandler({ store });
    const created = await request(handler, { operation: 'create', name: 'CLI', scopes: ['meals:propose'], expiresInDays: 30 });
    const headers = { authorization: `Bearer ${created.body.token}` };
    const path = '/api/agents/v1';
    expect((await request(handler, null, headers, path, 'POST', '{bad')).body.error.code).toBe('INVALID_JSON');
    expect((await request(handler, [], headers, path)).body.error.code).toBe('INVALID_REQUEST');
    expect((await request(handler, { operation: 'capabilities', extra: true }, headers, path)).status).toBe(400);
    expect((await request(handler, { operation: 'capabilities' }, { ...headers, origin: 'https://evil.example' }, path)).status).toBe(403);
    expect((await request(handler, { operation: 'capabilities' }, headers, path, 'GET')).status).toBe(405);
    expect((await request(handler, { operation: 'capabilities' }, { ...headers, 'content-type': 'text/plain' }, path)).status).toBe(415);
    expect((await request(handler, {}, headers, path, 'POST', 'x'.repeat(1_000_001))).status).toBe(413);
    expect((await request(handler, { operation: 'meals.propose', requestId: randomUUID(), meal: { ...meal, day: '2026-02-30' } }, headers, path)).status).toBe(400);
    const proposed = await request(handler, { operation: 'meals.propose', requestId: randomUUID(), meal }, headers, path);
    expect(proposed.body.reviewUrl).toBe('http://localhost:5173/#connections');
    expect((await request(handler, { operation: 'actions.get', actionId: proposed.body.action.id }, headers, path)).body.reviewUrl).toBe('http://localhost:5173/#connections');
  });
  it('requires verified hosted owner, account eligibility and admission, releases lease on errors', async () => {
    const store = makeStore(); const authenticate = vi.fn(async () => 'hosted-user');
    const admit = vi.fn(async () => ({ allowed: true, lease: 'lease' })); const release = vi.fn(async () => {}); const active = vi.fn(async () => true);
    const deps: AgentDependencies = { store, origin: 'https://repandplate.com', authenticate, admit, release, active };
    const handler = createAgentHandler(deps);
    expect((await request(handler, { operation: 'list' })).status).toBe(401);
    const created = await request(handler, { operation: 'create', name: 'CLI', scopes: ['meals:propose'], expiresInDays: 30 }, { authorization: 'Bearer session' });
    expect(created.status).toBe(200); expect(authenticate).toHaveBeenCalledWith('session');
    const agent = await request(handler, { operation: 'capabilities' }, { authorization: `Bearer ${created.body.token}` }, '/api/agents/v1');
    expect(agent.status).toBe(200); expect(admit).toHaveBeenLastCalledWith('hosted-user', false); expect(release).toHaveBeenCalledTimes(2);
    await request(handler, null, { authorization: `Bearer ${created.body.token}` }, '/api/agents/v1', 'POST', '{bad');
    expect(release).toHaveBeenCalledTimes(3);
    active.mockResolvedValue(false);
    expect((await request(handler, { operation: 'capabilities' }, { authorization: `Bearer ${created.body.token}` }, '/api/agents/v1')).status).toBe(403);
    active.mockResolvedValue(true); admit.mockResolvedValue({ allowed: false, lease: '' });
    expect((await request(handler, { operation: 'capabilities' }, { authorization: `Bearer ${created.body.token}` }, '/api/agents/v1')).status).toBe(429);
  });
});
