import { readBrowserRecords } from "./record-fixture";
import { test, expect, type Page } from "./app-fixture";
import { resultFixture } from "./ai-fixtures";
const stored = (page: Page) =>
  readBrowserRecords(page);
const send = async (page: Page, text: string) => {
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill(text);
  await page.getByRole("button", { name: "Send message", exact: true }).click();
};
test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({
      json: { available: true, jev: true, model: "test-model" },
    }),
  );
});

test("Receipt capture researches groceries, persists edits, and does not change intake", async ({
  page,
}) => {
  const requests: Record<string, any>[] = [];
  await page.route("**/api/chat", async (route) => {
    const req = route.request().postDataJSON();
    requests.push(req);
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({ type: "progress", text: "Checking the receipt…" }) +
        "\n" +
        JSON.stringify({
          type: "result",
          result: resultFixture(req.requestId),
        }) +
        "\n",
    });
  });
  await page.goto("/");
  const before = await stored(page);
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles("tests/fixtures/grocery-receipt.png");
  await page
    .getByRole("textbox", { name: "Anything to add? (optional)" })
    .fill("My grocery receipt");
  await page
    .getByRole("button", { name: "Send to Rep & Plate", exact: true })
    .click();
  await expect(page.locator(".fuel-grocery-card")).toBeVisible();
  expect(requests[0].image).toMatch(/^data:image\/png;base64,/);
  expect((await stored(page)).meals).toEqual(before.meals);
  await page.locator(".fuel-grocery-card").click();
  await page.getByRole("button", { name: "Check purchase details" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Estimated purchase total · partial",
  );
  await page
    .locator(".fuel-grocery-item")
    .filter({ hasText: "Whole milk" })
    .locator("summary")
    .click();
  await expect(
    page.getByRole("link", { name: "Milk nutrition" }),
  ).toHaveAttribute(
    "href",
    "https://www.kroger.com/p/test-product/0001111040101",
  );
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Product name", exact: true })
    .fill("My whole milk");
  await page
    .getByRole("spinbutton", { name: "Calories per serving", exact: true })
    .fill("160");
  await page
    .getByRole("button", { name: "Save grocery details", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.reload();
  expect((await stored(page)).groceries[0].items[0].nutrition.calories).toBe(
    160,
  );
  await send(page, "Here is the same receipt again");
  await expect(
    page.getByText(
      "This receipt is already in your groceries. I’ve kept your saved items and edits.",
      { exact: true },
    ),
  ).toBeVisible();
  expect((await stored(page)).groceries).toHaveLength(1);
  expect((await stored(page)).groceries[0].items[0].name).toBe("My whole milk");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page.getByRole("button", { name: /Groceries & pantry/ }).click();
  await page.getByRole("button", { name: "Check purchase details" }).click();
  await page
    .locator(".fuel-grocery-item")
    .filter({ hasText: "My whole milk" })
    .locator("summary")
    .click();
  await page.getByRole("button", { name: "Mark used", exact: true }).click();
  await page
    .getByRole("button", { name: "What can I make with these?", exact: true })
    .click();
  await expect.poll(() => requests.length).toBe(3);
  expect(
    requests[2].context.groceries[0].items.map((i: { name: string }) => i.name),
  ).toEqual(["Oats"]);
});

test("An AI drink estimate is added to nutrition only when accepted", async ({
  page,
}) => {
  await page.route("**/api/chat", async (route) => {
    const req = route.request().postDataJSON();
    const result = {
      ...resultFixture(req.requestId),
      reply: "Here’s my estimate for your chai, including whole milk.",
      decision: "meal",
      receipt: null,
      warnings: [],
      meal: {
        title: "Chai with whole milk",
        category: "Snack",
        portion: "One 12 oz cup",
        note: "Includes milk and sweetener; adjust to your recipe.",
        calories: 180,
        protein: 6,
        carbs: 22,
        fat: 7,
        sources: [],
      },
    };
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "result", result }) + "\n",
    });
  });
  await page.goto("/");
  const before = (await stored(page)).meals.length;
  await send(page, "I drank a 12 oz chai with whole milk.");
  await expect(
    page.getByRole("button", { name: "Yep, add to Snack", exact: true }),
  ).toBeVisible();
  expect((await stored(page)).meals).toHaveLength(before);
  await page.getByRole("button", { name: "Yep, add to Snack", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Edit Chai with whole milk",
      exact: true,
    }),
  ).toBeVisible();
  expect((await stored(page)).meals).toHaveLength(before + 1);
  await page.reload();
  expect((await stored(page)).meals.at(-1).protein).toBe(6);
});

test("Failed AI capture can be retried after refresh without duplicate records", async ({
  page,
}) => {
  let attempts = 0;
  const ids: string[] = [];
  await page.route("**/api/chat", async (route) => {
    const req = route.request().postDataJSON();
    ids.push(req.requestId);
    attempts++;
    if (attempts === 1)
      return route.fulfill({
        status: 503,
        json: { error: "The AI service is temporarily unavailable." },
      });
    await route.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          result: resultFixture(req.requestId),
        }) + "\n",
    });
  });
  await page.goto("/");
  await send(page, "I bought milk and oats");
  await expect(page.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Retry this capture", exact: true })
    .click();
  await expect(page.locator(".fuel-grocery-card")).toBeVisible();
  expect(ids[1]).toBe(ids[0]);
  const state = await stored(page);
  expect(
    state.messages.filter(
      (m: { role: string; text: string }) =>
        m.role === "user" && m.text === "I bought milk and oats",
    ),
  ).toHaveLength(1);
  expect(state.groceries).toHaveLength(1);
});

test("AI text and links cannot execute embedded HTML or link to unresearched destinations", async ({
  page,
}) => {
  await page.route("**/api/chat", async (route) => {
    const req = route.request().postDataJSON();
    const result = {
      ...resultFixture(req.requestId),
      receipt: null,
      decision: "conversation",
      reply:
        "<script>window.compromised=true</script>\n\n[bad](javascript:alert(1)) [unresearched](https://example.com/collect) [source](https://www.kroger.com/p/test-product/0001111040101)",
    };
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "result", result }) + "\n",
    });
  });
  await page.goto("/");
  await send(page, "Tell me about the source");
  await expect(
    page.getByRole("link", { name: "source", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "bad", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "unresearched", exact: true }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => Object.hasOwn(window, "compromised"))).toBe(
    false,
  );
});
