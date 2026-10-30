import { test, expect } from "@playwright/test";

const ACTIVE = "fuel.prototype.v1";
const PREFIX = "fuel.prototype.v1.corrupt-";
const BROKEN = '{"version":1,"profile":';

async function storedRecords(page: import("@playwright/test").Page) {
  return page.evaluate(
    async ({ active, prefix }) => {
      const storage = await import("/src/platform/browser-records.ts");
      return storage.browserRecordTransaction(async () => {
        const keys = (await storage.browserKeys()).filter((key: string) => key.startsWith(prefix)).sort();
        return {
          active: await storage.browserGet(active),
          mirror: localStorage.getItem(active),
          copies: await Promise.all(keys.map((key: string) => storage.browserGet(key))),
        };
      });
    },
    { active: ACTIVE, prefix: PREFIX },
  );
}

test("a corrupt device snapshot is kept, copied aside, and announced instead of being replaced", async ({ page }) => {
  await page.addInitScript(({ active, broken }) => {
    localStorage.setItem("rep-and-plate.onboarding.v1", JSON.stringify({ version: 1, mode: "guest", focus: "A little of both" }));
    localStorage.setItem(active, broken);
  }, { active: ACTIVE, broken: BROKEN });
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message Rep & Plate" })).toBeVisible();
  const notice = page.getByRole("status").filter({ hasText: "could not be opened" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("A copy was kept");
  expect(await storedRecords(page)).toEqual({ active: BROKEN, mirror: BROKEN, copies: [BROKEN] });
  // A second start meets the same blob: still not replaced, still one copy.
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Message Rep & Plate" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "could not be opened" })).toBeVisible();
  expect(await storedRecords(page)).toEqual({ active: BROKEN, mirror: BROKEN, copies: [BROKEN] });
});

test("a snapshot written by a newer app version is left for that version", async ({ page }) => {
  const future = JSON.stringify({ version: 2, profile: { name: "From the future" }, meals: [] });
  await page.addInitScript(({ active, future }) => {
    localStorage.setItem("rep-and-plate.onboarding.v1", JSON.stringify({ version: 1, mode: "guest", focus: "A little of both" }));
    localStorage.setItem(active, future);
  }, { active: ACTIVE, future });
  await page.goto("/");
  await expect(page.getByRole("textbox", { name: "Message Rep & Plate" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "newer version" })).toBeVisible();
  expect(await storedRecords(page)).toEqual({ active: future, mirror: future, copies: [future] });
});
