import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAgentClient, readConfig } from './client';

const run = promisify(execFile);
const root = resolve(import.meta.dirname, '../..');
const tsx = resolve(root, 'node_modules/tsx/dist/cli.mjs');
const secret = 'test-only-connection-token';
const meal = { title: 'Rice bowl', day: '2026-09-29', time: '18:30', category: 'Dinner' as const, portion: '1 bowl', calories: 400, protein: 20, carbs: 55, fat: 11, note: 'Estimate' };
let server: Server;
let origin: string;
const requests: { headers: Record<string, unknown>; body: Record<string, unknown> }[] = [];
const actions = new Map<string, Record<string, unknown>>();

beforeAll(async () => {
  server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push({ headers: req.headers, body });
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== `Bearer ${secret}` && req.headers.authorization !== 'Bearer read-only-token') {
      res.writeHead(401).end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Connection expired or revoked.', retryable: false } })); return;
    }
    const readOnly = req.headers.authorization === 'Bearer read-only-token';
    if (body.operation === 'capabilities') res.end(JSON.stringify({ operations: readOnly ? ['capabilities', 'context.read'] : ['capabilities', 'context.read', 'meals.propose', 'actions.get'], scopes: ['nutrition:read'] }));
    else if (body.operation === 'context.read') res.end(JSON.stringify({ context: { day: '2026-09-29', nutrition: { days: [] } }, publishedAt: '2026-09-29T12:00:00Z', stale: false, ageSeconds: 2, mode: 'published_snapshot' }));
    else if (body.operation === 'meals.propose') {
      const existing = actions.get(body.requestId);
      const action = existing ?? { id: randomUUID(), requestId: body.requestId, meal: body.meal, status: 'pending' };
      actions.set(body.requestId, action);
      res.end(JSON.stringify({ action, replayed: !!existing }));
    } else if (body.operation === 'actions.get') {
      const action = [...actions.values()].find(item => item.id === body.actionId);
      if (action) res.end(JSON.stringify({ action }));
      else res.writeHead(404).end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Proposal not found.', retryable: false } }));
    } else res.writeHead(400).end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing server address');
  origin = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });

