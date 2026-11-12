import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { AgentService } from '../server/agents/service';
import { SqliteAgentStore } from '../server/agents/sqlite';
import { registerCoachingTools } from '../scripts/agents/coaching-mcp';
import { COACHING_APP_MIME, COACHING_APP_URI } from '../server/agents/coaching-app';
import type { CoachingCommand, CoachingState } from '../src/features/coaching/contracts';

const day = '2026-11-12';
const operations = ['coaching.read', 'coaching.propose', 'coaching.resolve', 'coaching.undo', 'coaching.import'];
const host = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test conversation</title><style>html,body{margin:0;background:#181b19;color:#fff;font:14px system-ui}main{max-width:760px;margin:auto}iframe{display:block;border:1px solid #3e4d43;border-radius:14px;width:100%;box-sizing:border-box;background:#181b19}h1{font-size:14px;font-weight:400;color:#aab9af;margin:16px 12px}</style></head><body><main><h1>Rep &amp; Plate · Synthetic conversation host</h1><iframe id="app" title="Rep and Plate" src="/app"></iframe></main><script>
window.calls=[];window.initializations=0;
addEventListener('message',async event=>{
 const frame=document.querySelector('iframe'); if(event.source!==frame.contentWindow)return;
 const m=event.data;
 const reply=value=>event.source.postMessage({jsonrpc:'2.0',...value},event.origin);
 if(m.method==='ui/initialize'){
   window.initializations++;
   const params=new URL(location).searchParams;
   reply({id:m.id,result:{protocolVersion:'2026-01-26',hostCapabilities:params.has('readonly')?{}:{serverTools:{}},hostContext:{theme:params.get('theme')||'dark'}}});
 }
 if(m.method==='ui/notifications/initialized')reply({method:'ui/notifications/tool-result',params:await fetch('/read').then(r=>r.json())});
 if(m.method==='ui/notifications/size-changed')frame.style.height=m.params.height+2+'px';
 if(m.method==='tools/call'){
   window.calls.push(m.params);
   const result=await fetch('/call',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(m.params)}).then(r=>r.json());
   reply({id:m.id,result});
 }
});
</script></body></html>`;

async function fixture(page: Page, seeded = false, legacy: boolean | 'blocked-shell' = false, blockFrames = true) {
  const store = new SqliteAgentStore(':memory:');
  const service = new AgentService(store, () => Date.parse(`${day}T15:00:00Z`));
  const state = async () => (await service.manage('card-test', { operation: 'coaching.read', day }) as { state: CoachingState }).state;
  const propose = async (command: CoachingCommand) => {
    const requestId = randomUUID();
    await service.manage('card-test', { operation: 'coaching.propose', requestId, baseRevision: (await state()).revision, command });
    return requestId;
  };
  const save = async (command: CoachingCommand) => {
    const proposalId = await propose(command);
    await service.manage('card-test', { operation: 'coaching.resolve', proposalId, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' });
  };
  const session = { id: randomUUID(), day, sport: 'strength' as const, title: 'Full-body strength', minutes: 35, details: 'Comfortable effort. Leave a little in reserve.' };
  if (seeded) {
    await save({ type: 'setup', profile: { primaryGoal: 'Build a steady training routine', priorities: [], constraints: [], notes: '' }, reason: 'Chosen goal.' });
    await save({ type: 'replace_week', startDay: '2026-11-09', sessions: [session, { ...session, id: randomUUID(), day: '2026-11-14', sport: 'run', title: 'Easy run', minutes: 25, details: '' }], reason: 'Reviewed training week.' });
  }
  const mcp = new McpServer({ name: 'card-browser-test', version: '1.0.0' });
  registerCoachingTools(mcp, async request => {
    try {
      const result = await service.manage('card-test', request as Parameters<AgentService['manage']>[1]);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result as Record<string, unknown> };
    } catch (error) {
      const result = { error: { message: error instanceof Error ? error.message : 'Request failed.' } };
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    }
  }, operations);
  const client = new Client({ name: 'browser-host', version: '1.0.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [COACHING_APP_MIME] } } } });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await mcp.connect(serverTransport); await client.connect(clientTransport);
  // The host starts collapsed until the app initializes and reports its size.
  const cachedShell = legacy ? { text: readFileSync(new URL(legacy === true ? './fixtures/mcp/coaching-b34d29c.html' : './fixtures/mcp/coaching-shell-v1.html', import.meta.url), 'utf8') } : (await client.readResource({ uri: COACHING_APP_URI })).contents[0] as { text: string };
  if (legacy === true) expect(createHash('sha256').update(cachedShell.text).digest('hex')).toBe('c045f8ff1d97819fbb0e74d27800bc33cdcb94d2959f3a952a30e234cf7a6836');
  if (legacy === 'blocked-shell') expect(createHash('sha256').update(cachedShell.text).digest('hex')).toBe('33a2124d6670a82e366f09957002ccc9becd3862e4621e4e89321724813a075d');
  const viewRequests: string[] = [];
  let oldPayload = false;
  const toolResult = async (input: Parameters<typeof client.callTool>[0]) => {
    const result = await client.callTool(input);
    // Recreate the already-rendered bad response; metadata still contains Spot.
    if (oldPayload && result.structuredContent) delete (result.structuredContent as Record<string, unknown>).spot;
    return result;
  };
  await page.route('https://repandplate.com/**', async route => {
    viewRequests.push(route.request().url());
    await route.abort();
  });
  const server: Server = createServer((request, response) => {
    void (async () => {
      response.setHeader('Cache-Control', 'no-store');
      if (request.url === '/app') { response.setHeader('Content-Type', 'text/html'); if (blockFrames) response.setHeader('Content-Security-Policy', "frame-src 'none'"); response.end(cachedShell.text); return; }
      if (request.url === '/read') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(await toolResult({ name: 'get_coaching_day', arguments: { day } }))); return; }
      if (request.url === '/call') {
        const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
        response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(await toolResult(JSON.parse(Buffer.concat(chunks).toString())))); return;
      }
      response.setHeader('Content-Type', 'text/html'); response.end(host.replace('iframe{display:block;', 'iframe{height:0;display:block;'));
    })().catch(error => { response.statusCode = 500; response.end(String(error)); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const frame = page.frameLocator('#app');
  return {
    state, save, propose, service, session, frame,
    cachedShell, viewRequests,
    setOldPayload: (value: boolean) => { oldPayload = value; },
    navigate: () => page.goto(url),
    open: async (query = '') => {
      await page.goto(url + query);
      await expect(frame.locator('#summary-title')).not.toHaveText('Getting your coaching plan…');
      await expect.poll(() => page.locator('#app').evaluate(node => Number.parseInt((node as HTMLElement).style.height))).toBeGreaterThan(100);
    },
    close: async () => {
      await page.goto('about:blank');
      await new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); });
      await client.close(); await mcp.close(); store.close();
    },
  };
}

test('the card renders when the host blocks all nested frames', async ({ page }) => {
  const f = await fixture(page, false, false, true);
  try {
    await f.open();
    await expect(f.frame.getByRole('heading', { name: 'What are we training for?' })).toBeVisible();
    await expect(f.frame.locator('#spot')).toBeVisible();
    await expect(page.frameLocator('#app').locator('iframe')).toHaveCount(0);
  } finally { await f.close(); }
});

test('the retired shell reproduces a collapsed card under the host frame restriction', async ({ page }) => {
  const f = await fixture(page, false, 'blocked-shell');
  try {
    await page.clock.install();
    await f.navigate();
    await page.clock.fastForward(16000);
    expect(await page.evaluate(() => (window as unknown as { initializations: number }).initializations)).toBe(0);
    expect((await page.locator('#app').boundingBox())!.height).toBeLessThanOrEqual(2);
  } finally { await f.close(); }
});

test('the previously deployed cached card keeps Spot on the same connection', async ({ page }, info) => {
  const f = await fixture(page, false, true);
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    f.setOldPayload(true);
    await f.open();
    await expect(f.frame.locator('#spot')).toBeHidden();
    await expect(f.frame.getByRole('heading', { name: 'What are we training for?' })).toBeVisible();
    f.setOldPayload(false);
    await f.frame.getByRole('button', { name: 'Refresh plan' }).click();
    await expect(f.frame.locator('#spot')).toBeVisible();
    await expect(f.frame.locator('#spot-says')).toContainText('start a podcast');
    expect(f.viewRequests).toHaveLength(0);
    expect((await f.state()).revision).toBe(0);
    await page.locator('#app').screenshot({ path: info.outputPath('cached-card-restored.png') });
  } finally { await f.close(); }
});

test('empty plan asks one question in the card at narrow and wide widths', async ({ page }, info) => {
  const f = await fixture(page);
  try {
    for (const width of [320, 390, 760]) {
      await page.setViewportSize({ width, height: 844 }); await f.open();
      await expect(f.frame.getByRole('heading', { name: 'What are we training for?' })).toBeVisible();
      await expect(f.frame.locator('#next-step')).toHaveText('Tell me your goal in chat. We’ll build a week around it.');
      await expect(f.frame.locator('#more-plan')).toBeHidden();
      await expect(f.frame.getByText('0 completed', { exact: false })).toBeHidden();
      await expect(f.frame.locator('#notice')).toBeHidden();
      await expect(f.frame.locator('#spot-pose')).toHaveCSS('width', '56px');
      const box = await page.locator('#app').boundingBox(); expect(box!.height).toBeLessThan(400);
      expect(box!.width).toBe(width);
      expect(await f.frame.locator('html').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.locator('#app').screenshot({ path: info.outputPath(`spot-setup-${width}.png`) });
    }
    expect((await f.state()).revision).toBe(0);
  } finally { await f.close(); }
});

test('a cached inline card refreshes current data on the same MCP connection', async ({ page }) => {
  const f = await fixture(page);
  try {
    await f.open();
    const shell = f.cachedShell.text;
    await f.save({ type: 'setup', profile: { primaryGoal: 'Build a steady routine', priorities: [], constraints: [], notes: '' }, reason: 'Chosen goal.' });
    await f.frame.getByRole('button', { name: 'Refresh plan' }).click();
    await expect(f.frame.locator('#summary-goal')).toHaveText('Build a steady routine');
    expect(f.cachedShell.text).toBe(shell);
    expect(f.viewRequests).toHaveLength(0);
    expect((await f.state()).revision).toBe(1);
  } finally { await f.close(); }
});

test('messages from a foreign frame or origin cannot invoke a tool through the card', async ({ page }) => {
  const f = await fixture(page, true);
  try {
    await f.open();
    await page.locator('#app').evaluate(node => {
      const shell = (node as HTMLIFrameElement).contentWindow!;
      shell.postMessage({ jsonrpc: '2.0', method: 'tools/call', id: 'forged', params: { name: 'undo_coaching_change', arguments: {} } }, '*');
    });
    // An unsolicited host command and a sibling frame cannot invoke app actions.
    await page.evaluate(() => {
      const sibling = document.createElement('iframe'); document.body.append(sibling);
      sibling.contentWindow!.eval(`parent.document.querySelector('#app').contentWindow.postMessage({jsonrpc:'2.0',method:'tools/call',id:'sibling',params:{name:'undo_coaching_change',arguments:{}}},'*')`);
    });
    await page.frameLocator('#app').locator('body').evaluate(() => {
      dispatchEvent(new MessageEvent('message', { source: parent, origin: 'https://foreign.example', data: { jsonrpc: '2.0', method: 'tools/call', id: 'wrong-origin', params: { name: 'undo_coaching_change', arguments: {} } } }));
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(f.frame.getByRole('heading', { name: 'Today’s plan' })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { calls: unknown[] }).calls)).toEqual([]);
    expect((await f.state()).revision).toBe(2);
  } finally { await f.close(); }
});

test('the card needs no public view or external request to render', async ({ page }) => {
  const f = await fixture(page);
  try {
    await f.open();
    await expect(f.frame.locator('#spot-says')).toContainText('start a podcast');
    expect(f.viewRequests).toHaveLength(0);
    expect((await f.state()).revision).toBe(0);
  } finally { await f.close(); }
});

for (const legacy of [false, true]) test('report, review, approve and refresh persist one actual outcome and shrink the ' + (legacy ? 'cached card' : 'current card'), async ({ page }, info) => {
  const f = await fixture(page, true, legacy);
  try {
    await f.open();
    await expect(f.frame.getByRole('heading', { name: 'Today’s plan' })).toBeVisible();
    await expect(f.frame.locator('#summary-sessions')).toContainText('Full-body strength');
    await expect(f.frame.locator('#more-plan')).not.toHaveAttribute('open', '');
    await page.locator('#app').screenshot({ path: info.outputPath('spot-today.png') });
    await f.frame.locator('#summary-sessions').getByRole('button', { name: 'Report result' }).click();
    await f.frame.getByLabel('Minutes, if known', { exact: true }).fill('32');
    await f.frame.getByLabel('Anything to remember?').fill('Felt steady.');
    await f.frame.getByRole('button', { name: 'Propose feedback', exact: true }).click();
    await expect(f.frame.getByRole('heading', { name: 'Proposed change · awaiting your approval' })).toBeVisible();
    await expect(f.frame.locator('.beforeafter')).toContainText('32 min');
    expect((await f.state()).outcomes).toHaveLength(0);
    await expect(f.frame.locator('#summary')).toBeHidden();
    const apply = f.frame.getByRole('button', { name: 'Apply reviewed change', exact: true });
    await expect(apply).toBeDisabled();
    const proposalBox = await page.locator('#app').boundingBox();
    await page.locator('#app').screenshot({ path: info.outputPath('spot-review.png') });
    await f.frame.getByLabel('I reviewed the before and after details and approve this change.').check();
    await apply.click();
    await expect.poll(async () => (await f.state()).outcomes.length).toBe(1);
    await expect(f.frame.locator('#notice')).toHaveText('Reviewed change applied.');
    await expect(f.frame.locator('#review')).toBeHidden();
    await expect(f.frame.locator('#summary-sessions')).toContainText('Reported completed');
    await expect.poll(async () => (await page.locator('#app').boundingBox())!.height).toBeLessThan(proposalBox!.height);
    expect((await f.state()).outcomes[0]).toMatchObject({ actualMinutes: 32, note: 'Felt steady.' });
    await f.frame.getByRole('button', { name: 'Refresh plan' }).click();
    expect((await f.state()).outcomes).toHaveLength(1);
    await page.locator('#app').screenshot({ path: info.outputPath('spot-saved.png') });
  } finally { await f.close(); }
});

test('a stale proposal cannot save even after an earlier review', async ({ page }) => {
  const f = await fixture(page, true);
  try {
    await f.propose({ type: 'update_session', sessionId: f.session.id, changes: { day: '2026-11-13' }, reason: 'Move strength to Friday.' });
    await f.open();
    await f.save({ type: 'remember', memory: { id: randomUUID(), text: 'Fridays are easier.', category: 'preference' }, reason: 'Explicit preference.' });
    await f.frame.getByLabel('I reviewed the before and after details and approve this change.').check();
    await f.frame.getByRole('button', { name: 'Apply reviewed change' }).click();
    await expect(f.frame.locator('#notice')).toContainText(/revision|changed|stale/i);
    expect((await f.state()).sessions.find(item => item.id === f.session.id)?.day).toBe(day);
    await f.frame.getByRole('button', { name: 'Refresh plan' }).click();
    await expect(f.frame.getByRole('button', { name: 'Apply reviewed change' })).toBeDisabled();
  } finally { await f.close(); }
});

test('host theme controls colors and a display-only host offers a chat path', async ({ page }) => {
  const f = await fixture(page, true);
  try {
    await page.emulateMedia({ colorScheme: 'dark' }); await f.open('?theme=light&readonly');
    await expect(f.frame.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(f.frame.locator('html')).toHaveCSS('color', 'rgb(23, 61, 49)');
    await expect(f.frame.getByRole('button', { name: 'Refresh plan' })).toBeDisabled();
    await expect(f.frame.locator('#notice')).toContainText('Ask in chat');
    await expect(f.frame.locator('#summary-sessions').getByRole('button')).toHaveCount(0);
    await page.emulateMedia({ colorScheme: 'light' }); await f.open('?theme=dark');
    await expect(f.frame.locator('html')).toHaveCSS('color', 'rgb(229, 243, 233)');
  } finally { await f.close(); }
});
