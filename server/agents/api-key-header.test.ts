import { afterEach, describe, expect, it } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createAgentHandler } from './http.ts';
import { AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import { connectionKey } from './token.ts';
import { previewGate } from '../preview-gate.ts';

// Claude chat reserves the Authorization header on a custom connector unless its Authentication is
// "No sign-in", so its owner could not paste the documented header at all. The key is therefore also
// accepted on its own in x-api-key, a name Claude lets every connector send.

const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

async function fixture() {
  const store = new SqliteAgentStore(':memory:'); cleanup.push(() => store.close());
  const service = new AgentService(store);
  const credential = await service.manage('api-key-owner', { operation: 'create', name: 'Claude', scopes: ['coaching:read', 'coaching:write'], expiresInDays: 30 }) as { token: string };
  const handler = createAgentHandler({ store });
  const server = createServer((req, res) => { void handler(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { token: credential.token, origin };
}
const post = (url: string, headers: Record<string, string>, body: unknown) =>
  fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });

describe('reading the connection key from a request', () => {
  const key = `rpagent.11111111-1111-4111-8111-111111111111.${'a'.repeat(43)}`;
  const other = `rpagent.22222222-2222-4222-8222-222222222222.${'b'.repeat(43)}`;
  it('accepts a bearer credential, or the key on its own in x-api-key', () => {
    expect(connectionKey({ authorization: `Bearer ${key}` })).toBe(key);
    expect(connectionKey({ 'x-api-key': key })).toBe(key);
    // People paste the scheme by habit.
    expect(connectionKey({ 'x-api-key': `Bearer ${key}` })).toBe(key);
  });
  it('prefers x-api-key, because on a sign-in connector Authorization belongs to Claude', () => {
    expect(connectionKey({ authorization: 'Bearer some-oauth-token', 'x-api-key': key })).toBe(key);
    expect(connectionKey({ authorization: `Bearer ${other}`, 'x-api-key': key })).toBe(key);
  });
  it('ignores an x-api-key that is not a connection key and refuses a request with neither', () => {
    expect(connectionKey({ authorization: `Bearer ${key}`, 'x-api-key': 'sk-something-else' })).toBe(key);
    for (const headers of [{}, { 'x-api-key': 'sk-something-else' }, { authorization: key }, { 'x-api-key': [key, key] }, { 'x-api-key': `${key}${'x'.repeat(300)}` }])
      expect(() => connectionKey(headers)).toThrowError(/x-api-key/);
  });
});

describe('an assistant that can only send x-api-key', () => {
  it('connects over MCP, reads the coaching day and is refused with a wrong key', async () => {
    const f = await fixture();
    const client = new Client({ name: 'claude-chat-like', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`${f.origin}/api/agents/mcp`), { requestInit: { headers: { 'x-api-key': f.token } } }));
    cleanup.push(() => client.close());
    expect(client.getInstructions()).toContain('Spot');
    expect((await client.listTools()).tools.map(tool => tool.name)).toContain('import_records');
    const day = await client.callTool({ name: 'get_coaching_day', arguments: {} });
    expect(day.isError).not.toBe(true);
    expect((day.structuredContent as { nextSteps: string[] }).nextSteps[0]).toContain('No primary goal');

    const wrong = f.token.slice(0, -4) + 'AAAA';
    const refused = await post(`${f.origin}/api/agents/mcp`, { 'x-api-key': wrong }, { jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(refused.status).toBe(401);
  });

  it('works on the direct API too, and a request with no key is told both ways to send one', async () => {
    const f = await fixture();
    const ok = await post(`${f.origin}/api/agents/v1`, { 'x-api-key': f.token }, { operation: 'capabilities' });
    expect(ok.status).toBe(200);
    expect((await ok.json() as { operations: string[] }).operations).toContain('coaching.read');
    const none = await post(`${f.origin}/api/agents/mcp`, {}, { jsonrpc: '2.0', id: 1, method: 'ping' });
    expect(none.status).toBe(401);
    const body = await none.json() as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INVALID_TOKEN');
    expect(body.error.message).toContain('x-api-key');
    expect(body.error.message).toContain('Authorization: Bearer');
  });
});

describe('the private preview gate and x-api-key', () => {
  const env = { VERCEL: '1', PREVIEW_ACCESS_CODE: 'test-invitation-code-123456789' };
  const key = `rpagent.11111111-1111-4111-8111-111111111111.${'a'.repeat(43)}`;
  const request = (path: string, headers: Record<string, string>) => new Request(`https://repandplate.com${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: '{}' });
  it('lets a real-looking key through to the two assistant endpoints only', async () => {
    expect(await previewGate(request('/api/agents/mcp', { 'x-api-key': key }), env)).toBeNull();
    expect(await previewGate(request('/api/agents/v1', { 'x-api-key': `Bearer ${key}` }), env)).toBeNull();
    expect(await previewGate(request('/api/health?endpoint=agents/mcp', { 'x-api-key': key }), env)).toBeNull();
    // Not the management endpoint, and not the rest of the API.
    expect((await previewGate(request('/api/agents/manage', { 'x-api-key': key }), env))?.status).toBe(401);
    expect((await previewGate(request('/api/chat', { 'x-api-key': key }), env))?.status).toBe(401);
  });
  it('still blocks anything that does not look like a connection key', async () => {
    for (const value of ['', 'anything', 'sk-live-123', key.slice(0, -1), `${key}x`])
      expect((await previewGate(request('/api/agents/mcp', { 'x-api-key': value }), env))?.status).toBe(401);
  });
});
