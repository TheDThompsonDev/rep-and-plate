import {commitSeededRecords, readBrowserRecords } from "./record-fixture";
import { test, expect, type Page } from "./app-fixture";
import { resultFixture } from "./ai-fixtures";

const stored = (page: Page) =>
  readBrowserRecords(page);
async function seed(page: Page) {
  await page.clock.setFixedTime(new Date("2026-09-25T15:00:00Z"));
  await page.goto("/");
  const receipt = resultFixture("receipt-candidates").receipt!;
  receipt.items = ["Oats", "Milk", "Used yogurt"].map((name, index) => ({
    ...receipt.items[0],
    id: `date-${index}`,
    name,
    quantity: "1 package",
    servingsPurchased: 8,
    availability: index === 2 ? ("used" as const) : ("available" as const),
  }));
  await page.evaluate((receipt) => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    state.groceries = [receipt];
    state.pantryEvents = [];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  }, receipt);
  await commitSeededRecords(page);
  await page.reload();
  await openPantry(page);
}
async function openPantry(page: Page) {
  await page.getByRole("button", { name: "Open chat menu" }).click();
  await page
    .getByRole("button", { name: "Your groceries", exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: true, jev: true, usda: true } }),
  );
  await page.route("**/api/chat", (route) => route.abort());
});

test("Package dates save, reorder, survive refresh and clear without recording consumption", async ({
  page,
}) => {
  await seed(page);
  const before = await stored(page);
  await expect(page.locator(".pantry-lot").first()).toContainText("Oats");
  await page.getByRole("button", { name: "Edit dates for Milk" }).click();
  await expect(page.getByLabel("Package date", { exact: true })).toHaveValue(
    "",
  );
  await page.getByLabel("Package date wording").selectOption("use-by");
  await page.getByLabel("Package date", { exact: true }).fill("2026-09-27");
  await page.getByLabel("Opened on").fill("2026-09-24");
  expect((await stored(page)).groceries).toEqual(before.groceries);
  await page.getByRole("button", { name: "Save dates", exact: true }).click();
  await expect(page.locator(".pantry-lot").first()).toContainText("Milk");
  await expect(
    page.getByRole("region", { name: "Package date reminders" }),
  ).toContainText("Use by: in 2 days");
  const after = await stored(page);
  expect(after.groceries[0].items[1].pantryDates).toEqual({
    labelKind: "use-by",
    labelDate: "2026-09-27",
    openedDate: "2026-09-24",
  });
  expect(after.meals).toEqual(before.meals);
  expect(after.pantryEvents).toEqual(before.pantryEvents);
  expect(after.groceries[0].items[1].servingsPurchased).toBe(8);
  await page.getByLabel("Show items by").selectOption("purchase");
  await expect(page.locator(".pantry-lot").first()).toContainText("Oats");
  await page.reload();
  await openPantry(page);
  await page.getByRole("button", { name: "Edit dates for Milk" }).click();
  await expect(page.getByLabel("Opened on")).toHaveValue("2026-09-24");
  await page.getByRole("button", { name: "Clear dates", exact: true }).click();
  await page.getByRole("button", { name: "Save dates", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Package date reminders" }),
  ).toHaveCount(0);
  expect((await stored(page)).groceries[0].items[1].pantryDates).toEqual({
    labelKind: "use-by",
    labelDate: null,
    openedDate: null,
  });
});

test("Cancel preserves unknown dates and opened-only dates do not imply a deadline", async ({
  page,
}) => {
  await seed(page);
  const before = await stored(page);
  await page.getByRole("button", { name: "Edit dates for Oats" }).click();
  await page.getByLabel("Package date", { exact: true }).fill("2026-09-20");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await stored(page)).groceries).toEqual(before.groceries);
  await page.getByRole("button", { name: "Edit dates for Oats" }).click();
  await expect(page.getByLabel("Package date", { exact: true })).toHaveValue(
    "",
  );
  await page.getByLabel("Opened on").fill("2026-09-01");
  await page.getByRole("button", { name: "Save dates", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Package date reminders" }),
  ).toHaveCount(0);
  await expect(page.locator(".pantry-lot").first()).toContainText(
    "Package date not recorded",
  );
  await page
    .getByRole("button", { name: "Edit dates for Used yogurt" })
    .click();
  await page.getByLabel("Package date", { exact: true }).fill("2026-09-20");
  await page.getByRole("button", { name: "Save dates", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Package date reminders" }),
  ).toHaveCount(0);
  expect((await stored(page)).pantryEvents).toEqual(before.pantryEvents);
});
