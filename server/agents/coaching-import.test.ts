import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createAgentHandler } from './http.ts';
import { AgentError, AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import type { AgentRequest, AgentScope } from '../../src/features/connections/contracts.ts';
import type { CoachingEvidenceView, CoachingImportReceipt, CoachingState } from '../../src/features/coaching/contracts.ts';

const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
const owner = 'import-owner';
const now = Date.parse('2026-11-10T15:00:00Z');
const confirmation = 'SAVE_REPORTED_RECORDS' as const;
const run = { source: 'strava', externalId: 'run-9', day: '2026-11-09', sport: 'run' as const, title: 'Long run', minutes: 95, distanceKm: 18.1, avgHeartRate: 146, note: '' };
const lift = { source: 'buff', externalId: 'lift-4', day: '2026-11-08', sport: 'strength' as const, title: 'Lower body', minutes: 50, weightUnit: 'kg' as const, exercises: [{ name: 'Squat', sets: [{ reps: 5, weight: 100 }, { reps: 5, weight: 100 }] }], note: '' };
const macros = { source: 'macrofactor', day: '2026-11-09', calories: 2710, protein: 165, carbs: 340, fat: 72, note: '' };
const records: AgentRequest = { operation: 'coaching.import', activities: [run, lift], nutritionDays: [macros], confirmation };
type Saved = { state: CoachingState; imported: CoachingImportReceipt; replayed: boolean; evidence: CoachingEvidenceView; nextSteps: string[] };

async function fixture(scopes: AgentScope[] = ['coaching:read', 'coaching:write']) {
  const store = new SqliteAgentStore(':memory:'); cleanup.push(() => store.close());
  const service = new AgentService(store, () => now);
  const credential = await service.manage(owner, { operation: 'create', name: 'Daily coach', scopes, expiresInDays: 30 }) as { token: string };
  const handler = createAgentHandler({ store, now: () => now });
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/agents/mcp`);
  const connect = async () => {
    const client = new Client({ name: 'import-integration', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${credential.token}` } } }));
    cleanup.push(() => client.close());
    return client;
  };
  return { service, token: credential.token, connect };
}
const text = (result: { content?: unknown }) => (result.content as { text: string }[])[0].text;

describe('bringing other apps into the coaching record', () => {
  it('saves reported records for a write connection and returns them with the day', async () => {
    const f = await fixture();
    const saved = await f.service.execute(owner, f.token, records) as Saved;
    expect(saved.imported.activities.added).toBe(2);
    expect(saved.imported.nutritionDays.added).toBe(1);
    expect(saved.replayed).toBe(false);
    expect(saved.state.revision).toBe(0);
    expect(saved.state.evidence.activities.every(item => item.actor.startsWith('connection:'))).toBe(true);
    const read = await f.service.execute(owner, f.token, { operation: 'coaching.read' }) as Saved;
    expect(read.evidence.week).toMatchObject({ activities: 2, minutes: 145, distanceKm: 18.1 });
    expect(read.evidence.sources.map(item => item.source)).toEqual(['buff', 'macrofactor', 'strava']);
    expect(read.nextSteps[0]).toContain('No primary goal');
    // The same batch again is a replay, not three more records.
    const again = await f.service.execute(owner, f.token, records) as Saved;
    expect(again.replayed).toBe(true);
    expect(again.state.evidence.activities).toHaveLength(2);
  });

  it('refuses a read-only connection, a missing confirmation, and another account', async () => {
    const reader = await fixture(['coaching:read']);
    await expect(reader.service.execute(owner, reader.token, records)).rejects.toMatchObject({ status: 403, code: 'SCOPE_REQUIRED' });
    const capabilities = await reader.service.execute(owner, reader.token, { operation: 'capabilities' }) as { operations: string[] };
    expect(capabilities.operations).not.toContain('coaching.import');
    const writer = await fixture();
    const unconfirmed = { ...records, confirmation: undefined } as unknown as AgentRequest;
    await expect(writer.service.execute(owner, writer.token, unconfirmed)).rejects.toBeInstanceOf(AgentError);
    await writer.service.execute(owner, writer.token, records);
    const stranger = await writer.service.manage('someone-else', { operation: 'coaching.read' }) as Saved;
    expect(stranger.state.evidence.activities).toEqual([]);
  });

  it('lets the app remove a record without changing the plan revision', async () => {
    const f = await fixture();
    await f.service.execute(owner, f.token, records);
    const removed = await f.service.manage(owner, { operation: 'coaching.import', activities: [], nutritionDays: [], remove: { activities: [{ source: 'strava', externalId: 'run-9' }], nutritionDays: [] }, confirmation }) as Saved;
    expect(removed.imported.activities.removed).toBe(1);
    expect(removed.state.evidence.activities.map(item => item.externalId)).toEqual(['lift-4']);
    expect(removed.state.revision).toBe(0);
  });
});

