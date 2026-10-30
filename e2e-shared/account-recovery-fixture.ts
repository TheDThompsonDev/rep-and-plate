import { expect, type Page } from "@playwright/test";
import { mockCloud } from "./cloud-fixture";

export async function exercisePasswordRecovery(page: Page, native = false) {
  await mockCloud(page);
  if (native)
    await page.addInitScript(() =>
      sessionStorage.setItem(
        "health.connection",
        JSON.stringify({ url: "https://health-beta.example", token: "" }),
      ),
    );
  const headers = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  };
  let codes = 0,
    updates = 0;
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "fixture@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  await page.route(
    "https://fuelcloudtest.supabase.co/auth/v1/otp",
    async (route) => {
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      expect(route.request().postDataJSON().create_user).toBe(false);
      codes++;
      await route.fulfill({ headers, json: {} });
    },
  );
  await page.route(
    "https://fuelcloudtest.supabase.co/auth/v1/verify",
    async (route) => {
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      const valid = route.request().postDataJSON().token === "123456";
      await route.fulfill(
        valid
          ? {
              headers,
              json: {
                user,
                access_token: "recovery-token",
                refresh_token: "recovery-refresh",
                expires_in: 3600,
                token_type: "bearer",
              },
            }
          : {
              status: 403,
              headers,
              json: { code: "otp_expired", msg: "Expired" },
            },
      );
    },
  );
  await page.route(
    "https://fuelcloudtest.supabase.co/auth/v1/user",
    async (route) => {
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      if (route.request().method() === "PUT") {
        updates++;
        expect(route.request().postDataJSON().password).toBe(
          "new-password-for-test",
        );
      }
      await route.fulfill({ headers, json: user });
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await page.getByLabel("Account email", { exact: true }).fill(user.email);
  await page
    .getByRole("button", { name: "Send recovery code", exact: true })
    .click();
  await expect(
    page.getByText(/If an account exists for this email/),
  ).toBeVisible();
  await page.getByLabel("Email code", { exact: true }).fill("000000");
  await page
    .getByLabel("New password", { exact: true })
    .fill("new-password-for-test");
  await page
    .getByRole("button", { name: "Set new password", exact: true })
    .click();
  await expect(
    page.getByText(/That code is invalid or has expired/),
  ).toBeVisible();
  expect(updates).toBe(0);
  await page.getByLabel("Email code", { exact: true }).fill("123456");
  await page
    .getByLabel("New password", { exact: true })
    .fill("new-password-for-test");
  await page
    .getByRole("button", { name: "Set new password", exact: true })
    .click();
  await expect(
    page.getByText("Password updated. Sign in with your new password."),
  ).toBeVisible();
  expect(codes).toBe(1);
  expect(updates).toBe(1);
  const sessionKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => /^sb-.*auth-token/.test(key)),
  );
  expect(sessionKeys).toEqual([]);
  await expect(
    page.getByRole("textbox", { name: "Message Rep & Plate" }),
  ).toHaveCount(0);
}
