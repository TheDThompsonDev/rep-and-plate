import { test, expect } from "@playwright/test";
import { mockCloud } from "./cloud-fixture";
import { readBrowserRecords } from "./record-fixture";

async function start(page: import("@playwright/test").Page, movement = false) {
  await mockCloud(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  if (movement)
    await page
      .getByRole("radio", { name: "Movement & workouts", exact: true })
      .check();
  await page
    .getByRole("button", { name: "That’s me. Let’s go.", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Set this up later", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip targets for now", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Let’s do this", exact: true })
    .click();
}

test("first tracking prompt survives reload and completes only after a real meal is saved", async ({
  page,
}) => {
  await start(page);
  await expect(
    page.getByRole("button", { name: "Log my first meal", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("first-tracking-step.png"),
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Log my first meal", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Meal name", { exact: true })).toHaveValue("");
  expect((await readBrowserRecords(page)).meals).toHaveLength(0);
  await dialog.getByLabel("Meal name", { exact: true }).fill("My lunch");
  for (const [name, value] of [
    ["Calories", "500"],
    ["Protein (g)", "30"],
    ["Carbs (g)", "50"],
    ["Fat (g)", "15"],
  ])
    await dialog.getByLabel(name, { exact: true }).fill(value);
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Log my first meal", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(async () => (await readBrowserRecords(page)).meals.length)
    .toBe(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Log my first meal", exact: true }),
  ).toHaveCount(0);
  expect((await readBrowserRecords(page)).meals[0]).toMatchObject({
    title: "My lunch",
    calories: 500,
    protein: 30,
    carbs: 50,
    fat: 15,
  });
});

test("movement focus opens the real activity form and later is a durable choice", async ({
  page,
}) => {
  await start(page, true);
  await page
    .getByRole("button", { name: "Log my first movement", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Log walk or cardio" });
  await dialog.getByLabel("Minutes", { exact: true }).fill("15");
  await dialog
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Log my first movement", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(async () => (await readBrowserRecords(page)).activities?.length)
    .toBe(1);
  expect((await readBrowserRecords(page)).profile.targetsConfigured).toBe(
    false,
  );
});

test("logging later dismisses the prompt without manufacturing an entry", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "I’ll log later", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Log my first meal", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Log my first meal", exact: true }),
  ).toHaveCount(0);
  expect((await readBrowserRecords(page)).meals).toHaveLength(0);
});

test("a failed first-prompt marker save does not keep retrying on every app render", async ({
  page,
}) => {
  await start(page, true);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    let attempts = 0;
    Object.defineProperty(window, "firstLogSaveAttempts", {
      get: () => attempts,
    });
    Storage.prototype.setItem = function (key, value) {
      if (
        this === localStorage &&
        key === "rep-and-plate.onboarding.v1" &&
        value.includes('"firstLogPending":false')
      ) {
        attempts++;
        throw new DOMException(
          "Fixture marker write rejected",
          "QuotaExceededError",
        );
      }
      original.call(this, key, value);
    };
  });
  await page
    .getByRole("button", { name: "Log my first movement", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Log walk or cardio" });
  await dialog.getByLabel("Minutes", { exact: true }).fill("15");
  await dialog
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Calorie starting point", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).firstLogSaveAttempts)).toBe(
    1,
  );
  expect((await readBrowserRecords(page)).activities).toHaveLength(1);
});
