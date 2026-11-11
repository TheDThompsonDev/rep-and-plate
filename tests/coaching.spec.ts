import { randomUUID } from 'node:crypto';
import { test, expect } from './app-fixture';
import type { Page } from '@playwright/test';
import { AgentError, AgentService } from '../server/agents/service';
import { emptyDocument, type AgentStore, type Document } from '../server/agents/store';
import { manageRequestSchema } from '../src/features/connections/contracts';
import type { CoachingCommand, CoachingState } from '../src/features/coaching/contracts';
import { today } from '../src/domain';
import { readBrowserRecords } from './record-fixture';

function memoryStore(): AgentStore {
  let document = emptyDocument(), version = 0;
  return {
    read: async () => ({ document: structuredClone(document), version }),
    owner: async id => document.connections.some(connection => connection.id === id) ? 'test-owner' : null,
    compareAndSet: async (_owner, expected, next: Document) => { if (expected !== version) return false; document = structuredClone(next); version++; return true; },
  };
}
async function fixture(page: Page, lostResponse = false) {
  const service = new AgentService(memoryStore());
  const proposedIds: string[] = [];
  await page.route('**/api/status', route => route.fulfill({ json: { available: false, jev: false } }));
  await page.route('**/api/agents/manage', async route => {
    try {
      const request = manageRequestSchema.parse(route.request().postDataJSON());
      if (request.operation === 'coaching.propose') proposedIds.push(request.requestId);
      const result = await service.manage('test-owner', request);
      if (lostResponse && request.operation === 'coaching.propose') { lostResponse = false; await route.fulfill({ status: 503, json: { error: { message: 'Response lost after saving. Retry the same change.' } } }); return; }
      await route.fulfill({ json: result });
    } catch (cause) { await route.fulfill({ status: cause instanceof AgentError ? cause.status : 400, json: { error: { message: cause instanceof Error ? cause.message : 'Invalid request' } } }); }
  });
  const state = async () => (await service.manage('test-owner', { operation: 'coaching.read', day: today() }) as { state: CoachingState }).state;
  const apply = async (command: CoachingCommand) => {
    const requestId = randomUUID();
    await service.manage('test-owner', { operation: 'coaching.propose', requestId, baseRevision: (await state()).revision, command });
    await service.manage('test-owner', { operation: 'coaching.resolve', proposalId: requestId, status: 'accepted', confirmation: 'APPLY_REVIEWED_CHANGE' });
  };
  return { service, state, apply, proposedIds };
}
async function open(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Coaching plan', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Your coaching plan', exact: true });
  await expect(dialog.getByRole('button', { name: /Confirm my priorities|Add a session/, exact: true }).first()).toBeEnabled();
  return dialog;
}
const setup: CoachingCommand = { type: 'setup', profile: { primaryGoal: 'Consistent running with strength', priorities: ['running', 'strength'], constraints: ['Short Wednesdays'], notes: '' }, reason: 'My confirmed focus.' };

