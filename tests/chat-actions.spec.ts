import { readBrowserRecords } from "./record-fixture";
import { test, expect } from "./app-fixture";

for (const [action, label, title] of [
  ['pantry', 'Open your pantry', 'Your pantry'],
  ['recipes', 'Open recipes & leftovers', 'Recipes & leftovers'],
  ['meal-plan', 'Open meal planner', 'Your week of meals'],
  ['preferences', 'Review your preferences', 'Food & routine preferences'],
  ['workout', 'Build a workout', 'A workout for you'],
  ['shopping', 'Open swaps, list & spending', 'Shop your way'],
] as const) {
  test(`Chat opens ${action} only when requested, without changing records`, async ({ page }) => {
    await page.route('**/api/status', route => route.fulfill({ json: { available: true, jev: true } }));
    await page.route('**/api/chat', route => {
      const request = route.request().postDataJSON();
      return route.fulfill({ contentType: 'application/x-ndjson', body: JSON.stringify({ type: 'result', result: {
        requestId: request.requestId, reply: 'You can review this with the tool below.', decision: 'conversation',
        sources: [], warnings: [], receipt: null, meal: null, suggestedAction: action,
      } }) + '\n' });
    });
    await page.goto('/');
    await page.getByRole('textbox', { name: 'Message Rep & Plate' }).fill('Help me review this.');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    const button = page.getByRole('button', { name: label, exact: true });
    await expect(button).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const before = JSON.stringify(await readBrowserRecords(page));
    await button.click();
    await expect(page.getByRole('dialog').getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    expect(JSON.stringify(await readBrowserRecords(page))).toBe(before);
    await page.reload();
    await expect(button).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}
