import { test, expect, type Page } from "./app-fixture";
import { demoState } from "../src/domain";
import { seedBrowserRecords, readBrowserRecords } from "./record-fixture";

async function seedExamples(page: Page, includePersonalDinner = false) {
  const state = demoState();
  await page.clock.setFixedTime(new Date(`${state.meals[0].day}T12:00:00`));
  if (includePersonalDinner)
    state.meals = state.meals.map((meal) =>
      meal.id === "chat-demo-dinner"
        ? { ...meal, source: "Your confirmed dinner", example: false }
        : meal,
    );
  await seedBrowserRecords(page, state);
  await page.reload();
}
async function seedPersonalDinner(page: Page) {
  const state = demoState();
  state.profile.targetsConfigured = true;
  const dinner = {
    ...state.meals.find((meal) => meal.id === "chat-demo-dinner")!,
    id: "personal-dinner",
    source: "Your logged dinner",
    example: false,
  };
  await page.clock.setFixedTime(new Date(`${dinner.day}T12:00:00`));
  state.meals = [dinner];
  state.reviews = [];
  state.messages = [
    {
      id: "personal-dinner-card",
      role: "assistant",
      text: "Your saved dinner.",
      time: dinner.time,
      mealId: dinner.id,
    },
  ];
  await seedBrowserRecords(page, state);
  await page.reload();
  await page.getByRole("textbox", { name: "Message Rep & Plate" }).waitFor();
  expect((await readBrowserRecords(page)).meals).toEqual([dinner]);
}

async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message Rep & Plate" }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Rep & Plate is responding" }),
  ).toHaveCount(0);
}
const stored = readBrowserRecords;
async function chooseLoad(page: Page, name: string, load: string) {
  await page
    .getByRole("button", { name: `Adjust ${name}`, exact: true })
    .click();
  await page.getByLabel("Weight (lb)", { exact: true }).fill(load);
  await page
    .getByRole("button", { name: "Save exercise", exact: true })
    .click();
}

