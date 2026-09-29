import {commitSeededRecords, readBrowserRecords } from "./record-fixture";
import { test, expect, type Page } from "./app-fixture";

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
    const meal = {
      category: "Breakfast",
      time: "8:30 AM",
      day: "2026-09-26",
      confidence: "estimated",
      example: false,
      id: "pantry-link-meal",
      title: "Oats with milk",
      source: "Photo estimate",
      note: "",
      calories: 250,
      protein: 12,
      carbs: 30,
      fat: 9,
    };
    const item = {
      id: "milk",
      receiptText: "MILK",
      name: "Whole milk",
      quantity: "1 carton",
      serving: "1 cup",
      servingsPurchased: 8,
      nutrition: { calories: 150, protein: 8, carbs: 12, fat: 8 },
      match: "user",
      note: "",
      sources: [],
      needsReview: false,
      availability: "available",
    };
    state.meals = [meal];
    state.messages = [
      {
        id: "meal-message",
        role: "assistant",
        text: "Here is your logged meal.",
        time: "8:30 AM",
        mealId: meal.id,
      },
    ];
    state.pantryEvents = [];
    state.groceries = [
      {
        id: "link-shop",
        fingerprint: "fixture-only",
        store: "Fixture market",
        date: "2026-09-25",
        note: "",
        sources: [],
        items: [
          item,
          { ...item, id: "almond", name: "Almond milk", serving: "1 cup" },
          {
            ...item,
            id: "oats",
            name: "Rolled oats",
            serving: "1/2 cup",
            servingsPurchased: 20,
          },
          {
            ...item,
            id: "rice",
            name: "Brown rice",
            serving: "1 cup cooked",
            servingsPurchased: null,
          },
          {
            ...item,
            id: "peanut",
            name: "Peanut butter",
            serving: "2 tbsp",
            servingsPurchased: 10,
          },
        ],
      },
    ];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await commitSeededRecords(page);
  await page.reload();
  await page
    .getByRole("button", { name: "Which pantry ingredients did you use?" })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Did you use your groceries?",
  );
}

test("Ingredient suggestions start empty; confirmed fractions deduct once and undo preserves intake", async ({
  page,
}) => {
  await prepare(page);
  const before = await stored(page);
  const dialog = page.getByRole("dialog");
  expect(await dialog.getByRole("checkbox").count()).toBe(3);
  expect(await dialog.locator("input[type=checkbox]:checked").count()).toBe(0);
  expect((await stored(page)).pantryEvents).toEqual([]);
  await dialog.getByRole("checkbox", { name: /^Whole milk/ }).check();
  const amount = dialog.getByRole("spinbutton", {
    name: /How many servings did you use/,
  });
  await expect(amount).toHaveValue("");
  await dialog
    .getByRole("button", { name: "Confirm ingredients used" })
    .click();
  expect(
    await amount.evaluate(
      (input: HTMLInputElement) => input.validity.valueMissing,
    ),
  ).toBe(true);
  expect((await stored(page)).pantryEvents).toEqual([]);
  await amount.fill("0.5");
  await dialog
    .getByRole("button", { name: "Confirm ingredients used" })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Ingredients linked");
  const linked = await stored(page);
  expect(linked.meals).toHaveLength(1);
  expect(linked.meals[0].calories).toBe(before.meals[0].calories);
  expect(linked.meals[0].components[0]).toMatchObject({
    lotId: "link-shop::milk",
    servings: 0.5,
    nutrition: { calories: 75 },
  });
  expect(linked.pantryEvents).toHaveLength(1);
  expect(linked.pantryEvents[0].servings).toBe(-0.5);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "Review pantry links" }).click();
  await expect(dialog).toContainText("0.5 servings used");
  expect((await stored(page)).pantryEvents).toHaveLength(1);
  await dialog.getByRole("button", { name: "Undo ingredient links" }).click();
  expect((await stored(page)).pantryEvents).toHaveLength(1);
  await dialog.getByRole("button", { name: "Restore pantry portions" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Pantry portions restored",
  );
  const undone = await stored(page);
  expect(undone.meals).toHaveLength(1);
  expect(undone.meals[0].calories).toBe(before.meals[0].calories);
  expect(
    undone.pantryEvents.reduce(
      (sum: number, event: { servings: number }) => sum + event.servings,
      0,
    ),
  ).toBe(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await page
    .getByRole("button", { name: "Which pantry ingredients did you use?" })
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: /^Whole milk/ }),
  ).not.toBeChecked();
  expect((await stored(page)).pantryEvents).toHaveLength(2);
});

test("Ambiguous names are explained and users can choose another known purchase", async ({
  page,
}) => {
  await prepare(page);
  const dialog = page.getByRole("dialog");
  await expect(
    dialog
      .getByText(
        "More than one purchase shares this name. Check the product and purchase date.",
      )
      .first(),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Choose another pantry item" })
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: /^Brown rice/ }),
  ).toBeDisabled();
  await expect(dialog).toContainText(
    "The number of servings available is unknown",
  );
  await dialog.getByRole("checkbox", { name: /^Peanut butter/ }).check();
  const amount = dialog.getByRole("spinbutton", {
    name: /How many servings did you use/,
  });
  await expect(amount).toHaveValue("");
  await amount.fill("0.25");
  await dialog
    .getByRole("button", { name: "Confirm ingredients used" })
    .click();
  await expect(dialog.getByRole("status")).toContainText("Ingredients linked");
  const state = await stored(page);
  expect(state.meals).toHaveLength(1);
  expect(state.meals[0].calories).toBe(250);
  expect(state.pantryEvents[0]).toMatchObject({
    lotId: "link-shop::peanut",
    servings: -0.25,
  });
  expect(state.pantryEvents).toHaveLength(1);
});
