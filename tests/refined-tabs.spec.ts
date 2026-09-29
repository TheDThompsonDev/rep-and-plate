import { test, expect } from "./app-fixture";

test("refined tabs use personal records, allow dated browsing and keep their last actions reachable", async ({
  page,
}, info) => {
  await page.route("**/api/status", (r) =>
    r.fulfill({ json: { available: false, jev: false } }),
  );
  await page.goto("/");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    const day = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const meal = {
      category: "Lunch",
      time: "12:45 PM",
      source: "User confirmed",
      confidence: "confirmed",
      note: "",
      protein: 40,
      carbs: 50,
      fat: 20,
    };
    state.profile.name = "Avery";
    state.meals = [
      {
        ...meal,
        id: "actual-lunch",
        title: "Chicken, rice & broccoli",
        day: day(new Date()),
        calories: 610,
        image: "/images/chicken-dinner.png",
      },
      {
        ...meal,
        id: "actual-past",
        title: "Yesterday’s lunch",
        day: day(yesterday),
        calories: 500,
      },
    ];
    state.reviews = [];
    state.messages = [];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your day is coming together." }),
  ).toBeVisible();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("610");
  await page.getByRole("button", { name: "Previous day", exact: true }).click();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("500");
  await expect(
    page.getByRole("button", { name: "Edit Yesterday’s lunch", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return to today", exact: true })
    .click();
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("610");
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Your last seven days" }),
  ).toContainText("2 of 7 days have logs");
  await page.getByRole("button", { name: "Day", exact: true }).click();
  if (info.project.name === "mobile")
    await page.screenshot({ path: info.outputPath("refined-nutrition.png") });
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Looking ahead, Avery." }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Your recorded activity" }),
  ).toContainText("2");
  await expect(
    page.getByRole("region", { name: "Your recorded activity" }),
  ).not.toContainText("294");
  if (info.project.name === "mobile")
    await page.screenshot({ path: info.outputPath("refined-you.png") });
  await page.setViewportSize({ width: 320, height: 760 });
  await page
    .getByRole("button", { name: "About Rep & Plate", exact: false })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const surface = page.locator(".you-surface");
  await surface.evaluate((el) => (el.scrollTop = el.scrollHeight));
  const last = await page.locator(".you-chat-return").boundingBox();
  const nav = await page
    .getByRole("navigation", { name: "You navigation" })
    .boundingBox();
  expect(last!.y + last!.height).toBeLessThanOrEqual(nav!.y);
});
