import { test, expect } from "./app-fixture";
import { initialState, today } from "../src/domain";
import { readBrowserRecords } from "./record-fixture";

test("decimal meal corrections, repeat and manual backfill preserve reviewed values", async ({
  page,
}) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: false, jev: false } }),
  );
  const state = initialState();
  state.meals = [
    {
      id: "decimal-meal",
      title: "Decimal breakfast",
      category: "Breakfast",
      calories: 215,
      protein: 18.3,
      carbs: 33,
      fat: 0.4,
      day: today(),
      time: "9:00 AM",
      source: "Manual entry",
      confidence: "confirmed",
      note: "Synthetic",
    },
  ];
  await page.addInitScript(
    (state) => localStorage.setItem("fuel.prototype.v1", JSON.stringify(state)),
    state,
  );
  await page.goto("/#nutrition");
  await page
    .getByRole("button", { name: "Edit Decimal breakfast", exact: true })
    .click();
  await page
    .getByLabel("Meal name", { exact: true })
    .fill("Corrected breakfast");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit Corrected breakfast", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Corrected breakfast", exact: true })
    .click();
  await page.getByRole("button", { name: "Repeat meal", exact: true }).click();
  await page.getByLabel("Meal date", { exact: true }).fill("2026-09-01");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  let saved = await readBrowserRecords(page);
  expect(saved.meals).toHaveLength(2);
  expect(saved.meals[1]).toMatchObject({
    day: "2026-09-01",
    protein: 18.3,
    fat: 0.4,
  });
  await page.getByRole("button", { name: "Previous day", exact: true }).click();
  await page
    .getByRole("button", { name: "Enter meal manually", exact: true })
    .click();
  const date = await page.getByLabel("Meal date", { exact: true }).inputValue();
  expect(date).not.toBe(today());
  await page.getByLabel("Meal name", { exact: true }).fill("Offline lunch");
  await page.getByLabel("Calories", { exact: true }).fill("300.5");
  await page.getByLabel("Protein (g)", { exact: true }).fill("18.3");
  await page.getByLabel("Carbs (g)", { exact: true }).fill("25");
  await page.getByLabel("Fat (g)", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  saved = await readBrowserRecords(page);
  expect(saved.meals.at(-1)).toMatchObject({
    title: "Offline lunch",
    day: date,
    calories: 300.5,
  });
});

