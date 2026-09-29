import { test, expect } from "./app-fixture";
import { mockCloud, openAccount, signIn, stored } from "./cloud-fixture";

test("full account deletion requires confirmation and preserves records after failed reauthentication", async ({
  page,
}) => {
  await mockCloud(page);
  let attempts = 0,
    allow = false;
  await page.route("**/api/account/delete", async (route) => {
    attempts++;
    const body = route.request().postDataJSON();
    expect(body).toEqual({
      confirmation: "DELETE",
      password: "current-test-password",
    });
    expect(route.request().headers().authorization).toMatch(/^Bearer /);
    await route.fulfill(
      allow
        ? { json: { deleted: true } }
        : {
            status: 401,
            json: {
              error:
                "Your password could not be confirmed. Your account has not been deleted.",
            },
          },
    );
  });
  await openAccount(page);
  await signIn(page);
  await page.evaluate(() =>
    localStorage.setItem(
      "health.records.owner",
      "https://fuelcloudtest.supabase.co:11111111-1111-4111-8111-111111111111",
    ),
  );
  const before = await stored(page);
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
    page.getByText(
      "Your password could not be confirmed. Your account has not been deleted.",
    ),
  ).toBeVisible();
  expect(attempts).toBe(1);
  expect(await stored(page)).toEqual(before);
  allow = true;
  await page
    .getByLabel("Current password", { exact: true })
    .fill("current-test-password");
  await button.click();
  await expect(page.getByRole("heading", { name: /Good food/ })).toBeVisible();
  expect(attempts).toBe(2);
  expect(
    await page.evaluate(() => localStorage.getItem("health.records.owner")),
  ).toBeNull();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("rep-and-plate.onboarding.v1"),
    ),
  ).toBeNull();
});
