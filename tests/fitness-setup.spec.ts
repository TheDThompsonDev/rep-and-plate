import { expect, test } from "@playwright/test";
import { mockCloud } from "./cloud-fixture";
import { readBrowserRecords, seedBrowserRecords } from "./record-fixture";

test("onboarding saves goals and a real starting weight, then profile offers weight logging and immediate account entry", async ({
  page,
}) => {
  await mockCloud(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page
    .getByRole("button", { name: "That’s me. Let’s go.", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What are you working toward?" }),
  ).toBeVisible();
  await page.getByLabel("Your main goal", { exact: true }).selectOption("lose");
  await page.getByLabel("Weight unit", { exact: true }).selectOption("kg");
  await page.getByLabel("Current weight", { exact: true }).fill("82.5");
  await page.getByLabel("Target weight", { exact: true }).fill("78");
  await page
    .getByRole("button", { name: "Save my starting point", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip targets for now", exact: true }).click();
  await page
    .getByRole("button", { name: "Let’s do this", exact: true })
    .click();
  const saved = await readBrowserRecords(page);
  expect(saved.profile.fitnessGoal).toEqual({
    kind: "lose",
    targetWeight: 78,
    unit: "kg",
    cadence: "weekly",
  });
  expect(saved.bodyWeights).toHaveLength(1);
  expect(saved.bodyWeights?.[0]).toMatchObject({ value: 82.5, unit: "kg" });
  expect(saved.profile.targetsConfigured).toBe(false);
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  const account = page.getByRole("region", { name: "Quick account access" });
  await expect(
    account.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Body weight history" }),
  ).toContainText("78 kg");
  const history = page.getByRole("region", { name: "Body weight history" });
  const previousDay = new Date(`${saved.bodyWeights![0].day}T12:00:00Z`);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  await history
    .getByLabel("Measurement date", { exact: true })
    .fill(previousDay.toISOString().slice(0, 10));
  await history.getByLabel("Body weight", { exact: true }).fill("83");
  await history
    .getByRole("button", { name: "Save measurement", exact: true })
    .click();
  await expect(history).toContainText("-0.5 kg");
  await history
    .getByRole("button", { name: "Edit your goal", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Target weight", { exact: true })
    .fill("77");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save my starting point", exact: true })
    .click();
  await page.reload();
  await expect(history).toContainText("Target: 77 kg");
  expect((await readBrowserRecords(page)).profile.fitnessGoal).toEqual({
    ...saved.profile.fitnessGoal,
    targetWeight: 77,
  });
  await account.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Email");
  expect((await readBrowserRecords(page)).bodyWeights).toHaveLength(2);
});

test("due check-ins lead to a dated measurement and stop prompting after it is saved", async ({
  page,
}) => {
  await mockCloud(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page
    .getByRole("button", { name: "That’s me. Let’s go.", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Set this up later", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip targets for now", exact: true }).click();
  await page
    .getByRole("button", { name: "Let’s do this", exact: true })
    .click();
  const before = await readBrowserRecords(page);
  await seedBrowserRecords(page, {
    ...before,
    profile: {
      ...before.profile,
      fitnessGoal: { kind: "maintain", unit: "lb", cadence: "weekly" },
    },
    bodyWeights: [
      { id: "older-weight", day: "2020-10-01", value: 180, unit: "lb" },
    ],
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Log your weight", exact: true })
    .click();
  const history = page.getByRole("region", { name: "Body weight history" });
  await history.getByLabel("Body weight", { exact: true }).fill("181");
  await history
    .getByRole("button", { name: "Save measurement", exact: true })
    .click();
  await expect(history).toContainText("Next weight check-in:");
  await page
    .getByRole("button", { name: "Rep & Plate home", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Log your weight", exact: true }),
  ).toHaveCount(0);
  expect((await readBrowserRecords(page)).bodyWeights).toHaveLength(2);
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Log your weight", exact: true }),
  ).toHaveCount(0);
});

test("the profile icon gives signed-in users a direct sign-out action and keeps their records", async ({
  page,
}) => {
  await mockCloud(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await page.getByLabel("Your name", { exact: true }).fill("Alex");
  await page
    .getByRole("checkbox", { name: /These device records are mine/ })
    .check();
  await page
    .getByRole("button", { name: "That’s me. Let’s go.", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Set this up later", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip targets for now", exact: true }).click();
  await page
    .getByRole("button", { name: "Let’s do this", exact: true })
    .click();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  const before = await readBrowserRecords(page);
  const account = page.getByRole("region", { name: "Quick account access" });
  await expect(account).toContainText("fixture@example.test");
  await account.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await readBrowserRecords(page)).profile).toEqual(before.profile);
  expect((await readBrowserRecords(page)).bodyWeights).toEqual(
    before.bodyWeights,
  );
});
