import { afterEach, describe, expect, it } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Window } from 'happy-dom';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createAgentHandler } from './http.ts';
import { AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import { SPOT_APP_URI, spotAppHtml, spotAppResource } from './spot-app.ts';
import { coachingAppHtml } from './coaching-app.ts';
import { spotPoseImages } from './spot-poses.ts';
import { spotNote, spotPoseFor, type SpotMoment } from '../../src/features/spot/assistant.ts';

// Spot's drawings in the cards Claude shows above a reply. Each pose is a small built-in image;
// tool data only names which one, and the line enters as text.

const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
const moments: SpotMoment[] = ['blank', 'no_goal', 'unreported', 'today', 'done', 'organised', 'imported', 'meal_drafted', 'waiting'];

/** Load a card as a host would and complete the MCP Apps handshake. */
async function mount(html: string, protocolVersion = '2026-01-26', hostContext = {}) {
  const win = new Window({ url: 'https://view.example/', settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true, disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
  const posted: Record<string, unknown>[] = [];
  const host = { postMessage: (message: Record<string, unknown>) => posted.push(message) };
  Object.defineProperty(win, 'parent', { value: host });
  Object.defineProperty(win, 'crypto', { value: webcrypto });
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)![1];
  win.document.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  win.eval(script);
  const receive = (message: unknown) => {
    const event = new win.MessageEvent('message', { data: message, origin: 'https://host.example' });
    Object.defineProperty(event, 'source', { value: host });
    win.dispatchEvent(event);
  };
  const init = posted.find(message => message.method === 'ui/initialize')!;
  receive({ jsonrpc: '2.0', id: init.id, result: { protocolVersion, hostCapabilities: {}, hostContext } });
  for (let i = 0; i < 3; i++) await Promise.resolve();
  cleanup.push(() => win.happyDOM.close());
  return { win, posted, receive };
}

describe('Spot’s poses', () => {
  it('has a small built-in drawing for every moment', () => {
    for (const moment of moments) {
      const image = spotPoseImages[spotPoseFor[moment]];
      expect(image, moment).toMatch(/^data:image\/png;base64,/);
      // Each is a few kilobytes, not the 1.2 MB original.
      expect(image.length, moment).toBeLessThan(16_000);
    }
    expect(spotNote('meal_drafted').pose).toBe('chef');
  });
});

describe('the small Spot card for the basic tools', () => {
  it('allows only built-in images and no network, scripts or styles beyond its own', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(spotAppHtml)![1];
    const style = /<style>([\s\S]*?)<\/style>/.exec(spotAppHtml)![1];
    for (const source of [script, style]) expect(spotAppHtml).toContain(`sha256-${createHash('sha256').update(source).digest('base64')}`);
    expect(spotAppHtml).toContain("img-src data:; connect-src 'none'");
    expect(spotAppResource._meta.ui.csp).toEqual({ connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] });
    expect(script).not.toMatch(/innerHTML|insertAdjacentHTML|\bfetch\s*\(/);
  });

  it('shows the pose and line from a tool result, as text, and ignores a pose it does not have', async () => {
    const { win, posted, receive } = await mount(spotAppHtml);
    expect(posted.some(message => message.method === 'ui/notifications/initialized')).toBe(true);
    const box = win.document.getElementById('spot') as unknown as { hidden: boolean };
    expect(box.hidden).toBe(true);
    receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: { spot: spotNote('meal_drafted', '2026-11-12') } } });
    const image = win.document.getElementById('spot-pose') as unknown as { src: string; alt: string; hidden: boolean };
    expect(box.hidden).toBe(false);
    expect(image.src).toBe(spotPoseImages.chef);
    expect(image.alt).toBe('Spot, chef');
    expect(win.document.getElementById('spot-says')!.textContent).toBe(spotNote('meal_drafted', '2026-11-12').says);
    const hostile = '<img src=x onerror="globalThis.compromised=true">';
    receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: { spot: { says: hostile, pose: 'javascript:alert(1)' } } } });
    expect(win.document.getElementById('spot-says')!.textContent).toBe(hostile);
    expect(win.document.querySelectorAll('#spot img')).toHaveLength(1);
    expect(image.hidden).toBe(true);
  });
});

describe('a host on another protocol version', () => {
  it('still gets Spot instead of an empty frame', async () => {
    for (const html of [spotAppHtml, coachingAppHtml]) {
      const { win, receive } = await mount(html, '2026-06-01');
      receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: { state: { revision: 0 }, spot: spotNote('blank', '2026-11-12') } } });
      expect((win.document.getElementById('spot') as unknown as { hidden: boolean }).hidden).toBe(false);
    }
  });
});

