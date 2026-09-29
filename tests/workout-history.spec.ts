import { test, expect, type Page } from "./app-fixture";

const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fuel.prototype.v1")!));
const proposal = {
  title: "Your strength session",
  minutes: 25,
  reason: "Start with a comfortable warm-up.",
  exercises: [
    {
      name: "Bench Press",
      sets: 3,
      reps: 8,
      note: "Choose a comfortable load.",
    },
  ],
};
async function openBuilder(page: Page, withHistory = true) {
  await page.goto("/");
  if (withHistory) {
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
      state.workout.history = [
        {
          title: "Recorded upper body",
          startedAt: "2026-09-23T12:00:00Z",
          finishedAt: "2026-09-23T13:00:00Z",
          exercises: [
            {
              name: "Bench Press",
              weight: 95,
              target: 8,
              previous: [99, 99, 99],
              sets: [8, 7, null],
            },
          ],
        },
        {
          title: "Not finished",
          startedAt: "2026-09-24T12:00:00Z",
          finishedAt: null,
          exercises: [
            {
              name: "Bench Press",
              weight: 110,
              target: 8,
              previous: [],
              sets: [8, null],
            },
          ],
        },
      ];
      localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
    });
    await page.reload();
  }
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await page
    .getByRole("button", { name: "Create a workout for me", exact: true })
    .click();
  await page
    .getByLabel("What are you working toward?")
    .fill("Build strength with familiar exercises");
}
test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: true, jev: true, usda: true } }),
  );
  await page.route("**/api/chat", (route) => route.abort());
});

test("Workout proposal cites only recorded sets and preserves explicit substitutions and dose", async ({
  page,
}) => {
  const requests: unknown[] = [];
  await page.route("**/api/plans/workout", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: proposal });
  });
  await openBuilder(page);
  const before = await stored(page);
  await expect(page.locator(".workout-history-context")).toContainText(
    "Using 1 completed session",
  );
  await page
    .getByRole("button", { name: "Create workout", exact: true })
    .click();
  await expect(page.locator(".workout-previous-evidence")).toContainText(
    "95 lb · 2 recorded sets: 8, 7 reps",
  );
  expect(requests).toEqual([
    {
      goal: "Build strength with familiar exercises",
      equipment: "Bodyweight",
      minutes: 30,
      history: [
        {
          title: "Recorded upper body",
          startedAt: "2026-09-23T12:00:00.000Z",
          finishedAt: "2026-09-23T13:00:00.000Z",
          exercises: [{ name: "Bench Press", weight: 95, sets: [8, 7] }],
        },
      ],
    },
  ]);
  expect((await stored(page)).workout).toEqual(before.workout);
  await page.getByLabel("Exercise 1", { exact: true }).fill("Wall Push-up");
  await page.getByLabel("Sets for exercise 1").fill("2");
  await page.getByLabel("Reps for exercise 1").fill("12");
  await expect(page.locator(".workout-previous-evidence")).toContainText(
    "No completed history for this exact exercise name.",
  );
  await page
    .getByRole("button", { name: "Use this workout", exact: true })
    .click();
  const exercise = (await stored(page)).workout.exercises[0];
  expect(exercise).toMatchObject({
    name: "Wall Push-up",
    target: 12,
    sets: [null, null],
    weight: 0,
    previous: [],
  });
});

test("Sample targets are excluded and invalid doses cannot start a workout", async ({
  page,
}) => {
  const requests: { history: unknown[] }[] = [];
  await page.route("**/api/plans/workout", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ json: proposal });
  });
  await openBuilder(page, false);
  await expect(page.locator(".workout-history-context")).toContainText(
    "Sample targets are not treated as your history.",
  );
  await page
    .getByRole("button", { name: "Create workout", exact: true })
    .click();
  await expect(page.getByLabel("Sets for exercise 1")).toHaveValue("3");
  expect(requests[0].history).toEqual([]);
  await page.getByLabel("Sets for exercise 1").fill("0");
  await expect(
    page.getByRole("button", { name: "Use this workout", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Sets for exercise 1").fill("2");
  await page.getByLabel("Reps for exercise 1").fill("31");
  await expect(
    page.getByRole("button", { name: "Use this workout", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Reps for exercise 1").fill("10");
  await page.getByLabel("Exercise 1", { exact: true }).fill(" ");
  await expect(
    page.getByRole("button", { name: "Use this workout", exact: true }),
  ).toBeDisabled();
  expect((await stored(page)).workout.status).toBe("ready");
});
