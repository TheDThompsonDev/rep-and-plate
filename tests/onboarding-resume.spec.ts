import { expect, test } from "@playwright/test";
import { mockCloud } from "./cloud-fixture";
import { draftKey, emptyDraft } from "../src/features/onboarding/draft";
import { readBrowserRecords } from "./record-fixture";

test("signed-in unfinished setup resumes after reload and later sign-in without storing credentials", async ({
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
  await page.getByLabel("Current weight", { exact: true }).fill("180");
  const key = draftKey("11111111-1111-4111-8111-111111111111");
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key)!).fitnessInput?.currentWeight,
        key,
      ),
    )
    .toBe("180");
  const raw = await page.evaluate((key) => localStorage.getItem(key)!, key);
  expect(raw).not.toContain("test-password-only");
  expect(raw).not.toContain("fixture@example.test");
  expect(raw).not.toContain("confirmed");
  await page.reload();
  await expect(page.getByLabel("Current weight", { exact: true })).toHaveValue(
    "180",
  );
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .locator("form")
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByLabel("Current weight", { exact: true })).toHaveValue(
    "180",
  );
  expect(await readBrowserRecords(page)).toBeNull();
});

test("guest startup ignores another account draft and a corrupt guest draft", async ({
  page,
}) => {
  await mockCloud(page);
  await page.addInitScript(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem(
        "rep-and-plate.onboarding.draft.v1.guest",
        "{broken",
      );
    },
    {
      key: draftKey("other-account"),
      value: { ...emptyDraft("w"), step: "ready", name: "Other person" },
    },
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Meet Spot", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("");
  expect(await readBrowserRecords(page)).toBeNull();
});
