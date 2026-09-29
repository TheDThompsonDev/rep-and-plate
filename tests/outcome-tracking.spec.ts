import { readBrowserRecords } from "./record-fixture";
import { test, expect } from "./app-fixture";
test("optional dated body measurements edit and survive reload without changing nutrition targets", async ({
  page,
}) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: false, jev: false } }),
  );
  await page.goto("/");
  const profile = (await readBrowserRecords(page)).profile;
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  const region = page.getByRole("region", { name: "Body weight history" });
  await expect(region).toContainText("Add measurements on two dates");
  await region
    .getByLabel("Measurement date", { exact: true })
    .fill("2026-09-01");
  await region.getByLabel("Body weight", { exact: true }).fill("180");
  await region
    .getByRole("button", { name: "Save measurement", exact: true })
    .click();
  await expect(region).toContainText("Add measurements on two dates");
  await region
    .getByLabel("Measurement date", { exact: true })
    .fill("2026-09-02");
  await region.getByLabel("Body weight", { exact: true }).fill("181");
  await region
    .getByRole("button", { name: "Save measurement", exact: true })
    .click();
  await expect(region).toContainText("+1 lb between 2026-09-01 and 2026-09-02");
  await region
    .getByRole("button", { name: "Edit weight for 2026-09-02" })
    .click();
  await region.getByLabel("Body weight", { exact: true }).fill("179");
  await region
    .getByRole("button", { name: "Update measurement", exact: true })
    .click();
  await page.reload();
  await expect(region).toContainText("-1 lb between 2026-09-01 and 2026-09-02");
  const state = await readBrowserRecords(page);
  expect(state.bodyWeights).toHaveLength(2);
  expect(state.profile).toEqual(profile);
});
test("each logged set retains its actual weight after corrections and reload", async ({
  page,
}) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: false, jev: false } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  const exercise = page.getByRole("region", {
    name: "Bench Press",
    exact: true,
  });
  const first = exercise.locator(".workout-set").nth(0),
    second = exercise.locator(".workout-set").nth(1);
  await first.getByLabel("Bench Press set 1 weight (lb)").fill("100");
  await first
    .getByRole("button", { name: "Save set weight", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bench Press set 1: 8 reps", exact: true })
    .click();
  await second.getByLabel("Bench Press set 2 weight (lb)").fill("110");
  await second
    .getByRole("button", { name: "Save set weight", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bench Press set 2: 7 reps", exact: true })
    .click();
  await first.getByLabel("Bench Press set 1 weight (lb)").fill("95");
  await first
    .getByRole("button", { name: "Save set weight", exact: true })
    .click();
  await page.reload();
  await expect(exercise).toContainText("95 lb × 8 reps");
  await expect(exercise).toContainText("110 lb × 7 reps");
  const state = await readBrowserRecords(page);
  expect(state.workout.exercises[0].setWeights).toEqual([95, 110, null]);
  expect(state.workout.exercises[0].sets).toEqual([8, 7, null]);
});
