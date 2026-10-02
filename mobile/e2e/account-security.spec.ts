import { test, expect } from "./app-fixture";
import { mockCloud } from "../../tests/cloud-fixture";
test.setTimeout(90000);

test("native account deletion confirms credentials and never clears records on failure", async ({
  page,
}) => {
  await mockCloud(page);
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "health.connection",
      JSON.stringify({ url: "https://health-beta.example", token: "" }),
    ),
  );
  let allow = false,
    attempts = 0;
  await page.route("**/api/account/delete", async (route) => {
    if (route.request().method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "POST,OPTIONS",
        },
      });
    attempts++;
    expect(route.request().postDataJSON()).toEqual({
      confirmation: "DELETE",
      password: "current-test-password",
    });
    await route.fulfill({
      headers: { "access-control-allow-origin": "*" },
      status: allow ? 200 : 401,
      json: allow
        ? { deleted: true }
        : { error: "Your password could not be confirmed." },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Cloud & your records", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("current-test-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).last().click();
  await page
    .getByRole("button", { name: "These device records are mine", exact: true })
    .click();
  const before = await page.evaluate(() =>
    localStorage.getItem("dannys-health.native.v1"),
  );
  const draft = 'rep-and-plate.onboarding.draft.v1.account:11111111-1111-4111-8111-111111111111';
  await page.evaluate(key => {localStorage.setItem(key,'unfinished setup');localStorage.setItem('rep-and-plate.onboarding.draft.v1.account:other','other account');},draft);
  await page
    .getByRole("button", { name: "Delete my account", exact: true })
    .click();
  const button = page.getByRole("button", {
    name: "Permanently delete account",
    exact: true,
  });
  await expect(button).toBeDisabled();
  await page
    .getByLabel("Current password", { exact: true })
    .fill("current-test-password");
  await page
    .getByLabel("Type DELETE to delete your account", { exact: true })
    .fill("DELETE");
  await button.click();
  await expect(
    page.getByText("Your password could not be confirmed.", { exact: true }),
  ).toBeVisible();
  expect(attempts).toBe(1);
  expect(
    await page.evaluate(() => localStorage.getItem("dannys-health.native.v1")),
  ).toBe(before);
  expect(await page.evaluate(key => localStorage.getItem(key),draft)).toBe('unfinished setup');
  allow = true;
  await page
    .getByLabel("Current password", { exact: true })
    .fill("current-test-password");
  await button.click();
  await expect(page.getByRole("heading", { name: /Track your food/ })).toBeVisible();
  expect(attempts).toBe(2);
  expect(await page.evaluate(key => localStorage.getItem(key),draft)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('rep-and-plate.onboarding.draft.v1.account:other'))).toBe('other account');
  expect(
    await page.evaluate(() => localStorage.getItem("health.records.owner")),
  ).toBeNull();
});
