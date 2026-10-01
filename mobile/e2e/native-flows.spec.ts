import { test, expect } from "./app-fixture";
import { resultFixture } from "../../tests/ai-fixtures";
const key = "dannys-health.native.v1";
test("native shell preserves chat draft, opens receipt capture and saves household settings", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("Keep my draft");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await expect(page.getByText("What sounds good tonight?")).toBeVisible();
  await page
    .getByRole("button", { name: "Add a receipt", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Take a photo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose a photo", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toHaveValue("Keep my draft");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Food & household preferences", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "People in your household" })
    .fill("3");
  await page.getByRole("button", {name:"Shopping", exact:true}).click();
  await page
    .getByRole("textbox", { name: "Weekly grocery budget (optional)" })
    .fill("150");
  await page.getByRole("button", {name:"Food", exact:true}).click();
  await page
    .getByRole("textbox", { name: "Favorite foods (comma separated)" })
    .pressSequentially("rice, beans");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  const state = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(state.preferences.favorites).toEqual(["rice", "beans"]);
  expect(state.preferences.householdSize).toBe(3);
  expect(state.preferences.weeklyBudget).toBe(150);
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(
    page.getByText("Nothing here yet.").first(),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("native-nutrition.png") });
  expect(errors).toEqual([]);
});
test("native chat uses the API and groceries remain separate from daily intake", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "http://127.0.0.1:5174", token: "a".repeat(64) }),
    ),
  );
  await page.route("**/api/chat", async (r) => {
    const req = r.request().postDataJSON();
    await r.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          result: resultFixture(req.requestId),
        }) + "\n",
    });
  });
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("I bought these groceries");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review groceries", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Review groceries", exact: true })
    .click();
  await expect(page.getByText("Whole milk", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page
    .getByRole("button", { name: "Swaps, list & spending", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Add to shopping list" })
    .fill("Brown rice");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "○ Brown rice", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  const state = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(state.groceries).toHaveLength(1);
  expect(state.meals).toHaveLength(0);
  expect(state.shopping.list[0].name).toBe("Brown rice");
});
test("native workout logs sets and persists session", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await page
    .getByRole("button", { name: "Start Upper Body", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Bench Press set 1 weight (lb)" }).fill("45");
  await page.getByRole("textbox", { name: "Bench Press set 1 reps" }).fill("7");
  await page
    .getByRole("button", { name: "Save Bench Press set 1", exact: true })
    .click();
  await expect(page.getByRole("textbox", { name: "Bench Press set 1 reps", exact: true })).toHaveValue("7");
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page.getByRole("button",{name:"Save finished workout",exact:true}).click();
  await page.reload();
  const state = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)!),
    key,
  );
  expect(state.workout.status).toBe("finished");
  expect(state.workout.exercises[0].sets[0]).toBe(7);
});

const product = {
  id: "usda-123",
  gtin: "00012345678905",
  name: "Test oats",
  brand: "Oat Farm",
  ingredients: "Whole grain oats",
  serving: { label: "1/2 cup", amount: 40, unit: "g" },
  nutrition: { calories: 150, protein: 5, carbs: 27, fat: 3 },
  basis: "serving",
  source: {
    provider: "usda",
    id: "123",
    url: "https://fdc.nal.usda.gov/food-details/123/nutrients",
    fetchedAt: "2026-09-25T12:00:00Z",
    updatedAt: null,
    release: null,
  },
  verification: "source",
  version: "2026-09",
};
test("native barcode confirmation keeps purchases separate and exports a portable backup", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "http://127.0.0.1:5174", token: "a".repeat(64) }),
    ),
  );
  await page.route("**/api/products/lookup", (r) =>
    r.fulfill({
      json: { status: "found", products: [product], message: "USDA match" },
    }),
  );
  await page.route("**/api/cloud/config", (r) =>
    r.fulfill({ json: { enabled: false } }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Scan a barcode", exact: true })
    .last()
    .click();
  await page
    .getByRole("textbox", { name: "Barcode number" })
    .fill("012345678905");
  await page
    .getByRole("button", { name: "Look up barcode", exact: true })
    .click();
  await expect(page.getByText("Test oats", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Number of labeled servings" })
    .fill("4");
  await page
    .getByRole("button", { name: "Add to groceries", exact: true })
    .click();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Cloud & your records", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export this device", exact: true })
    .click();
  const download = await downloadPromise;
  const path = await download.path();
  const fs = await import("node:fs/promises");
  const backup = JSON.parse(await fs.readFile(path!, "utf8"));
  expect(backup.state.groceries.at(-1).items[0].servingsPurchased).toBe(4);
  expect(backup.state.meals).toHaveLength(0);
  const chooserPromise = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import a backup file", exact: true })
    .click();
  await (
    await chooserPromise
  ).setFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(
    page.getByText("Replace this phone’s records?", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restore these records", exact: true })
    .click();
  await expect(
    page.getByText("Records restored on this device.", { exact: true }).first(),
  ).toBeVisible();
});