test("Workout selection becomes a persistent conversation and archives finished sessions", async ({
  page,
}) => {
  await page.goto("/#workouts");
  await expect(
    page.getByRole("heading", { name: "What should you do today?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Lower Body ~35 min", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lower Body · ~35 min" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lower Body in progress" }),
  ).toBeVisible();
  await chooseLoad(page, "Goblet Squat", "35");
  await page
    .getByRole("button", { name: "Goblet Squat set 1: 10 reps", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Message about your workout" })
    .fill("Got 9");
  await page
    .getByRole("button", { name: "Send workout message", exact: true })
    .click();
  await expect(
    page.getByText("Got it. Goblet Squat, set 2: 35 lb × 9 reps.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message about your workout" })
    .fill("Set 2 was 8");
  await page
    .getByRole("button", { name: "Send workout message", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Goblet Squat set 3: 10 reps", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Dumbbell Romanian Deadlift set 1: 10 reps",
      exact: true,
    }),
  ).toBeVisible();
  expect((await stored(page)).workout.exercises[0].sets).toEqual([10, 8, 10]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Lower Body in progress" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Goblet Squat set 1", exact: true })
    .click();
  await page.getByRole("spinbutton", { name: "Reps", exact: true }).fill("11");
  await page.getByRole("button", { name: "Save reps", exact: true }).click();
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save partial workout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lower Body saved", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Choose your next workout", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Full Body ~30 min", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  const saved = await stored(page);
  expect(saved.workout.title).toBe("Full Body");
  expect(saved.workout.exercises[0].sets).toEqual([null, null, null]);
  expect(saved.workout.history[0].exercises[0].sets).toEqual([11, 8, 10]);
  await page
    .getByRole("button", { name: "Open workout menu", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Session history", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lower Body · Saved", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.route("**/api/chat", (route) => route.abort());
  await page.goto("/");
  // Route completion can precede async onboarding hydration and the first
  // app save. Finish initialization before injecting records into its store.
  await page.getByRole("textbox", { name: "Message Rep & Plate" }).waitFor();
  await stored(page);
});

test("Chat starts clean with four destinations and direct barcode scanning", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("heading", { name: "Rep & Plate", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Always here.", exact: true }),
  ).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Chat navigation" });
  await expect(tabs.getByRole("button")).toHaveText([
    "Chat",
    "Nutrition",
    "Scan",
    "Workouts",
    "Kitchen",
  ]);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Use voice", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("(In a supportive way.)", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".fuel-message-photo")).toHaveCount(0);
  expect((await stored(page)).meals).toEqual([]);
  expect((await stored(page)).reviews).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".fuel-tabs")
      .evaluate((el) => el.getBoundingClientRect().bottom <= innerHeight + 1),
  ).toBe(true);
  await page.goto("/#not-a-page");
  await expect(
    page.getByRole("heading", { name: "Rep & Plate", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("chat meal corrections recalculate nutrition and survive refresh", async ({
  page,
}) => {
  await seedPersonalDinner(page);
  await page
    .getByRole("button", {
      name: "Edit Grilled Chicken, Rice, Broccoli",
      exact: true,
    })
    .click();
  await page.getByLabel("Calories", { exact: true }).fill("700");
  await page.getByLabel("Protein (g)", { exact: true }).fill("55");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".fuel-meal-details b").first()).toHaveText(
    "700 cal · 55g protein",
  );
  await send(page, "How am I doing today?");
  await expect(page.locator(".fuel-inline-summary").last()).toContainText(
    "700",
  );
  await expect(page.locator(".fuel-inline-summary").last()).toContainText(
    "55g",
  );
  await page.reload();
  expect(
    (await stored(page)).meals.find(
      (m: { id: string }) => m.id === "personal-dinner",
    ).calories,
  ).toBe(700);
  await expect(
    page.getByRole("heading", { name: "Rep & Plate", exact: true }),
  ).toBeVisible();
});

test("sample photo asks one portion question before adding a meal, including after refresh", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open chat menu" }).click();
  await page.getByRole("button", { name: "Try a sample capture" }).click();
  await page.getByRole("button", { name: /A home-cooked dinner/ }).click();
  expect((await stored(page)).meals).toHaveLength(0);
  await expect(
    page.getByText("Was that about 1 cup of rice?", { exact: true }).last(),
  ).toBeVisible();
  await page.reload();
  await send(page, "2 cups");
  const state = await stored(page);
  expect(state.meals).toHaveLength(1);
  expect(state.meals.at(-1).calories).toBe(815);
  expect(state.meals.at(-1).example).toBe(true);
  expect(state.pendingMeal).toBeUndefined();
  await expect(page.locator(".fuel-meal-card").last()).toBeInViewport();
  await expect(page.locator(".fuel-meal-card").last()).toContainText(
    "Example · not counted",
  );
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("0");
  await expect(
    page.getByRole("region", { name: "Today's logged meals" }),
  ).toContainText("Nothing here yet.");
});

test("unknown text can be reviewed and resolved without leaving chat", async ({
  page,
}) => {
  await seedExamples(page);
  await send(page, "Something unfamiliar for lunch");
  await expect(
    page.getByText("Saved your words for review.", { exact: false }),
  ).toBeVisible();
  expect((await stored(page)).meals).toHaveLength(4);
  await send(page, "What needs review?");
  await page
    .locator(".fuel-inline-review")
    .getByRole("button", { name: "Keep as a note" })
    .click();
  expect((await stored(page)).reviews.at(-1).resolved).toBe(true);
  await page
    .locator(".fuel-inline-review")
    .getByRole("button", { name: "Chicken", exact: true })
    .click();
  await page
    .locator(".fuel-inline-review")
    .getByRole("button", { name: "About half", exact: true })
    .click();
  await expect(
    page.getByText("Everything is taken care of.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Rep & Plate", exact: true }),
  ).toBeVisible();
});

test("bench sets can be recorded and corrected inside chat", async ({
  page,
}) => {
  await send(page, "Start my workout");
  await page
    .getByRole("button", {
      name: "Choose or adjust workout loads",
      exact: true,
    })
    .click();
  await chooseLoad(page, "Bench Press", "45");
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByRole("button", { name: "Bench set 1: 8 reps", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bench set 2: 8 reps", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Bench set 3: 7 reps", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit bench set 3" }).click();
  await page
    .getByRole("button", { name: "Bench set 3: 9 reps", exact: true })
    .click();
  expect((await stored(page)).workout.exercises[0].sets).toEqual([8, 8, 9]);
  await page.reload();
  expect((await stored(page)).workout.exercises[0].sets).toEqual([8, 8, 9]);
  await expect(page.locator(".fuel-inline-workout")).toContainText("9 reps");
});

test("uploaded image stays in chat and persists without guessed nutrition", async ({
  page,
}) => {
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("public/images/bowl.jpg");
  await expect(
    page.getByRole("img", { name: "Your uploaded capture" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save my image for review" }).click();
  await expect(
    page.getByRole("heading", { name: "Rep & Plate", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Your captured photo or screenshot" }),
  ).toBeVisible();
  expect((await stored(page)).meals).toHaveLength(0);
  await page.reload();
  const state = await stored(page);
  expect(state.reviews.at(-1).image).toMatch(/^data:image\/jpeg;base64,/);
  expect(state.meals).toHaveLength(0);
});

test("secondary screens return home to Chat and profile is keyboard accessible", async ({
  page,
}) => {
  await page
    .getByRole("navigation", { name: "Chat navigation" })
    .getByRole("button", { name: "Nutrition", exact: true })
    .click();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("0");
  const navName = "Nutrition navigation";
  await page
    .getByRole("navigation", { name: navName, exact: true })
    .getByRole("button", { name: "Chat", exact: true })
    .click();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /^Looking ahead, / }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit your profile", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit your profile", exact: true }),
  ).toBeFocused();
});

test("You reviews and goals update shared records and persist", async ({
  page,
}) => {
  await seedExamples(page);
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(page).toHaveURL(/#you$/);
  await expect(
    page.getByRole("button", { name: "Your profile", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByText("2 little things to review", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chicken", exact: true }).click();
  await expect(
    page.getByText("1 little thing to review", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "About half", exact: true }).click();
  await expect(
    page.getByText("Nothing waiting on you.", { exact: true }),
  ).toBeVisible();
  const resolvedState = await stored(page);
  expect(
    resolvedState.reviews.filter((r: { resolved: boolean }) => r.resolved),
  ).toHaveLength(2);
  await page
    .getByRole("button", { name: "Completed · 2", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Chicken");
  await expect(page.getByRole("dialog")).toContainText("About half");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Edit goals", exact: true }).click();
  await page.getByRole("textbox", { name: "Your first name" }).fill("Alex");
  await page
    .getByRole("spinbutton", { name: "Daily calories", exact: true })
    .fill("2200");
  await page.locator('input[name="targetsConfigured"]').check();
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Alex.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your daily goals" }),
  ).toContainText("2,200");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Alex.", exact: true }),
  ).toBeVisible();
  expect((await stored(page)).meals).toHaveLength(resolvedState.meals.length);
  await page.getByRole("button", { name: /Your data & privacy/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Conflicting copies wait for your review.",
  );
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/#review");
  await expect(
    page.getByRole("navigation", { name: "You navigation" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rep & Plate home", exact: true })
    .click();
  await expect(page).toHaveURL(/#chat$/);
});

test("You shows captured notes, editable meals, and real workout history", async ({
  page,
}) => {
  await seedExamples(page, true);
  await send(page, "A note about my walk today");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "See all 3 reviews", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep as a note", exact: true })
    .click();
  await page.getByRole("button", { name: /Meals & captures/ }).click();
  await expect(page.getByRole("dialog")).not.toContainText(
    "Avocado toast & eggs",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "A note about my walk today",
  );
  await page
    .getByRole("button", {
      name: "Edit Grilled Chicken, Rice, Broccoli",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Meal name", exact: true }),
  ).toHaveValue("Grilled Chicken, Rice, Broccoli");
  await page
    .getByRole("spinbutton", { name: "Calories", exact: true })
    .fill("620");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  expect(
    (await stored(page)).meals.find(
      (m: { id: string }) => m.id === "chat-demo-dinner",
    ).calories,
  ).toBe(620);
  await page.getByRole("button", { name: /Workout history/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your first session is ahead of you.",
  );
  await page
    .getByRole("button", { name: "Explore workouts", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await chooseLoad(page, "Bench Press", "45");
  await page
    .getByRole("button", { name: "Bench Press set 1: 8 reps", exact: true })
    .click();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page.getByRole("button", { name: /Workout history/ }).click();
  await expect(page.getByRole("dialog")).toContainText("1 sets recorded");
  await expect(page.getByRole("dialog")).toContainText("In progress");
  await page
    .getByRole("button", { name: "Continue your workout", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Upper Body in progress", exact: true }),
  ).toBeVisible();
});

test("nutrition uses personal evidence and opens pantry comparisons without sample claims", async ({
  page,
}) => {
  await page
    .getByRole("navigation", { name: "Chat navigation" })
    .getByRole("button", { name: "Nutrition", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Your day is coming together.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".nutrition-insight")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Compare foods in your pantry/ }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Nutrition navigation" })
      .getByRole("button", { name: "Nutrition", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator(".nutrition-scroll")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Open nutrition menu", exact: true })
    .click();
  await page.getByRole("button", { name: "All insights", exact: true }).click();
  await expect(page.locator(".nutrition-all-insight")).toHaveCount(1);
  await page.locator(".nutrition-all-insight").first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "Example meals don't establish a pattern",
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: /Compare foods in your pantry/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "There aren’t two ready-to-compare foods yet",
  );
  await expect(page.getByRole("dialog")).not.toContainText(
    "390 fewer calories",
  );
});

test("nutrition ring opens editable records and macro percentages follow actual totals", async ({
  page,
}) => {
  await seedPersonalDinner(page);
  await page.goto("/#nutrition");
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("610");
  await expect(
    page.locator(".nutrition-macro.protein .nutrition-macro-percent"),
  ).toHaveText("45%");
  await page
    .getByRole("button", { name: "View and edit today’s meals" })
    .click();
  await page
    .getByRole("button", {
      name: "Edit Grilled Chicken, Rice, Broccoli",
      exact: true,
    })
    .click();
  await page.getByLabel("Calories", { exact: true }).fill("100");
  await page.getByLabel("Protein (g)", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("100");
  await expect(page.locator(".nutrition-remaining")).toHaveText(
    "1,900 calories left",
  );
  await expect(
    page.locator(".nutrition-macro.protein .nutrition-macro-percent"),
  ).toHaveText("0%");
  await page.reload();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("100");
  await page
    .getByRole("button", { name: "Rep & Plate home", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Rep & Plate", exact: true }),
  ).toBeVisible();
});
