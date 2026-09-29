import { test, expect, type Page } from "./app-fixture";
import type { FoodProduct } from "../src/features/products/contracts";
import { resultFixture } from "./ai-fixtures";

const original: FoodProduct = {
  id: "usda:100",
  gtin: "00012345678905",
  name: "Original black beans",
  brand: "Original",
  ingredients: "Black beans, water.",
  serving: { label: "40 g", amount: 40, unit: "g" },
  nutrition: { calories: 100, protein: 4, carbs: 20, fat: 1 },
  sugars: { total: 8, added: null },
  basis: "serving",
  source: {
    provider: "usda",
    id: "100",
    url: "https://fdc.nal.usda.gov/food-details/100/nutrients",
    fetchedAt: "2026-09-26T00:00:00Z",
    updatedAt: "2026-09-20",
    release: null,
  },
  verification: "source",
  version: "v1",
};
const alternative: FoodProduct = {
  ...original,
  id: "usda:200",
  gtin: "00098765432105",
  name: "Alternative black beans",
  brand: "Alternative",
  nutrition: { ...original.nutrition, calories: 60 },
  sugars: { total: 0, added: null },
  source: {
    ...original.source,
    id: "200",
    url: "https://fdc.nal.usda.gov/food-details/200/nutrients",
  },
};
const saved = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fuel.prototype.v1")!));
async function seed(page: Page) {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: true, jev: true, usda: true } }),
  );
  await page.route("**/api/chat", (r) => r.abort());
  await page.goto("/");
  const receipt = resultFixture("shopping-receipt").receipt!;
  receipt.items = [
    {
      ...receipt.items[0],
      id: "beans",
      name: original.name,
      productSnapshot: original,
      match: "user",
      needsReview: false,
      servingsPurchased: 10,
      serving: "40 g",
      nutrition: { calories: 100, protein: 4, carbs: 20, fat: 1 },
      price: { total: 4, discount: 0 },
    },
  ];
  receipt.purchase = {
    purchaseDate: "2026-09-25",
    currency: "USD",
    total: 4,
    subtotal: 4,
    tax: 0,
    discount: 0,
    confirmed: false,
  };
  await page.evaluate((receipt) => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    state.groceries = [receipt];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  }, receipt);
  await page.goto("/#kitchen");
  await page.reload();
}
async function open(page: Page) {
  await page.getByRole("button", { name: "Swaps, list & spending" }).click();
  await expect(
    page.getByRole("heading", { name: "Shop your way", exact: true }),
  ).toBeVisible();
}
async function swaps(page: Page) {
  await page.route("**/api/products/search", (r) =>
    r.fulfill({
      json: {
        status: "candidates",
        products: [original, alternative],
        message: "Possible products.",
      },
    }),
  );
  await open(page);
  await page
    .getByLabel("What would you like to compare?")
    .selectOption("beans");
  await page.getByRole("button", { name: "Find swaps", exact: true }).click();
  await expect(page.locator(".shopping-swap")).toHaveCount(1);
}

