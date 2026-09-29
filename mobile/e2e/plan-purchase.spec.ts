import { test, expect } from "./app-fixture";
import { initialState } from "../../src/domain";

test("native purchased ingredient review completes the week without double logging", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await page.evaluate((fallback) => {
    const key = "dannys-health.native.v1",
      state = JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
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
    localStorage.setItem(key, JSON.stringify(state));
  }, initialState());
  await page.reload();
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page.getByText("Your week of meals", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Log one portion", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Connect purchased Rice", exact: true })
    .click();
  await page.getByText("100 g · 4 left · 2026-09-29", { exact: true }).click();
  await expect(
    page.getByRole("textbox", {
      name: "Labeled servings for the whole recipe",
    }),
  ).toHaveValue("1");
  await expect(
    page.getByRole("button", { name: "Use this ingredient", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "I checked the product, preparation state and amount",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Use this ingredient", exact: true })
    .click();
  await expect(
    page.getByText("~200 cal per portion", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/1 of 1 ingredients covered by pantry stock/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Approve plan", exact: true }).click();
  await page
    .getByRole("button", { name: "Log one portion", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Portion logged", exact: true }),
  ).toBeDisabled();
  const state = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dannys-health.native.v1")!),
  );
  expect(state.meals).toHaveLength(1);
  expect(state.meals[0].calories).toBe(200);
  expect(state.pantryEvents).toHaveLength(1);
  expect(state.pantryEvents[0].servings).toBe(-1);
  expect(state.mealPlans).toHaveLength(1);
});