describe('the coaching card', () => {
  it('shows Spot above the plan', async () => {
    expect(coachingAppHtml).toContain("img-src data:; connect-src 'none'");
    const { win, receive } = await mount(coachingAppHtml);
    receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: { state: { revision: 0 }, spot: spotNote('no_goal', '2026-11-12') } } });
    expect((win.document.getElementById('spot') as unknown as { hidden: boolean }).hidden).toBe(false);
    expect((win.document.getElementById('spot-pose') as unknown as { src: string }).src).toBe(spotPoseImages.planner);
  });

  it('makes an empty plan one useful question without an empty dashboard or stale-plan warning', async () => {
    const { win, receive } = await mount(coachingAppHtml);
    receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: {
      state: { revision: 0, profile: { primaryGoal: '' }, sessions: [], proposals: [], journal: [] },
      brief: { day: '2026-11-12', today: [], upcoming: [], missingData: ['No completed or skipped outcomes have been reported.'] },
      weekly: { plannedSessions: 0, completedSessions: 0, observations: ['No actual outcomes were reported for this period.'] },
      freshness: { stale: true, dataUpdatedAt: null }, spot: spotNote('no_goal', '2026-11-12'),
    } } });
    expect(win.document.getElementById('summary-title')?.textContent).toBe('What are we training for?');
    expect(win.document.getElementById('next-step')?.textContent).toContain('Tell me your goal in chat');
    expect(win.document.getElementById('summary')?.textContent).not.toMatch(/0 completed|out of date|No actual outcomes/);
    expect((win.document.getElementById('more-plan') as unknown as { hidden: boolean }).hidden).toBe(true);
    expect((win.document.getElementById('review') as unknown as { hidden: boolean }).hidden).toBe(true);
    expect(win.document.body.textContent).not.toContain('Refresh before changing the plan');
  });

  it('shows the next useful question about a sourced activity without marking a session complete', async () => {
    const { win, receive } = await mount(coachingAppHtml);
    const yesterday = { id: 'earlier-run', title: 'Easy run', day: '2026-11-11', sport: 'run', minutes: 25 };
    receive({ jsonrpc: '2.0', method: 'ui/notifications/tool-result', params: { structuredContent: {
      state: { revision: 2, profile: { primaryGoal: 'A steady routine' }, sessions: [], outcomes: [] },
      brief: { day: '2026-11-12', awaitingFeedback: [yesterday], today: [], upcoming: [] },
      evidence: { activities: [{ source: 'strava', title: 'Morning run', day: '2026-11-11', sport: 'run', minutes: 25 }] },
      nextSteps: ['Ask whether the imported record was this session before recording anything.'],
      spot: spotNote('unreported', '2026-11-12'),
    } } });
    expect(win.document.getElementById('next-step')?.textContent).toContain('Was that your “Easy run”');
    expect(win.document.getElementById('next-step')?.textContent).toContain('Strava');
    expect(win.document.getElementById('summary')?.textContent).not.toContain('completed');
    expect(win.document.getElementById('saved-state')).toBeNull();
  });

  it('uses the host theme for the palette and keeps the artwork small', async () => {
    for (const html of [coachingAppHtml, spotAppHtml]) {
      const { win, receive } = await mount(html, '2026-01-26', { theme: 'light' });
      expect(win.document.documentElement.dataset.theme).toBe('light');
      receive({ jsonrpc: '2.0', method: 'ui/notifications/host-context-changed', params: { theme: 'dark' } });
      expect(win.document.documentElement.dataset.theme).toBe('dark');
      expect(win.document.getElementById('spot-pose')?.getAttribute('width')).toBe('56');
    }
  });
});

describe('the server offers the Spot card', () => {
  it('links the basic tools to it and serves it', async () => {
    const store = new SqliteAgentStore(':memory:'); cleanup.push(() => store.close());
    const service = new AgentService(store);
    const { token } = await service.manage('card-owner', { operation: 'create', name: 'Basic', scopes: ['nutrition:read', 'meals:propose'], expiresInDays: 30 }) as { token: string };
    const handler = createAgentHandler({ store });
    const server = createServer((req, res) => { void handler(req, res); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
    const client = new Client({ name: 'card-host', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/agents/mcp`), { requestInit: { headers: { 'x-api-key': token } } }));
    cleanup.push(() => client.close());
    const tools = (await client.listTools()).tools;
    for (const name of ['read_context', 'propose_meal']) expect(tools.find(tool => tool.name === name)?._meta, name).toMatchObject({ ui: { resourceUri: SPOT_APP_URI }, 'ui/resourceUri': SPOT_APP_URI });
    const resource = await client.readResource({ uri: SPOT_APP_URI });
    expect((resource.contents[0] as { text: string }).text).toBe(spotAppHtml);
  });
});
