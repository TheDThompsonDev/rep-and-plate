import { test, expect } from "./app-fixture";
import { commitSeededRecords, readBrowserRecords } from "./record-fixture";
import { resultFixture } from "./ai-fixtures";
import { mockCloud } from "./cloud-fixture";

test("receipt entry explains the payoff and its example never changes records", async ({
  page,
}) => {
  await page.goto("/");
  const before = await readBrowserRecords(page);
  await expect(
    page.getByRole("region", { name: "From groceries to dinner" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "See a receipt example", exact: true })
    .click();
  const example = page.getByRole("dialog", {
    name: "A receipt to dinner example",
  });
  await expect(example).toContainText("Example only");
  await example
    .getByRole("button", { name: "See dinner ideas", exact: true })
    .click();
  await expect(example).toContainText("Chicken, rice & broccoli");
  await example
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  expect(await readBrowserRecords(page)).toEqual(before);
});

test("a saved receipt survives refresh and can be read once without another upload", async ({
  page,
}) => {
  let available = false;
  const requests: any[] = [];
  let finishDinner: () => void = () => {};
  const dinnerGate = new Promise<void>((resolve) => {
    finishDinner = resolve;
  });
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available, jev: false } }),
  );
  await page.route("**/api/chat", async (r) => {
    const body = r.request().postDataJSON();
    requests.push(body);
    const result = resultFixture(body.requestId);
    if (requests.length > 1) {
      await dinnerGate;
      result.receipt = null;
      result.decision = "conversation";
      result.reply = "Here is a dinner idea using your checked groceries.";
    }
    return r.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "result", result }) + "\n",
    });
  });
  await page.goto("/#kitchen");
  const before = await readBrowserRecords(page);
  await page
    .getByRole("button", { name: "Add a receipt", exact: true })
    .click();
  await page
    .locator("input[capture=environment]")
    .setInputFiles("tests/fixtures/grocery-receipt.png");
  await page
    .getByRole("button", { name: "Save my image for review", exact: true })
    .click();
  available = true;
  await page.reload();
  const read = page.getByRole("button", {
    name: "Read this receipt",
    exact: true,
  });
  await expect(read).toBeEnabled();
  await read.click();
  await expect(page.locator(".fuel-grocery-card")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].image).toMatch(/^data:image/);
  const after = await readBrowserRecords(page);
  expect(after.meals).toEqual(before.meals);
  expect(after.groceries).toHaveLength(1);
  expect(after.reviews.filter((r) => !r.resolved)).toHaveLength(0);
  await expect(
    page.getByRole("button", {
      name: "Choose dinner from these groceries",
      exact: true,
    }),
  ).toBeVisible();
  await page.locator(".fuel-grocery-card").click();
  await page
    .getByRole("button", { name: "Check purchase details", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review store, date & prices", exact: true })
    .click();
  await page
    .getByText("Compare with original receipt", { exact: true })
    .click();
  await expect(page.getByAltText("Original grocery receipt")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page
    .getByRole("dialog", { name: "Your pantry", exact: true })
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page
    .getByRole("button", { name: "Review receipt spending", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("spending");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await page
    .getByRole("button", {
      name: "Choose dinner from these groceries",
      exact: true,
    })
    .click();
  await expect.poll(() => requests.length).toBe(2);
  await page
    .getByRole("button", {
      name: "Choose dinner from these groceries",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toHaveValue(/Kroger receipt/);
  expect(requests).toHaveLength(2);
  finishDinner();
  await expect(
    page.getByText("Here is a dinner idea using your checked groceries.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(requests[1].text).toContain("Kroger receipt");
  expect(requests[1].text).toContain(
    "do not log a meal or change pantry stock",
  );
  const afterDinner = await readBrowserRecords(page);
  expect(afterDinner.meals).toEqual(before.meals);
  expect(afterDinner.pantryEvents).toEqual(after.pantryEvents);
});

test("used groceries do not block checks and an empty pantry invites the next receipt", async ({
  page,
}) => {
  await page.goto("/#kitchen");
  const receipt = resultFixture("used").receipt!;
  receipt.items.forEach((item) => {
    item.availability = "used";
  });
  await page.evaluate((receipt) => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    state.groceries = [receipt];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  }, receipt);
  await commitSeededRecords(page);
  await page.reload();
  const guide = page.getByRole("region", { name: "Your first useful week" });
  await expect(guide).toContainText("Your recorded groceries are used up");
  await guide
    .getByRole("button", { name: "Add my next grocery receipt", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Add a grocery receipt" }),
  ).toBeVisible();
});

test("guest receipt preview survives account cancellation and explicit guest linking", async ({
  page,
  baseURL,
}) => {
  const origin = "https://repandplate.test";
  await page.route(`${origin}/**`, async (route) => {
    const response = await route.fetch({
      url: route.request().url().replace(origin, baseURL!),
    });
    await route.fulfill({ response });
  });
  await mockCloud(page);
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: true, jev: false } }),
  );
  await page.goto(`${origin}/#kitchen`);
  await page
    .getByRole("button", { name: "Add a receipt", exact: true })
    .click();
  await page
    .locator("input[capture=environment]")
    .setInputFiles("tests/fixtures/grocery-receipt.png");
  await page.getByLabel("Anything to add? (optional)").fill("Two grocery bags");
  await page
    .getByRole("button", { name: "Sign in to read receipts", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close dialog" })
    .click();
  await expect(page.getByAltText("Your grocery receipt")).toBeVisible();
  await expect(page.getByLabel("Anything to add? (optional)")).toHaveValue(
    "Two grocery bags",
  );
  await page
    .getByRole("button", { name: "Sign in to read receipts", exact: true })
    .click();
  const account = page.getByRole("dialog");
  await account
    .getByLabel("Email", { exact: true })
    .fill("fixture@example.test");
  await account
    .getByLabel("Password", { exact: true })
    .fill("test-password-only");
  await account.getByRole("button", { name: "Sign in", exact: true }).click();
  await account
    .getByRole("button", { name: "These device records are mine" })
    .click();
  await expect(page.getByAltText("Your grocery receipt")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Read my receipt", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Anything to add? (optional)")).toHaveValue(
    "Two grocery bags",
  );
  await expect(page.getByRole("dialog")).toContainText("private account copy");
});

test("an inconclusive saved receipt can be read again with a fresh request and retained photo", async ({
  page,
}) => {
  let available = false;
  const requests: any[] = [];
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available, jev: false } }),
  );
  await page.route("**/api/chat", (r) => {
    const body = r.request().postDataJSON();
    requests.push(body);
    const result = resultFixture(body.requestId);
    if (requests.length === 1) {
      result.receipt = null;
      result.decision = "uncertain";
      result.reply = "The photo was unclear. Try a clearer receipt.";
    }
    return r.fulfill({
      contentType: "application/x-ndjson",
      body: JSON.stringify({ type: "result", result }) + "\n",
    });
  });
  await page.goto("/#kitchen");
  await page
    .getByRole("button", { name: "Add a receipt", exact: true })
    .click();
  await page
    .locator("input[capture=environment]")
    .setInputFiles("tests/fixtures/grocery-receipt.png");
  await page
    .getByRole("button", { name: "Save my image for review", exact: true })
    .click();
  available = true;
  await page.reload();
  await page
    .getByRole("button", { name: "Read this receipt", exact: true })
    .click();
  await expect(
    page.getByText("The photo was unclear. Try a clearer receipt.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Read this receipt again", exact: true })
    .click();
  await expect(page.locator(".fuel-grocery-card")).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1].requestId).not.toBe(requests[0].requestId);
  expect(requests[1].image).toEqual(requests[0].image);
  const records = await readBrowserRecords(page);
  expect(records.meals).toHaveLength(0);
  expect(records.groceries).toHaveLength(1);
  expect(records.reviews.filter((r) => !r.resolved)).toHaveLength(0);
});

