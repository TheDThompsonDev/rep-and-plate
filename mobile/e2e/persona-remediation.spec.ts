import { test, expect } from "./app-fixture";
import { today } from "../../src/domain";
import { shiftPlanDate } from "../../src/features/planning/recurring-plans";
const key = "dannys-health.native.v1";

test("selected day reaches AI and correction stays reviewable without another request", async ({
  page,
}) => {
  const day = shiftPlanDate(today(), -1);
  let requests = 0;
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "http://127.0.0.1:5174", token: "a".repeat(64) }),
    ),
  );
  await page.route("**/api/chat", async (route) => {
    const request = route.request().postDataJSON();
    requests++;
    expect(request.captureDay).toBe(day);
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          result: {
            requestId: request.requestId,
            decision: "meal",
            reply: "Review this estimate.",
            meal: {
              title: "Yogurt",
              day,
              category: "Breakfast",
              portion: "One bowl",
              calories: 215,
              protein: 18.3,
              carbs: 33,
              fat: 0.4,
              note: "Estimated",
              sources: [],
            },
            receipt: null,
            sources: [],
            warnings: [],
          },
        }) + "\n",
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await page.getByRole("button", { name: day, exact: true }).click();
  await page.getByRole("button", { name: "Log a meal", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message Rep & Plate", exact: true })
    .fill("I ate yogurt");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.getByRole("button", { name: "Fix it", exact: true }).click();
  await page
    .getByRole("textbox", { name: "protein (g)", exact: true })
    .fill("");
  await page
    .getByRole("textbox", { name: "protein (g)", exact: true })
    .pressSequentially("19.2");
  await page
    .getByRole("button", { name: "Update estimate", exact: true })
    .click();
  await expect(
    page.getByText("Review your corrected estimate below.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Yep, add to Breakfast", exact: true })
    .click();
  expect(requests).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).meals[0]?.protein,
        key,
      ),
    )
    .toBe(19.2);
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).meals[0],
    key,
  );
  expect(saved.day).toBe(day);
});

test("manual fractional meal, correction and repeat preserve values without stock effects", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter meal manually", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Meal name", exact: true })
    .fill("Yogurt and oats");
  await page
    .getByRole("textbox", { name: "calories", exact: true })
    .fill("215");
  await page
    .getByRole("textbox", { name: "protein (g)", exact: true })
    .pressSequentially("18.3");
  await page
    .getByRole("textbox", { name: "carbs (g)", exact: true })
    .fill("33");
  await page
    .getByRole("textbox", { name: "fat (g)", exact: true })
    .pressSequentially("0.4");
  await page.getByRole("button", { name: "Save meal", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Yogurt and oats", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "protein (g)", exact: true }),
  ).toHaveValue("18.3");
  await page
    .getByRole("textbox", { name: "Meal name", exact: true })
    .fill("Breakfast yogurt");
  await page.getByRole("button", { name: "Save meal", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit Breakfast yogurt", exact: true })
    .click();
  await page.getByRole("button", { name: "Repeat meal", exact: true }).click();
  await page.getByRole("button", { name: "Save meal", exact: true }).click();
  await page.reload();
  const state = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(state.meals).toHaveLength(2);
  expect(state.meals.map((m: { protein: number }) => m.protein)).toEqual([
    18.3, 18.3,
  ]);
  expect(state.meals.map((m: { fat: number }) => m.fat)).toEqual([0.4, 0.4]);
  expect(state.pantryEvents ?? []).toHaveLength(0);
});

test("deliberate kg load, workout correction and walking remain recoverable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await page.getByRole("button", { name: "kg", exact: true }).click();
  await page
    .getByRole("button", { name: "Start Upper Body", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Bench Press set 1 weight (kg)",
      exact: true,
    }),
  ).toHaveValue("");
  await page
    .getByRole("textbox", { name: "Bench Press set 1 reps", exact: true })
    .fill("7");
  await expect(
    page.getByRole("button", { name: "Save Bench Press set 1", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", {
      name: "Bench Press set 1 weight (kg)",
      exact: true,
    })
    .fill("20.5");
  await page
    .getByRole("button", { name: "Save Bench Press set 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(
    page.getByText("1 sets recorded.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save finished workout", exact: true })
    .click();
  await expect(
    page.getByText("Set 1: 20.5 kg × 7 reps", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Correct Upper Body", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Bench Press set 1 reps", exact: true })
    .fill("8");
  await page
    .getByRole("button", { name: "Add effort to set 1", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Set 1 effort (RPE, optional)", exact: true })
    .fill("7.5");
  await page
    .getByRole("button", { name: "Save Bench Press set 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Log a walk or cardio", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Minutes", exact: true }).fill("20");
  await page
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await page
    .getByRole("button", { name: `Edit Walk on ${today()}`, exact: true })
    .click();
  await page.getByRole("textbox", { name: "Minutes", exact: true }).fill("25");
  await page
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await page.reload();
  const state = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(state.workout.exercises[0].sets[0]).toBe(8);
  expect(state.workout.exercises[0].setWeights[0]).toBeCloseTo(45.1948, 3);
  expect(state.workout.exercises[0].setEffort[0]).toBe(7.5);
  expect(state.activities).toHaveLength(1);
  expect(state.activities[0]).toMatchObject({ title: "Walk", minutes: 25 });
});

test("recipe draft survives guided offline ingredient setup", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page
    .getByRole("button", { name: "Recipes & leftovers", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Recipe name", exact: true })
    .fill("Oat breakfast");
  await page
    .getByRole("button", { name: "Set up pantry ingredients", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add ingredient manually", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Ingredient name", exact: true })
    .fill("Oats");
  await page
    .getByRole("textbox", {
      name: "Labeled serving (for example 40 g)",
      exact: true,
    })
    .fill("40 g");
  await page
    .getByRole("textbox", { name: "Servings available", exact: true })
    .fill("5");
  for (const [name, value] of Object.entries({
    calories: "150",
    protein: "5",
    carbs: "27",
    fat: "3",
  }))
    await page
      .getByRole("textbox", { name: `${name} per serving`, exact: true })
      .fill(value);
  await page
    .getByRole("button", { name: "Save ingredient", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Return to recipe draft", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Recipe name", exact: true }),
  ).toHaveValue("Oat breakfast");
  await page
    .getByRole("textbox", { name: "Oats (5 × 40 g available)", exact: true })
    .fill("2");
  await page
    .getByRole("button", { name: "Prepare recipe batch", exact: true })
    .click();
  await expect(
    page.getByText("4 portions remain", { exact: false }),
  ).toBeVisible();
});
