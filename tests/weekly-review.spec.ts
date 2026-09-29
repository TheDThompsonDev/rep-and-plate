import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.route("**/api/chat", (route) => route.abort());
});
test("weekly review excludes sample history and returns to Chat", async ({
  page,
}) => {
  await page.goto("/#you");
  await page.getByRole("button", { name: "Open your weekly review" }).click();
  await expect(
    page.getByRole("heading", { name: "Weekly Spot Check", level: 2, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".you-week-stats strong")).toHaveText([
    "0",
    "0",
    "0",
  ]);
  await expect(page.getByRole("dialog")).toContainText(
    "No dated workouts with recorded sets",
  );
  await page.getByText("How this was calculated", { exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "sample records excluded",
  );
  await page
    .getByRole("button", { name: "Continue your week in Chat" })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
});
test("weekly review shows real evidence and edited meals update its calculations", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    state.meals.push({
      category: "Breakfast",
      time: "8:30 AM",
      day: new Date().toLocaleDateString("en-CA"),
      confidence: "estimated",
      note: "",
      example: false,
      id: "weekly-personal",
      title: "My oatmeal",
      source: "Your confirmed label",
      calories: 300,
      protein: 13,
      carbs: 39,
      fat: 11,
    });
    state.workout = {
      ...state.workout,
      status: "active",
      title: "My upper body",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      exercises: [{ ...state.workout.exercises[0], sets: [8, null, null] }],
    };
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await page.goto("/#you");
  await page.reload();
  await page.getByRole("button", { name: "Open your weekly review" }).click();
  await expect(page.locator(".you-week-stats strong")).toHaveText([
    "1",
    "1",
    "1",
  ]);
  await expect(page.getByRole("dialog")).toContainText(
    "Average recorded intake: 300 calories per logged day",
  );
  await expect(page.locator(".you-week-workout")).toContainText(
    "My upper body",
  );
  await expect(page.locator(".you-week-workout")).toContainText(
    "1 set recorded · In progress",
  );
  await page.getByText("View the 1 meal record", { exact: true }).click();
  await page
    .getByRole("button", { name: "Edit My oatmeal", exact: true })
    .click();
  await page.getByLabel("Calories", { exact: true }).fill("330");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Open your weekly review" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Average recorded intake: 330 calories per logged day",
  );
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "Open your weekly review" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "330 calories per logged day",
  );
});
