import { test, expect } from "@playwright/test";
import { mockCloud } from "./cloud-fixture";
import { readBrowserRecords } from "./record-fixture";

test("Spot previews teach tracking without saving examples or requesting AI", async ({
  page,
}) => {
  await mockCloud(page);
  let aiRequests = 0;
  page.on("request", (request) => {
    if (/\/api\/(chat|capture)/.test(request.url())) aiRequests++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Meet Spot", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Here’s what you can do with me." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Example preview" }),
  ).toContainText("Estimated calories & macros");
  await page
    .getByRole("button", { name: "Workout example", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Example preview" }),
  ).toContainText("3 sets × 8 reps · 135 lb");
  await page
    .getByRole("button", { name: "Receipt example", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Example preview" }),
  ).toContainText("Purchases never count as food eaten");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("rep-and-plate.onboarding.v1"),
    ),
  ).toBeNull();
  await page
    .getByRole("button", { name: "Set up my tracking", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Make it official." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page.getByLabel('Your name', { exact: true }).fill('Alex');
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await page.getByRole('button', { name: 'Set this up later', exact: true }).click();
  await page.getByRole("button", { name: "Skip targets for now", exact: true }).click();

  await page.getByRole("button", { name: "Let’s do this" }).click();
  const draft = page.getByRole("textbox", { name: "Message Rep & Plate" });
  await expect(draft).toHaveValue("");
  const before = await readBrowserRecords(page);
  await draft.fill("My actual breakfast draft");
  await page
    .getByRole("button", { name: "What can I say to Spot?", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Workout example", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Example preview" }),
  ).toContainText("Review sets & weight");
  await page
    .getByRole("button", { name: "Use my own words", exact: true })
    .click();
  await expect(draft).toHaveValue("My actual breakfast draft");
  await expect(draft).toBeFocused();
  const after = await readBrowserRecords(page);
  for (const field of ["meals", "messages", "groceries", "workout"] as const)
    expect(after[field]).toEqual(before[field]);
  expect(aiRequests).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "What can I say to Spot?", exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'What can I say to Spot?', exact: true }).click();
  await page.getByRole('button', { name: 'Enter a meal manually', exact: true }).click();
  const meal = page.getByRole('dialog');
  await meal.getByLabel('Meal name', { exact: true }).fill('My actual breakfast');
  for (const [label, value] of [['Calories', '350'], ['Protein (g)', '25'], ['Carbs (g)', '40'], ['Fat (g)', '10']])
    await meal.getByLabel(label, { exact: true }).fill(value);
  expect((await readBrowserRecords(page)).meals).toEqual(before.meals);
  await meal.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect((await readBrowserRecords(page)).meals).toHaveLength(before.meals.length + 1);
  await page.reload();
  expect((await readBrowserRecords(page)).meals.at(-1)?.title).toBe('My actual breakfast');
  expect(aiRequests).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