test("Shopping preferences save, survive reload and remain accessible from You", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Shopping preferences", exact: true })
    .click();
  await page.getByLabel("People to cook for").fill("4");
  await page.getByLabel("Shopping priority").selectOption("budget");
  await page.getByLabel("Weekly grocery budget").fill("150");
  await page.getByLabel("Budget currency").selectOption("CAD");
  await page.getByLabel("Stores you shop at").fill("Costco, Kroger");
  await page
    .getByRole("button", { name: "Save food & routine preferences" })
    .click();
  await page.reload();
  expect((await saved(page)).preferences).toMatchObject({
    householdSize: 4,
    shoppingPriority: "budget",
    weeklyBudget: 150,
    shoppingCurrency: "CAD",
    preferredStores: ["Costco", "Kroger"],
  });
  await expect(
    page.getByText("Shopping for 4.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(page).toHaveURL(/#you$/);
});

test("Reviewing receipt spending preserves quantities and daily intake", async ({
  page,
}) => {
  await seed(page);
  const before = await saved(page);
  await open(page);
  await page.getByRole("tab", { name: "Your spending" }).click();
  await expect(page.getByText("No reviewed totals yet")).toBeVisible();
  await page.locator(".shopping-trip").first().click();
  await expect(
    page.getByRole("heading", { name: "Review grocery trip" }),
  ).toBeVisible();
  await page.getByLabel("Grocery store").fill("Kroger Downtown");
  await page.getByRole("button", { name: "Save reviewed receipt" }).click();
  await expect(page.locator(".shopping-spend-total")).toContainText("$4.00");
  const after = await saved(page);
  expect(after.groceries[0].purchase.confirmed).toBe(true);
  expect(after.groceries[0].items).toEqual(before.groceries[0].items);
  expect(after.meals).toEqual(before.meals);
  await page.reload();
  await open(page);
  await page.getByRole("tab", { name: "Your spending" }).click();
  await expect(page.locator(".shopping-store-row")).toContainText(
    "Kroger Downtown",
  );
});

test("Equal-quantity swaps require a household check, add once, and never alter pantry or intake", async ({
  page,
}, info) => {
  await seed(page);
  const before = await saved(page);
  await swaps(page);
  const card = page.locator(".shopping-swap");
  await expect(card).toContainText("100 fewer cal");
  await expect(card).toContainText("20g less total sugar");
  await expect(card).toContainText("Price savings unknown");
  await expect(
    card.getByRole("button", { name: "Add to shopping list" }),
  ).toBeDisabled();
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Add to shopping list" }).click();
  await expect(
    card.getByRole("button", { name: "On your list" }),
  ).toBeDisabled();
  await page.getByRole("tab", { name: "Shopping list" }).click();
  await expect(page.locator(".shopping-list-row")).toHaveCount(1);
  await page.locator(".shopping-list-row input").check();
  expect((await saved(page)).shopping.list[0].checked).toBe(true);
  expect((await saved(page)).groceries).toEqual(before.groceries);
  expect((await saved(page)).meals).toEqual(before.meals);
  await page.screenshot({ path: info.outputPath("shopping-list.png") });
});

test("Price savings use user checked amounts, currency and dated observations", async ({
  page,
}, info) => {
  await seed(page);
  await swaps(page);
  for (const [container, price, store] of [
    [page.locator(".shopping-original"), "4", "Store A"],
    [page.locator(".shopping-swap"), "2", "Store B"],
  ] as const) {
    const editor = container.locator(".shopping-price-editor");
    await editor.locator("summary").click();
    await editor.getByLabel("Package price").fill(price);
    await editor.getByLabel("Amount covered by price").fill("400");
    await editor.getByLabel("Store and location").fill(store);
    await editor.getByRole("checkbox").check();
    await editor.getByRole("button", { name: "Save checked price" }).click();
    await editor.locator("summary").click();
  }
  await expect(page.locator(".shopping-price-result")).toContainText(
    "50% lower unit price",
  );
  await expect(page.locator(".shopping-price-result")).toContainText(
    "confirm at checkout",
  );
  await page.setViewportSize({ width: 320, height: 850 });
  const card = page.locator(".shopping-swap");
  await card.scrollIntoViewIfNeeded();
  expect(
    await page
      .getByRole("dialog")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("smart-swaps-320.png") });
});

