import { expect, test, type Page } from "./app-fixture";

const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fuel.prototype.v1")!));
async function openRecipes(page: Page) {
  await page.getByRole("textbox", { name: "Message Rep & Plate" }).fill("recipes");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Recipes & leftovers");
}
async function setup(page: Page) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.route("**/api/chat", (route) => route.abort());
  await page.goto("/#chat");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
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
    state.meals = [];
    state.messages = [];
    state.pantryEvents = [];
    state.recipeBatches = [];
    state.groceries = [
      {
        id: "recipe-shop",
        fingerprint: "test",
        store: "Fixture market",
        date: "2026-09-25",
        note: "",
        sources: [],
        items: [
          item,
          {
            ...item,
            id: "oats",
            name: "Rolled oats",
            serving: "1/2 cup",
            servingsPurchased: 10,
            nutrition: { calories: 150, protein: 5, carbs: 27, fat: 3 },
          },
          {
            ...item,
            id: "unknown",
            name: "Brown rice",
            servingsPurchased: null,
          },
        ],
      },
    ];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await page.reload();
  await openRecipes(page);
}
test("Preparing a batch logs no intake; portions persist and undo restores the correct inventory", async ({
  page,
}) => {
  await setup(page);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Prepare a batch", exact: true })
    .click();
  await expect(
    dialog.getByRole("checkbox", { name: /^Brown rice/ }),
  ).toBeDisabled();
  expect(await dialog.locator("input[type=checkbox]:checked").count()).toBe(0);
  await dialog.getByLabel("Batch name", { exact: true }).fill("Overnight oats");
  await dialog
    .getByLabel("How many portions did the whole batch make?")
    .fill("4");
  await dialog.getByRole("checkbox", { name: /^Whole milk/ }).check();
  const milk = dialog.getByLabel("Servings of Whole milk used");
  await expect(milk).toHaveValue("");
  await dialog.getByRole("button", { name: "Confirm prepared batch" }).click();
  expect((await stored(page)).pantryEvents).toEqual([]);
  expect(
    await milk.evaluate(
      (input: HTMLInputElement) => input.validity.valueMissing,
    ),
  ).toBe(true);
  await milk.fill("2");
  await dialog.getByRole("checkbox", { name: /^Rolled oats/ }).check();
  await dialog.getByLabel("Servings of Rolled oats used").fill("4");
  await dialog.getByRole("button", { name: "Confirm prepared batch" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "no calories logged yet",
  );
  const prepared = await stored(page);
  expect(prepared.meals).toEqual([]);
  expect(
    prepared.pantryEvents.map((entry: { servings: number }) => entry.servings),
  ).toEqual([-2, -4]);
  const amount = dialog.getByLabel("How many portions did you eat?");
  await expect(amount).toHaveValue("");
  await amount.fill("1.5");
  await dialog.getByRole("button", { name: "Log eaten portion" }).click();
  await expect(dialog.getByRole("status")).toContainText("Portion logged");
  await expect(dialog).toContainText("2.5 / 4 portions left");
  await page.screenshot({ path: test.info().outputPath("recipe-batch.png") });
  await expect(amount).toHaveValue("");
  expect((await stored(page)).meals).toHaveLength(1);
  expect((await stored(page)).meals[0].calories).toBe(337.5);
  expect((await stored(page)).pantryEvents).toHaveLength(2);
  await expect(
    dialog.getByRole("button", { name: "Undo preparation", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.reload();
  await openRecipes(page);
  await expect(dialog).toContainText("2.5 / 4 portions left");
  expect((await stored(page)).meals).toHaveLength(1);
  await dialog
    .getByRole("button", { name: "Undo logged portion", exact: true })
    .click();
  expect((await stored(page)).meals).toHaveLength(1);
  await dialog
    .getByRole("button", { name: "Confirm remove logged portion" })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "prepared portions restored",
  );
  await expect(dialog).toContainText("4 / 4 portions left");
  expect((await stored(page)).meals).toEqual([]);
  expect((await stored(page)).pantryEvents).toHaveLength(2);
  await dialog
    .getByRole("button", { name: "Undo preparation", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Confirm undo preparation" })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Original ingredient quantities restored",
  );
  const undone = await stored(page);
  expect(
    undone.pantryEvents.reduce(
      (sum: number, entry: { servings: number }) => sum + entry.servings,
      0,
    ),
  ).toBe(0);
  expect(undone.meals).toEqual([]);
  await page.keyboard.press("Escape");
  await page.reload();
  await openRecipes(page);
  await expect(dialog).toContainText("Your next meal can start here");
  expect((await stored(page)).pantryEvents).toHaveLength(4);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth + 1,
    ),
  ).toBe(true);
});
