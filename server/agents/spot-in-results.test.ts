import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createAgentHandler } from './http.ts';
import { AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import { contextNotes } from './mcp-server.ts';
import { spotLine, spotNote, spotToolNote, spotVoice } from '../../src/features/spot/assistant.ts';
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

async function connect(scopes: AgentScope[], cards = false) {
  const store = new SqliteAgentStore(':memory:'); cleanup.push(() => store.close());
  const service = new AgentService(store, () => Date.parse(`${day}T15:00:00Z`));
  const credential = await service.manage(owner, { operation: 'create', name: 'Coach', scopes, expiresInDays: 90 }) as { token: string };
  await service.manage(owner, { operation: 'publish', context: buildAgentContext(initialState(), day, 'UTC'), dataUpdatedAt: `${day}T14:59:00Z` });
  const handler = createAgentHandler({ store, now: () => Date.parse(`${day}T15:00:00Z`) });
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const client = new Client({ name: 'chat-like', version: '1.0.0' }, { capabilities: cards ? { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } : {} });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/agents/mcp`), { requestInit: { headers: { 'x-api-key': credential.token } } }));
  cleanup.push(() => client.close());
  return client;
}
const text = (result: { content?: unknown }) => (result.content as { text: string }[])[0].text;
const character = (result: { _meta?: Record<string, unknown> }) => (result._meta?.repAndPlateView as { spot: { moment: string; says: string; voice: string } }).spot;

describe('Spot for an outside assistant', () => {
  it('has a line for every moment, changes it between days and keeps it steady within one', () => {
    for (const moment of ['blank', 'no_goal', 'unreported', 'today', 'done', 'organised', 'imported', 'meal_drafted', 'waiting'] as const) {
      const line = spotLine(moment, day);
      expect(line.length).toBeGreaterThan(10);
      expect(spotLine(moment, day)).toBe(line);
    }
    const acrossDays = new Set(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map(value => spotLine('today', value)));
    expect(acrossDays.size).toBeGreaterThan(1);
    expect(spotNote('done', day)).toEqual({ moment: 'done', says: spotLine('done', day), pose: 'proud', voice: spotVoice });
  });
  it('keeps Spot’s voice without duplicating the card’s joke in every reply', () => {
    // The compact card carries the line; the assistant should still sound like Spot.
    expect(spotVoice).toContain('Do not repeat');
    expect(spotVoice).toContain('a little sassy');
    expect(spotVoice).toContain('never about the person’s body, food, weight or a missed day');
    expect(spotVoice).toContain('drop the jokes and leave out his line');
    expect(spotToolNote).toContain('Do not repeat');
    expect(spotVoice).not.toContain('End with spot.says, quoted and attributed');
  });
});

describe('a new connection is a coach by default', () => {
  it('grants coaching, records and meal drafts unless the person turns something off', () => {
    expect([...defaultConnectionScopes].sort()).toEqual(['activities:read', 'coaching:read', 'coaching:write', 'meals:propose', 'nutrition:read', 'pantry:read', 'preferences:read', 'workouts:read']);
  });
  it('gives the assistant the coaching day with next steps and Spot’s line', async () => {
    const client = await connect([...defaultConnectionScopes]);
    const tools = (await client.listTools()).tools;
    expect(tools.map(tool => tool.name)).toEqual(expect.arrayContaining(['get_coaching_day', 'import_records', 'propose_meal']));
    // Every result-bearing tool points to the fresh presentation contract.
    for (const tool of tools.filter(item => !['capabilities', 'get_action'].includes(item.name))) expect(tool.description, tool.name).toContain(spotToolNote);
    expect(client.getInstructions()).toMatch(/do not repeat/i);
    const result = await client.callTool({ name: 'get_coaching_day', arguments: {} });
    const view = result.structuredContent as { nextSteps: string[]; spot: unknown; presentation: { mode: string; instruction: string; questionOwner: string } };
    expect(view.nextSteps[0]).toContain('No primary goal');
    expect(character(result)).toEqual(spotNote('no_goal', day));
    expect(view.spot).toEqual(character(result));
    expect(text(result)).not.toContain(spotLine('no_goal', day));
    expect(view.presentation.mode).toBe('auto');
    expect(view.presentation.questionOwner).toBe('card');
    expect(view.presentation.instruction).toContain('Do not add a follow-up question');
    expect(view.presentation.instruction).toContain('If no card is displayed');
  });
  it('changes Spot’s line with the moment', async () => {
    const client = await connect([...defaultConnectionScopes]);
    const setup = randomUUID();
    await client.callTool({ name: 'propose_coaching_change', arguments: { requestId: setup, baseRevision: 0, command: { type: 'setup', profile: { primaryGoal: 'Spring half marathon', priorities: ['running'], constraints: [], notes: '' }, reason: 'Chosen goal.' } } });
    const waiting = await client.callTool({ name: 'get_coaching_day', arguments: {} });
    expect(character(waiting).moment).toBe('waiting');
    await client.callTool({ name: 'resolve_coaching_change', arguments: { proposalId: setup, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' } });
    const imported = await client.callTool({ name: 'import_records', arguments: { confirmation: 'SAVE_REPORTED_RECORDS', activities: [{ source: 'strava', externalId: 'r1', day: '2026-11-10', sport: 'run', title: 'Easy run', minutes: 40 }] } });
    expect(character(imported).moment).toBe('imported');
  });
});

describe('a connection without coaching still says something useful', () => {
  it('keeps the basic card joke UI-only while still asking Claude to answer from saved facts', async () => {
    const client = await connect(['nutrition:read', 'preferences:read'], true);
    const result = await client.callTool({ name: 'read_context', arguments: {} });
    const view = result.structuredContent as { spot?: unknown; context: unknown; presentation: { instruction: string } };
    const card = result._meta?.repAndPlateView as { spot: { says: string } };
    expect(card.spot.says).toBeTruthy();
    expect(view.spot).toEqual(card.spot);
    expect(view.context).toBeTruthy();
    expect(text(result)).not.toContain(card.spot.says);
    expect(view.presentation.instruction).toContain('Answer the actual question');
  });
  it('reads records with what to raise next, how to get a coach, and Spot’s line', async () => {
    const client = await connect(['nutrition:read', 'pantry:read', 'preferences:read', 'meals:propose']);
    expect((await client.listTools()).tools.map(tool => tool.name).sort()).toEqual(['capabilities', 'get_action', 'propose_meal', 'read_context']);
    expect(client.getInstructions()).toContain('no coaching access');
    const result = await client.callTool({ name: 'read_context', arguments: {} });
    const view = result.structuredContent as { nextSteps: string[]; spot: { moment: string; says: string }; context: { day: string } };
    expect(view.context.day).toBe(day);
    expect(view.nextSteps[0]).toContain('Nothing is logged for today');
    expect(view.nextSteps.join(' ')).toContain('app defaults');
    expect(view.nextSteps.at(-1)).toContain('create a connection with coaching turned on');
    expect(character(result).moment).toBe('blank');
    expect(text(result)).not.toContain(spotLine('blank', day));
    expect(text(result)).toContain('Answer the actual question');
  });
  it('says where a drafted meal is waiting', async () => {
    const client = await connect(['nutrition:read', 'meals:propose']);
    const result = await client.callTool({ name: 'propose_meal', arguments: { requestId: randomUUID(), meal: { title: 'Oats', day, time: '08:00', category: 'Breakfast', portion: 'One bowl', calories: 350, protein: 14, carbs: 55, fat: 8, note: 'Reported by the user.' } } });
    const view = result.structuredContent as { nextSteps: string[]; spot: { moment: string }; action: { status: string } };
    expect(view.action.status).toBe('pending');
    expect(view.nextSteps[0]).toContain('Nothing is logged yet');
    expect(character(result).moment).toBe('meal_drafted');
  });
  it('does not add notes to an error, and counts logged meals when there are some', () => {
    expect(contextNotes({ context: { day, nutrition: { days: [{ day, meals: 2 }], goalsConfigured: true } } }, true)).toEqual({
      nextSteps: ['2 meals are logged today. Say what that adds up to, and ask if anything is missing.'],
      spot: spotNote('organised', day),
    });
    expect(contextNotes({ context: { day } }, true).nextSteps).toEqual([]);
  });
});
