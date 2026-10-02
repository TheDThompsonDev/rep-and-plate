import { expect, test, type Page } from "@playwright/test";
import { mockCloud } from "../../tests/cloud-fixture";

async function start(page: Page, movement = false) {
  await mockCloud(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "https://health-beta.example", token: "" }),
    ),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Alex");
  if (movement)
    await page
      .getByRole("radio", { name: "Movement & workouts", exact: true })
      .click();
  await page
    .getByRole("button", { name: "That’s me. Let’s go.", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Set this up later", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skip targets for now", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Let’s do this", exact: true })
    .click();
}

test("native first meal uses the real manual form and stays saved after reload", async ({
  page,
}) => {
  await start(page);
  await page.reload();
  await page
    .getByRole("button", { name: "Log my first meal", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Meal name", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("textbox", { name: "Meal name", exact: true })
    .fill("My lunch");
  for (const [name, value] of [
    ["calories", "500"],
    ["protein (g)", "30"],
    ["carbs (g)", "50"],
    ["fat (g)", "15"],
  ])
    await page.getByRole("textbox", { name, exact: true }).fill(value);
  await page.getByRole("button", { name: "Save meal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Log my first meal", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Log my first meal", exact: true }),
  ).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dannys-health.native.v1")!),
  );
  expect(saved.meals).toHaveLength(1);
  expect(saved.meals[0]).toMatchObject({
    title: "My lunch",
    calories: 500,
    protein: 30,
    carbs: 50,
    fat: 15,
  });
});

test("native first movement opens the actual duration form", async ({
  page,
}) => {
  await start(page, true);
  await page
    .getByRole("button", { name: "Log my first movement", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Minutes", exact: true }).fill("15");
  await page
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Log my first movement", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Log my first movement", exact: true }),
  ).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("dannys-health.native.v1")!),
  );
  expect(saved.activities).toHaveLength(1);
  expect(saved.activities[0]).toMatchObject({ title: "Walk", minutes: 15 });
  expect(saved.meals).toHaveLength(0);
});
