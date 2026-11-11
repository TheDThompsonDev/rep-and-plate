import type { Page } from "@playwright/test";

// Waiting happens here in Node, never with timers inside the page: some specs freeze the page clock.
const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Install a fixture through the same durable store used by the app. This is
 * required when replacing records after the app has already hydrated.
 *
 * The app saves its own snapshot once when it mounts. A seed written before
 * that save is silently replaced by it, and the test then fails far away on a
 * missing button. It happened only on slow machines, so it looked flaky. Wait
 * for the app to mount and finish that save, then confirm the seed is what the
 * store holds, and write it again if the app got in first. */
export async function seedBrowserRecords(page: Page, state: unknown) {
  for (let checks = 0; checks < 200; checks++) {
    const app = await page.evaluate(() => ({
      mounted: !!document.querySelector(".app-shell"),
      saving: Object.keys(localStorage).some((key) => key.startsWith("health.pending.")),
    }));
    if (app.mounted && !app.saving) break;
    // A page that never mounts the app (onboarding) has no mount save to wait for.
    if (!app.mounted && checks >= 80) break;
    await settle(25);
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const raw = await page.evaluate(async (next) => {
      const modulePath = "/src/platform/browser-records.ts";
      const { persistBrowserRecords } = await import(modulePath);
      await persistBrowserRecords(next);
      return JSON.stringify(next);
    }, state);
    await settle(75);
    const held = await page.evaluate(async (expected) => {
      const modulePath = "/src/platform/browser-records.ts";
      const { browserRecordTransaction, browserGet } = await import(modulePath);
      return (await browserRecordTransaction(() => browserGet("fuel.prototype.v1"))) === expected;
    }, raw);
    if (held) return;
  }
  throw Error("Seeded records were replaced by the app's own save four times. The app is still writing; wait for it to settle before seeding.");
}

/** Existing fixtures construct their snapshot in the compatibility mirror.
 * Commit that exact snapshot to IndexedDB before their intentional reload. */
export async function commitSeededRecords(page: Page) {
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
  );
  await seedBrowserRecords(page, state);
}

/** A save journals to localStorage first and clears the journal once IndexedDB
 * holds the same snapshot. Wait for that hand-off, so a read right after a save
 * or reload sees what the app hydrated instead of racing the durable write. */
export async function readBrowserRecords(page: Page) {
  return page.evaluate(async () => {
    const modulePath = "/src/platform/browser-records.ts";
    const { browserRecordTransaction, browserGet } = await import(modulePath);
    const deadline = Date.now() + 5000;
    while (Object.keys(localStorage).some((key) => key.startsWith("health.pending.")) && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
    return browserRecordTransaction(async () =>
      JSON.parse(await browserGet("fuel.prototype.v1")),
    );
  });
}

/** Replace the stored conversation with `messages` through the durable store
 * and reload so the Chat thread renders exactly that history. Waits for the
 * composer first so startup hydration cannot overwrite the seed (ledger: the
 * legacy nutrition fixture raced it). */
export async function seedConversation(page: Page, messages: unknown[]) {
  await page.getByRole("textbox", { name: "Message Rep & Plate" }).waitFor();
  const state = await readBrowserRecords(page);
  await seedBrowserRecords(page, { ...state, messages });
  await page.reload();
  await page.getByRole("textbox", { name: "Message Rep & Plate" }).waitFor();
}