test('priorities are reviewed, survive a fresh page, and can be undone', async ({ page }) => {
  const f = await fixture(page); const dialog = await open(page);
  await dialog.getByRole('button', { name: 'Confirm my priorities', exact: true }).click();
  await dialog.getByLabel('Primary goal', { exact: true }).fill('Finish my fall half marathon');
  await dialog.getByLabel('Constraints, one per line').fill('Keep Wednesdays short');
  await dialog.getByRole('button', { name: 'Review priorities', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Apply reviewed change', exact: true })).toBeVisible();
  expect((await f.state()).profile.primaryGoal).toBe('');
  await dialog.screenshot({ path: test.info().outputPath('coaching-review.png') });
  await dialog.getByRole('button', { name: 'Apply reviewed change', exact: true }).click();
  await expect.poll(async () => (await f.state()).revision).toBe(1);
  await page.reload(); await page.getByRole('button', { name: 'Coaching plan', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Finish my fall half marathon', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Undo latest change', exact: true }).click();
  await expect.poll(async () => (await f.state()).profile.primaryGoal).toBe('');
});

test('planned running, explicit feedback and corrections remain distinct from tracking intake', async ({ page }) => {
  const f = await fixture(page); await f.apply(setup); const dialog = await open(page);
  await dialog.getByRole('button', { name: 'Add a session', exact: true }).click();
  await dialog.getByLabel('Session title', { exact: true }).fill('Morning run');
  await dialog.getByLabel('Session date', { exact: true }).fill(today());
  await dialog.getByLabel('Minutes', { exact: true }).fill('45');
  await dialog.getByRole('combobox', { name: 'Session type', exact: true }).selectOption('run');
  await dialog.getByRole('button', { name: 'Review session', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Apply reviewed change', exact: true })).toBeVisible();
  expect((await f.state()).sessions).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Apply reviewed change', exact: true }).click();
  await expect.poll(async () => (await f.state()).sessions.length).toBe(1);
  expect((await f.state()).outcomes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Record outcome for Morning run', exact: true }).first().click();
  await dialog.getByLabel('Actual minutes, optional', { exact: true }).fill('38');
  await dialog.getByLabel(/Effort, optional/).fill('7');
  await dialog.getByRole('textbox', { name: 'Your note, optional', exact: true }).fill('Harder than expected');
  await dialog.getByRole('button', { name: 'Review feedback', exact: true }).click();
  expect((await f.state()).outcomes).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Apply reviewed change', exact: true }).click();
  await expect.poll(async () => (await f.state()).outcomes.length).toBe(1);
  expect((await f.state()).outcomes[0]).toMatchObject({ actualMinutes: 38, effort: 7, note: 'Harder than expected' });
  await dialog.getByRole('button', { name: 'Record outcome for Morning run', exact: true }).first().click();
  await expect(dialog.getByRole('textbox', { name: 'Your note, optional', exact: true })).toHaveValue('Harder than expected');
  await dialog.getByRole('textbox', { name: 'Your note, optional', exact: true }).fill('Corrected: harder than my last easy run');
  await dialog.getByRole('button', { name: 'Review feedback', exact: true }).click();
  await dialog.getByRole('button', { name: 'Apply reviewed change', exact: true }).click();
  await expect.poll(async () => (await f.state()).outcomes[0].note).toBe('Corrected: harder than my last easy run');
  expect((await f.state()).outcomes).toHaveLength(1);
  expect((await readBrowserRecords(page)).meals).toHaveLength(0);
  await dialog.screenshot({ path: test.info().outputPath('coaching-day.png') });
});

test('a saved proposal with a lost response retries its original request identity', async ({ page }) => {
  const f = await fixture(page, true); const dialog = await open(page);
  await dialog.getByRole('button', { name: 'Confirm my priorities', exact: true }).click();
  await dialog.getByLabel('Primary goal', { exact: true }).fill('Keep running regularly');
  await dialog.getByRole('button', { name: 'Review priorities', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Response lost');
  expect((await f.state()).revision).toBe(0);
  // The form remains populated. Retrying must recover the existing pending draft.
  await dialog.getByRole('button', { name: 'Review priorities', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Apply reviewed change', exact: true })).toBeVisible();
  expect(new Set(f.proposedIds).size).toBe(1);
  expect((await f.state()).proposals).toHaveLength(1);
});

test('a proposal from an older plan cannot overwrite a newer decision', async ({ page }) => {
  const f = await fixture(page); await f.apply(setup); const dialog = await open(page);
  await dialog.getByRole('button', { name: 'Review priorities', exact: true }).click();
  await dialog.getByLabel('Primary goal', { exact: true }).fill('An older conversation goal');
  await dialog.getByRole('region', { name: 'Confirm coaching priorities' }).getByRole('button', { name: 'Review priorities', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Apply reviewed change', exact: true })).toBeVisible();
  await f.apply({ ...setup, profile: { ...setup.profile, primaryGoal: 'The newer agreed goal' } });
  await dialog.getByRole('button', { name: 'Apply reviewed change', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('plan changed');
  expect((await f.state()).profile.primaryGoal).toBe('The newer agreed goal');
  await dialog.getByRole('button', { name: 'Retry connection', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Apply reviewed change', exact: true })).toBeDisabled();
});

test('records an assistant brought in from other apps are shown apart from the plan and can be removed', async ({ page }) => {
  const f = await fixture(page); await f.apply(setup);
  await f.service.manage('test-owner', {
    operation: 'coaching.import', confirmation: 'SAVE_REPORTED_RECORDS',
    activities: [{ source: 'strava', externalId: 'run-1', day: today(), sport: 'run', title: 'Riverside long run', minutes: 95, distanceKm: 18.1, avgHeartRate: 146, note: '' }],
    nutritionDays: [{ source: 'macrofactor', day: today(), calories: 2710, protein: 165, note: '' }],
  });
  const dialog = await open(page);
  await dialog.getByText('From your other apps · 2', { exact: true }).click();
  const activities = dialog.getByRole('list', { name: 'Activities from other apps' });
  await expect(activities).toContainText('Riverside long run');
  await expect(activities).toContainText('Strava');
  await expect(activities).toContainText('18.1 km');
  await expect(dialog.getByRole('list', { name: 'Nutrition days from other apps' })).toContainText('2710 kcal');
  // An imported run is evidence, not a reported outcome or a plan change.
  expect((await f.state()).outcomes).toEqual([]);
  const revision = (await f.state()).revision;
  await dialog.getByRole('button', { name: 'Remove Riverside long run from Strava', exact: true }).click();
  await expect(dialog.getByText('From your other apps · 1', { exact: true })).toBeVisible();
  const after = await f.state();
  expect(after.evidence.activities).toEqual([]);
  expect(after.evidence.nutritionDays).toHaveLength(1);
  expect(after.revision).toBe(revision);
});
