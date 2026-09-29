import { test, expect } from "@playwright/test";
import { readBrowserRecords } from "./record-fixture";
import { mockCloud } from "./cloud-fixture";
import { demoState } from "../src/domain";

test("new users meet Spot outside the app, create an account, confirm, set up and return after sign-out", async ({
  page,
}) => {
  const cloud = await mockCloud(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good food/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toHaveCount(0);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByRole("button", { name: "Meet Spot", exact: true }).click();
  for (const heading of [
    "Hey. I’m Spot.",
    "Tell me what you ate.",
    "Tell me what you did.",
    "We do real life here.",
  ]) {
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    const img = page.locator(".welcome-art img");
    expect(
      await img.evaluate(async (el) => {
        await (el as HTMLImageElement).decode();
        return (el as HTMLImageElement).naturalWidth;
      }),
    ).toBeGreaterThan(500);
    if (heading !== "We do real life here.")
      await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: "Let’s make this official" }).click();
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(cloud.signups).toBe(1);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What should I call you?" }),
  ).toBeVisible();
  await page.getByLabel("Your name").fill("Alex");
  await page.getByRole("radio", { name: "Movement & workouts" }).check();
  await page
    .getByRole("checkbox", { name: /These device records are mine/ })
    .check();
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await expect(
    page.getByRole("heading", { name: "We’re a team, Alex." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Let’s do this" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await expect.poll(() => cloud.saveCalls).toBeGreaterThanOrEqual(1);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page.getByRole("button", { name: /Account & backups/ }).click();
  await page.getByRole("button", { name: "Sign out on this device" }).click();
  await expect(page.getByRole("heading", { name: /Good food/ })).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Try on this device first" }),
  ).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Alex." }),
  ).toBeVisible();
});

test("local setup preserves records, persists completion and replay preserves the draft", async ({
  page,
}) => {
  await mockCloud(page);
  const state = demoState();
  await page.addInitScript((state) => {
    if (!localStorage.getItem("fuel.prototype.v1"))
      localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  }, state);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await page.getByRole("button", { name: "Let’s do this" }).click();
  const saved = await readBrowserRecords(page);
  expect(saved.meals).toEqual(state.meals);
  expect(saved.profile).toEqual(state.profile);
  const draft = page.getByRole("textbox", { name: "Message Rep & Plate" });
  await draft.fill("Keep my draft");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page.getByRole("button", { name: /Meet Spot/ }).click();
  await expect(
    page.getByRole("heading", { name: "Hey. I’m Spot." }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Close tour", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Rep & Plate home" }).click();
  await expect(draft).toHaveValue("Keep my draft");
  await page.reload();
  await expect(draft).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("signing into a different account opens separate records and preserves the original archive", async ({
  page,
}) => {
  await mockCloud(page);
  const original = demoState();
  original.profile.name = "Original account owner";
  await page.addInitScript((original) => {
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(original));
    localStorage.setItem(
      "health.records.owner",
      "https://fuelcloudtest.supabase.co:other-account",
    );
  }, original);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Try on this device first" }),
  ).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page
    .getByRole("checkbox", { name: /Open this account’s separate records/ })
    .check();
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await expect(
    page.getByRole("heading", { name: "We’re a team." }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("health.records.owner")),
  ).toBe(
    "https://fuelcloudtest.supabase.co:11111111-1111-4111-8111-111111111111",
  );
  const records = await page.evaluate(() => ({
    active: JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
    original: JSON.parse(
      localStorage.getItem(
        `health.account.${encodeURIComponent("https://fuelcloudtest.supabase.co:other-account")}`,
      )!,
    ),
  }));
  expect(records.original).toEqual(original);
  expect(records.active.profile.name).not.toBe(original.profile.name);
  expect(records.active.meals).toEqual([]);
});

test("auth errors and unavailable artwork leave the onboarding usable", async ({
  page,
}) => {
  await mockCloud(page);
  await page.route("**/images/spot/scenes/**", (route) => route.abort());
  await page.route(
    "https://fuelcloudtest.supabase.co/auth/v1/token**",
    (route) =>
      route.fulfill({
        status: 400,
        json: { code: "invalid_credentials", msg: "Invalid credentials" },
      }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Meet Spot", exact: true }).click();
  await page.getByRole("button", { name: "Skip to account" }).click();
  await page
    .getByRole("button", { name: "Already have an account? Sign in" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Sign-in didn’t work");
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
