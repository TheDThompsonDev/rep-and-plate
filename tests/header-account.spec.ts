import { test, expect } from './app-fixture';
import { mockCloud, openAccount, signIn, stored } from '../e2e-shared/cloud-fixture';

test('header account exposes guest sign-in without leaving the current screen', async ({ page }) => {
  await mockCloud(page);
  for (const hash of ['', '#nutrition', '#workouts', '#kitchen', '#you']) {
    await page.goto(`/${hash}`);
    const opener = page.getByRole('button', { name: 'Open account menu', exact: true });
    await opener.click();
    const panel = page.getByRole('dialog', { name: 'Your account', exact: true });
    await expect(panel.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Create account', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await expect(opener).toBeFocused();
    expect(new URL(page.url()).hash).toBe(hash);
  }
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your account & saved records' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
});

test('header sign-out is immediately visible and preserves device records', async ({ page }) => {
  const cloud = await mockCloud(page);
  await openAccount(page);
  await signIn(page);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.goto('/');
  const before = await stored(page);
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Your account', exact: true });
  await expect(panel).toContainText('fixture@example.test');
  const logout = panel.getByRole('button', { name: 'Sign out', exact: true });
  await expect(logout).toBeInViewport();
  await logout.click();
  await expect(page.getByRole('main', { name: 'Welcome to Rep & Plate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(cloud.signouts).toBe(1);
  expect(await stored(page)).toEqual(before);
  await page.reload();
  // These device records were never bound to the account, so a reload returns to the app as a
  // guest. Assert that settled state. The Welcome screen and its "Sign in" button are on screen
  // for about ten milliseconds while the app loads, and waiting for them passed or failed on timing.
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const signedOut = page.getByRole('dialog', { name: 'Your account', exact: true });
  await expect(signedOut.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(signedOut).not.toContainText('fixture@example.test');
  expect(await stored(page)).toEqual(before);
});

test('server sign-out failure still ends the local session and preserves records', async ({ page }) => {
  const cloud = await mockCloud(page);
  await openAccount(page);
  await signIn(page);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  cloud.failedSignOut = true;
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Your account', exact: true });
  const before = await stored(page);
  await panel.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('main', { name: 'Welcome to Rep & Plate' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before);
  expect(cloud.signouts).toBe(1);
});

test('the account menu opens Connections directly from any screen', async ({ page }) => {
  await mockCloud(page);
  for (const hash of ['', '#kitchen']) {
    await page.goto(`/${hash}`);
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
    await page.getByRole('dialog', { name: 'Your account', exact: true }).getByRole('button', { name: 'Connect an assistant', exact: true }).click();
    const connections = page.getByRole('dialog', { name: 'Connections', exact: true });
    await expect(connections).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Your account', exact: true })).toHaveCount(0);
    await expect(connections.getByRole('heading', { name: 'Bring your own assistant.' })).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(connections).toHaveCount(0);
  }
});

