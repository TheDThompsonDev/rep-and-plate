import { readBrowserRecords } from "./record-fixture";
import { test, expect, type Page } from './app-fixture';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createAgentHandler } from '../server/agents/http';
import { SqliteAgentStore } from '../server/agents/sqlite';

const execute = promisify(execFile);
async function setup(page: Page) {
  const store = new SqliteAgentStore(':memory:');
  const server = createServer(createAgentHandler({ store }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  let failResolve = false;
  let profile = '';
  await page.route('**/api/agents/manage', async route => {
    const request = route.request();
    const data = request.postDataJSON();
    if (failResolve && data.operation === 'resolve') { await route.fulfill({ status: 503, json: { error: { message: 'Temporary failure' } } }); return; }
    const incoming = request.headers();
    profile = incoming['x-rp-profile'];
    const response = await page.request.post(`${base}/api/agents/manage`, { data, headers: { 'x-rp-client': incoming['x-rp-client'], 'x-rp-profile': incoming['x-rp-profile'] } });
    await route.fulfill({ response });
  });
  await page.route('**/api/cloud/config', route => route.fulfill({ json: { available: false } }));
  await page.route('**/api/status', route => route.fulfill({ json: { available: false } }));
  await page.goto('/#you');
  await page.getByRole('button', { name: 'Connections Your assistants, access, and meal proposals' }).click();
  await page.getByRole('button', { name: 'Connect an assistant', exact: true }).click();
  await page.getByRole('textbox', { name: 'Connection name' }).fill('Test assistant');
  await page.getByRole('button', { name: 'Create connection', exact: true }).click();
  const key = page.getByRole('textbox', { name: 'Access key', exact: true });
  await expect(key).toBeVisible();
  const token = await key.inputValue();
  const call = async (data: object) => {
    const response = await page.request.post(`${base}/api/agents/v1`, { data, headers: { Authorization: `Bearer ${token}` } });
    return { status: response.status(), body: await response.json() };
  };
  const manage = (data: object) => page.request.post(`${base}/api/agents/manage`, { data, headers: { 'x-rp-client': 'web', 'x-rp-profile': profile } });
  return { base, token, call, manage, failAcknowledgment: (value: boolean) => { failResolve = value; }, close: async () => { await page.unrouteAll({ behavior: 'wait' }); await page.close(); await new Promise<void>(resolve => server.close(() => resolve())); store.close(); } };
}
function proposal() {
  return { operation: 'meals.propose', requestId: randomUUID(), meal: { title: 'Agent chili', day: '2026-09-29', time: '12:30', category: 'Lunch', portion: 'One bowl', calories: 450, protein: 30, carbs: 45, fat: 15, note: 'Estimated ingredients; portion reported by you.' } };
}
const saved = (page: Page) => readBrowserRecords(page);

test('CLI connects, proposes once, user logs, refresh preserves outcome, revocation takes effect', async ({ page }, info) => {
  const fixture = await setup(page);
  try {
    const env = { ...process.env, REP_PLATE_URL: fixture.base, REP_PLATE_TOKEN: fixture.token };
    const result = await execute(process.execPath, ['--import', 'tsx', 'scripts/health.ts', 'context', '--json'], { env });
    const context = JSON.parse(result.stdout);
    expect(context.context.nutrition.days).toHaveLength(7);
    expect(context.context).not.toHaveProperty('messages');
    expect(context.context).not.toHaveProperty('workouts'); // ungranted
    const input = proposal();
    const first = await fixture.call(input);
    expect(first.status).toBe(200);
    expect(first.body.reviewUrl).toBe(`${fixture.base}/#connections`);
    expect((await fixture.call(input)).body.action.id).toBe(first.body.action.id);
    expect((await saved(page)).meals).toHaveLength(0);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    const card = page.getByRole('article', { name: 'Agent chili' });
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    if (info.project.name === 'mobile') await page.screenshot({ path: info.outputPath('connections-mobile.png'), fullPage: true });
    await card.getByRole('button', { name: 'Log this meal' }).click();
    await expect.poll(async () => (await saved(page)).meals.length).toBe(1);
    await expect.poll(async () => (await fixture.call({ operation: 'actions.get', actionId: first.body.action.id })).body.action.status).toBe('accepted');
    await page.goto('/#connections');
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Connections' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Access key', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Log this meal' })).toHaveCount(0);
    expect((await saved(page)).meals).toHaveLength(1);
    expect((await fixture.call(input)).body.action.status).toBe('accepted');
    await page.getByRole('button', { name: 'Disconnect Test assistant' }).click();
    await expect.poll(async () => (await fixture.call({ operation: 'capabilities' })).status).toBe(401);
  } finally { await fixture.close(); }
});

test('failed acknowledgment retries the saved receipt without logging twice', async ({ page }) => {
  const fixture = await setup(page);
  try {
    const input = proposal(); const action = (await fixture.call(input)).body.action;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Log this meal' })).toBeVisible();
    fixture.failAcknowledgment(true);
    await page.getByRole('button', { name: 'Log this meal' }).click();
    await expect(page.getByRole('alert')).toContainText('saved on this device');
    expect((await saved(page)).meals).toHaveLength(1);
    expect((await saved(page)).agentResolutions).toHaveLength(1);
    expect((await fixture.call({ operation: 'actions.get', actionId: action.id })).body.action.status).toBe('pending');
    fixture.failAcknowledgment(false);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect.poll(async () => (await fixture.call({ operation: 'actions.get', actionId: action.id })).body.action.status).toBe('accepted');
    expect((await saved(page)).meals).toHaveLength(1);
  } finally { await fixture.close(); }
});

test('storage failure leaves a proposal pending and food totals unchanged', async ({ page }) => {
  const fixture = await setup(page);
  try {
    const action = (await fixture.call(proposal())).body.action;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Log this meal' })).toBeVisible();
    await page.evaluate(() => { IDBObjectStore.prototype.put = function () { throw new DOMException('Device storage is full.', 'QuotaExceededError'); }; });
    await page.getByRole('button', { name: 'Log this meal' }).click();
    await expect(page.getByRole('alert')).toContainText('storage is full');
    expect((await saved(page)).meals).toHaveLength(0);
    expect((await fixture.call({ operation: 'actions.get', actionId: action.id })).body.action.status).toBe('pending');
  } finally { await fixture.close(); }
});

test('a conflicting server outcome stays visible without discarding a saved meal', async ({ page }) => {
  const fixture = await setup(page);
  try {
    const action = (await fixture.call(proposal())).body.action;
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Log this meal' })).toBeVisible();
    fixture.failAcknowledgment(true);
    await page.getByRole('button', { name: 'Log this meal' }).click();
    await expect(page.getByRole('alert')).toContainText('saved on this device');
    const revoked = await fixture.manage({ operation: 'revoke', connectionId: action.connectionId });
    expect(revoked.ok()).toBe(true);
    fixture.failAcknowledgment(false);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('differs');
    await page.getByText('Recent outcomes (1)', { exact: true }).click();
    await expect(page.getByText(/server outcome: revoked/)).toBeVisible();
    expect((await saved(page)).meals).toHaveLength(1);
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('differs');
    expect((await saved(page)).meals).toHaveLength(1);
  } finally { await fixture.close(); }
});