test("profile activity includes workout-only dates and load-aware history", async ({
  page,
}) => {
  const state = initialState();
  state.workout = {
    ...state.workout,
    status: "finished",
    title: "My session",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    exercises: [
      {
        name: "Bench Press",
        weight: 45,
        target: 8,
        previous: [],
        sets: [5],
        setWeights: [45],
      },
    ],
  };
  await page.addInitScript(
    (state) => localStorage.setItem("fuel.prototype.v1", JSON.stringify(state)),
    state,
  );
  await page.goto("/#you");
  await expect(
    page.getByRole("region", { name: "Your recorded activity" }),
  ).toContainText("1of 7 days");
  await page.getByRole("button", { name: /^Workout history/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Workout history", exact: true }),
  ).toContainText("45 lb");
});

test("public help always has the owned contact even offline", async ({
  page,
}) => {
  await page.route("**/api/cloud/config", (r) =>
    r.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/#you");
  await page.getByRole("button", { name: /Your data & privacy/ }).click();
  await expect(
    page.getByRole("link", { name: "Contact support" }),
  ).toHaveAttribute("href", "mailto:dthompsondev@gmail.com");
});

test("reset clears the temporary recipe setup without retaining private draft text", async ({
  page,
}) => {
  await page.goto("/#kitchen");
  await page.getByRole("button", { name: "Open recipes", exact: true }).click();
  await page
    .getByRole("button", { name: "Prepare a batch", exact: true })
    .click();
  await page
    .getByLabel("Batch name", { exact: true })
    .fill("Private unfinished batch");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit your profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await page
    .getByRole("button", { name: "Clear my records", exact: true })
    .click();
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page.getByRole("button", { name: "Open recipes", exact: true }).click();
  await page
    .getByRole("button", { name: "Prepare a batch", exact: true })
    .click();
  await expect(page.getByLabel("Batch name", { exact: true })).toHaveValue("");
});

test("correcting a historical workout preserves its completion date and rejects implicit zero load", async ({
  page,
}) => {
  const state = initialState();
  state.workout = {
    ...state.workout,
    status: "finished",
    title: "September session",
    startedAt: "2026-09-01T12:00:00Z",
    finishedAt: "2026-09-01T13:00:00Z",
    exercises: [
      {
        name: "Bench Press",
        weight: 45,
        target: 8,
        previous: [],
        sets: [5],
        setWeights: [45],
      },
    ],
  };
  await page.addInitScript(
    (state) => localStorage.setItem("fuel.prototype.v1", JSON.stringify(state)),
    state,
  );
  await page.goto("/#workouts");
  await page
    .getByRole("button", { name: "Correct this workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Bench Press set 1", exact: true })
    .click();
  await page.getByLabel("Reps", { exact: true }).fill("6");
  await page.getByRole("button", { name: "Save reps", exact: true }).click();
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  expect((await readBrowserRecords(page)).workout.finishedAt).toBe(
    "2026-09-01T13:00:00Z",
  );
  await page
    .getByRole("button", { name: "Choose your next workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Adjust Bench Press", exact: true })
    .click();
  await expect(page.getByLabel("Weight (lb)", { exact: true })).toHaveValue("");
  await page.getByLabel("Target reps", { exact: true }).fill("9");
  await page
    .getByRole("button", { name: "Save exercise", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    (await readBrowserRecords(page)).workout.exercises[0].weightConfirmed,
  ).toBe(false);
});

test("flexible workout chooses loads, logs later exercise, corrects partial history and uses kg", async ({
  page,
}) => {
  await page.goto("/#workouts");
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Bench Press set 1: 8 reps",
      exact: true,
    }),
  ).toBeDisabled();
  await page.getByLabel("Workout units", { exact: true }).selectOption("kg");
  const row = page.getByRole("region", {
    name: "Seated Cable Row",
    exact: true,
  });
  await row
    .getByLabel("Seated Cable Row set 1 weight (kg)", { exact: true })
    .fill("20.5");
  await row
    .locator(".workout-set")
    .first()
    .getByRole("button", { name: "Save set weight", exact: true })
    .click();
  await row
    .getByRole("button", {
      name: "Seated Cable Row set 1: 12 reps",
      exact: true,
    })
    .click();
  await row
    .getByLabel("Seated Cable Row set 1 effort", { exact: true })
    .selectOption("7");
  await page
    .getByRole("button", { name: "Move Seated Cable Row earlier", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Save this partial workout?" }),
  ).toContainText("1 of 12");
  await page
    .getByRole("button", { name: "Save partial workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Correct this workout", exact: true })
    .click();
  await row
    .getByRole("button", { name: "Edit Seated Cable Row set 1", exact: true })
    .click();
  await page.getByRole("dialog").getByRole("spinbutton").fill("10");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save reps", exact: true })
    .click();
  await page.reload();
  await expect(row).toContainText("20.5 kg × 10 reps");
  const saved = await readBrowserRecords(page);
  expect(saved.workout.exercises[1].setEffort[0]).toBe(7);
  await page.screenshot({
    path: "docs/audits/2026-09-30-remediation/evidence/web-workout.png",
    fullPage: true,
  });
});

test("manual movement is saved once and participates in the activity view", async ({
  page,
}) => {
  await page.goto("/#workouts");
  await page
    .getByRole("button", { name: "Log walk or cardio", exact: true })
    .click();
  await page.getByLabel("Minutes", { exact: true }).fill("20");
  await page
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Your recorded activity" }),
  ).toContainText("1of 7 days");
  await page.reload();
  const saved = await readBrowserRecords(page);
  expect(saved.activities).toHaveLength(1);
  expect(saved.activities[0]).toMatchObject({ title: "Walk", minutes: 20 });
});

test("selected nutrition day reaches AI and pending corrections retain the proposal until saved", async ({
  page,
}) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: true, jev: false } }),
  );
  let request: any;
  await page.route("**/api/chat", async (r) => {
    request = r.request().postDataJSON();
    await r.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          result: {
            requestId: request.requestId,
            reply: "Review this estimate.",
            sources: [],
            receipt: null,
            decision: "meal",
            warnings: [],
            meal: {
              title: "Yogurt",
              category: "Breakfast",
              day: request.captureDay,
              portion: "One bowl",
              calories: 215,
              protein: 18.3,
              carbs: 33,
              fat: 0.4,
              note: "Estimate",
              sources: [],
            },
          },
        }) + "\n",
    });
  });
  await page.goto("/#nutrition");
  await page.getByRole("button", { name: "Previous day", exact: true }).click();
  await page.getByRole("button", { name: "Tell Spot", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("I ate yogurt");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  const card = page.locator(".fuel-proposed-meal");
  await expect(card).toContainText("18.3g");
  expect(request.captureDay).not.toBe(today());
  await card.getByRole("button", { name: "Fix it", exact: true }).click();
  await page.getByLabel("Protein (g)", { exact: true }).fill("23.7");
  await page.keyboard.press("Escape");
  await expect(card).toContainText("18.3g");
  await card.getByRole("button", { name: "Fix it", exact: true }).click();
  await page.getByLabel("Protein (g)", { exact: true }).fill("23.7");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(card).toContainText("23.7g");
  expect((await readBrowserRecords(page)).meals).toHaveLength(0);
  await card
    .getByRole("button", { name: "Yep, add to Breakfast", exact: true })
    .click();
  const saved = await readBrowserRecords(page);
  expect(saved.meals[0]).toMatchObject({
    day: request.captureDay,
    protein: 23.7,
  });
});
