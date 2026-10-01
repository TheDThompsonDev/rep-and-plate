import { test, expect } from "./app-fixture";
test("native measurements and distinct set loads persist through reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Measurement date (YYYY-MM-DD)" })
    .fill("2026-09-01");
  await page
    .getByRole("textbox", { name: "Body weight", exact: true })
    .fill("180");
  await page
    .getByRole("button", { name: "Save measurement", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Measurement date (YYYY-MM-DD)" })
    .fill("2026-09-02");
  await page
    .getByRole("textbox", { name: "Body weight", exact: true })
    .fill("181");
  await page
    .getByRole("button", { name: "Save measurement", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit weight for 2026-09-02", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Body weight", exact: true })
    .fill("179");
  await page
    .getByRole("button", { name: "Update measurement", exact: true })
    .click();
  await expect(
    page.getByText(/-1 lb between 2026-09-01 and 2026-09-02/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await page
    .getByRole("button", { name: "Start Upper Body", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Bench Press set 1 weight (lb)",
      exact: true,
    })
    .fill("100");
  await page
    .getByRole("textbox", { name: "Bench Press set 1 reps", exact: true })
    .fill("8");
  await page
    .getByRole("button", { name: "Save Bench Press set 1", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Bench Press set 2 weight (lb)",
      exact: true,
    })
    .fill("110");
  await page
    .getByRole("textbox", { name: "Bench Press set 2 reps", exact: true })
    .fill("7");
  await page
    .getByRole("button", { name: "Save Bench Press set 2", exact: true })
    .click();
  await page.reload();
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await expect(
    page.getByRole("textbox", {
      name: "Bench Press set 1 weight (lb)",
      exact: true,
    }),
  ).toHaveValue("100");
  await expect(
    page.getByRole("textbox", {
      name: "Bench Press set 2 weight (lb)",
      exact: true,
    }),
  ).toHaveValue("110");
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dannys-health.native.v1")!),
  );
  expect(state.bodyWeights).toHaveLength(2);
  expect(state.bodyWeights[1].value).toBe(179);
  expect(state.workout.exercises[0].setWeights).toEqual([100, 110, null]);
});
