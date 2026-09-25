import { test, expect, type Page } from "@playwright/test";

async function send(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Message Fuel" }).fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Fuel is responding" }),
  ).toHaveCount(0);
}
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fuel.prototype.v1")!));

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
});

test("Chat is the default home with the reference layout and four destinations", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("heading", { name: "Fuel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Show me what you ate. I’ll figure it out."),
  ).toBeVisible();
  const tabs = page.getByRole("navigation", { name: "Chat navigation" });
  await expect(tabs.getByRole("button")).toHaveText([
    "Chat",
    "Nutrition",
    "Workouts",
    "You",
  ]);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Use voice", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Grilled chicken, rice, and broccoli dinner",
    }),
  ).toBeVisible();
  expect(
    await page
      .locator(".fuel-message-photo")
      .evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
  ).toBe(true);
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
    page.getByRole("heading", { name: "Fuel", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("chat meal corrections recalculate nutrition and survive refresh", async ({
  page,
}) => {
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
    "2,060",
  );
  await expect(page.locator(".fuel-inline-summary").last()).toContainText(
    "113g",
  );
  await page.reload();
  expect(
    (await stored(page)).meals.find(
      (m: { id: string }) => m.id === "chat-demo-dinner",
    ).calories,
  ).toBe(700);
  await expect(
    page.getByRole("heading", { name: "Fuel", exact: true }),
  ).toBeVisible();
});

test("sample photo asks one portion question before adding a meal, including after refresh", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Open chat menu" }).click();
  await page.getByRole("button", { name: "Try a sample capture" }).click();
  await page.getByRole("button", { name: /A home-cooked dinner/ }).click();
  expect((await stored(page)).meals).toHaveLength(4);
  await expect(
    page.getByText("Was that about 1 cup of rice?", { exact: true }).last(),
  ).toBeVisible();
  await page.reload();
  await send(page, "2 cups");
  const state = await stored(page);
  expect(state.meals).toHaveLength(5);
  expect(state.meals.at(-1).calories).toBe(815);
  expect(state.pendingMeal).toBeUndefined();
  await expect(page.locator(".fuel-meal-card").last()).toBeInViewport();
});

test("unknown text can be reviewed and resolved without leaving chat", async ({
  page,
}) => {
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
    page.getByRole("heading", { name: "Fuel", exact: true }),
  ).toBeVisible();
});

test("bench sets can be recorded and corrected inside chat", async ({
  page,
}) => {
  await send(page, "Start my workout");
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
    page.getByRole("heading", { name: "Fuel", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Your captured photo or screenshot" }),
  ).toBeVisible();
  expect((await stored(page)).meals).toHaveLength(4);
  await page.reload();
  const state = await stored(page);
  expect(state.reviews.at(-1).image).toMatch(/^data:image\/jpeg;base64,/);
  expect(state.meals).toHaveLength(4);
});

test("secondary screens return home to Chat and profile is keyboard accessible", async ({
  page,
}) => {
  await page
    .getByRole("navigation", { name: "Chat navigation" })
    .getByRole("button", { name: "Nutrition", exact: true })
    .click();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText(
    "1,970",
  );
  const navName = "Nutrition navigation";
  await page
    .getByRole("navigation", { name: navName, exact: true })
    .getByRole("button", { name: "Chat", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Chat navigation" })
    .getByRole("button", { name: "You", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your space, your pace.", exact: true }),
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
  await page
    .getByRole("navigation", { name: "Chat navigation" })
    .getByRole("button", { name: "You", exact: true })
    .click();
  await expect(page).toHaveURL(/#you$/);
  await expect(
    page
      .getByRole("navigation", { name: "You navigation" })
      .getByRole("button", { name: "You", exact: true }),
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
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Alex", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your daily goals" }),
  ).toContainText("2,200");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Alex", exact: true }),
  ).toBeVisible();
  expect((await stored(page)).meals).toHaveLength(resolvedState.meals.length);
  await page.getByRole("button", { name: /Your data & privacy/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "There’s no account or cloud sync",
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
  await page.getByRole("button", { name: "Fuel home", exact: true }).click();
  await expect(page).toHaveURL(/#chat$/);
});

test("You shows captured notes, editable meals, and real workout history", async ({
  page,
}) => {
  await send(page, "A note about my walk today");
  await page
    .getByRole("navigation", { name: "Chat navigation" })
    .getByRole("button", { name: "You", exact: true })
    .click();
  await page
    .getByRole("button", { name: "See all 3 reviews", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Keep as a note", exact: true })
    .click();
  await page.getByRole("button", { name: /Meals & captures/ }).click();
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
  await page
    .getByRole("button", { name: "Bench Press set 1: 8 reps", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Workouts navigation" })
    .getByRole("button", { name: "You", exact: true })
    .click();
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

test("nutrition matches the reference sections and opens insight and swap context", async ({
  page,
}) => {
  await page
    .getByRole("navigation", { name: "Chat navigation" })
    .getByRole("button", { name: "Nutrition", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Here’s what we’re learning/ }),
  ).toBeVisible();
  await expect(page.locator(".nutrition-insight")).toHaveCount(3);
  await expect(page.locator(".nutrition-swap")).toHaveCount(2);
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
  await page.locator(".nutrition-insight").first().click();
  await expect(page.getByRole("dialog")).toContainText("Sample history");
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page.getByRole("button", { name: "See all", exact: true }).click();
  await expect(page.locator(".nutrition-all-insight")).toHaveCount(3);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", {
      name: "Starbucks Frappuccino to Iced Americano",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "About 390 fewer calories",
  );
  await page.getByRole("button", { name: "Got it", exact: true }).click();
  await page
    .getByRole("button", { name: "Ranch Dressing to Salsa", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "About 130 fewer calories",
  );
});

test("nutrition ring opens editable records and macro percentages follow actual totals", async ({
  page,
}) => {
  await page.goto("/#nutrition");
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText(
    "1,970",
  );
  await expect(
    page.locator(".nutrition-macro.protein .nutrition-macro-percent"),
  ).toHaveText("97%");
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
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText(
    "1,460",
  );
  await expect(page.locator(".nutrition-remaining")).toHaveText(
    "540 calories left",
  );
  await expect(
    page.locator(".nutrition-macro.protein .nutrition-macro-percent"),
  ).toHaveText("53%");
  await page.reload();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText(
    "1,460",
  );
  await page.getByRole("button", { name: "Fuel home", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fuel", exact: true }),
  ).toBeVisible();
});