test("a quantity-history rejection keeps the correction draft and offers pantry adjustment", async ({
  page,
}) => {
  await page.goto("/");
  const receipt = resultFixture("history").receipt!;
  receipt.store = "History market";
  receipt.items = [receipt.items[0]];
  await page.evaluate((receipt) => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    state.groceries = [receipt];
    state.pantryEvents = [
      {
        id: "earlier-adjustment",
        lotId: "history::history-0",
        kind: "adjusted",
        servings: -1,
        createdAt: "2026-09-25T12:00:00Z",
        note: "Earlier adjustment",
      },
    ];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  }, receipt);
  await commitSeededRecords(page);
  await page.reload();
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page.getByRole("button", { name: /^History market/ }).click();
  await page
    .getByRole("button", { name: "Check purchase details", exact: true })
    .click();
  await page.locator("summary").filter({ hasText: "Whole milk" }).click();
  await page.getByRole("button", { name: "Edit details", exact: true }).click();
  await page
    .getByLabel("Product name", { exact: true })
    .fill("My corrected product");
  await page
    .getByRole("button", { name: "Save grocery details", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("quantity history");
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "Check this grocery item",
  );
  await expect(page.getByLabel("Product name", { exact: true })).toHaveValue(
    "My corrected product",
  );
  await page
    .getByRole("button", {
      name: "Adjust remaining amount instead",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toHaveAttribute(
    "aria-label",
    "How much is left?",
  );
  expect((await readBrowserRecords(page)).groceries![0].items[0].name).toBe(
    "Whole milk",
  );
});
