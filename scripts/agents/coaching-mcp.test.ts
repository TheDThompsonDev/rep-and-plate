import { randomUUID, webcrypto, createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { Window } from 'happy-dom';
import { describe, expect, it, vi } from 'vitest';
import { registerCoachingTools, coachingAppSupported, projectCoachingMcpResult, freshnessView } from './coaching-mcp';
import { coachingAppHtml, coachingAppResource, COACHING_APP_MIME, COACHING_APP_URI } from '../../server/agents/coaching-app';
import type { AgentRequest } from '../../src/features/connections/contracts';

const operations = ['coaching.read', 'coaching.propose', 'coaching.resolve', 'coaching.undo'];
const sessionId = randomUUID();
const canonical = {
  state: { revision: 3, profile: { primaryGoal: 'Build a steady routine', priorities: [], constraints: [], notes: '' }, sessions: [{ id: sessionId, day: '2026-11-08', sport: 'run', title: 'Easy run', minutes: 25, details: '' }], outcomes: [], memories: [], proposals: [], journal: [] },
  brief: { day: '2026-11-08', today: [], upcoming: [], missingData: ['Unreported sessions are unknown.'] },
  weekly: { planned: [], completed: [], skipped: [], unreported: [], observations: [] },
  freshness: { mode: 'published_snapshot', stale: true, dataUpdatedAt: null, ageSeconds: null },
};

async function connect(granted = operations, supplied?: (request: AgentRequest) => Promise<CallToolResult>, cards = true) {
  const seen: AgentRequest[] = [];
  const server = new McpServer({ name: 'coaching-test', version: '1.0.0' });
  registerCoachingTools(server, async request => {
    seen.push(request);
    return supplied ? supplied(request) : { content: [{ type: 'text', text: JSON.stringify(canonical) }], structuredContent: canonical };
  }, granted);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'coaching-client-test', version: '1.0.0' }, { capabilities: cards ? { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [COACHING_APP_MIME] } } } : {} });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server, seen, close: async () => { await client.close(); await server.close(); } };
}

