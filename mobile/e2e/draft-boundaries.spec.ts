import { test, expect } from "./app-fixture";
import { initialState } from "../../src/domain";
import { shiftPlanDate } from "../../src/features/planning/recurring-plans";

test("import discards recipe draft and a closed planner cannot append a late result", async ({
  page,
}) => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "http://127.0.0.1:5174", token: "a".repeat(64) }),
    ),
  );
  await page.route("**/api/plans/meals", async (route) => {
    const input = route.request().postDataJSON();
    requested();
    await ready;
    await route.fulfill({
      json: {
        id: "late-prior-plan",
        status: "draft",
        createdAt: new Date().toISOString(),
        days: Array.from({ length: 7 }, (_, i) => ({
          date: shiftPlanDate(input.startDate, i),
          meals: [
            {
              id: `meal-${i}`,
              title: ["Oat bowl", "Oat pancakes", "Oat soup"][i % 3],
              category: "Dinner",
              portions: input.preferences.householdSize,
              minutes: 15,
              ingredients: [
                {
                  lotId: null,
                  name: "Oats",
                  servings: 1,
                  servingLabel: "40 g",
                },
              ],
              notes: "Cook until ready.",
            },
          ],
        })),
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page
    .getByRole("button", { name: "Recipes & leftovers", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Recipe name", exact: true })
    .fill("Prior copy draft");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Your week of meals", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Generate meal plan", exact: true })
    .click();
  await requestStarted;
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Cloud & your records", exact: true })
    .click();
  const file = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Import a backup file", exact: true })
    .click();
  const replacement = initialState();
  replacement.profile.name = "Replacement copy";
  await (
    await file
  ).setFiles({
    name: "replacement.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(replacement)),
  });
  await page
    .getByRole("button", { name: "Restore these records", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("dannys-health.native.v1")!).profile
            .name,
      ),
    )
    .toBe("Replacement copy");
  const completed = page.waitForResponse("**/api/plans/meals");
  release();
  await completed;
  if (await page.getByRole("button", { name: "Close", exact: true }).count())
    await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Kitchen", exact: true }).click();
  await page
    .getByRole("button", { name: "Recipes & leftovers", exact: true })
    .click();
  await expect
    .soft(page.getByRole("textbox", { name: "Recipe name", exact: true }))
    .toHaveValue("");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Your week of meals", exact: true })
    .click();
  await expect
    .soft(
      page.getByRole("textbox", { name: "Planned meal title", exact: true }),
    )
    .toHaveCount(0);
  const plans = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("dannys-health.native.v1")!).mealPlans ??
      [],
  );
  expect(plans).toEqual([]);
});
