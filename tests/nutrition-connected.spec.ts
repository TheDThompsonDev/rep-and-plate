import {commitSeededRecords, readBrowserRecords } from "./record-fixture";
import { test, expect, type Page } from "./app-fixture";
import { demoState } from "../src/domain";

async function blankMeals(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    state.meals = [];
    state.messages = [];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await commitSeededRecords(page);
  await page.reload();
}

test("Nutrition shows accepted Chat meals inline and edits update its totals", async ({
  page,
}, testInfo) => {
  let calls = 0;
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: true, jev: true } }),
  );
  await page.route("**/api/chat", (route) => {
    calls++;
    const { requestId } = route.request().postDataJSON();
    return route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          result: {
            requestId,
            reply:
              "Here's your lunch estimate. Check the portion before adding it.",
            decision: "meal",
            receipt: null,
            sources: [],
            warnings: [],
            meal: {
              title: "Fixture lentil lunch",
              category: "Lunch",
              portion: "One bowl",
              note: "Estimated portion.",
              calories: 420,
              protein: 24,
              carbs: 60,
              fat: 10,
              sources: [],
            },
          },
        }) + "\n",
    });
  });
  await blankMeals(page);
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("I ate a bowl of lentils for lunch.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Yep, add to Lunch", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("0");
  await expect(
    page.getByRole("region", { name: "Today's logged meals" }),
  ).toContainText("Nothing here yet.");
  await page.getByRole("button", { name: "Tell Spot", exact: true }).click();
  expect(calls).toBe(1);
  await page.getByRole("button", { name: "Yep, add to Lunch", exact: true }).click();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  const meal = page.getByRole("button", {
    name: "Edit Fixture lentil lunch",
    exact: true,
  });
  await expect(meal).toContainText("420 cal");
  await expect(meal).toContainText("24g protein");
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("420");
  await expect(page.getByRole("region", { name: "Lunch meals" })).toBeVisible();
  await meal.click();
  await page.getByLabel("Calories", { exact: true }).fill("450");
  await page.getByLabel("Protein (g)", { exact: true }).fill("27");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(meal).toContainText("450 cal");
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("450");
  await expect(
    page.getByRole("progressbar", { name: "protein", exact: true }),
  ).toHaveAttribute("aria-valuenow", "27");
  await page.reload();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(meal).toContainText("450 cal");
  expect(calls).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  if (testInfo.project.name === "mobile")
    await page.screenshot({
      path: testInfo.outputPath("nutrition-mobile.png"),
    });
});

test("Nutrition excludes persisted example meals and opens the connected planning tools", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: true, jev: true } }),
  );
  await page.route("**/api/chat", (route) => {
    calls++;
    return route.abort();
  });
  await page.goto("/");
  const samples = demoState();
  const sample = samples.meals[0];
  const real = {
    ...sample,
    id: "personal-nutrition",
    title: "My actual breakfast",
    source: "Your confirmed meal",
    example: false,
    calories: 200,
    protein: 20,
    carbs: 15,
    fat: 7,
  };
  await page.evaluate(
    ({ sample, real }) => {
      const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
      state.meals = [sample, real];
      localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
    },
    { sample, real },
  );
  await commitSeededRecords(page);
  await page.reload();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Today's logged meals" }),
  ).toContainText("My actual breakfast");
  await expect(
    page.getByRole("region", { name: "Today's logged meals" }),
  ).not.toContainText(sample.title);
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("200");
  await expect(
    page.getByRole("progressbar", { name: "protein", exact: true }),
  ).toHaveAttribute("aria-valuenow", "20");
  expect(
    (await readBrowserRecords(page)).meals.length,
  ).toBe(2);
  const tools = page.getByRole("navigation", { name: "Food planning tools" });
  for (const [name, title] of [
    ["Pantry", "Your pantry"],
    ["Meal plan", "Your week of meals"],
    ["Recipes", "Recipes & leftovers"],
  ]) {
    await tools.getByRole("button", { name: new RegExp(name) }).click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  }
  expect(calls).toBe(0);
});
