import { test, expect } from "./app-fixture";
import { initialState, today } from "../../src/domain";
import { shiftPlanDate } from "../../src/features/planning/recurring-plans";
import { addManualPantryIngredient } from "../../src/features/pantry/manual-ingredient";
const key = "dannys-health.native.v1";
test.setTimeout(12000);
test("dated manual entry opens its day and persistent notice cannot block Chat Send", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter meal manually", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Meal name", exact: true })
    .fill("Older audit meal");
  const day = shiftPlanDate(today(), -35);
  await page
    .getByRole("textbox", { name: "Day (YYYY-MM-DD)", exact: true })
    .fill(day);
  for (const [name, value] of Object.entries({
    calories: "215",
    "protein (g)": "18.3",
    "carbs (g)": "33",
    "fat (g)": "0.4",
  }))
    await page.getByRole("textbox", { name, exact: true }).fill(value);
  await page.getByRole("button", { name: "Save meal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Older audit meal", exact: true }),
  ).toBeVisible();
  const correctedDay = shiftPlanDate(today(), -34);
  await page
    .getByRole("button", { name: "Edit Older audit meal", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Day (YYYY-MM-DD)", exact: true })
    .fill(correctedDay);
  await page.getByRole("button", { name: "Save meal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Older audit meal", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message Rep & Plate", exact: true })
    .fill("I ate an apple");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry capture", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose another date", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Browse meal date (YYYY-MM-DD)",
      exact: true,
    })
    .fill(correctedDay);
  await page
    .getByRole("button", { name: "Show this day", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit Older audit meal", exact: true }),
  ).toBeVisible();
});
test("unconfigured targets show recorded totals without goal judgments", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(
    page.getByText(/calories left|calories above target/),
  ).toHaveCount(0);
  await expect(
    page.getByText("Recorded nutrition · daily targets are optional", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Your daily targets", exact: true })
    .click();
  await page.getByRole("button", { name: "Save targets", exact: true }).click();
  await expect(page.getByText(/calories left/)).toBeVisible();
  await page
    .getByRole("button", { name: "Your daily targets", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Log without daily targets", exact: true })
    .click();
  await expect(
    page.getByText(/calories left|calories above target/),
  ).toHaveCount(0);
});
test("repeat portion preview scales decimals and logging leaves stock unchanged", async ({
  page,
}) => {
  const state = initialState();
  state.meals = [
    {
      id: "portion-source",
      title: "Yogurt",
      day: today(),
      time: "12:00",
      category: "Breakfast",
      calories: 215,
      protein: 18.3,
      carbs: 33,
      fat: 0.4,
      source: "Manual entry",
      confidence: "confirmed",
      note: "",
    },
  ];
  await page.addInitScript(
    ({ state, key }) => localStorage.setItem(key, JSON.stringify(state)),
    { state, key },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await page.getByRole("button", { name: "Edit Yogurt", exact: true }).click();
  await page.getByRole("button", { name: "Repeat meal", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Portion multiplier", exact: true })
    .fill("1.5");
  await expect(
    page.getByRole("textbox", { name: "protein (g)", exact: true }),
  ).toHaveValue("27.45");
  await expect(
    page.getByRole("textbox", { name: "fat (g)", exact: true }),
  ).toHaveValue("0.6");
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).meals.length,
      key,
    ),
  ).toBe(1);
  await page.getByRole("button", { name: "Save meal", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (k) => JSON.parse(localStorage.getItem(k)!).meals.length,
        key,
      ),
    )
    .toBe(2);
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(saved.meals[1].protein).toBe(27.45);
  expect(saved.meals[1].note).toContain(
    "Pantry and prepared portions were not changed",
  );
  expect(saved.groceries).toEqual(state.groceries);
});
test("remaining loads preserve performed sets and timer and routine survive navigation", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await page
    .getByRole("button", { name: "Start Upper Body", exact: true })
    .click();
  await page
    .getByRole("textbox", {
      name: "Bench Press set 1 weight (lb)",
      exact: true,
    })
    .fill("45");
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
    .fill("50");
  await page
    .getByRole("button", {
      name: "Apply set 2 load to remaining sets",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Bench Press set 1 weight (lb)",
      exact: true,
    }),
  ).toHaveValue("45");
  await expect(
    page.getByRole("textbox", {
      name: "Bench Press set 3 weight (lb)",
      exact: true,
    }),
  ).toHaveValue("50");
  await page.getByRole("button", { name: "90 seconds", exact: true }).click();
  const until = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).workout.restUntil,
    key,
  );
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await expect(page.getByText(/Rest timer · \d+s/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).workout.restUntil,
      key,
    ),
  ).toBe(until);
  await page.clock.fastForward(91000);
  await expect(
    page.getByText("Rest timer · 0s", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save workout as a routine", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Routine name", exact: true })
    .fill("My upper session");
  await page.getByRole("button", { name: "Save routine", exact: true }).click();
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save finished workout", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Review routine: My upper session",
      exact: true,
    })
    .click();
  await expect(page.getByText(/Prior load 45 lb/)).toBeVisible();
  await page
    .getByRole("button", { name: "Start saved routine", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Bench Press set 1 weight (lb)",
      exact: true,
    }),
  ).toHaveValue("");
  await expect(
    page.getByRole("textbox", { name: "Bench Press set 1 reps", exact: true }),
  ).toHaveValue("");
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!).workout,
    key,
  );
  expect(saved.history[0].exercises[0].sets[0]).toBe(8);
  expect(saved.routines).toHaveLength(1);
  expect(saved.restUntil).toBeNull();
});
test("older workout correction remains reachable after twelve sessions", async ({
  page,
}) => {
  const state = initialState();
  state.workout.history = Array.from({ length: 13 }, (_, i) => ({
    title: `Saved session ${i}`,
    startedAt: `2026-08-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
    finishedAt: `2026-08-${String(i + 1).padStart(2, "0")}T12:15:00Z`,
    exercises: [
      { name: "Bench press", weight: 40, target: 8, sets: [8], previous: [] },
    ],
  }));
  await page.addInitScript(
    ({ state, key }) => localStorage.setItem(key, JSON.stringify(state)),
    { state, key },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await page
    .getByRole("button", { name: "Load older workouts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Correct Saved session 0", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Bench press set 1 reps", exact: true }),
  ).toHaveValue("8");
});
test("guest saving copy and malformed backup explain current records correctly", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Cloud & your records", exact: true })
    .click();
  await expect(
    page.getByText("Your account saves changes automatically.", {
      exact: false,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Your records are on this device.", { exact: false }),
  ).toBeVisible();
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import a backup file", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(
    page.getByText("This file is not a valid Rep & Plate backup.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
});
test("storage-failure warning remains visible while Chat actions stay reachable", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "dannys-health.native.v1")
        throw new DOMException("Injected test quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter meal manually", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Meal name", exact: true })
    .fill("Unsaved recovery meal");
  for (const [name, value] of Object.entries({
    calories: "100",
    "protein (g)": "10",
    "carbs (g)": "10",
    "fat (g)": "2",
  }))
    await page.getByRole("textbox", { name, exact: true }).fill(value);
  await page.getByRole("button", { name: "Save meal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Dismiss notification", exact: true }),
  ).toContainText("could not be saved");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message Rep & Plate", exact: true })
    .fill("Recovery note");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry capture", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Dismiss notification", exact: true }),
  ).toContainText("could not be saved");
});
test("manual stock is not a purchase and uncertain food exposes product matching", async ({
  page,
}) => {
  const state = addManualPantryIngredient(
    initialState(),
    {
      name: "Rice",
      serving: "100 g",
      servings: 4,
      nutrition: { calories: 200, protein: 4, carbs: 44, fat: 0 },
    },
    "native-stock",
  );
  state.groceries![0].items[0].nutrition = null;
  state.groceries![0].items[0].needsReview = true;
  await page.addInitScript(
    ({ state, key }) => localStorage.setItem(key, JSON.stringify(state)),
    { state, key },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await expect(
    page.getByText("Your receipts will live here, ready when you need them.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open pantry", exact: true }).click();
  await page.getByRole("button", { name: "Check Rice", exact: true }).click();
  await expect(
    page.getByRole("textbox", {
      name: "Search USDA for this item",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Scan this package barcode",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", {
      name: "Total labeled servings on hand",
      exact: true,
    }),
  ).toBeVisible();
});
test("cooking method review persists and quantity changes invalidate review", async ({
  page,
}) => {
  const state = initialState();
  state.mealPlans = [
    {
      id: "method-plan",
      status: "draft",
      createdAt: new Date().toISOString(),
      days: Array.from({ length: 7 }, (_, i) => ({
        date: shiftPlanDate(today(), i),
        meals: [
          {
            id: `method-${i}`,
            title: `Rice ${i}`,
            category: "Dinner",
            portions: 1,
            minutes: 20,
            notes: "",
            ingredients: [
              { lotId: null, name: "Rice", servingLabel: "100 g", servings: 1 },
            ],
            cookingMethod: {
              reviewed: false,
              steps: [
                {
                  action: "boil",
                  ingredientIndexes: [0],
                  minutes: 15,
                  temperatureC: null,
                },
              ],
            },
          },
        ],
      })),
    },
  ];
  await page.addInitScript(
    ({ state, key }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.setItem(
        "health.connection",
        JSON.stringify({ url: "http://127.0.0.1:5174", token: "a".repeat(64) }),
      );
    },
    { state, key },
  );
  // Explicit provider fixture: validate native request/review behavior, not live cooking correctness.
  let generated = false;
  await page.route("**/api/plans/meals", async (route) => {
    expect(route.request().postDataJSON().goalsConfigured).toBe(false);
    generated = true;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(state.mealPlans![0]),
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page
    .getByRole("button", { name: "Your week of meals", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate meal plan", exact: true })
    .click();
  await expect.poll(() => generated).toBe(true);
  await expect(
    page.getByText("Dinner: 1 ingredient pattern across 7 meals.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("1. Boil Rice for 15 min.", { exact: true }),
  ).toHaveCount(7);
  await page
    .getByRole("button", {
      name: "I reviewed this method: Rice 0",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Method reviewed by you", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page
    .getByRole("button", { name: "Your week of meals", exact: true })
    .click();
  await expect(
    page.getByText("Method reviewed by you", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Portions for Rice 0", exact: true })
    .fill("2");
  await expect(
    page.getByRole("button", {
      name: "I reviewed this method: Rice 0",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review cooking method: Rice 0", exact: true })
    .click();
  await page.getByRole("button", { name: "serve", exact: true }).click();
  await page.getByRole("button", { name: "Rice", exact: true }).click();
  await page
    .getByRole("button", { name: "Add cooking step", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save cooking method", exact: true })
    .click();
  await expect(page.getByText("2. Serve Rice.", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)!).meals.length,
      key,
    ),
  ).toBe(0);
});
