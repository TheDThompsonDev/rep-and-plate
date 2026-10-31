import { openProfile } from '../../e2e-shared/profile-navigation';
import { expect, test } from "@playwright/test";
import { mockCloud } from "../../e2e-shared/cloud-fixture";

test("native goal setup saves a starting weight, supports goal edits and exposes account access from the profile icon", async ({
  page,
}) => {
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
  await page
    .getByRole("button", { name: "That’s me. Let’s go.", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What are you working toward?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Lose weight", exact: true }).click();
  await page.getByRole("button", { name: "kg", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Current weight", exact: true })
    .fill("82.5");
  await page
    .getByRole("textbox", { name: "Target weight", exact: true })
    .fill("78");
  // Optional training week in the same step.
  await page.getByRole("button", { name: "3 days", exact: true }).click();
  await page.getByRole("checkbox", { name: "Dumbbells", exact: true }).click();
  await page.getByRole("button", { name: "Some experience", exact: true }).click();
  await page
    .getByRole("button", { name: "Save my starting point", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip targets for now", exact: true }).click();
  await expect(page.getByText("Your training week", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Let’s do this", exact: true })
    .click();
  const records = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("dannys-health.native.v1")!),
    );
  expect((await records()).bodyWeights).toHaveLength(1);
  expect((await records()).profile.trainingProgram).toMatchObject({
    daysPerWeek: 3,
    equipment: ["bodyweight", "dumbbells"],
    experience: "some",
  });
  // Workouts leads with the week; the next session starts with loads the person confirms.
  await page.getByRole("button", { name: "Workouts", exact: true }).click();
  await expect(page.getByText("Your week", { exact: true })).toBeVisible();
  await expect(page.getByText("Session 1 · Upper Body · Next up", { exact: true })).toBeVisible();
  await expect(page.getByText(/Dumbbell Bench Press 3 × 8/)).toBeVisible();
  await page.getByRole("button", { name: "Start Session 1 · Upper Body", exact: true }).click();
  await expect(page.getByText("Session 1 · Upper Body", { exact: true })).toBeVisible();
  const started = (await records()).workout;
  expect(started.status).toBe("active");
  expect(started.exercises[0]).toMatchObject({ name: "Dumbbell Bench Press", weight: 0, weightConfirmed: false });
  await openProfile(page);
  await expect(
    page.getByText("Lose weight · Target: 78 kg · Weekly check-ins", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit your goal", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Target weight", exact: true })
    .fill("77");
  await page
    .getByRole("button", { name: "Save my starting point", exact: true })
    .click();
  await expect(
    page.getByText("Lose weight · Target: 77 kg · Weekly check-ins", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await openProfile(page);
  await expect(
    page.getByText("Lose weight · Target: 77 kg · Weekly check-ins", {
      exact: true,
    }),
  ).toBeVisible();
  expect((await records()).bodyWeights).toHaveLength(1);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("fixture@example.test");
  await page
    .getByRole("textbox", { name: "Password", exact: true })
    .fill("test-password-only");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "These device records are mine", exact: true })
    .click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect((await records()).bodyWeights).toHaveLength(1);
});
