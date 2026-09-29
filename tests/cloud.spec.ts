import { test, expect, type Page } from "@playwright/test";

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
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("fuel.prototype.v1")!));

async function mockCloud(page: Page) {
  const control = {
    remote: null as any,
    saveCalls: 0,
    deleteCalls: 0,
    signups: 0,
    conflict: false,
    failedSave: false,
    failedSignOut: false,
    signouts: 0,
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
      await route.fulfill({ headers, json: { user, session: null } });
      return;
    }
    if (url.pathname === "/auth/v1/logout") {
      control.signouts++;
      expect(url.searchParams.get("scope")).toBe("local");
      if (control.failedSignOut) {
        await route.fulfill({ headers, status: 500, json: { message: "Unavailable" } });
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
async function openAccount(page: Page) {
  await page.goto("/#you");
  await page.getByRole("button", { name: /Account & backups/ }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Your account & saved records",
  );
}
async function signIn(page: Page) {
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("fixture@example.test");
  await expect(
    page.getByRole("button", { name: /Upload this device/ }),
  ).toBeEnabled();
}

test("Account sign-out is visible immediately and preserves device records", async ({ page }) => {
  const cloud = await mockCloud(page);
  await page.goto('/#you');
  await expect(page.getByRole('button', { name: /Account & backups/ })).toBeInViewport();
  await page.getByRole('button', { name: /Account & backups/ }).click();
  await signIn(page);
  const before = await stored(page);
  const signout = page.getByRole('button', { name: 'Sign out on this device' });
  await expect(signout).toBeInViewport();
  await signout.click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('You’re not signed in');
  expect(cloud.signouts).toBe(1);
  expect(await stored(page)).toEqual(before);
  await page.reload();
  await page.getByRole('button', { name: /Account & backups/ }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before);
});

test("A server sign-out failure reports the actual local session state", async ({ page }) => {
  const cloud = await mockCloud(page);
  await openAccount(page);
  await signIn(page);
  const before = await stored(page);
  cloud.failedSignOut = true;
  await page.getByRole('button', { name: 'Sign out on this device' }).click();
  await expect(page.getByRole('alert')).toContainText('Signed out on this device, but the server could not confirm');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await stored(page)).toEqual(before);
  cloud.failedSignOut = false;
  await signIn(page);
  await page.getByRole('button', { name: 'Sign out on this device' }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
});

test("Cloud uploads, restores, and deletes only after explicit review", async ({
  page,
}) => {
  const cloud = await mockCloud(page);
  await openAccount(page);
  const before = await stored(page);
  await signIn(page);
  expect(cloud.saveCalls).toBe(0);
  await page.getByRole("button", { name: /Upload this device/ }).click();
  await expect(
    page.getByRole("button", { name: "Upload reviewed records" }),
  ).toBeDisabled();
  expect(cloud.saveCalls).toBe(0);
  await page
    .getByRole("checkbox", {
      name: "I want these records saved to this account.",
    })
    .check();
  await page.getByRole("button", { name: "Upload reviewed records" }).click();
  await expect(page.getByRole("status")).toContainText("records are saved");
  expect(cloud.saveCalls).toBe(1);
  expect(cloud.remote.state).toEqual(before);
  expect(await stored(page)).toEqual(before);

  cloud.remote.state = {
    ...before,
    profile: { ...before.profile, name: "Restored fixture" },
  };
  await page.getByRole("button", { name: /Load my saved records/ }).click();
  await expect(
    page.getByRole("button", { name: "Replace this device", exact: true }),
  ).toBeDisabled();
  expect((await stored(page)).profile.name).toBe(before.profile.name);
  await page
    .getByRole("checkbox", {
      name: "I understand this replaces this device's records.",
    })
    .check();
  await page
    .getByRole("button", { name: "Replace this device", exact: true })
    .click();
  await expect
    .poll(async () => (await stored(page)).profile.name)
    .toBe("Restored fixture");

  await page.getByRole("button", { name: /Delete my cloud copy/ }).click();
  await expect(
    page.getByRole("button", { name: "Delete cloud copy", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("textbox", { name: "Type DELETE to confirm" })
    .fill("DELETE");
  await page
    .getByRole("button", { name: "Delete cloud copy", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText(
    "cloud copy was deleted",
  );
  expect(cloud.deleteCalls).toBe(1);
  expect((await stored(page)).profile.name).toBe("Restored fixture");
});

test("A conflicting upload stops without changing local records or retrying", async ({
  page,
}) => {
  const cloud = await mockCloud(page);
  await openAccount(page);
  const before = await stored(page);
  await signIn(page);
  cloud.conflict = true;
  await page.getByRole("button", { name: /Upload this device/ }).click();
  await page
    .getByRole("checkbox", {
      name: "I want these records saved to this account.",
    })
    .check();
  await page.getByRole("button", { name: "Upload reviewed records" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "changed on another device",
  );
  await expect(page.getByRole("button", { name: "Upload reviewed records" })).toBeDisabled();
  expect(cloud.saveCalls).toBe(1);
  expect(await stored(page)).toEqual(before);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Upload this device/ }),
  ).toBeDisabled();
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export this device's records" })
    .click();
  expect((await download).suggestedFilename()).toMatch(
    /^rep-and-plate-records-.*\.json$/,
  );
});

test("Cloud setup and authentication never automatically upload device records", async ({
  page,
}) => {
  const cloud = await mockCloud(page);
  await openAccount(page);
  await page
    .getByRole("button", { name: "Create an account", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("fixture@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-password-only");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect(cloud.signups).toBe(1);
  expect(cloud.saveCalls).toBe(0);
  await page
    .getByRole("button", { name: "Already have an account? Sign in" })
    .click();
  await signIn(page);
  const before = await stored(page);
  cloud.failedSave = true;
  await page.getByRole("button", { name: /Upload this device/ }).click();
  await page
    .getByRole("checkbox", {
      name: "I want these records saved to this account.",
    })
    .check();
  await page.getByRole("button", { name: "Upload reviewed records" }).click();
  await expect(page.getByRole("alert")).toContainText("did not complete");
  await expect(page.getByRole("alert")).not.toContainText("Private upstream");
  expect(await stored(page)).toEqual(before);
  expect(cloud.saveCalls).toBe(1);
});