test("Hidden suggestions persist, search errors preserve records, and list entries can be managed", async ({
  page,
}) => {
  await seed(page);
  await swaps(page);
  await page.getByRole("button", { name: "Don’t suggest this again" }).click();
  await expect(page.locator(".shopping-swap")).toHaveCount(0);
  await page.reload();
  await swapsWithoutResult(page);
  await expect(page.locator(".shopping-swap")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Reset hidden swap suggestions" })
    .click();
  await expect(page.locator(".shopping-swap")).toHaveCount(1);
  await page.route("**/api/products/search", (r) =>
    r.fulfill({ status: 503, json: { error: "Unavailable" } }),
  );
  await page.getByRole("button", { name: "Find swaps", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Could not finish");
  await page.getByRole("tab", { name: "Shopping list" }).click();
  await page.getByLabel("Item to buy").fill("Apples");
  await page.getByLabel("Amount or note").fill("6");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByRole("button", { name: "Remove Apples from list" }).click();
  await expect(page.locator(".shopping-list-row")).toHaveCount(0);
});
async function swapsWithoutResult(page: Page) {
  await open(page);
  await page
    .getByLabel("What would you like to compare?")
    .selectOption("beans");
  await page.getByRole("button", { name: "Find swaps", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Compare the labels");
}

test("Online price research remains unconfirmed until both linked offers are reviewed", async ({
  page,
}) => {
  await seed(page);
  await swaps(page);
  const quote = {
    price: 4,
    amount: 400,
    unit: "g",
    currency: "USD",
    date: "2026-09-26",
    store: "Kroger",
    conditions: "Membership required",
    confirmed: false,
    sourceUrl: "https://www.kroger.com/p/beans/00012345678905",
  };
  await page.route("**/api/shopping/prices", (r) =>
    r.fulfill({
      json: {
        quotes: {
          [original.id]: quote,
          [alternative.id]: { ...quote, price: 2 },
        },
        note: "Check these offers.",
      },
    }),
  );
  await page
    .getByRole("button", { name: "Look up store prices", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Found online prices" }),
  ).toBeVisible();
  await expect(page.locator(".shopping-price-result")).toHaveCount(0);
  for (const container of [
    page.locator(".shopping-original"),
    page.locator(".shopping-swap"),
  ]) {
    const editor = container.locator(".shopping-price-editor");
    await editor.locator("summary").click();
    await expect(
      editor.getByRole("link", { name: "Open retailer price source" }),
    ).toHaveAttribute("href", quote.sourceUrl);
    await expect(
      editor.getByText("Found online, not yet confirmed", { exact: false }),
    ).toBeVisible();
    await editor.getByRole("checkbox").check();
    await editor.getByRole("button", { name: "Save checked price" }).click();
  }
  await expect(page.locator(".shopping-price-result")).toContainText(
    "50% lower unit price",
  );
  await expect(page.locator(".shopping-price-result")).toContainText(
    "Membership required",
  );
  expect((await saved(page)).shopping.prices[original.id].confirmed).toBe(true);
});

test("A household meal plan uses pantry macros and contributes only actual shortfalls to the shopping list", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "Shopping preferences", exact: true })
    .click();
  await page.getByLabel("People to cook for").fill("2");
  await page.getByLabel("Shopping priority").selectOption("budget");
  await page.getByLabel("Weekly grocery budget").fill("150");
  await page
    .getByRole("button", { name: "Save food & routine preferences" })
    .click();
  let captured: any;
  await page.route("**/api/plans/meals", (route) => {
    const context = route.request().postDataJSON();
    captured = context;
    const start = new Date(context.startDate + "T12:00:00Z");
    return route.fulfill({
      json: {
        id: "shopping-week",
        createdAt: new Date().toISOString(),
        status: "draft",
        days: Array.from({ length: 7 }, (_, index) => {
          const day = new Date(start);
          day.setUTCDate(day.getUTCDate() + index);
          return {
            date: day.toISOString().slice(0, 10),
            meals: [
              {
                id: `beans-${index}`,
                title: "Warm bean bowl",
                category: "Dinner",
                portions: 2,
                minutes: 10,
                ingredients: [
                  {
                    lotId: "shopping-receipt::beans",
                    name: "Original black beans",
                    servingLabel: "40 g",
                    servings: 2,
                  },
                ],
                notes: "Warm the beans and divide into two portions.",
              },
            ],
          };
        }),
      },
    });
  });
  const before = await saved(page);
  await page
    .getByRole("button", { name: "Open meal planner", exact: true })
    .click();
  await page.getByRole("button", { name: "Create my week" }).click();
  await expect(page.locator(".fuel-plan-day")).toHaveCount(7);
  expect(captured.preferences).toMatchObject({
    householdSize: 2,
    weeklyBudget: 150,
    shoppingPriority: "budget",
  });
  await expect(page.locator(".fuel-plan-nutrition").first()).toContainText(
    "100 cal",
  );
  await page.getByRole("button", { name: "Approve this plan" }).click();
  await page.keyboard.press("Escape");
  await open(page);
  await page.getByRole("tab", { name: "Shopping list" }).click();
  await expect(page.locator(".shopping-original")).toContainText("4 × 40 g");
  await page.getByRole("button", { name: "Add plan needs to my list" }).click();
  await page.getByRole("button", { name: "Add plan needs to my list" }).click();
  await expect(page.locator(".shopping-list-row")).toHaveCount(1);
  await expect(page.locator(".shopping-list-row")).toContainText("4 × 40 g");
  expect((await saved(page)).meals).toEqual(before.meals);
  expect((await saved(page)).groceries).toEqual(before.groceries);
});
