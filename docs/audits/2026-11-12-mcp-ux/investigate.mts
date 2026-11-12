// Read-only UX investigation. Run: node --import tsx docs/audits/2026-11-12-mcp-ux/investigate.mts
// Browser host and all records are synthetic; no account, API, or saved user data is accessed.
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { coachingAppHtml } from '../../../server/agents/coaching-app.ts';
import { spotAppHtml } from '../../../server/agents/spot-app.ts';
import { spotPoseImages } from '../../../server/agents/spot-poses.ts';
import { emptyCoachingState, coachingBrief, coachingWeeklyReview, coachingNextSteps, coachingEvidenceView, proposeCoaching } from '../../../src/features/coaching/model.ts';
import { projectCoachingMcpResult } from '../../../scripts/agents/coaching-mcp.ts';

const directory = fileURLToPath(new URL('.', import.meta.url));
const day = '2026-11-12';
const operations = ['coaching.read', 'coaching.propose', 'coaching.resolve', 'coaching.undo'];
const blank = emptyCoachingState();
const active = emptyCoachingState();
active.profile.primaryGoal = 'Build a steady training routine';
active.sessions = [
  { id: randomUUID(), day: '2026-11-11', sport: 'run', title: 'Easy run', minutes: 25, details: '' },
  { id: randomUUID(), day, sport: 'strength', title: 'Full-body strength', minutes: 35, details: 'Comfortable effort. Leave a little in reserve.' },
  { id: randomUUID(), day: '2026-11-14', sport: 'run', title: 'Easy run', minutes: 25, details: '' },
];
const pending = proposeCoaching(active, {
  requestId: randomUUID(), baseRevision: 0,
  command: { type: 'update_session', sessionId: active.sessions[1].id, changes: { day: '2026-11-13' }, reason: 'Move strength training to Friday, as requested.' },
}, 'UX audit fixture', `${day}T14:00:00Z`, day).state;
const imported = structuredClone(active);
imported.evidence.activities.push({ source: 'strava', externalId: 'synthetic-run-1', day: '2026-11-11', sport: 'run', title: 'Morning run', minutes: 25, actor: 'UX audit fixture', recordedAt: `${day}T14:00:00Z` });
const view = state => projectCoachingMcpResult({
  state, brief: coachingBrief(state, day), weekly: coachingWeeklyReview(state, day), evidence: coachingEvidenceView(state, day),
  nextSteps: coachingNextSteps(state, day),
  freshness: { mode: 'cloud_snapshot', publishedAt: null, dataUpdatedAt: null, sourceRevision: null, ageSeconds: null, stale: true },
});
const fixtures = Object.fromEntries(Object.entries({ blank, active, pending, imported }).map(([name, state]) => [name, view(state)]));
let selected = 'blank', hostTheme = 'dark', interactive = true;
const hostHtml = `<!doctype html><html><head><meta charset="utf-8"><title>Synthetic MCP Apps host</title><style>html,body{margin:0;background:#181818}iframe{display:block;width:100%;border:0}</style></head><body><iframe title="Coaching app" src="/app"></iframe><script>
window.auditMessages=[];
addEventListener('message',async event=>{
  const frame=document.querySelector('iframe'); if(event.source!==frame.contentWindow)return;
  const m=event.data; window.auditMessages.push(m);
  const reply=message=>event.source.postMessage({jsonrpc:'2.0',...message},event.origin);
  if(m.method==='ui/initialize'){
    const options=await fetch('/options').then(r=>r.json());
    reply({id:m.id,result:{protocolVersion:'2026-01-26',hostCapabilities:options.interactive?{serverTools:{}}:{},hostContext:{theme:options.theme}}});
  }
  if(m.method==='ui/notifications/initialized')reply({method:'ui/notifications/tool-result',params:await fetch('/result').then(r=>r.json())});
  if(m.method==='ui/notifications/size-changed')frame.style.height=m.params.height+'px';
  if(m.method==='tools/call'){
    if(m.params.name==='get_coaching_day')reply({id:m.id,result:await fetch('/result').then(r=>r.json())});
    else reply({id:m.id,result:{isError:true,structuredContent:{error:{message:'Synthetic host: changes are intentionally not saved.'}}}});
  }
});
</script></body></html>`;
const server = createServer((request, response) => {
  const path = request.url;
  response.setHeader('Cache-Control', 'no-store');
  if (path === '/result') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ structuredContent: fixtures[selected], _meta: { coachingOperations: operations } })); }
  else if (path === '/options') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ theme: hostTheme, interactive })); }
  else { response.setHeader('Content-Type', 'text/html'); response.end(path === '/app' ? coachingAppHtml : path === '/concept' ? concept : hostHtml); }
});

