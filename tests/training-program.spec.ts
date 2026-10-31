import { readBrowserRecords, seedBrowserRecords } from "./record-fixture";
import { test, expect, type Page } from "./app-fixture";
import { deriveTrainingProgram } from "../src/features/progress/training-program";

// A saved training week drives the Workouts landing: next session first, starter plans and
// the AI builder beneath, loads always chosen by the person, never a stored or assumed weight.
const stored = (page: Page) => readBrowserRecords(page);
const program = deriveTrainingProgram(
  { daysPerWeek: 3, equipment: ["dumbbells"], experience: "some" },
  "2020-01-01",
);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.goto("/#workouts");
  await expect(
    page.getByRole("heading", { name: "What should you do today?", exact: true }),
  ).toBeVisible();
  const state = await stored(page);
  await seedBrowserRecords(page, {
    ...state,
    profile: { ...state.profile, trainingProgram: program },
  });
  await page.reload();
});

test("the next session leads, starts with unconfirmed loads, and the week advances only when it is finished", async ({
  page,
}) => {
  await expect(page.getByRole("heading", { name: "Your week", exact: true })).toBeVisible();
  await expect(page.getByText("3 sessions · Bodyweight · Dumbbells · Some experience. Do them on the days that fit you.")).toBeVisible();
  const week = page.getByRole("group", { name: "Your week" }).or(page.locator('[aria-label="Your week"]'));
  await expect(week.getByRole("button", { name: /Session 1 · Upper Body/ })).toHaveAttribute("aria-pressed", "true");
  await expect(week.getByRole("button", { name: /Session 1 · Upper Body/ })).toContainText("Next up");
  await expect(page.getByText("Next session", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Session 1 · Upper Body · ~42 min", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Example rep targets/)).toHaveCount(0);
  await expect(page.getByText(/nothing here is a record/)).toBeVisible();
  // Starter plans and the AI builder are still one tap away beneath the week.
  await expect(page.getByRole("heading", { name: "Starter plans", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lower Body ~35 min", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create a workout for me", exact: true })).toBeEnabled();

  // Choosing a session shows its own equipment-matched exercises before anything is started.
  await week.getByRole("button", { name: /Session 2 · Lower Body/ }).click();
  await expect(page.getByText("Session 2 of 3", { exact: true })).toBeVisible();
  await expect(page.locator(".workout-preview").first()).toContainText("Goblet Squat");
  await week.getByRole("button", { name: /Session 1 · Upper Body/ }).click();
  await expect(page.locator(".workout-preview").first()).toContainText("Dumbbell Bench Press");
  await expect(page.locator(".workout-preview").first()).toContainText("Choose load · 3 × 8");
  const before = await stored(page);

  await page.getByRole("button", { name: "Start this session", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Session 1 · Upper Body in progress", exact: true }),
  ).toBeVisible();
  const active = (await stored(page)).workout;
  expect(active.status).toBe("active");
  expect(active.exercises.map((exercise: { name: string }) => exercise.name)).toEqual([
    "Dumbbell Bench Press",
    "Incline Dumbbell Press",
    "Dumbbell Row",
    "Dumbbell Overhead Triceps Extension",
  ]);
  for (const exercise of active.exercises) {
    expect(exercise.weight).toBe(0);
    expect(exercise.weightConfirmed).toBe(false);
    expect(exercise.sets).toEqual([null, null, null]);
  }
  expect((await stored(page)).profile.trainingProgram).toEqual(before.profile.trainingProgram);
  // No rep can be recorded until the person chooses the load for that set.
  const first = page.getByRole("region", { name: "Dumbbell Bench Press", exact: true });
  await expect(
    page.getByRole("button", { name: "Dumbbell Bench Press set 1: 8 reps", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Dumbbell Bench Press set 1 weight (lb)", { exact: true }).fill("40");
  await first.locator(".workout-set").first().getByRole("button", { name: "Save set weight", exact: true }).click();
  await page.getByRole("button", { name: "Dumbbell Bench Press set 1: 8 reps", exact: true }).click();
  await expect(first).toContainText("40 lb × 8 reps");

  // Browsing mid-session keeps the active session first and the week visible beneath it.
  await page.getByRole("button", { name: "Browse workout options", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your active workout" })).toContainText(
    "Session 1 · Upper Body is still in progress",
  );
  await expect(page.getByRole("heading", { name: "Your week", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start this session", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Continue current workout", exact: true }).click();

  await page.getByRole("button", { name: "Finish workout", exact: true }).click();
  await page.getByRole("button", { name: "Save partial workout", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Session 1 · Upper Body saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose your next workout", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Session 2 · Lower Body · ~35 min", exact: true }),
  ).toBeVisible();
  await expect(week.getByRole("button", { name: /Session 2 · Lower Body/ })).toContainText("Next up");
  await expect(week.getByRole("button", { name: /Session 1 · Upper Body/ })).not.toContainText("Next up");
  // After a reload the finished session reopens in its saved view, as today; the week then leads with session 2.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Session 1 · Upper Body saved", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose your next workout", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Session 2 · Lower Body · ~35 min", exact: true }),
  ).toBeVisible();
  const saved = await stored(page);
  expect(saved.profile.trainingProgram).toEqual(before.profile.trainingProgram);
  expect(saved.workout.status).toBe("finished");
  expect(saved.workout.exercises[0].sets).toEqual([8, null, null]);
  expect(saved.workout.exercises[0].setWeights?.[0]).toBe(40);

  // A starter plan chosen beneath the week is labeled as such and keeps its own copy.
  await page.getByRole("button", { name: "Upper Body ~42 min", exact: true }).click();
  await expect(page.getByText("Starter plan", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upper Body · ~42 min", exact: true })).toBeVisible();
  await expect(page.getByText(/Example rep targets/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Start workout", exact: true })).toBeVisible();

  // The AI builder defaults to the week's equipment so proposals honor it.
  await page.getByRole("button", { name: "Create a workout for me", exact: true }).click();
  await expect(page.getByLabel("Available equipment", { exact: true })).toHaveValue("Bodyweight, Dumbbells");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBe(true);
});
