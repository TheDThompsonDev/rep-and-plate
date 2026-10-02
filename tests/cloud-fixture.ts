import { readBrowserRecords } from "./record-fixture";
import { test, expect, type Page } from "./app-fixture";

const userId = "11111111-1111-4111-8111-111111111111";
const now = new Date().toISOString();
const user = {
  id: userId,
  aud: "authenticated",
  role: "authenticated",
  email: "fixture@example.test",
  email_confirmed_at: now,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: now,
};
const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: userId, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.fixture-signature`;
export const stored = (page: Page) =>
  readBrowserRecords(page);

export async function mockCloud(page: Page) {
  const control = {
    remote: null as any,
    saveCalls: 0,
    deleteCalls: 0,
    signups: 0,
    conflict: false,
    failedSave: false,
    failedSignOut: false,
    signouts: 0,
    signupConfirmed: false,
  };
  await page.route("**/api/status", (route) =>
    route.fulfill({ json: { available: false, jev: false } }),
  );
  await page.route("**/api/chat", (route) => route.abort());
  await page.route("**/api/cloud/config", (route) =>
    route.fulfill({
      json: {
        url: "https://fuelcloudtest.supabase.co",
        publishableKey: "sb_publishable_fixture_key_long_enough",
      },
    }),
  );
  await page.route("https://fuelcloudtest.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    };
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    if (url.pathname === "/auth/v1/token") {
      await route.fulfill({
        headers,
        json: {
          access_token: token,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "fixture-refresh",
          user,
        },
      });
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      await route.fulfill({ headers, json: user });
      return;
    }
    if (url.pathname === "/auth/v1/signup") {
      control.signups++;
      await route.fulfill({
        headers,
        json: control.signupConfirmed
          ? {
              access_token: token,
              token_type: "bearer",
              expires_in: 3600,
              refresh_token: "fixture-refresh",
              user,
            }
          : { user, session: null },
      });
      return;
    }
    if (url.pathname === "/auth/v1/logout") {
      control.signouts++;
      expect(url.searchParams.get("scope")).toBe("local");
      if (control.failedSignOut) {
        await route.fulfill({
          headers,
          status: 500,
          json: { message: "Unavailable" },
        });
        return;
      }
      await route.fulfill({ headers, status: 204 });
      return;
    }
    if (url.pathname === "/rest/v1/fuel_snapshots") {
      await route.fulfill({
        headers,
        json: control.remote ? [control.remote] : [],
      });
      return;
    }
    if (url.pathname === "/rest/v1/rpc/health_save_snapshot") {
      control.saveCalls++;
      const body = request.postDataJSON();
      expect(body.p_user).toBe(userId);
      if (control.conflict) {
        await route.fulfill({
          headers,
          status: 409,
          json: { code: "40001", message: "Snapshot changed" },
        });
        return;
      }
      if (control.failedSave) {
        await route.fulfill({
          headers,
          status: 500,
          json: { code: "XX000", message: "Private upstream error" },
        });
        return;
      }
      control.remote = {
        user_id: userId,
        revision: Math.max(1, body.p_expected_revision + 1),
        updated_at: now,
        state: body.p_state,
      };
      await route.fulfill({
        headers,
        json: {
          user_id: userId,
          revision: control.remote.revision,
          updated_at: now,
        },
      });
      return;
    }
    if (url.pathname === "/rest/v1/rpc/health_delete_snapshot") {
      expect(request.postDataJSON().p_user).toBe(userId);
      control.deleteCalls++;
      control.remote = null;
      await route.fulfill({ headers, json: { deleted: true } });
      return;
    }
    await route.fulfill({
      headers,
      status: 404,
      json: { message: "Unexpected fixture route" },
    });
  });
  return control;
}
export async function openAccount(page: Page) {
  await page.goto("/#you");
  await page.getByRole("button", { name: /Account & backups/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your account & saved records",
  );
}
export async function signIn(page: Page) {
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("dialog", { name: "Your account & saved records" })
    .getByRole("button", { name: "Sign in", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("fixture@example.test");
  await expect(
    page.getByRole("button", { name: /Upload this device/ }),
  ).toBeEnabled();
}