describe('coaching MCP registration', () => {
  it('retains the complete text answer and character line for a negotiated text-only client', async () => {
    const connection = await connect(['coaching.read'], undefined, false);
    try {
      const result = await connection.client.callTool({ name: 'get_coaching_day', arguments: {} });
      const view = result.structuredContent as { spot: { says: string }; presentation: { mode: string }; state: unknown };
      expect(view.presentation.mode).toBe('text');
      expect(view.spot.says).toBeTruthy();
      expect((result.content as { text: string }[])[0].text).toContain(view.spot.says);
      expect(view.state).toBeTruthy();
    } finally { await connection.close(); }
  });
  it('fetches the compact template instead of reusing a host-cached legacy dashboard', async () => {
    const connection = await connect(['coaching.read']);
    try {
      const cache = new Map<string, string>([['ui://rep-and-plate/coaching.html', '<h1>Old cached dashboard</h1>'], ['ui://rep-and-plate/coaching-shell-v1.html','<iframe>Blocked shell</iframe>']]);
      const tool = (await connection.client.listTools()).tools.find(item => item.name === 'get_coaching_day')!;
      const uri = (tool._meta?.ui as { resourceUri: string }).resourceUri;
      let html = cache.get(uri);
      if (html === undefined) {
        const resource = (await connection.client.readResource({ uri })).contents[0];
        if (!('text' in resource)) throw new Error('Expected an HTML text resource.');
        html = resource.text;
      }
      expect(html).toContain('id="summary-title"');
      expect(html).not.toContain('<iframe');
      expect(uri).toMatch(/^ui:\/\/rep-and-plate\/coaching-[a-f0-9]{16}\.html$/);
      const legacy = await connection.client.readResource({ uri: 'ui://rep-and-plate/coaching.html' });
      expect(legacy.contents[0]).toMatchObject({ uri: 'ui://rep-and-plate/coaching.html', text: coachingAppResource.text });
      const shell = await connection.client.readResource({ uri: 'ui://rep-and-plate/coaching-shell-v1.html' });
      expect(shell.contents[0]).toMatchObject({ text: coachingAppResource.text });
    } finally { await connection.close(); }
  });
  it('keeps the joke in the card and gives the assistant a fresh non-repeating response contract', async () => {
    const connection = await connect(['coaching.read']);
    try {
      const result = await connection.client.callTool({ name: 'get_coaching_day', arguments: {} });
      const view = result.structuredContent as Record<string, unknown>;
      const card = result._meta?.repAndPlateView as { spot: { says: string } };
      expect(view.presentation).toMatchObject({ mode: 'card' });
      expect(card.spot.says).toBeTruthy();
      expect(JSON.stringify(result.content)).not.toContain(card.spot.says);
      expect(view.spot).toEqual(card.spot);
      expect(view.presentation).toMatchObject({ questionOwner: 'card' });
      expect((result.content as { text: string }[])[0].text).toContain('Do not recap the card');
      expect((result.content as { text: string }[])[0].text).toContain('default nutrition targets');
    } finally { await connection.close(); }
  });
  it('detects negotiated UI support without requiring the extension', () => {
    expect(coachingAppSupported(undefined)).toBeUndefined();
    expect(coachingAppSupported({})).toBe(false);
    expect(coachingAppSupported({ extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [COACHING_APP_MIME] } } })).toBe(true);
  });
  it('exposes only granted operations and returns a useful text fallback plus the current coaching view', async () => {
    const connection = await connect(['coaching.read']);
    try {
      const list = await connection.client.listTools();
      expect(list.tools.map(tool => tool.name)).toEqual(['get_coaching_day']);
      expect(list.tools[0].annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(list.tools[0]._meta).toMatchObject({ ui: { resourceUri: COACHING_APP_URI } });
      const result = await connection.client.callTool({ name: 'get_coaching_day', arguments: { day: '2026-11-08' } });
      expect(result.structuredContent).toMatchObject({ state: { revision: 3, profile: canonical.state.profile }, freshness: canonical.freshness });
      expect(result.content).toEqual([expect.objectContaining({ type: 'text', text: expect.stringContaining('"stale": true') })]);
      // A real Codex session read a bare "stale" flag as "your plan is out of date"; the result now says what it covers.
      expect((result.content as { text: string }[])[0].text).toContain('do not describe the plan as stale');
      expect(result._meta).toMatchObject({ coachingOperations: ['coaching.read'] });
      expect(connection.seen).toEqual([{ operation: 'coaching.read', day: '2026-11-08' }]);
      const resource = await connection.client.readResource({ uri: COACHING_APP_URI });
      expect(resource.contents[0]).toMatchObject({ mimeType: COACHING_APP_MIME, _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, permissions: {} } } });
    } finally { await connection.close(); }
  });
  it('forwards a proposal without resolving it and rejects apply without the approval literal', async () => {
    const connection = await connect();
    try {
      const list = await connection.client.listTools();
      expect(list.tools.find(tool => tool.name === 'propose_coaching_change')?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, idempotentHint: true });
      expect(list.tools.find(tool => tool.name === 'resolve_coaching_change')?.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, idempotentHint: true });
      const requestId = randomUUID();
      await connection.client.callTool({ name: 'propose_coaching_change', arguments: { requestId, baseRevision: 3, command: { type: 'remember', memory: { id: randomUUID(), category: 'constraint', text: 'Hotel gym this week' }, reason: 'The user supplied this constraint.' } } });
      expect(connection.seen).toHaveLength(1);
      expect(connection.seen[0]).toMatchObject({ operation: 'coaching.propose', requestId, baseRevision: 3 });
      const invalid = await connection.client.callTool({ name: 'resolve_coaching_change', arguments: { proposalId: requestId, status: 'accepted' } }).catch(() => ({ isError: true }));
      expect(invalid.isError).toBe(true);
      expect(connection.seen).toHaveLength(1);
      await connection.client.callTool({ name: 'resolve_coaching_change', arguments: { proposalId: requestId, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' } });
      expect(connection.seen[1]).toMatchObject({ operation: 'coaching.resolve', confirmation: 'APPLY_REVIEWED_CHANGE' });
    } finally { await connection.close(); }
  });
  it('keeps service errors in both structured and text fallbacks', async () => {
    const connection = await connect(['coaching.read'], async () => ({ isError: true, content: [], structuredContent: { error: { code: 'REVOKED', message: 'Connection was revoked.' } } }));
    try {
      const result = await connection.client.callTool({ name: 'get_coaching_day', arguments: {} });
      expect(result.isError).toBe(true);
      expect(result.content).toEqual([expect.objectContaining({ type: 'text', text: expect.stringContaining('Connection was revoked.') })]);
    } finally { await connection.close(); }
  });

  it('keeps daily context bounded and excludes receipts, archived snapshots and forgotten memories', async () => {
    const forgotten = 'FORGOTTEN_PREFERENCE_DO_NOT_REINTRODUCE';
    const memory = { id: randomUUID(), text: 'Prefer short morning runs', category: 'preference' };
    const oldMemory = { id: randomUUID(), text: forgotten, category: 'preference' };
    const before = { profile: canonical.state.profile, sessions: canonical.state.sessions, outcomes: [], memories: [memory, oldMemory] };
    const after = { ...before, sessions: [{ ...canonical.state.sessions[0], minutes: 30 }] };
    const pendingId = randomUUID();
    const pending = { id: pendingId, requestId: pendingId, baseRevision: 3, status: 'pending', command: { type: 'update_session', reason: 'Make this run five minutes longer' }, before, after };
    const stale = { ...pending, id: randomUUID(), baseRevision: 2, command: { type: 'remember', reason: forgotten }, after: { ...after, memories: [oldMemory] } };
    const terminal = { ...pending, id: randomUUID(), status: 'accepted', command: { type: 'remember', reason: forgotten, memory: oldMemory } };
    const archived = { id: randomUUID(), revision: 3, kind: 'apply', at: '2026-11-08T10:00:00Z', reason: forgotten, before, after };
    const raw = {
      ...canonical,
      state: { ...canonical.state, memories: [memory], proposals: [terminal, stale, pending], journal: [archived], receipts: Array.from({ length: 100 }, () => ({ canonicalInput: `${forgotten}${'x'.repeat(2000)}` })) },
      brief: { ...canonical.brief, today: canonical.state.sessions, recentChanges: [archived] },
      proposal: terminal,
      context: { day: '2026-11-08', timezone: 'UTC', truncated: [] },
    };
    const connection = await connect(['coaching.read'], async () => ({ content: [], structuredContent: raw }));
    try {
      const reply = await connection.client.callTool({ name: 'get_coaching_day', arguments: {} });
      const rendered = JSON.stringify(reply);
      expect(rendered).toContain(memory.text);
      expect(rendered).not.toContain(forgotten);
      expect(rendered).not.toContain('canonicalInput');
      expect(rendered).not.toContain('receipts');
      expect(rendered.length).toBeLessThan(16000);
      expect(JSON.stringify(raw).length).toBeGreaterThan(200000);
      expect(reply.structuredContent).toMatchObject({ state: { revision: 3, memories: [memory] }, proposal: { id: terminal.id, status: 'accepted' }, context: raw.context });
      const view = reply.structuredContent as { state: { proposals: Record<string, unknown>[]; journal: Record<string, unknown>[] } };
      expect(view.state.proposals.find(item => item.id === pendingId)).toMatchObject({ before: { sessions: [{ id: sessionId, minutes: 25 }] }, after: { sessions: [{ id: sessionId, minutes: 30 }] } });
      expect(view.state.proposals.find(item => item.id === pendingId)?.before).not.toHaveProperty('memories');
      expect(view.state.proposals.find(item => item.id === stale.id)).toEqual({ id: stale.id, requestId: stale.requestId, baseRevision: 2, status: 'pending', needsReview: true });
      expect(view.state.journal[0]).not.toHaveProperty('before');
      expect(raw.state.journal[0].before.memories).toContain(oldMemory);
    } finally { await connection.close(); }
  });

  it('limits surfaced sessions, outcomes and pending proposals without losing weekly totals', () => {
    const sessionRows = Array.from({ length: 90 }, (_, index) => ({ ...canonical.state.sessions[0], id: randomUUID(), day: index < 20 ? '2026-11-08' : '2026-11-09' }));
    const outcomes = Array.from({ length: 180 }, () => ({ id: randomUUID(), sessionId, day: '2026-11-08', status: 'completed' }));
    const state = { ...canonical.state, sessions: sessionRows, outcomes, proposals: Array.from({ length: 40 }, () => ({ id: randomUUID(), baseRevision: 3, status: 'pending', command: { type: 'remember', reason: 'Current proposal' }, before: {}, after: {} })) };
    const view = projectCoachingMcpResult({ ...canonical, state, brief: { day: '2026-11-08', today: sessionRows.slice(0, 20), upcoming: sessionRows.slice(20), outcomes }, weekly: { planned: sessionRows, completed: outcomes, skipped: [], unreported: [], completedActualMinutes: 540 } });
    const projectedState = view.state as { sessions: unknown[]; outcomes: unknown[]; proposals: unknown[] };
    expect(projectedState.sessions).toHaveLength(28);
    expect(projectedState.outcomes).toHaveLength(14);
    expect(projectedState.proposals).toHaveLength(5);
    expect(view.weekly).toMatchObject({ plannedSessions: 90, completedSessions: 180, completedActualMinutes: 540 });
    expect(view.omitted).toEqual({ sessions: 62, outcomes: 166, pendingProposals: 35 });
  });
});

