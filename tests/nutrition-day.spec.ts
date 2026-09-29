import { test, expect, type Page } from "./app-fixture";

async function seedDay(page: Page) {
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.clock.install({ time: new Date(2026, 8, 26, 23, 59, 50) });
  await page.clock.pauseAt(new Date(2026, 8, 26, 23, 59, 50));
  await page.goto("/");
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
    const base = {
      category: "Breakfast",
      time: "9:00 AM",
      source: "User entry",
      confidence: "confirmed",
      note: "",
      calories: 795,
      protein: 61,
      carbs: 73,
      fat: 29,
    };
    state.meals = [
      { ...base, id: "real-today", title: "My breakfast", day: "2026-09-26" },
      {
        ...base,
        id: "real-yesterday",
        title: "Yesterday breakfast",
        day: "2026-09-25",
        calories: 400,
      },
      {
        ...base,
        id: "breakfast",
        title: "Example avocado toast",
        day: "2026-09-26",
        source: "Sample photo",
        calories: 390,
      },
    ];
    localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole("button", { name: "Nutrition", exact: true }).click();
}

test("personal dashboard excludes examples and preserves dated history through midnight", async ({
  page,
}, info) => {
  await seedDay(page);
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("795");
  await expect(
    page.getByRole("button", {
      name: "Edit Example avocado toast",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Your last seven days" }),
  ).toContainText("2 of 7 days have logs");
  await expect(
    page.getByRole("region", { name: "Your last seven days" }),
  ).toContainText("Not logged");
  await page
    .getByRole("button", { name: "Edit daily targets", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByLabel("Daily calories", { exact: true }).fill("1900");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(page.locator(".nutrition-ring-label")).toContainText("1,900");
  await expect(page.locator(".nutrition-remaining")).toContainText("1,105");
  if (info.project.name === "mobile")
    await page.screenshot({ path: info.outputPath("nutrition-personal.png") });
  await page.clock.fastForward(15_000);
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("0");
  await expect(page.locator(".nutrition-date")).toContainText("27");
  await page
    .getByRole("button", { name: /View Saturday, September 26/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText("My breakfast");
  await expect(page.getByRole("dialog")).toContainText("795");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  const meals = await page.evaluate(
    () => JSON.parse(localStorage.getItem("fuel.prototype.v1")!).meals,
  );
  expect(meals).toHaveLength(3);
  expect(meals.find((m: { id: string }) => m.id === "real-today").day).toBe(
    "2026-09-26",
  );
});

test("waking after a date change refreshes totals and dashboard scan opens immediately", async ({
  page,
}) => {
  await seedDay(page);
  await page.clock.setSystemTime(new Date(2026, 8, 28, 10, 0, 0));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".nutrition-ring-label strong")).toHaveText("0");
  await expect(page.locator(".nutrition-date")).toContainText("28");
  // Let the lazy-loaded scanner's scheduler run after the wake assertion.
  await page.clock.resume();
  await page
    .getByRole("button", { name: "Scan a food barcode", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("barcode");
});

test("seven-day history stays readable at 320 pixels and an empty day is unknown", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await seedDay(page);
  const week = page.getByRole("region", { name: "Your last seven days" });
  await page.getByRole("button", { name: "Week", exact: true }).click();
  await week.scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await week.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await expect(week.getByRole("button")).toHaveCount(7);
  if (info.project.name === "mobile")
    await page.screenshot({ path: info.outputPath("nutrition-week-320.png") });
  await week.getByRole("button", { name: /View Sunday, September 20/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "doesn’t tell us how much you ate",
  );
});
