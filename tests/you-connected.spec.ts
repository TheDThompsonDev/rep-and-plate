import {commitSeededRecords, readBrowserRecords } from "./record-fixture";
import { expect, test, type Page } from "./app-fixture";

const stored = (page: Page) =>
  readBrowserRecords(page);
async function prepare(page: Page) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.route("**/api/chat", (route) => route.abort());
  await page.goto("/#chat");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    const nutrition = { calories: 150, protein: 8, carbs: 12, fat: 8 };
    const item = {
      id: "milk",
      receiptText: "MILK",
      name: "Whole milk",
      quantity: "1 carton",
      serving: "1 cup",
      servingsPurchased: 8,
      nutrition,
      match: "user",
      note: "",
      sources: [],
      needsReview: false,
      availability: "available",
    };
    const preferenceProposal = {
      evidence: "I prefer oats for breakfast.",
      description: "Remember oats as a favorite.",
      changes: [{ field: "favorites", operation: "add", value: "oats" }],
    };
    state.meals = [];
    state.reviews = [];
    state.recipeBatches = [
      {
        id: "you-batch",
        name: "Prepared oats",
        createdAt: new Date().toISOString(),
        totalPortions: 4,
        ingredients: [
          {
            id: "ingredient",
            name: "Oats",
            servings: 4,
            servingLabel: "1/2 cup",
            nutrition: { calories: 600, protein: 20, carbs: 108, fat: 12 },
            sourceUrls: [],
          },
        ],
        nutrition: { calories: 600, protein: 20, carbs: 108, fat: 12 },
        preparationEventIds: ["prep-fixture"],
        consumptions: [],
      },
    ];
    state.groceries = [
      {
        id: "you-shop",
        fingerprint: "fixture",
        store: "Fixture market",
        date: "2026-09-26",
        note: "",
        sources: [],
        items: [
          item,
          { ...item, id: "empty", name: "Empty oats", servingsPurchased: 2 },
          {
            ...item,
            id: "unknown-1",
            name: "Unmatched rice",
            match: "unresolved",
            servingsPurchased: null,
            needsReview: true,
          },
          {
            ...item,
            id: "unknown-2",
            name: "Unmatched sauce",
            match: "unresolved",
            servingsPurchased: null,
            needsReview: true,
          },
        ],
      },
    ];
    state.pantryEvents = [
      {
        id: "used",
        lotId: "you-shop::empty",
        kind: "consumed",
        servings: -2,
        createdAt: new Date().toISOString(),
        note: "Used all servings",
      },
    ];
    state.groceries.push({
      id: "unrelated-shop",
      fingerprint: "unrelated",
      store: "Unrelated market",
      date: "2026-09-25",
      note: "",
      sources: [],
      items: [
        { ...item, id: "beans", name: "Unrelated beans", availability: "used" },
      ],
    });
    state.messages = [
      {
        id: "old-meal-proposal",
        role: "assistant",
        text: "Please review this older breakfast estimate.",
        time: "8:00 AM",
        ai: true,
        mealProposal: {
          title: "Breakfast estimate",
          category: "Breakfast",
          portion: "One bowl",
          note: "",
          sources: [],
          calories: 300,
          protein: 15,
          carbs: 40,
          fat: 9,
          components: [
            {
              name: "Oats",
              portion: "One bowl",
              nutrition: { calories: 320, protein: 15, carbs: 40, fat: 9 },
            },
          ],
        },
      },
      {
        id: "pending-preference",
        role: "assistant",
        text: "Review your favorite breakfast.",
        time: "8:01 AM",
        preferenceProposal,
        preferenceStatus: "pending",
      },
      {
        id: "pending-portion",
        role: "assistant",
        text: "Review this prepared portion.",
        time: "8:02 AM",
        recipePortionProposal: {
          batchId: "you-batch",
          portions: 1,
          category: "Lunch",
          evidence: "I ate one prepared portion.",
        },
        recipePortionProposalStatus: "pending",
      },
      {
        id: "accepted-preference",
        role: "assistant",
        text: "A saved preference.",
        time: "8:03 AM",
        preferenceProposal: {
          ...preferenceProposal,
          description: "Your saved favorite.",
        },
        preferenceStatus: "accepted",
      },
      {
        id: "dismissed-portion",
        role: "assistant",
        text: "A dismissed portion.",
        time: "8:04 AM",
        recipePortionProposal: {
          batchId: "you-batch",
          portions: 1,
          category: "Lunch",
          evidence: "Do not log this one.",
        },
        recipePortionProposalStatus: "dismissed",
      },
      ...Array.from({ length: 35 }, (_, index) => ({
        id: `later-${index}`,
        role: "assistant",
        text: `A later conversation message ${index + 1}. The earlier breakfast is still waiting for review.`,
        time: "9:00 AM",
      })),
    ];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await page.goto("/#you");
  await commitSeededRecords(page);
  await page.reload();
}

