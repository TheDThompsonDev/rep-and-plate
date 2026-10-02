import { test, expect } from "@playwright/test";
import { mockCloud } from "../../tests/cloud-fixture";
test.setTimeout(60000);

test('native interaction guide previews are isolated and lead to a real saved meal', async ({ page }, info) => {
  await page.setViewportSize({ width: 320, height: 800 });
  let aiRequests = 0;
  page.on('request', request => { if (/\/api\/(chat|capture)/.test(request.url())) aiRequests++; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Meet Spot', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Here’s what you can do with me.' })).toBeVisible();
  await expect(page.getByText('Estimated calories & macros', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Workout example', exact: true }).click();
  await expect(page.getByText('3 sets × 8 reps · 135 lb', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Receipt example', exact: true }).click();
  await expect(page.getByText(/Purchases never count as food eaten/)).toBeVisible();
  await page.screenshot({ path: info.outputPath('native-interaction-guide.png'), fullPage: true });
  await page.getByRole('button', { name: 'Set up my tracking', exact: true }).click();
  await page.getByRole('button', { name: 'Try on this device first' }).click();
  await expect(page.getByRole('radio', { name: 'A little of all three', exact: true })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveText(['Food & meals', 'Movement & workouts', 'Groceries & dinner', 'A little of all three']);
  const next = page.getByRole('button', { name: 'That’s me. Let’s go.', exact: true });
  await expect(next).toBeDisabled();
  const name = page.getByRole('textbox', { name: 'Your name', exact: true });
  await name.fill('   ');
  await expect(next).toBeDisabled();
  await name.fill('  Alex  ');
  await expect(next).toBeEnabled();
  await page.getByRole('button', { name: 'That’s me. Let’s go.' }).click();
  await page.getByRole('button', { name: 'Set this up later', exact: true }).click();
  await page.getByRole("button", { name: "Skip targets for now", exact: true }).click();

  await expect(page.getByText('Start with a meal, a workout, or a grocery receipt. You can use all three at your own pace.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Let’s do this' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rep-and-plate.onboarding.v1')!).focus)).toBe('A little of all three');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dannys-health.native.v1')!).profile.name)).toBe('Alex');
  const composer = page.getByRole('textbox', { name: 'Message Rep & Plate' });
  await expect(composer).toHaveValue('');
  const records = () => page.evaluate(() => JSON.parse(localStorage.getItem('dannys-health.native.v1')!));
  const before = await records();
  await composer.fill('My real lunch draft');
  await page.getByRole('button', { name: 'What can I say to Spot?', exact: true }).click();
  await page.getByRole('button', { name: 'Workout example', exact: true }).click();
  await page.getByRole('button', { name: 'Use my own words', exact: true }).click();
  await expect(composer).toHaveValue('My real lunch draft');
  await expect(composer).toBeFocused();
  const after = await records();
  for (const key of ['meals', 'messages', 'groceries', 'workout']) expect(after[key]).toEqual(before[key]);
  expect(aiRequests).toBe(0);
  await page.getByRole('button', { name: 'What can I say to Spot?', exact: true }).click();
  await page.getByRole('button', { name: 'Enter a meal manually', exact: true }).click();
  await page.getByRole('textbox', { name: 'Meal name', exact: true }).fill('My lunch');
  for (const [label, value] of [['calories', '400'], ['protein (g)', '25'], ['carbs (g)', '40'], ['fat (g)', '15']])
    await page.getByRole('textbox', { name: label, exact: true }).fill(value);
  expect((await records()).meals).toEqual(before.meals);
  await page.getByRole('button', { name: 'Save meal', exact: true }).click();
  expect((await records()).meals).toHaveLength(before.meals.length + 1);
  await page.reload();
  expect((await records()).meals.at(-1).title).toBe('My lunch');
  await expect(page.getByRole('button', { name: 'What can I say to Spot?', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("native first launch introduces Spot, creates an account, confirms and signs out", async ({
  page,
}) => {
  const cloud = await mockCloud(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "https://health-beta.example", token: "" }),
    ),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Track your food. Build your fitness. With a little help from Spot.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Meet Spot", exact: true }).click();
  for (const heading of [
    "Hey. I’m Spot.",
    "Here’s what you can do with me.",
    "Give your groceries a plan.",
    "Tell me what you ate.",
    "Tell me what you did.",
    "We do real life here.",
  ]) {
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    if (heading === "Here’s what you can do with me.")
      await page.getByRole("button", { name: "More about Spot", exact: true }).click();
    else if (heading !== "We do real life here.")
      await page.getByRole("button", { name: "Next", exact: true }).click();
  }
  await page.getByRole("button", { name: "Let’s make this official" }).click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByText(
      "Check your email to confirm your account, then return here to sign in.",
    ),
  ).toBeVisible();
  expect(cloud.signups).toBe(1);
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page
    .getByRole("textbox", { name: "Your name" })
    .fill("Alex");
  await page
    .getByRole("checkbox", { name: "These device records are mine" })
    .click();
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await page.getByRole('button', { name: 'Set this up later', exact: true }).click();
  await page.getByRole("button", { name: "Skip targets for now", exact: true }).click();

  await page.getByRole("button", { name: "Let’s do this" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Cloud & your records", exact: true })
    .click();
  await page.getByRole("button", { name: "Sign out", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: /Track your food/ })).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Try on this device first" }),
  ).toHaveCount(0);
  await expect.poll(() => cloud.saveCalls).toBeGreaterThanOrEqual(1);
});

test("native local setup and returning launch work without an account connection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page.getByRole("textbox", { name: "Your name" }).fill("Sam");
  await page.getByRole("radio", { name: "Food & meals" }).click();
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await page.getByRole('button', { name: 'Set this up later', exact: true }).click();
  await page.getByRole("button", { name: "Skip targets for now", exact: true }).click();

  await page.getByRole("button", { name: "Let’s do this" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("native onboarding stays open when the profile cannot be saved and can retry", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByRole("button", { name: "Try on this device first" }).click();
  await page.getByRole("textbox", { name: "Your name" }).fill("Sam");
  await page.getByRole("button", { name: "That’s me. Let’s go." }).click();
  await page.getByRole('button', { name: 'Set this up later', exact: true }).click();
  await page.getByRole("button", { name: "Skip targets for now", exact: true }).click();

  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === "dannys-health.native.v1") {
        Storage.prototype.setItem = original;
        throw new Error("Device storage is full. Please try again.");
      }
      return original.call(this, key, value);
    };
  });
  await page.getByRole("button", { name: "Let’s do this" }).click();
  await expect(
    page.getByText("Device storage is full. Please try again."),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      localStorage.getItem("rep-and-plate.onboarding.v1"),
    ),
  ).toBeNull();
  await page.getByRole("button", { name: "Let’s do this" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("dannys-health.native.v1")!).profile
          .name,
    ),
  ).toBe("Sam");
});