describe('credential and transport boundaries', () => {
  it('allows HTTPS and loopback HTTP but rejects credentials, external HTTP, paths and queries', () => {
    for (const value of ['https://app.example.com', 'http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) expect(readConfig({ REP_PLATE_URL: value, REP_PLATE_TOKEN: secret }).endpoint).toContain('/api/agents/v1');
    for (const value of ['http://app.example.com', 'https://user:secret@app.example.com', 'https://app.example.com/path', 'https://app.example.com/?secret=x', 'file:///tmp/a']) expect(() => readConfig({ REP_PLATE_URL: value, REP_PLATE_TOKEN: secret })).toThrow();
    expect(() => readConfig({})).toThrow('Set REP_PLATE_URL');
  });
  it('validates locally and refuses redirects without forwarding credentials', async () => {
    const client = createAgentClient(readConfig({ REP_PLATE_URL: origin, REP_PLATE_TOKEN: secret }));
    await expect(client.request({ operation: 'actions.get', actionId: 'bad' })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    let targetHits = 0;
    const redirect = createServer((req, res) => {
      if (req.url === '/api/agents/v1') res.writeHead(307, { Location: '/target' }).end();
      else { targetHits++; res.end('{}'); }
    });
    await new Promise<void>(resolve => redirect.listen(0, '127.0.0.1', resolve));
    try {
      const address = redirect.address();
      if (!address || typeof address === 'string') throw new Error('Missing address');
      await expect(createAgentClient({ endpoint: `http://127.0.0.1:${address.port}/api/agents/v1`, token: secret }).request({ operation: 'capabilities' })).rejects.toMatchObject({ code: 'CONNECTION_FAILED' });
      expect(targetHits).toBe(0);
    } finally { await new Promise<void>(resolve => redirect.close(() => resolve())); }
  });
  it('redacts credentials from upstream error text', async () => {
    const client = createAgentClient({ endpoint: origin, token: secret }, async () => new Response(JSON.stringify({ error: { code: 'DENIED', message: `Proxy saw ${secret}`, retryable: false } }), { status: 403 }));
    await expect(client.request({ operation: 'capabilities' })).rejects.toMatchObject({ message: 'Proxy saw [redacted]' });
  });
});

describe('terminal agent CLI', () => {
  const cli = (...args: string[]) => run(process.execPath, [tsx, resolve(root, 'scripts/health.ts'), ...args], { env: { ...process.env, REP_PLATE_URL: origin, REP_PLATE_TOKEN: secret }, windowsHide: true });
  it('discovers capabilities and reads freshness metadata as clean JSON', async () => {
    const doctor = await cli('doctor', '--json');
    expect(JSON.parse(doctor.stdout).operations).toContain('meals.propose');
    expect(doctor.stderr).toBe('');
    const context = await cli('context', '--json');
    expect(JSON.parse(context.stdout)).toMatchObject({ ageSeconds: 2, mode: 'published_snapshot' });
    expect(requests.at(-1)?.headers.authorization).toBe(`Bearer ${secret}`);
  });
  it('submits a file, preserves request IDs on retry, and reads status', async () => {
    const requestId = randomUUID();
    const first = JSON.parse((await cli('meals', 'propose', '--file', resolve(root, 'docs/agent-meal.example.json'), '--request-id', requestId, '--json')).stdout);
    const second = JSON.parse((await cli('meals', 'propose', '--request-id', requestId, '--file', resolve(root, 'docs/agent-meal.example.json'), '--json')).stdout);
    expect(first.action.requestId).toBe(requestId);
    expect(second).toMatchObject({ action: { id: first.action.id, status: 'pending' }, replayed: true });
    expect(JSON.parse((await cli('actions', 'get', first.action.id, '--json')).stdout).action.id).toBe(first.action.id);
  });
  it('reports invalid arguments without echoing token arguments', async () => {
    await expect(cli('capabilities', '--token', secret, '--json')).rejects.toMatchObject({ code: 1, stdout: expect.not.stringContaining(secret) });
    await expect(cli('actions', 'get', 'not-a-uuid', '--json')).rejects.toMatchObject({ code: 1, stdout: expect.stringContaining('INVALID_REQUEST') });
  });
});

describe('official MCP stdio client roundtrip', () => {
  async function connect(token = secret) {
    const client = new Client({ name: 'connection-test', version: '1.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath, args: [tsx, resolve(root, 'scripts/agents/mcp.ts')], env: { REP_PLATE_URL: origin, REP_PLATE_TOKEN: token }, stderr: 'pipe' });
    await client.connect(transport);
    return client;
  }
  it('discovers tools, returns structured context and proposal status, and marks tool errors', async () => {
    const client = await connect();
    try {
      const list = await client.listTools();
      expect(list.tools.map(tool => tool.name)).toEqual(['capabilities', 'read_context', 'propose_meal', 'get_action']);
      const context = await client.callTool({ name: 'read_context', arguments: {} });
      expect(context.structuredContent).toMatchObject({ mode: 'published_snapshot' });
      const proposal = await client.callTool({ name: 'propose_meal', arguments: { requestId: randomUUID(), meal } });
      expect(proposal.isError).not.toBe(true);
      const action = (proposal.structuredContent as { action: { id: string } }).action;
      expect((await client.callTool({ name: 'get_action', arguments: { actionId: action.id } })).structuredContent).toMatchObject({ action: { status: 'pending' } });
      const missing = await client.callTool({ name: 'get_action', arguments: { actionId: randomUUID() } });
      expect(missing).toMatchObject({ isError: true, structuredContent: { error: { code: 'NOT_FOUND' } } });
    } finally { await client.close(); }
  });
  it('only exposes operations granted to the connection', async () => {
    const client = await connect('read-only-token');
    try { expect((await client.listTools()).tools.map(tool => tool.name)).toEqual(['capabilities', 'read_context']); }
    finally { await client.close(); }
  });
});