test("You counts pending Chat reviews and focuses an older proposal without accepting it", async ({
  page,
}) => {
  await prepare(page);
  await expect(
    page.getByText("4 little things to review", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("You’re all caught up.", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Breakfast estimate", exact: true }),
  ).toContainText("~320 cal");
  const original = await stored(page);
  await page
    .getByRole("region", { name: "Breakfast estimate", exact: true })
    .getByRole("button", { name: "Review in Chat" })
    .click();
  await expect(page).toHaveURL(/#chat$/);
  const source = page.locator('[data-message-id="old-meal-proposal"]');
  await expect(source).toBeFocused();
  await expect(source).toBeInViewport();
  const unchanged = await stored(page);
  expect(unchanged.messages).toEqual(original.messages);
  expect(unchanged.meals).toEqual([]);
  expect(unchanged.pantryEvents).toEqual(original.pantryEvents);
  await source
    .getByRole("button", { name: "Yep, add to Breakfast", exact: true })
    .click();
  expect((await stored(page)).meals).toHaveLength(1);
  expect((await stored(page)).meals[0].calories).toBe(320);
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(
    page.getByText("3 little things to review", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Completed · 3", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Added to Breakfast");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByText("3 little things to review", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Your preference update", exact: true })
    .getByRole("button", { name: "Review in Chat" })
    .click();
  const preference = page.locator('[data-message-id="pending-preference"]');
  await expect(preference).toBeFocused();
  await preference
    .getByRole("button", { name: "Not now", exact: true })
    .click();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(
    page.getByText("2 little things to review", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Prepared oats", exact: true })
    .getByRole("button", { name: "Review in Chat" })
    .click();
  await expect(
    page.locator('[data-message-id="pending-portion"]'),
  ).toBeFocused();
  expect((await stored(page)).recipeBatches[0].consumptions).toEqual([]);
});

test("You groups receipt checks, excludes empty pantry lots, and opens recipes and completed reviews", async ({
  page,
}) => {
  await prepare(page);
  await page
    .getByRole("button", { name: "See all 4 reviews", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Fixture market receipt", exact: true }),
  ).toContainText(
    "2 items need a match or nutrition check. This receipt counts as one review.",
  );
  await expect(
    page.getByRole("button", { name: /Groceries & pantry/ }),
  ).toContainText("1 available item · 2 amounts need a check");
  await page
    .getByRole("button", { name: "Review receipt items", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Unmatched rice");
  await expect(page.getByRole("dialog")).not.toContainText("Unrelated beans");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Recipes & leftovers/ }).click();
  await expect(page.getByRole("dialog")).toContainText("4 / 4 portions left");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Completed · 2", exact: true })
    .click();
  const completed = page.getByRole("dialog");
  await expect(completed).toContainText("Preferences saved");
  await expect(completed).toContainText("Not logged");
  await completed
    .locator("article")
    .filter({ hasText: "Your saved favorite." })
    .getByRole("button", { name: "View in Chat" })
    .click();
  await expect(
    page.locator('[data-message-id="accepted-preference"]'),
  ).toBeFocused();
  expect((await stored(page)).meals).toEqual([]);
  expect((await stored(page)).recipeBatches[0].consumptions).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