describe('coaching MCP App resource', () => {
  it('preserves a bounded earlier session to ask about without exposing the whole stored plan', () => {
    const old = { id: randomUUID(), day: '2026-11-07', sport: 'run', title: 'Yesterday’s run', minutes: 20 };
    const view = projectCoachingMcpResult({ ...canonical, weekly: { ...canonical.weekly, unreported: [old] } });
    expect((view.brief as { awaitingFeedback: unknown[] }).awaitingFeedback).toEqual([old]);
    expect((view.state as { sessions: unknown[] }).sessions).not.toContainEqual(old);
  });
  it('does not treat today’s planned session as an overdue report', () => {
    const view = projectCoachingMcpResult({ ...canonical, brief: { ...canonical.brief, today: canonical.state.sessions }, weekly: { ...canonical.weekly, unreported: canonical.state.sessions } });
    expect((view.spot as { moment: string }).moment).toBe('today');
    expect((view.brief as { awaitingFeedback: unknown[] }).awaitingFeedback).toEqual([]);
  });
  it('has an exact hash CSP, no external network origins, and no dynamic HTML insertion', () => {
    const executable = /<script>([\s\S]*?)<\/script>/.exec(coachingAppHtml)?.[1];
    const style = /<style>([\s\S]*?)<\/style>/.exec(coachingAppHtml)?.[1];
    expect(executable).toBeTruthy(); expect(style).toBeTruthy();
    for (const source of [executable!, style!]) expect(coachingAppHtml).toContain(`sha256-${createHash('sha256').update(source).digest('base64')}`);
    expect(coachingAppResource._meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] });
    expect(executable).not.toMatch(/innerHTML|insertAdjacentHTML|\bfetch\s*\(/);
  });

  it('negotiates the Apps handshake, ignores other senders, escapes content and requires a reviewed approval', async () => {
    const win = new Window({ url: 'https://view.example/', settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
    const posted: { message: Record<string, unknown>; origin: string }[] = [];
    const host = { postMessage: (message: Record<string, unknown>, origin: string) => posted.push({ message, origin }) };
    Object.defineProperty(win, 'parent', { value: host });
    Object.defineProperty(win, 'crypto', { value: webcrypto });
    const script = /<script>([\s\S]*?)<\/script>/.exec(coachingAppHtml)![1];
    win.document.write(coachingAppHtml.replace(/<script>[\s\S]*?<\/script>/, ''));
    win.eval(script);
    const receive = (message: unknown, source = host, origin = 'https://host.example') => {
      const event = new win.MessageEvent('message', { data: message, origin });
      Object.defineProperty(event, 'source', { value: source });
      win.dispatchEvent(event);
    };
    try {
      expect(posted[0].message).toMatchObject({ method: 'ui/initialize', params: { appInfo: { name: 'rep-and-plate-coaching' }, appCapabilities: { availableDisplayModes: ['inline'] } } });
      receive({ jsonrpc: '2.0', id: posted[0].message.id, result: { protocolVersion: '2026-01-26', hostCapabilities: { serverTools: {} } } });
      await Promise.resolve(); await Promise.resolve();
      expect(posted.some(item => item.message.method === 'ui/notifications/initialized')).toBe(true);
      const proposalId = randomUUID();
      const malicious = '<img src=x onerror="globalThis.compromised=true">';
      const snapshot = { profile: canonical.state.profile, sessions: canonical.state.sessions, outcomes: [], memories: [] };
      const proposal = { id: proposalId, status: 'pending', command: { type: 'remember', reason: malicious }, before: snapshot, after: snapshot };
      const result = { structuredContent: { ...canonical, state: { ...canonical.state, proposals: [proposal] } }, _meta: { coachingOperations: operations } };
      receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result }, { postMessage: vi.fn() });
      expect(win.document.getElementById('proposals')?.textContent).not.toContain(malicious);
      receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: result });
      expect(win.document.getElementById('proposals')?.textContent).toContain(malicious);
      expect(win.document.querySelector('#proposals img')).toBeNull();
      const apply = [...win.document.querySelectorAll('button')].find(button => button.textContent === 'Apply reviewed change')!;
      expect(apply.disabled).toBe(true);
      expect(posted.filter(item => item.message.method === 'tools/call')).toHaveLength(0);
      const checkbox = win.document.querySelector('#proposals input[type="checkbox"]')!;
      (checkbox as unknown as { checked: boolean }).checked = true;
      checkbox.dispatchEvent(new win.Event('change'));
      expect(apply.disabled).toBe(false);
      apply.click(); await Promise.resolve(); await Promise.resolve();
      const tool = posted.find(item => item.message.method === 'tools/call');
      expect(tool?.message.params).toMatchObject({ name: 'resolve_coaching_change', arguments: { proposalId, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' } });
      expect(tool?.origin).toBe('https://host.example');
      // Settle the request and wait for the click handler to display the service error.
      receive({ jsonrpc: '2.0', id: tool?.message.id, result: { ...result, isError: true, structuredContent: { error: { message: 'Review is stale.' } } } });
      await vi.waitFor(() => expect(win.document.getElementById('notice')?.textContent).toBe('Review is stale.'));
      // Cancellation clears the pending RPC and restores the ability to refresh.
      win.document.getElementById('refresh')!.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
      await vi.waitFor(() => expect(posted.filter(item => item.message.method === 'tools/call')).toHaveLength(2));
      receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-cancelled', params: {} });
      await vi.waitFor(() => expect(win.document.getElementById('notice')?.textContent).toContain('tool call was cancelled'));
      // Closing with a pending request must cancel it before the host removes the DOM.
      win.document.getElementById('refresh')!.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
      await vi.waitFor(() => expect(posted.filter(item => item.message.method === 'tools/call')).toHaveLength(3));
      receive({ jsonrpc: '2.0', id: 'teardown', method: 'ui/resource-teardown', params: {} });
      expect(posted.at(-1)?.message).toMatchObject({ id: 'teardown', result: {} });
      win.document.body.replaceChildren();
      await new Promise(resolve => setTimeout(resolve, 0));
    } finally { await win.happyDOM.close(); }
  });
});

