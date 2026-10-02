import { test, expect } from "./app-fixture";
import { initialState, today } from "../../src/domain";
test.setTimeout(60000);

test("native Spot intro, workout check, saved result and weekly Rep summary", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "http://127.0.0.1:5174", token: "a".repeat(64) }),
    ),
  );
  await page.route("**/api/chat", (r) =>
    r.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          result: {
            requestId: r.request().postDataJSON().requestId,
            reply: "Check these completed sets.",
            decision: "conversation",
            meal: null,
            receipt: null,
            sources: [],
            warnings: [],
            workout: {
              title: "Bench session",
              day: today(),
              note: "As reported.",
              exercises: [
                { name: "Bench Press", weight: 185, reps: [5, 5, 5] },
              ],
            },
          },
        }) + "\n",
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page.getByRole("button", { name: "Meet Spot", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hey. I’m Spot." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Here’s what you can do with me." })).toBeVisible();
  await page.getByRole("button", { name: "More about Spot", exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Give your groceries a plan.' })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tell me what you did." }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("spot-native-rep.png") });
  await page.getByRole("button", { name: "Close tour", exact: true }).first().click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  const draft = page.getByRole("textbox", { name: "Message Rep & Plate" });
  await draft.fill("Keep my sandwich story");
  const beforeMoods = await page.evaluate(() =>
    localStorage.getItem("dannys-health.native.v1"),
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
    await page.evaluate(() => localStorage.getItem("dannys-health.native.v1")),
  ).toBe(beforeMoods);
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("Bench 185 3x5");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Spot Check", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yep, log workout" }).click();
  await expect(page.getByText("Logged. Workout saved.")).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Yep, log workout" }),
  ).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dannys-health.native.v1")!),
  );
  expect(saved.workout.history).toHaveLength(1);
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(
    page.getByText("Weekly Spot Check", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Rep · Training", exact: true })
    .click();
  await expect(page.getByText("2,775 lb recorded volume")).toBeVisible();
  await page.getByRole("button", { name: "Hide Spot illustrations" }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("native comeback starts with today and preserves the capture draft", async ({
  page,
}) => {
  const state = initialState();
  state.spot = {
    introSeen: true,
    lastVisit: new Date(Date.now() - 6 * 86400000).toISOString(),
  };
  await page.addInitScript(
    (s) => localStorage.setItem("dannys-health.native.v1", JSON.stringify(s)),
    state,
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Oh hey." })).toBeVisible();
  await page.getByRole("button", { name: "Catch me up", exact: true }).click();
  await expect(page.getByText("Catch me up.", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("Yesterday I had oats");
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toHaveValue("Yesterday I had oats");
});
