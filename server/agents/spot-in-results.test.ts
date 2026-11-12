import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createAgentHandler } from './http.ts';
import { AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import { contextNotes } from './mcp-server.ts';
import { spotHow, spotLine, spotNote } from '../../src/features/spot/assistant.ts';
import { defaultConnectionScopes } from '../../src/features/connections/permissions.ts';
import { initialState } from '../../src/domain.ts';
import { buildAgentContext } from '../../src/features/connections/context.ts';
import type { AgentScope } from '../../src/features/connections/contracts.ts';

// A real Claude chat reply from the first hosted connection read as a plain inventory: the connection
// had no coaching access, so it got four basic tools and a list of records. These tests hold the
// three things that changed: coaching by default, next steps on the basic tools, and Spot in results.

const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
const owner = 'spot-owner';
const day = '2026-11-11';

async function connect(scopes: AgentScope[]) {
  const store = new SqliteAgentStore(':memory:'); cleanup.push(() => store.close());
  const service = new AgentService(store, () => Date.parse(`${day}T15:00:00Z`));
  const credential = await service.manage(owner, { operation: 'create', name: 'Coach', scopes, expiresInDays: 90 }) as { token: string };
  await service.manage(owner, { operation: 'publish', context: buildAgentContext(initialState(), day, 'UTC'), dataUpdatedAt: `${day}T14:59:00Z` });
  const handler = createAgentHandler({ store, now: () => Date.parse(`${day}T15:00:00Z`) });
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const client = new Client({ name: 'chat-like', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/agents/mcp`), { requestInit: { headers: { 'x-api-key': credential.token } } }));
  cleanup.push(() => client.close());
  return client;
}
const text = (result: { content?: unknown }) => (result.content as { text: string }[])[0].text;

describe('Spot for an outside assistant', () => {
  it('has a line for every moment, changes it between days and keeps it steady within one', () => {
    for (const moment of ['blank', 'no_goal', 'unreported', 'today', 'done', 'organised', 'imported', 'meal_drafted', 'waiting'] as const) {
      const line = spotLine(moment, day);
      expect(line.length).toBeGreaterThan(10);
      expect(spotLine(moment, day)).toBe(line);
    }
    const acrossDays = new Set(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map(value => spotLine('today', value)));
    expect(acrossDays.size).toBeGreaterThan(1);
    expect(spotNote('done', day)).toEqual({ moment: 'done', line: spotLine('done', day), how: spotHow });
  });
  it('keeps the joke on Spot and says when to leave it out', () => {
    expect(spotHow).toContain('plain words first');
    expect(spotHow).toContain('never joke about the person’s body, food, weight or a missed day');
    expect(spotHow).toContain('leave it out');
  });
});

describe('a new connection is a coach by default', () => {
  it('grants coaching, records and meal drafts unless the person turns something off', () => {
    expect([...defaultConnectionScopes].sort()).toEqual(['activities:read', 'coaching:read', 'coaching:write', 'meals:propose', 'nutrition:read', 'pantry:read', 'preferences:read', 'workouts:read']);
  });
  it('gives the assistant the coaching day with next steps and Spot’s line', async () => {
    const client = await connect([...defaultConnectionScopes]);
    expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(expect.arrayContaining(['get_coaching_day', 'import_records', 'propose_meal']));
    const result = await client.callTool({ name: 'get_coaching_day', arguments: {} });
    const view = result.structuredContent as { nextSteps: string[]; spot: { moment: string; line: string; how: string } };
    expect(view.nextSteps[0]).toContain('No primary goal');
    expect(view.spot).toEqual(spotNote('no_goal', day));
    // The line is in the text an assistant reads, not only in the structured form.
    expect(text(result)).toContain(spotLine('no_goal', day));
  });
  it('changes Spot’s line with the moment', async () => {
    const client = await connect([...defaultConnectionScopes]);
    const setup = randomUUID();
    await client.callTool({ name: 'propose_coaching_change', arguments: { requestId: setup, baseRevision: 0, command: { type: 'setup', profile: { primaryGoal: 'Spring half marathon', priorities: ['running'], constraints: [], notes: '' }, reason: 'Chosen goal.' } } });
    const waiting = await client.callTool({ name: 'get_coaching_day', arguments: {} });
    expect((waiting.structuredContent as { spot: { moment: string } }).spot.moment).toBe('waiting');
    await client.callTool({ name: 'resolve_coaching_change', arguments: { proposalId: setup, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' } });
    const imported = await client.callTool({ name: 'import_records', arguments: { confirmation: 'SAVE_REPORTED_RECORDS', activities: [{ source: 'strava', externalId: 'r1', day: '2026-11-10', sport: 'run', title: 'Easy run', minutes: 40 }] } });
    expect((imported.structuredContent as { spot: { moment: string } }).spot.moment).toBe('imported');
  });
});

describe('a connection without coaching still says something useful', () => {
  it('reads records with what to raise next, how to get a coach, and Spot’s line', async () => {
    const client = await connect(['nutrition:read', 'pantry:read', 'preferences:read', 'meals:propose']);
    expect((await client.listTools()).tools.map(tool => tool.name).sort()).toEqual(['capabilities', 'get_action', 'propose_meal', 'read_context']);
    expect(client.getInstructions()).toContain('no coaching access');
    const result = await client.callTool({ name: 'read_context', arguments: {} });
    const view = result.structuredContent as { nextSteps: string[]; spot: { moment: string; line: string }; context: { day: string } };
    expect(view.context.day).toBe(day);
    expect(view.nextSteps[0]).toContain('Nothing is logged for today');
    expect(view.nextSteps.join(' ')).toContain('app defaults');
    expect(view.nextSteps.at(-1)).toContain('create a connection with coaching turned on');
    expect(view.spot.moment).toBe('blank');
    expect(text(result)).toContain(spotLine('blank', day));
  });
  it('says where a drafted meal is waiting', async () => {
    const client = await connect(['nutrition:read', 'meals:propose']);
    const result = await client.callTool({ name: 'propose_meal', arguments: { requestId: randomUUID(), meal: { title: 'Oats', day, time: '08:00', category: 'Breakfast', portion: 'One bowl', calories: 350, protein: 14, carbs: 55, fat: 8, note: 'Reported by the user.' } } });
    const view = result.structuredContent as { nextSteps: string[]; spot: { moment: string }; action: { status: string } };
    expect(view.action.status).toBe('pending');
    expect(view.nextSteps[0]).toContain('Nothing is logged yet');
    expect(view.spot.moment).toBe('meal_drafted');
  });
  it('does not add notes to an error, and counts logged meals when there are some', () => {
    expect(contextNotes({ context: { day, nutrition: { days: [{ day, meals: 2 }], goalsConfigured: true } } }, true)).toEqual({
      nextSteps: ['2 meals are logged today. Say what that adds up to, and ask if anything is missing.'],
      spot: spotNote('organised', day),
    });
    expect(contextNotes({ context: { day } }, true).nextSteps).toEqual([]);
  });
});
