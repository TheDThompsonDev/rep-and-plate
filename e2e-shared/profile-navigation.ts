import type { Page } from '@playwright/test';

export async function openProfile(page: Page) {
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('button', { name: 'View your profile', exact: true }).click();
}