const concept = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rep & Plate · conversational cards concept</title><style>
:root{color-scheme:dark;--bg:#151a17;--surface:#202823;--ink:#ecf3ee;--muted:#b4c3b8;--line:#3e4d43;--mint:#a5e3c0;--soft:#283c30;font-family:"Segoe UI",sans-serif;color:var(--ink);background:var(--bg)}
*{box-sizing:border-box}body{margin:0;padding:40px;max-width:1320px;margin-inline:auto}header{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding-bottom:22px}header img{width:52px;height:52px;object-fit:contain}.brand{font-size:12px;letter-spacing:1.6px;color:var(--mint);font-weight:750;margin:0 0 5px}.sub{font-size:13px;color:var(--muted);margin:0}h1{font-size:clamp(25px,4vw,40px);font-weight:650;letter-spacing:-1px;line-height:1.15;margin:30px 0 12px}main>p{max-width:730px;margin:0;color:var(--muted);font-size:16px;line-height:1.6}.examples{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;margin:30px 0}.step{font-size:11px;letter-spacing:1.2px;color:var(--mint);text-transform:uppercase;font-weight:700;margin:0 0 14px}.scenario{font-size:13px;line-height:1.5;color:var(--muted);margin:0 0 14px}.user{background:#29332c;border-radius:16px 16px 3px 16px;padding:10px 13px;line-height:1.5;font-size:14px;margin:0 0 20px 30px}.reply{line-height:1.6;font-size:16px}.reply p{margin:0 0 12px}.card{border:1px solid var(--line);background:var(--surface);border-radius:18px;overflow:hidden}.card-top{padding:16px 18px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--line)}.card-top img{width:36px;height:36px;object-fit:contain}.card-top span{font-size:12px;color:var(--muted)}.card-top strong{display:block;font-size:12px;color:var(--mint);margin-bottom:2px}.content{padding:18px}h2{font-size:21px;letter-spacing:-.4px;line-height:1.3;margin:0 0 8px}.meta{font-size:13px;color:var(--muted);margin:0 0 18px}.detail{border-top:1px solid var(--line);padding-top:12px;margin:0;font-size:14px;line-height:1.5}.detail span{display:block;color:var(--muted);font-size:12px;margin-top:5px}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:18px}button{border:1px solid var(--mint);border-radius:10px;min-height:44px;background:var(--mint);color:#15291c;font:600 13px "Segoe UI",sans-serif;padding:10px 14px}button.secondary{background:transparent;color:var(--ink);border-color:var(--line)}button:disabled{opacity:1}.note{font-size:12px;line-height:1.5;color:var(--muted);margin:12px 0 0}.delta{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;padding:14px 0;border-block:1px solid var(--line);font-size:16px}.delta small{display:block;color:var(--muted);font-size:11px;margin-bottom:6px}.delta b{font-weight:600}.delta i{font-style:normal;color:var(--mint)}footer{border-top:1px solid var(--line);padding-top:18px;font-size:12px;color:var(--muted);line-height:1.6}.thesis{color:var(--ink);font-weight:600} @media(max-width:820px){body{padding:22px}.examples{grid-template-columns:1fr;gap:30px}h1{letter-spacing:-.5px}.column{max-width:520px}.user{margin-left:45px}} @media(prefers-color-scheme:light){:root{color-scheme:light;--bg:#f5f8f4;--surface:#fff;--ink:#17372a;--muted:#4a6354;--line:#c8d8cd;--mint:#006249;--soft:#e1f0e5}.user{background:#e4ede5}button{color:#fff}button.secondary{color:var(--ink)}}
</style></head><body><header><img src="${spotPoseImages.peek}" alt="" width="52" height="52"><div><p class="brand">REP &amp; PLATE</p><p class="sub">UX direction · November 12, 2026</p></div></header><main><h1>A coach in the conversation.</h1><p>Let the question lead. Bring in a small card when there is something useful to see or a decision to make.</p><div class="examples">
<section class="column"><p class="step">01 / No plan yet</p><p class="scenario">A plain reply is enough to get started.</p><div class="user">Can you help me plan my training?</div><div class="reply"><p>What would you like your training to support?</p><p>Give me a goal and we’ll build a week around it. I’ve got the clipboard.</p></div><p class="note">Continue in the chat composer. No empty dashboard.</p></section>
<section class="column"><p class="step">02 / A useful daily summary</p><p class="scenario">One session. One clear next step.</p><article class="card"><div class="card-top"><img src="${spotPoseImages.dumbbell}" alt="" width="36" height="36"><div><strong>REP &amp; PLATE</strong><span>Thursday, Nov 12 · Plan checked now</span></div></div><div class="content"><h2>Full-body strength</h2><p class="meta">Today · 35 min · Planned</p><p class="detail">Next: easy run on Saturday<span>25 min · Planned</span></p><div class="actions"><button disabled>Tell me how it went</button></div><p class="note">Starts a chat reply. Recording an outcome still needs your review.</p></div></article></section>
<section class="column"><p class="step">03 / A change to review</p><p class="scenario">Lead with the decision that needs a yes.</p><article class="card"><div class="card-top"><img src="${spotPoseImages.planner}" alt="" width="36" height="36"><div><strong>REP &amp; PLATE</strong><span>Proposed change · Not saved</span></div></div><div class="content"><h2>Move strength to Friday?</h2><p class="meta">Full-body strength · 35 min</p><div class="delta"><div><small>BEFORE</small><b>Thu, Nov 12</b></div><i aria-label="changes to">→</i><div><small>AFTER</small><b>Fri, Nov 13</b></div></div><div class="actions"><button disabled>Approve change</button><button class="secondary" disabled>Keep Thursday</button></div><p class="note">We’ll ask you to review again if your plan changes.</p></div></article></section>
</div></main><footer><span class="thesis">Keep Spot. Make the interface earn its place.</span><br>Static concept with illustrative training data. Buttons are disabled; no live host actions or writes. Full history and diagnostics stay in the app.</footer></body></html>`;
writeFileSync(directory + 'concept.html', concept);

await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as { port: number }).port;
const browser = await chromium.launch({ headless: true });
const evidence: any = { date: day, scope: 'Real HTML/CSP in synthetic MCP Apps host, synthetic data only', source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(), fixtures: {}, measurements: [], browserErrors: [] };
const check = (value: unknown, message: string) => { if (!value) throw new Error(message); };
try {
  const page = await browser.newPage({ viewport: { width: 760, height: 1000 }, colorScheme: 'dark' });
  page.on('pageerror', error => evidence.browserErrors.push(error.message));
  for (const [name, fixture] of Object.entries(fixtures)) {
    selected = name; hostTheme = 'dark'; interactive = true;
    for (const width of [390, 760]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`http://127.0.0.1:${port}/`);
      const frame = page.frameLocator('iframe');
      await frame.locator('#revision').filter({ hasText: 'Revision 0' }).waitFor();
      await page.waitForFunction(() => parseInt(document.querySelector('iframe')!.style.height) > 300);
      const measurement = await frame.locator('body').evaluate(body => {
        return { height: document.documentElement.scrollHeight, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, firstFeedbackY: document.querySelector('#today button')?.getBoundingClientRect().top ?? null, proposalsHeadingY: document.querySelector('#proposals').previousElementSibling.getBoundingClientRect().top, firstApplyY: [...document.querySelectorAll('button')].find(button => button.textContent === 'Apply reviewed change')?.getBoundingClientRect().top ?? null, freshness: document.querySelector('#freshness').textContent, headings: [...document.querySelectorAll('h1,h2')].map(h => h.textContent), notice: document.querySelector('#notice').textContent, bodyText: body.innerText };
      });
      check(measurement.scrollWidth <= width, `${name} overflows at ${width}`);
      if (name === 'imported') {
        check(fixture.evidence.activities.length === 1, 'Imported fixture must contain a projected activity');
        check(fixture.nextSteps.some(step => step.includes('Strava')), 'Imported fixture must have a source-specific next step');
        check(!measurement.bodyText.includes('Strava') && !measurement.bodyText.includes('Morning run'), 'Imported activity invisibility hypothesis not reproduced');
      }
      evidence.measurements.push({ fixture: name, ...measurement });
      await page.locator('iframe').screenshot({ path: directory + `current-${name}-${width}.png` });
      if (name === 'blank' && width === 390) {
        check(measurement.freshness.includes('out of date'), 'Expected stale warning not reproduced');
        await frame.getByRole('button', { name: 'Refresh plan', exact: true }).click();
        await page.waitForFunction(() => window.auditMessages.some(m => m.method === 'tools/call'));
        check((await frame.locator('#freshness').innerText()).includes('out of date'), 'Expected unchanged no-context freshness after refresh');
      }
      if (name === 'pending' && width === 390) {
        const apply = frame.getByRole('button', { name: 'Apply reviewed change', exact: true });
        check(await apply.isDisabled(), 'Apply should require review');
        await frame.locator('#proposals input[type=checkbox]').check();
        check(await apply.isEnabled(), 'Reviewed proposal should enable apply');
      }
    }
    evidence.fixtures[name] = { nextSteps: fixture.nextSteps, freshnessSummary: fixture.freshness.summary, importedActivities: fixture.evidence.activities.length, importedSources: fixture.evidence.sources };
  }
  // Deliberately disagree with the browser preference: host theme should be authoritative.
  selected = 'blank'; hostTheme = 'light';
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.frameLocator('iframe').locator('#revision').filter({ hasText: 'Revision 0' }).waitFor();
  evidence.hostLightBrowserDark = await page.frameLocator('iframe').locator('html').evaluate(root => ({ inlineScheme: root.style.colorScheme, background: getComputedStyle(root).backgroundColor, ink: getComputedStyle(root).color }));
  check(evidence.hostLightBrowserDark.inlineScheme === 'light', 'Host theme not received');
  check(evidence.hostLightBrowserDark.background === 'rgb(16, 35, 28)', 'Theme mismatch hypothesis not reproduced');
  interactive = false; hostTheme = 'dark';
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.frameLocator('iframe').locator('#revision').filter({ hasText: 'Revision 0' }).waitFor();
  evidence.readOnlyHost = { refreshDisabled: await page.frameLocator('iframe').locator('#refresh').isDisabled(), notice: await page.frameLocator('iframe').locator('#notice').innerText() };
  check(evidence.readOnlyHost.refreshDisabled, 'Read-only host refresh should be disabled');
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 810 : 1000 });
    await page.goto(`http://127.0.0.1:${port}/concept`);
    await page.locator('img').first().waitFor({ state: 'visible' });
    await page.evaluate(() => Promise.all([...document.images].map(image => image.decode())));
    const layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, images: [...document.images].every(image => image.complete && image.naturalWidth > 0), minimumButtonHeight: Math.min(...[...document.querySelectorAll('button')].map(button => button.getBoundingClientRect().height)) }));
    check(layout.scrollWidth <= width && layout.images && layout.minimumButtonHeight >= 44, `Concept layout failed at ${width}`);
    (evidence.conceptLayouts ??= []).push(layout);
    await page.screenshot({ path: directory + (width === 1280 ? 'recommendation.png' : `concept-${width}.png`), fullPage: true });
  }
  evidence.resourceBytes = { coaching: Buffer.byteLength(coachingAppHtml), smallSpot: Buffer.byteLength(spotAppHtml), poseCount: Object.keys(spotPoseImages).length };
  evidence.browserChecks = 'Passed: 8 current-state renders, unchanged freshness after refresh, review gating, host-theme mismatch reproduced, read-only host, 3 concept widths, all images decoded, no horizontal overflow.';
  check(evidence.browserErrors.length === 0, 'Unexpected browser errors');
  writeFileSync(directory + 'browser-evidence.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ checks: evidence.browserChecks, resourceBytes: evidence.resourceBytes, heights: evidence.measurements.map(({fixture,width,height,firstApplyY}) => ({fixture,width,height,firstApplyY})), hostLightBrowserDark: evidence.hostLightBrowserDark, browserErrors: evidence.browserErrors }, null, 2));
} finally {
  await browser.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
}
