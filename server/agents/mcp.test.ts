import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createAgentHandler } from './http.ts';
import { AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import type { AgentScope } from '../../src/features/connections/contracts.ts';

const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

async function fixture(scopes: AgentScope[] = ['coaching:read', 'coaching:write']) {
  const store = new SqliteAgentStore(':memory:'); cleanup.push(() => store.close());
  const service = new AgentService(store);
  const credential = await service.manage('mcp-test-owner', { operation: 'create', name: 'Daily coach', scopes, expiresInDays: 30 }) as { token: string; connection: { id: string } };
  const handler = createAgentHandler({ store });
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const url = new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/agents/mcp`);
  const connect = async (token = credential.token) => {
    const client = new Client({ name: 'coaching-integration', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    cleanup.push(() => client.close());
    return client;
  };
  return { service, credential, connect, url, store };
}

describe('authenticated remote coaching MCP', () => {
  it('completes reviewed changes, preserves them in a new conversation, and undoes exactly once', async () => {
    const f = await fixture();
    const client = await f.connect();
    expect((await client.listTools()).tools.map(tool => tool.name)).toContain('get_coaching_day');
    const read = await client.callTool({ name: 'get_coaching_day', arguments: {} });
    expect(read.structuredContent).toMatchObject({ state: { revision: 0 }, freshness: { stale: true } });
    const requestId = randomUUID();
    const args = { requestId, baseRevision: 0, command: { type: 'setup', profile: { primaryGoal: 'Run consistently and keep lifting', priorities: ['running', 'strength'], constraints: ['Short Wednesdays'], notes: '' }, reason: 'My confirmed training priorities.' } };
    const proposal = await client.callTool({ name: 'propose_coaching_change', arguments: args });
    expect(proposal.structuredContent).toMatchObject({ state: { revision: 0, profile: { primaryGoal: '' } }, proposal: { status: 'pending', id: requestId } });
    const missingConfirmation = await client.callTool({ name: 'resolve_coaching_change', arguments: { proposalId: requestId, status: 'accepted' } });
    expect(missingConfirmation.isError).toBe(true);
    const result = await client.callTool({ name: 'resolve_coaching_change', arguments: { proposalId: requestId, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' } });
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({ state: { revision: 1, profile: { primaryGoal: args.command.profile.primaryGoal } } });
    const nextConversation = await f.connect();
    const resumed = await nextConversation.callTool({ name: 'get_coaching_day', arguments: {} });
    expect(resumed.structuredContent).toMatchObject({ state: { revision: 1, profile: { constraints: ['Short Wednesdays'] } } });
    const saved = result.structuredContent as { entry: { id: string } };
    const undo = { entryId: saved.entry.id, baseRevision: 1, requestId: randomUUID() };
    const undone = await nextConversation.callTool({ name: 'undo_coaching_change', arguments: undo });
    expect(undone.structuredContent).toMatchObject({ state: { revision: 2, profile: { primaryGoal: '' } } });
    expect((await nextConversation.callTool({ name: 'undo_coaching_change', arguments: undo })).structuredContent).toMatchObject({ state: { revision: 2 }, replayed: true });
  });

  it('uses exact scope discovery and immediately stops serving revoked credentials', async () => {
    const f = await fixture(['coaching:read']); const client = await f.connect();
    const names = (await client.listTools()).tools.map(tool => tool.name);
    expect(names).toContain('get_coaching_day'); expect(names).not.toContain('propose_coaching_change');
    await f.service.manage('mcp-test-owner', { operation: 'revoke', connectionId: f.credential.connection.id });
    await expect(client.listTools()).rejects.toThrow();
    const response = await fetch(f.url, { method: 'POST', headers: { Authorization: `Bearer ${f.credential.token}`, 'Content-Type': 'application/json' }, body: '{}' });
    expect(response.status).toBe(401);
  });

  it('validates request origins, authentication, methods and body limits before MCP processing', async () => {
    const f = await fixture();
    const headers = { Authorization: `Bearer ${f.credential.token}`, 'Content-Type': 'application/json' };
    expect((await fetch(f.url, { method: 'POST', headers: { ...headers, Origin: 'https://foreign.example' }, body: '{}' })).status).toBe(403);
    expect((await fetch(f.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(401);
    expect((await fetch(f.url, { headers })).status).toBe(405);
    expect((await fetch(f.url, { method: 'POST', headers, body: '{bad' })).status).toBe(400);
    expect((await fetch(f.url, { method: 'POST', headers, body: JSON.stringify({ large: 'x'.repeat(1_000_001) }) })).status).toBe(413);
  });
});
