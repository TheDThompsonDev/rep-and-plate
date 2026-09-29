import { test, expect } from "@playwright/test";

test("Spot personality appears before the first log and introduction stays skippable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hey. I’m Spot." }),
  ).toBeVisible();
  await expect(
    page.getByText("You opened the app. I called a press conference.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator('[data-spot-scene="press-conference"] img'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.locator('[data-spot-scene="dinner-conspiracy"] img'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hey. I’m Spot." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.locator('[data-spot-scene="leg-funeral"] img'),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.locator('[data-spot-scene="recovery-department"] img'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Try it. What happened today?" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeFocused();
  await page.reload();
  await expect(page.getByRole("button", { name: "Skip intro" })).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("missing onboarding art preserves navigation and the first draft", async ({
  page,
}) => {
  await page.route("**/images/spot/scenes/**", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByText("You opened the app. I called a press conference.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Skip intro" }).click();
  const draft = page.getByRole("textbox", { name: "Message Rep & Plate" });
  await draft.fill("A sandwich and a walk");
  await page.getByRole("button", { name: "Open chat menu" }).click();
  await page.getByRole("button", { name: "Meet Spot", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hey. I’m Spot." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(draft).toHaveValue("A sandwich and a walk");
});
