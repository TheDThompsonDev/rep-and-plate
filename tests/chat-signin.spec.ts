import { test, expect, type Page } from './app-fixture';
import { mockCloud } from './cloud-fixture';
import { readBrowserRecords } from './record-fixture';

test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'wait' }); });

async function hostedGuest(page: Page, baseURL: string) {
  const origin = 'https://repandplate.test';
  await page.route(`${origin}/**`, async route => {
    const response = await route.fetch({ url: route.request().url().replace(origin, baseURL) });
    await route.fulfill({ response });
  });
  const cloud = await mockCloud(page);
  await page.route('**/api/status', route => route.fulfill({ json: { available: true, jev: false } }));
  await page.goto(origin);
  await expect(page.getByText('Sign in to chat with Spot', { exact: true })).toBeVisible();
  return cloud;
}

test('guest chat offers sign-in, preserves a draft, and completes account setup', async ({ page, baseURL }) => {
  await hostedGuest(page, baseURL!);
  const before = await readBrowserRecords(page);
  const composer = page.getByRole('textbox', { name: 'Message Rep & Plate' });
  const draft = 'For example, what should I ask you?';
  await composer.fill(draft);
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Chat is available to signed-in users');
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(composer).toHaveValue(draft);
  await expect(page.getByText(/I can’t answer freely/)).toHaveCount(0);
  expect((await readBrowserRecords(page)).messages).toEqual(before.messages);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Create your account' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Already have an account? Sign in' }).click();
  await dialog.getByLabel('Email', { exact: true }).fill('fixture@example.test');
  await dialog.getByLabel('Password', { exact: true }).fill('test-password-only');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await dialog.getByRole('button', { name: 'These device records are mine' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(composer).toHaveValue(draft);
  await expect(page.locator('.fuel-connection-notice')).toHaveCount(0);
  await page.reload();
  await expect(composer).toBeVisible();
  await expect(page.locator('.fuel-connection-notice')).toHaveCount(0);
  await page.route('**/api/status', route => route.fulfill({ json: { available: false } }));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByText('Connected chat is unavailable.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toHaveCount(0);
  await page.route('**/api/status', route => route.fulfill({ status: 403, json: { error: 'not_enabled' } }));
  await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
  await expect(page.getByText('Chat access isn’t enabled for this account yet', { exact: true })).toBeVisible();
});

test('signup explains email confirmation and guests can dismiss all chat entry prompts', async ({ page, baseURL }) => {
  const cloud = await hostedGuest(page, baseURL!);
  const dialog = page.getByRole('dialog');
  for (const name of ['Sign in', 'Tell Spot', 'Take a meal photo', 'Attach image or screenshot', 'Use voice']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(dialog).toContainText('Chat is available to signed-in users');
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
  }
  const composer = page.getByRole('textbox', { name: 'Message Rep & Plate' });
  await composer.fill('I had eggs for breakfast.');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await dialog.getByLabel('Email', { exact: true }).fill('fixture@example.test');
  await dialog.getByLabel('Password', { exact: true }).fill('test-password-only');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('Check your email');
  expect(cloud.signups).toBe(1);
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await expect(composer).toHaveValue('I had eggs for breakfast.');
  await expect(page.getByText('Sign in to chat with Spot', { exact: true })).toBeVisible();
  expect(cloud.saveCalls).toBe(0);
});
