import { readBrowserRecords } from "./record-fixture";
import { test, expect } from "./app-fixture";
import { resultFixture } from "../e2e-shared/ai-fixtures";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: true, jev: true, model: "test-model" } }),
  );
});

test("A meal camera photo with no caption gets an estimate and keeps its photo when added", async ({ page }) => {
  const requests: Record<string, any>[] = [];
  await page.route("**/api/chat", async (route) => {
    const req = route.request().postDataJSON();
    requests.push(req);
    const result = {
      ...resultFixture(req.requestId),
      reply: "Here’s my estimate for your salmon bowl.",
      decision: "meal",
      receipt: null,
      warnings: [],
      meal: {
        title: "Salmon rice bowl",
        category: "Dinner",
        portion: "About 5 oz salmon and 1 cup rice (visual estimate)",
        note: "Cooking oil is the biggest unknown.",
        calories: 640,
        protein: 42,
        carbs: 58,
        fat: 24,
        sources: [],
      },
    };
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "result", result }) + "\n",
    });
  });
  await page.goto("/");
  const camera = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Take a meal photo" }).click();
  await (await camera).setFiles("public/images/bowl.jpg");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Your meal, ready to estimate.");
  await expect(dialog.getByRole("img", { name: "Your meal photo" })).toBeVisible();
  await dialog.getByRole("button", { name: "Estimate this meal", exact: true }).click();

  await expect(page.getByRole("button", { name: "Yep, add to Dinner", exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ captureIntent: "meal", text: "Estimate this meal from my photo." });
  expect(requests[0].image).toMatch(/^data:image\/jpeg;base64,/);
  expect((await readBrowserRecords(page)).meals).toHaveLength(0);

  await page.getByRole("button", { name: "Yep, add to Dinner", exact: true }).click();
  const card = page.getByRole("button", { name: "Edit Salmon rice bowl", exact: true });
  await expect(card.locator("img")).toHaveAttribute("src", requests[0].image);
  await page.reload();
  const saved = (await readBrowserRecords(page)).meals.at(-1);
  expect(saved).toMatchObject({ title: "Salmon rice bowl", calories: 640, image: requests[0].image });
});

test("An attached image keeps the general capture path without a meal intent", async ({ page }) => {
  const requests: Record<string, any>[] = [];
  await page.route("**/api/chat", async (route) => {
    const req = route.request().postDataJSON();
    requests.push(req);
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "result", result: { ...resultFixture(req.requestId), decision: "conversation", receipt: null, meal: null, reply: "Noted.", warnings: [] } }) + "\n",
    });
  });
  await page.goto("/");
  const attach = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Attach image or screenshot" }).click();
  await (await attach).setFiles("public/images/bowl.jpg");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("A moment, captured.");
  await dialog.getByRole("button", { name: "Send to Rep & Plate", exact: true }).click();
  await expect(page.getByText("Noted.", { exact: true })).toBeVisible();
  expect(requests[0].captureIntent).toBeUndefined();
  expect(requests[0].text).toContain("Please help me understand this photo or receipt.");
});