describe('what freshness tells the assistant', () => {
  const current = 'The coaching plan, reported outcomes, memories and records from other apps shown here are current.';
  it('says the plan is current when no app records exist, which is normal for an assistant-only user', () => {
    const view = freshnessView({ mode: 'cloud_snapshot', publishedAt: null, dataUpdatedAt: null, sourceRevision: null, ageSeconds: null, stale: true });
    expect(view.summary).toContain(current);
    expect(view.summary).toContain('unknown, not zero');
    expect(view.summary).toContain('do not describe the plan as stale');
    expect(view.appliesTo).toContain('never the coaching plan');
    expect(view.stale).toBe(true);
  });
  it('gives the age of old app records in plain words and limits when to mention it', () => {
    const view = freshnessView({ mode: 'cloud_snapshot', dataUpdatedAt: '2026-11-10T09:00:00Z', ageSeconds: 3 * 3600, stale: true });
    expect(view.summary).toContain(current);
    expect(view.summary).toContain('last saved 3 hours ago');
    expect(view.summary).toContain('only when your advice depends on them');
    expect(freshnessView({ dataUpdatedAt: '2026-11-07T09:00:00Z', ageSeconds: 3 * 86400, stale: true }).summary).toContain('3 days ago');
  });
  it('states fresh app records without a warning', () => {
    const view = freshnessView({ mode: 'cloud_snapshot', dataUpdatedAt: '2026-11-10T11:59:00Z', ageSeconds: 60, stale: false });
    expect(view.summary).toContain('saved under two minutes ago');
    expect(view.summary).not.toContain('may miss');
  });
});
