import { commitSeededRecords, readBrowserRecords } from "./record-fixture";
import { test, expect } from "./app-fixture";

test("first useful week starts with household preferences and leads to receipt review", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  const guide = page.getByRole("region", { name: "Your first useful week" });
  await guide
    .getByRole("button", {
      name: "Start: Make it your kind of week",
      exact: true,
    })
    .click();
  await page.getByLabel("People to cook for").fill("2");
  await page.getByLabel("Weekly grocery budget").fill("80");
  await page
    .getByRole("button", {
      name: "Save food & routine preferences",
      exact: true,
    })
    .click();
  await expect(guide).toContainText("1 of 6 steps complete");
  await guide
    .getByRole("button", { name: "See the whole journey", exact: true })
    .click();
  await expect(guide).toContainText(
    "Confirm uncertain products and quantities before planning.",
  );
  await guide
    .getByRole("button", {
      name: "Start: Give your groceries a job",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toContainText("receipt");
});

test("a reviewed purchase connects to the existing week and logs exactly once", async ({
  page,
}) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.goto("/");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    state.meals = [];
    state.pantryEvents = [];
    state.groceries = [
      {
        id: "shop",
        fingerprint: "shop",
        store: "Rice shop",
        date: "2026-09-29",
        note: "",
        sources: [],
        items: [
          {
            id: "rice",
            receiptText: "Rice",
            name: "Rice",
            serving: "100 g",
            quantity: "4 servings",
            servingsPurchased: 4,
            nutrition: { calories: 200, protein: 4, carbs: 44, fat: 0 },
            match: "user",
            needsReview: false,
            availability: "available",
            note: "",
            sources: [],
          },
        ],
      },
    ];
    state.mealPlans = [
      {
        id: "week",
        status: "approved",
        createdAt: "2026-09-29",
        days: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-10-0${i + 1}`,
          meals:
            i === 0
              ? [
                  {
                    id: "dinner",
                    title: "Rice bowl",
                    category: "Dinner",
                    portions: 1,
                    minutes: 20,
                    notes: "Cook rice.",
                    ingredients: [
                      {
                        lotId: null,
                        name: "Rice",
                        servingLabel: "g",
                        servings: 100,
                      },
                    ],
                  },
                ]
              : [],
        })),
      },
    ];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await commitSeededRecords(page);
  await page.reload();
  await page.getByRole("button", { name: "Open chat menu" }).click();
  await page.getByRole("button", { name: "Plan my week", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Log one portion", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Connect purchased ingredient", exact: true })
    .click();
  await page
    .getByLabel("Purchased ingredient", { exact: true })
    .selectOption("shop::rice");
  await expect(
    page.getByLabel("Labeled servings for the whole recipe"),
  ).toHaveValue("1");
  await expect(
    page.getByRole("button", { name: "Use this ingredient", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("checkbox", {
      name: "I checked the product, preparation state and amount.",
    })
    .check();
  await page
    .getByRole("button", { name: "Use this ingredient", exact: true })
    .click();
  await expect(page.locator(".fuel-plan-shopping")).toContainText(
    "Known pantry quantities cover",
  );
  await expect(page.locator(".fuel-plan-nutrition")).toContainText("200 cal");
  const before = await readBrowserRecords(page);
  expect(before.meals).toEqual([]);
  expect(before.pantryEvents).toEqual([]);
  expect(before.mealPlans[0].days[0].meals[0].ingredients[0].lotId).toBeNull();
  await page
    .getByRole("button", { name: "Approve this plan", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Log one portion", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Portion logged", exact: true }),
  ).toBeDisabled();
  const after = await readBrowserRecords(page);
  expect(after.mealPlans).toHaveLength(1);
  expect(after.mealPlans[0].id).toBe("week");
  expect(after.meals).toHaveLength(1);
  expect(after.meals[0].calories).toBe(200);
  expect(after.pantryEvents).toHaveLength(1);
  expect(after.pantryEvents[0].servings).toBe(-1);
  await expect(
    page.getByRole("button", {
      name: "Replace pantry ingredient",
      exact: true,
    }),
  ).toHaveCount(0);
});
