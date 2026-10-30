import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByRole('button', { name: 'Try on this device first', exact: true }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Alex');
  await page.getByRole('button', { name: 'That’s me. Let’s go.', exact: true }).click();
  await page.getByLabel('Your main goal', { exact: true }).selectOption('lose');
  await page.getByLabel('Weight unit', { exact: true }).selectOption('kg');
  await page.getByLabel('Current weight', { exact: true }).fill('82.5');
  await page.getByLabel('Target weight', { exact: true }).fill('78');
  await page.screenshot({ path: fileURLToPath(new URL('goals.png', import.meta.url)), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Save my starting point', exact: true }).click();
  await page.getByRole('button', { name: 'Let’s do this', exact: true }).click();
  await page.getByRole('button', { name: 'Your profile', exact: true }).click();
  await page.getByRole('region', { name: 'Quick account access' }).getByRole('button', { name: 'Sign in', exact: true }).waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('profile.png', import.meta.url)), fullPage: true, animations: 'disabled' });
} finally { await browser.close(); }
