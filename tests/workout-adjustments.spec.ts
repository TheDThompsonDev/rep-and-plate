import { expect, test, type Page } from "@playwright/test";

const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fuel.prototype.v1")!));
test("Active exercise substitutions preserve recorded sets through later adjustments and reload", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.goto("/#chat");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    state.workout.status = "ready";
    state.workout.startedAt = null;
    state.workout.history = [];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adjust Bench Press", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Exercise name or substitution")
    .fill("Dumbbell Floor Press");
  await dialog.getByLabel("Weight (lb)").fill("40");
  await dialog.getByLabel("Number of sets").fill("4");
  await dialog.getByLabel("Target reps").fill("10");
  await dialog.getByRole("button", { name: "Save exercise" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Dumbbell Floor Press set 1: 9 reps",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Got it. Dumbbell Floor Press, set 1: 40 lb × 9 reps."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Adjust Dumbbell Floor Press", exact: true })
    .click();
  await expect(
    dialog.getByLabel("Exercise name or substitution"),
  ).toBeDisabled();
  await expect(dialog.getByLabel("Weight (lb)")).toBeDisabled();
  await expect(dialog).toContainText("Your recorded reps stay as they are");
  await dialog.getByLabel("Number of sets").fill("5");
  await dialog.getByLabel("Target reps").fill("12");
  await dialog.getByRole("button", { name: "Save exercise" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await stored(page)).workout.exercises[0]).toMatchObject({
    name: "Dumbbell Floor Press",
    weight: 40,
    target: 12,
    sets: [9, null, null, null, null],
  });
  await page
    .getByRole("button", {
      name: "Dumbbell Floor Press set 2: 12 reps",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Adjust Dumbbell Floor Press", exact: true })
    .click();
  await dialog.getByLabel("Number of sets").fill("1");
  await dialog.getByRole("button", { name: "Save exercise" }).click();
  expect(
    await dialog
      .getByLabel("Number of sets")
      .evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow),
  ).toBe(true);
  expect((await stored(page)).workout.exercises[0].sets).toEqual([
    9,
    12,
    null,
    null,
    null,
  ]);
  await dialog.getByLabel("Number of sets").fill("3");
  await dialog.getByRole("button", { name: "Save exercise" }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dumbbell Floor Press", exact: true }),
  ).toBeVisible();
  expect((await stored(page)).workout.exercises[0].sets).toEqual([9, 12, null]);
  expect((await stored(page)).workout.exercises[0].weight).toBe(40);
});
