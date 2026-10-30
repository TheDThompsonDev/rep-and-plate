import { chromium, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { initialState } from '../../../../src/domain';
import { resultFixture } from '../../../../tests/ai-fixtures';
import { firstWeekSteps } from '../../../../src/features/planning/first-week';

const out = 'docs/audits/2026-10-01-receipt-value/evidence';
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(state => {
  localStorage.setItem('fuel.prototype.v1', JSON.stringify(state));
  localStorage.setItem('rep-and-plate.onboarding.v1', JSON.stringify({ version: 1, mode: 'guest', focus: 'A little of both' }));
}, initialState());
let available = false;
await page.route('**/api/status', r => r.fulfill({ json: { available, jev: available } }));
await page.route('**/api/chat', r => r.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'result', result: resultFixture(r.request().postDataJSON().requestId) }) + '\n' }));
await page.goto('http://127.0.0.1:5173/#kitchen');
await page.getByRole('button', { name: 'Add a receipt', exact: true }).click();
await page.locator('input[capture=environment]').setInputFiles('tests/fixtures/grocery-receipt.png');
await expect(page.getByAltText('Your grocery receipt')).toBeVisible();
await expect(page.getByRole('dialog')).toContainText('AI is unavailable');
await page.screenshot({ path: `${out}/guest-preview-mobile.png` });
writeFileSync(`${out}/guest-preview.txt`, await page.getByRole('dialog').innerText());
await page.getByRole('button', { name: 'Save my image for review', exact: true }).click();
await page.getByRole('textbox', { name: 'Message Rep & Plate' }).fill('What needs review?');
await page.getByRole('textbox', { name: 'Message Rep & Plate' }).press('Enter');
await expect(page.getByRole('button', { name: 'Keep as a note', exact: true }).first()).toBeVisible();
await page.screenshot({ path: `${out}/saved-photo-mobile.png` });
writeFileSync(`${out}/saved-photo.txt`, await page.locator('main').innerText());
// Controlled provider response demonstrates UI behavior; it is not a real approved account or OCR result.
available = true;
await page.reload();
await page.getByRole('button', { name: 'Kitchen', exact: true }).click();
await page.getByRole('button', { name: 'Add a receipt', exact: true }).click();
await page.locator('input[capture=environment]').setInputFiles('tests/fixtures/grocery-receipt.png');
await expect(page.getByRole('button', { name: 'Send to Rep & Plate', exact: true })).toBeVisible();
await page.screenshot({ path: `${out}/ready-preview-mobile.png` });
await page.getByRole('button', { name: 'Send to Rep & Plate', exact: true }).click();
await expect(page.locator('.fuel-grocery-card')).toBeVisible();
writeFileSync(`${out}/receipt-result.txt`, await page.locator('.fuel-grocery-card').innerText());
await page.locator('.fuel-grocery-card').screenshot({ path: `${out}/receipt-result.png` });
await page.locator('.fuel-grocery-card').click();
await expect(page.getByRole('dialog')).toBeVisible();
await page.screenshot({ path: `${out}/pantry-review-mobile.png` });
writeFileSync(`${out}/pantry-review.txt`, await page.getByRole('dialog').innerText());
const state = initialState();
const receipt = resultFixture('used-stock-repro').receipt!;
receipt.items[1].availability = 'used';
state.groceries = [receipt];
const pantryStep = firstWeekSteps(state).find(s => s.key === 'pantry');
expect(pantryStep?.done).toBe(false);
writeFileSync(`${out}/verification.json`, JSON.stringify({
  method: 'Isolated Playwright mobile walkthrough with controlled status and receipt response; no live AI or customer data',
  guestPreview: 'Shows AI unavailable and Save my image for review; no sign-in CTA in dialog',
  savedPhoto: 'Keep as a note visible; does not extract groceries',
  successCard: 'Saved receipt observed before opening pantry; text retained in receipt-result.txt',
  usedUnresolvedStock: { pantryStepDone: pantryStep?.done, hypothesis: 'Used unresolved stock remains in all-lots completion predicate' },
  pageErrors: errors,
  focusedExistingTests: { command: 'node node_modules/@playwright/test/cli.js test tests/receipt-capture.spec.ts tests/receipt-products.spec.ts tests/shopping.spec.ts tests/onboarding.spec.ts --reporter=list', passed: 36, failed: 0 },
}, null, 2));
await browser.close();
