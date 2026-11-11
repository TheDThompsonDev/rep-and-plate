import { test, expect } from './app-fixture';
import { mockCloud } from '../../e2e-shared/cloud-fixture';
import { initialState } from '../../src/domain';

test('native header opens sign-in directly, then sign-out preserves the records', async ({ page }) => {
  const cloud = await mockCloud(page);
  const seed = initialState();
  seed.bodyWeights = [{ id: 'header-weight', day: '2026-10-01', value: 82, unit: 'kg' }];
  await page.addInitScript(state => localStorage.setItem('dannys-health.native.v1', JSON.stringify(state)), seed);
  await page.addInitScript(() => sessionStorage.setItem('health.connection', JSON.stringify({ url: 'https://health-beta.example', token: '' })));
  await page.goto('/');
  const records = () => page.evaluate(() => JSON.parse(localStorage.getItem('dannys-health.native.v1')!));
  const before = await records();
  const composer = page.getByRole('textbox', { name: 'Message Rep & Plate' });
  await composer.fill('Keep this draft');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(composer).toHaveValue('Keep this draft');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('fixture@example.test');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('test-password-only');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await page.getByRole('button', { name: 'These device records are mine', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('health.records.owner'))).toContain('11111111-1111-4111-8111-111111111111');
  const owner = await page.evaluate(() => localStorage.getItem('health.records.owner')!);
  const ownedRecords = () => page.evaluate(key => JSON.parse(localStorage.getItem(`health.account.${encodeURIComponent(key)}`) ?? 'null'), owner);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await expect(page.getByText('Signed in as fixture@example.test', { exact: true })).toBeVisible();
  const logout = page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true });
  await expect(logout).toBeInViewport();
  await logout.click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(cloud.signouts).toBe(1);
  await expect.poll(ownedRecords).toMatchObject({ meals: before.meals, bodyWeights: before.bodyWeights });
});

test('native account menu opens assistant connections directly', async ({ page }) => {
  await mockCloud(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Connect an assistant', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Agent connections', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your account', exact: true })).toHaveCount(0);
});

