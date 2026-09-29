import { test, expect } from "@playwright/test";
import { mockCloud } from "../../tests/cloud-fixture";
test.setTimeout(60000);

test("native first launch introduces Spot, creates an account, confirms and signs out", async ({
  page,
}) => {
  const cloud = await mockCloud(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "https://health-beta.example", token: "" }),
    ),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Good food. Real life. A very invested plate.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toHaveCount(0);
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
    if (heading !== "We do real life here.")
      await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: "Let’s make this official" }).click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(
      "Check your email to confirm your account, then return here to sign in.",
    ),
  ).toBeVisible();
  expect(cloud.signups).toBe(1);
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page
    .getByRole("textbox", { name: "Your name (optional)" })
    .fill("Alex");
  await page
    .getByRole("checkbox", { name: "These device records are mine" })
    .click();
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await page.getByRole("button", { name: "Let’s do this" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Cloud & your records", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Good food/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Try on this device first" }),
  ).toHaveCount(0);
  expect(cloud.saveCalls).toBe(0);
});

test("native local setup and returning launch work without an account connection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page.getByRole("textbox", { name: "Your name (optional)" }).fill("Sam");
  await page.getByRole("radio", { name: "Food & meals" }).click();
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await page.getByRole("button", { name: "Let’s do this" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("native onboarding stays open when the profile cannot be saved and can retry", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page.getByRole("textbox", { name: "Your name (optional)" }).fill("Sam");
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "dannys-health.native.v1") {
        Storage.prototype.setItem = original;
        throw new Error("Device storage is full. Please try again.");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Let’s do this" }).click();
  await expect(
    page.getByText("Device storage is full. Please try again."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("rep-and-plate.onboarding.v1"),
    ),
  ).toBeNull();
  await page.getByRole("button", { name: "Let’s do this" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("dannys-health.native.v1")!).profile
          .name,
    ),
  ).toBe("Sam");
});
