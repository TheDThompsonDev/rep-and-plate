import { test, expect } from "@playwright/test";

test("every page opens barcode scanning directly without changing records", async ({
  page,
}) => {
  let chatCalls = 0;
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.route("**/api/chat", (route) => {
    chatCalls++;
    return route.abort();
  });
  await page.goto("/#chat");
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
  );
  for (const name of ["Chat", "Nutrition", "Workouts", "Kitchen", "You"]) {
    if (name === "You")
      await page
        .getByRole("button", { name: "Your profile", exact: true })
        .click();
    else
      await page
        .locator(".fuel-tabs")
        .getByRole("button", { name, exact: true })
        .click();
    const navigation = page.getByRole("navigation", {
      name: `${name} navigation`,
    });
    await expect(navigation.getByRole("button")).toHaveCount(5);
    await expect(navigation.getByRole("button")).toHaveText([
      "Chat",
      "Nutrition",
      "Scan",
      "Workouts",
      "Kitchen",
    ]);
    await expect(
      name === "You"
        ? page.getByRole("button", { name: "Your profile", exact: true })
        : navigation.getByRole("button", { name, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await navigation
      .getByRole("button", { name: "Scan a barcode", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Scan a food barcode", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
      ),
    ).toMatchObject({
      meals: before.meals,
      workout: before.workout,
      messages: before.messages,
    });
  }
  expect(chatCalls).toBe(0);
});

test("chat barcode capture stays usable beside photo, attachment and voice at 320 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  let chatCalls = 0;
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.route("**/api/chat", (route) => {
    chatCalls++;
    return route.abort();
  });
  await page.goto("/#chat");
  const composer = page.locator(".fuel-composer");
  for (const name of [
    "Scan a barcode in chat",
    "Take a meal photo",
    "Attach image or screenshot",
    "Use voice",
  ]) {
    const control = composer.getByRole("button", { name, exact: true });
    await expect(control).toBeVisible();
    await expect(control).toBeInViewport();
    const box = await control.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(32);
    expect(box!.height).toBeGreaterThanOrEqual(32);
  }
  const input = page.getByRole("textbox", {
    name: "Message Rep & Plate",
    exact: true,
  });
  expect((await input.boundingBox())!.width).toBeGreaterThanOrEqual(65);
  await input.fill("Keep this draft while I scan");
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
  );
  await composer
    .getByRole("button", { name: "Scan a barcode in chat", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Scan a food barcode", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(input).toHaveValue("Keep this draft while I scan");
  await expect(
    composer.getByRole("button", { name: "Send message", exact: true }),
  ).toBeInViewport();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
    ),
  ).toEqual(before);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(chatCalls).toBe(0);
});
