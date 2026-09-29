import type { Page } from "@playwright/test";

/** Install a fixture through the same durable store used by the app. This is
 * required when replacing records after the app has already hydrated. */
export async function seedBrowserRecords(page: Page, state: unknown) {
  await page.evaluate(async (next) => {
    const modulePath = "/src/platform/browser-records.ts";
    const { persistBrowserRecords } = await import(modulePath);
    await persistBrowserRecords(next);
  }, state);
}

/** Existing fixtures construct their snapshot in the compatibility mirror.
 * Commit that exact snapshot to IndexedDB before their intentional reload. */
export async function commitSeededRecords(page: Page) {
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
  );
  await seedBrowserRecords(page, state);
}

export async function readBrowserRecords(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/src/platform/browser-records.ts";
    const { browserRecordTransaction, browserGet } = await import(modulePath);
    return browserRecordTransaction(async () =>
      JSON.parse(await browserGet("fuel.prototype.v1")),
    );
  });
}
