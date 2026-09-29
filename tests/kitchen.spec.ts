import {commitSeededRecords, readBrowserRecords } from "./record-fixture";
import { test, expect } from "./app-fixture";

test("Kitchen replaces the You tab and keeps profile, workouts and food tools connected", async ({
  page,
}) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: false, jev: false } }),
  );
  await page.goto("/");
  const before = JSON.stringify(await readBrowserRecords(page));
  await expect(page.locator(".fuel-tabs button")).toHaveText([
    "Chat",
    "Nutrition",
    "Scan",
    "Workouts",
    "Kitchen",
  ]);
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await expect(page).toHaveURL(/#kitchen$/);
  await expect(
    page.getByRole("heading", { name: "What sounds good tonight?" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What sounds good tonight?" }),
  ).toBeVisible();
  for (const [action, title] of [
    ["Open pantry", "Your pantry"],
    ["Open recipes", "Recipes & leftovers"],
    ["Open meal planner", "Your week of meals"],
  ] as const) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(title);
    await page
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(page).toHaveURL(/#you$/);
  await expect(
    page.getByRole("button", { name: "Your profile", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".fuel-tabs [aria-current=page]")).toHaveCount(0);
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await expect(page).toHaveURL(/#workouts$/);
  expect(
    await readBrowserRecords(page),
  ).toEqual(JSON.parse(before!));
});

test("Kitchen derives stock, portions, date reminders and missing ingredients without changing intake", async ({
  page,
}, info) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: false, jev: false } }),
  );
  await page.goto("/");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    };
    const nutrition = { calories: 150, protein: 8, carbs: 12, fat: 8 };
    const item = {
      id: "milk",
      receiptText: "MILK",
      name: "Whole milk",
      quantity: "1 carton",
      serving: "1 cup",
      servingsPurchased: 4,
      nutrition,
      match: "user",
      note: "",
      sources: [],
      needsReview: false,
      availability: "available",
    };
    state.groceries = [
      {
        id: "shop",
        fingerprint: "fixture",
        store: "Neighborhood Market",
        date: day(-1),
        note: "",
        sources: [],
        items: [
          {
            ...item,
            pantryDates: {
              labelKind: "best-before",
              labelDate: day(1),
              openedDate: null,
            },
          },
          {
            ...item,
            id: "oats",
            name: "Oats",
            servingsPurchased: null,
            nutrition: null,
            needsReview: true,
          },
          { ...item, id: "used", name: "Used-up juice", availability: "used" },
        ],
      },
    ];
    state.recipeBatches = [
      {
        id: "prepared",
        name: "Overnight oats",
        createdAt: new Date().toISOString(),
        totalPortions: 2,
        ingredients: [
          {
            id: "ingredient",
            name: "Oats",
            servings: 2,
            servingLabel: "1/2 cup",
            nutrition,
            sourceUrls: [],
          },
        ],
        nutrition: { calories: 600, protein: 20, carbs: 100, fat: 10 },
        preparationEventIds: ["prep"],
        consumptions: [],
      },
    ];
    const meal = {
      id: "planned",
      title: "Breakfast oats",
      category: "Breakfast",
      portions: 2,
      minutes: 10,
      ingredients: [
        {
          lotId: "shop::milk",
          name: "Whole milk",
          servings: 6,
          servingLabel: "1 cup",
        },
        {
          lotId: "shop::oats",
          name: "Oats",
          servings: 2,
          servingLabel: "1/2 cup",
        },
        { lotId: null, name: "Berries", servings: 2, servingLabel: "1 cup" },
      ],
      notes: "",
    };
    state.mealPlans = [
      {
        id: "plan",
        createdAt: new Date().toISOString(),
        status: "approved",
        days: Array.from({ length: 7 }, (_, index) => ({
          date: day(index - 1),
          meals:
            index === 1
              ? [meal]
              : index === 0
                ? [
                    {
                      ...meal,
                      id: "old",
                      title: "Yesterday plan",
                      ingredients: [
                        {
                          lotId: null,
                          name: "Past-only ingredient",
                          servings: 10,
                          servingLabel: "1 cup",
                        },
                      ],
                    },
                  ]
                : [],
        })),
      },
    ];
    state.meals = [];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await commitSeededRecords(page);
  await page.reload();
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  const stock = page.getByRole("region", {
    name: "What you have",
    exact: true,
  });
  await expect(stock).toContainText("1 item on hand");
  await expect(stock).toContainText("1 quantity needs a check");
  await expect(stock).not.toContainText("Used-up juice");
  await expect(stock).toContainText("150 cal · 8g protein per 1 cup");
  await expect(
    page.getByRole("region", { name: "What you can make" }),
  ).toContainText("300 cal · 10g protein per portion");
  await expect(
    page.getByRole("region", { name: "What you can make" }),
  ).not.toContainText("Yesterday plan");
  await expect(
    page.getByRole("region", { name: "Dates to check" }),
  ).toContainText("Best before: in 1 day");
  const shopping = page.getByRole("region", { name: "What you need to buy" });
  await expect(shopping).toContainText("Check your pantry quantity first");
  await expect(shopping).toContainText("Berries");
  await expect(shopping).not.toContainText("Past-only ingredient");
  await expect(
    shopping.getByRole("button").filter({ hasText: "Whole milk" }),
  ).toContainText("2 × 1 cup");
  if (info.project.name === "mobile")
    await page.screenshot({ path: info.outputPath("kitchen-personal.png") });
  await page.setViewportSize({ width: 320, height: 760 });
  expect(
    await page
      .locator(".kitchen-surface")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page
    .locator(".kitchen-surface")
    .evaluate((el) => (el.scrollTop = el.scrollHeight));
  const last = await page.locator(".kitchen-chat-return").boundingBox();
  const nav = await page.locator(".fuel-tabs").boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(nav!.y);
  const receipts = page.getByRole("region", { name: "Recent grocery trips" });
  await receipts.getByRole("button", { name: /Neighborhood Market/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Neighborhood Market");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("0");
});