describe('the remote MCP experience', () => {
  it('speaks for Spot, lists check-in prompts and brings records in through one confirmed call', async () => {
    const f = await fixture();
    const client = await f.connect();
    expect(client.getInstructions()).toContain('Spot');
    expect(client.getInstructions()).toContain('nextSteps');
    expect(client.getInstructions()).toContain('always current');
    expect(client.getInstructions()).not.toContain('stale plan');
    expect((await client.listTools()).tools.map(tool => tool.name)).toContain('import_records');
    const prompts = (await client.listPrompts()).prompts.map(prompt => prompt.name);
    expect(prompts).toEqual(expect.arrayContaining(['morning_check_in', 'log_what_i_did', 'sync_my_apps', 'weekly_review', 'plan_my_week']));
    const sync = await client.getPrompt({ name: 'sync_my_apps', arguments: { apps: 'Strava and MacroFactor', days: '10' } });
    const message = (sync.messages[0].content as { text: string }).text;
    expect(message).toContain('last 10 days from Strava and MacroFactor');
    expect(message).toContain('SAVE_REPORTED_RECORDS');

    const unconfirmed = await client.callTool({ name: 'import_records', arguments: { activities: [run] } });
    expect(unconfirmed.isError).toBe(true);
    const saved = await client.callTool({ name: 'import_records', arguments: { activities: [run, lift], nutritionDays: [macros], confirmation } });
    expect(saved.isError).not.toBe(true);
    expect(saved.structuredContent).toMatchObject({ imported: { activities: { added: 2 }, nutritionDays: { added: 1 } }, state: { revision: 0 } });
    expect(text(saved)).toContain('agreed plan, session outcomes and food diary are unchanged');

    // A new conversation sees one home for all three apps, with lifts readable at a glance.
    const next = await f.connect();
    const day = await next.callTool({ name: 'get_coaching_day', arguments: {} });
    const view = day.structuredContent as { evidence: { activities: { source: string; exercises?: string[]; actor?: string }[]; nutritionDays: { source: string }[]; sources: { source: string }[] }; nextSteps: string[] };
    expect(view.evidence.activities.map(item => item.source)).toEqual(['buff', 'strava']);
    expect(view.evidence.activities[0].exercises).toEqual(['Squat: 5x100kg, 5x100kg']);
    expect(view.evidence.activities[0].actor).toBeUndefined();
    expect(view.evidence.nutritionDays[0].source).toBe('macrofactor');
    expect(view.nextSteps.length).toBeGreaterThan(0);
    expect(text(day)).toContain('"nextSteps"');
    expect(text(day)).toContain('recordsFromOtherApps');
  });

  it('matches an imported run to an unreported planned session as a question, not an outcome', async () => {
    const f = await fixture();
    const client = await f.connect();
    const sessionId = randomUUID(), requestId = randomUUID();
    const setupId = randomUUID();
    await client.callTool({ name: 'propose_coaching_change', arguments: { requestId: setupId, baseRevision: 0, command: { type: 'setup', profile: { primaryGoal: 'Half marathon in spring', priorities: ['running'], constraints: [], notes: '' }, reason: 'Chosen goal.' } } });
    await client.callTool({ name: 'resolve_coaching_change', arguments: { proposalId: setupId, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' } });
    await client.callTool({ name: 'propose_coaching_change', arguments: { requestId, baseRevision: 1, command: { type: 'replace_week', startDay: '2026-11-08', sessions: [{ id: sessionId, day: '2026-11-09', sport: 'run', title: 'Sunday long run', minutes: 90, details: '' }], reason: 'Agreed week.' } } });
    await client.callTool({ name: 'resolve_coaching_change', arguments: { proposalId: requestId, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' } });
    const saved = await client.callTool({ name: 'import_records', arguments: { activities: [run], confirmation } });
    const view = saved.structuredContent as { nextSteps: string[]; state: { outcomes: unknown[]; revision: number } };
    expect(view.nextSteps.find(step => step.includes('Sunday long run'))).toContain('A Strava run ("Long run", 95 min) was brought in for that day. Ask whether it was this session');
    expect(view.state.outcomes).toEqual([]);
    expect(view.state.revision).toBe(2);
  });

  it('offers a read-only connection the check-ins but nothing that writes', async () => {
    const f = await fixture(['coaching:read']);
    const client = await f.connect();
    expect((await client.listTools()).tools.map(tool => tool.name)).not.toContain('import_records');
    expect((await client.listPrompts()).prompts.map(prompt => prompt.name).sort()).toEqual(['morning_check_in', 'weekly_review']);
  });
});
