import { test, expect } from "./app-fixture";
import { initialState, today } from "../src/domain";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: true, jev: true } }),
  );
});
test("Spot introduction pivots to Rep, capture stays universal, and visuals are optional", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", {name:"Open chat menu"}).click();
  await page.getByRole("button", {name:"Meet Spot",exact:true}).click();
  await expect(
    page.getByRole("heading", { name: "Hey. I’m Spot." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tell me what you ate." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tell me what you did." }),
  ).toBeVisible();
  await expect(
    page.locator('.welcome-art img'),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("spot-onboarding-rep.png") });
  await page.getByRole("button", { name: "Close tour",exact:true }).first().click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  const draft = page.getByRole("textbox", { name: "Message Rep & Plate" });
  await draft.fill("Keep my sandwich story");
  const beforeMoods = await page.evaluate(() =>
    localStorage.getItem("fuel.prototype.v1"),
  );
  for (const title of [
    "Still here.",
    "Good food. Great plot.",
    "Booting up.",
    "Chef-ish.",
    "Rest is a plan.",
    "We can work with that.",
    "Look at us planning.",
    "Get my publicist.",
    "I’ve connected the dots.",
    "The prophecy is complete.",
    "We gather here today.",
    "Always here.",
  ]) {
    await page.getByRole("button", { name: "Another Spot mood" }).click();
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(draft).toHaveValue("Keep my sandwich story");
  }
  expect(
    await page.evaluate(() => localStorage.getItem("fuel.prototype.v1")),
  ).toBe(beforeMoods);
  await page.getByRole("button", { name: "Open chat menu" }).click();
  await page
    .getByRole("checkbox", { name: "Show Spot illustrations" })
    .uncheck();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.locator(".spot-avatar img")).toHaveCount(0);
  await expect(page.locator(".spot-reaction img")).toHaveCount(0);
  await expect(page.locator(".spot-scene img")).toHaveCount(0);
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nothing here yet." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("workout capture confirms once, survives reload and retains an active session", async ({
  page,
}, info) => {
  const state = initialState();
  state.spot = { introSeen: true };
  state.workout.status = "active";
  await page.addInitScript(
    (s) => localStorage.setItem("fuel.prototype.v1", JSON.stringify(s)),
    state,
  );
  await page.route("**/api/chat", async (r) => {
    const req = r.request().postDataJSON();
    await r.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          result: {
            requestId: req.requestId,
            reply: "Check the sets and loads.",
            decision: "conversation",
            meal: null,
            receipt: null,
            sources: [],
            warnings: [],
            workout: {
              title: "Evening session",
              day: today(),
              note: "Dumbbell load is per hand.",
              exercises: [
                { name: "Bench Press", weight: 185, reps: [5, 5, 5] },
                { name: "Incline DB", weight: 60, reps: [8, 8, 8] },
              ],
            },
          },
        }) + "\n",
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("Bench 185 3x5, incline DB 60s 3x8");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Spot Check", exact: true }),
  ).toBeVisible();
  await expect(page.locator('.spot-check [data-side="rep"]')).toBeVisible();
  await page.screenshot({ path: info.outputPath("spot-workout-check.png") });
  await page.getByRole("button", { name: "Yep, log workout" }).click();
  await expect(page.getByText("Logged.", { exact: true })).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
  );
  expect(saved.workout.status).toBe("active");
  expect(saved.workout.history).toHaveLength(1);
  await page.addInitScript(
    (s) => localStorage.setItem("fuel.prototype.v1", JSON.stringify(s)),
    saved,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Yep, log workout" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Your profile" }).click();
  await page.getByRole("button", { name: "Open your weekly review" }).click();
  await page
    .getByRole("button", { name: "Rep · Training", exact: true })
    .click();
  await expect(page.getByText("4,215", { exact: true })).toBeVisible();
});
test("comeback is welcoming and broken artwork leaves all controls usable", async ({
  page,
}) => {
  const state = initialState();
  state.spot = {
    introSeen: true,
    lastVisit: new Date(Date.now() - 6 * 86400000).toISOString(),
  };
  await page.addInitScript(
    (s) => localStorage.setItem("fuel.prototype.v1", JSON.stringify(s)),
    state,
  );
  await page.route("**/images/spot/*", (r) => r.abort());
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Oh hey." })).toBeVisible();
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  await expect(page.getByText("Catch me up.", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeFocused();
  await expect(page.locator(".spot-fallback").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
