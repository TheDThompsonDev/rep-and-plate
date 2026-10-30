import { test, expect, type Page } from "./app-fixture";
import { readBrowserRecords } from "./record-fixture";
import { sendAndWaitForReply as send } from "../e2e-shared/chat";

// The shared dev server may have a live provider; these journeys are about the
// app without connected chat, so the status route is pinned to unavailable.
async function withoutConnectedChat(page: Page) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.route("**/api/chat", (route) => route.abort());
}

test("#today lands on Chat and the legacy dashboard is gone", async ({
  page,
}) => {
  await page.goto("/#today");
  await expect(
    page.getByRole("heading", { name: "Rep & Plate", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#chat$/);
  await expect(page.getByText("LOCAL DEMO")).toHaveCount(0);
  await expect(page.getByText(/sample data/i)).toHaveCount(0);
  await expect(page.getByText("6,842")).toHaveCount(0);
  await expect(page.locator(".sidebar, .topbar, .bottom-nav")).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Chat navigation" }).getByRole("button"),
  ).toHaveText(["Chat", "Nutrition", "Scan", "Workouts", "Kitchen"]);
});

test("the capture modal and chat menu offer no demo meals", async ({
  page,
}) => {
  await withoutConnectedChat(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Open chat menu" }).click();
  await expect(
    page.getByRole("button", { name: "Try a sample capture" }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).not.toContainText("Local demo");
  await page.keyboard.press("Escape");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Attach image or screenshot", exact: true })
    .click();
  await (await chooser).setFiles("tests/fixtures/grocery-receipt.png");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByAltText("Your uploaded capture")).toBeVisible();
  await expect(dialog).not.toContainText("OR EXPLORE A DEMO");
  await expect(dialog).not.toContainText("sample estimate");
  await expect(
    dialog.getByRole("button", { name: /home-cooked dinner|takeout screenshot/ }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Save my image for review" }),
  ).toBeVisible();
  expect((await readBrowserRecords(page)).meals).toEqual([]);
});

test("a typed meal without connected chat gets guidance instead of a sample meal", async ({
  page,
}) => {
  await withoutConnectedChat(page);
  await page.goto("/");
  await expect(
    page.getByText("Connected chat is unavailable.", { exact: true }),
  ).toBeVisible();
  for (const text of [
    "Chicken rice and broccoli",
    "Protein shake after the gym",
    "Same breakfast as yesterday",
  ]) {
    await send(page, text);
    await expect(
      page
        .getByText(/I can’t answer freely while connected chat is unavailable/)
        .last(),
    ).toBeVisible();
    await expect(page.getByText(/Enter meal manually/).last()).toBeVisible();
  }
  await expect(page.locator(".fuel-meal-card")).toHaveCount(0);
  await expect(page.getByText("Example · not counted")).toHaveCount(0);
  await expect(page.getByText(/sample estimate/i)).toHaveCount(0);
  const stored = await readBrowserRecords(page);
  expect(stored.meals).toEqual([]);
  expect(stored.reviews).toEqual([]);
  expect(stored.pendingMeal).toBeUndefined();
  await page.reload();
  await expect(page.locator(".fuel-meal-card")).toHaveCount(0);
  expect((await readBrowserRecords(page)).meals).toEqual([]);
});
