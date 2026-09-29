import { test, expect } from "@playwright/test";
import { resultFixture } from "../../tests/ai-fixtures";

test("hosted native sign-in binds device records and blocks a different account before sending", async ({
  page,
}) => {
  const user = "11111111-1111-4111-8111-111111111111";
  const base = "https://health-beta.example";
  const project = "https://betatest.supabase.co";
  const jwt =
    [
      { alg: "HS256", typ: "JWT" },
      {
        sub: user,
        aud: "authenticated",
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    ]
      .map((v) => Buffer.from(JSON.stringify(v)).toString("base64url"))
      .join(".") + ".signature";
  await page.addInitScript(
    ({ base }) =>
      sessionStorage.setItem(
        "health.connection",
        JSON.stringify({ url: base, token: "" }),
      ),
    { base },
  );
  await page.route(`${base}/api/cloud/config`, (r) =>
    r.fulfill({
      json: {
        available: true,
        url: project,
        publishableKey: "sb_publishable_testtesttesttest",
      },
    }),
  );
  await page.route(`${project}/auth/v1/otp`, (r) => r.fulfill({ json: {} }));
  await page.route(`${project}/auth/v1/verify`, (r) =>
    r.fulfill({
      json: {
        access_token: jwt,
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: user,
          aud: "authenticated",
          role: "authenticated",
          email: "tester@example.com",
          created_at: new Date().toISOString(),
        },
      },
    }),
  );
  let calls = 0;
  await page.route(`${base}/api/chat`, async (r) => {
    calls++;
    expect(r.request().headers().authorization).toBe(`Bearer ${jwt}`);
    const body = r.request().postDataJSON();
    await r.fulfill({
      contentType: "application/x-ndjson",
      body:
        JSON.stringify({
          type: "result",
          result: resultFixture(body.requestId),
        }) + "\n",
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Your profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Cloud & your records", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("tester@example.com");
  await page
    .getByRole("button", { name: "Email me a sign-in code", exact: true })
    .click();
  await expect(
    page.getByText("Check your email for a sign-in code."),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Email code", exact: true })
    .fill("123456");
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await page
    .getByRole("button", { name: "These device records are mine", exact: true })
    .click();
  await expect(
    page.getByText(
      "Device records linked to your account. Chat and cloud access are ready.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("Here are my groceries");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review groceries", exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await page.evaluate(() =>
    localStorage.setItem(
      "health.records.owner",
      "https://betatest.supabase.co:another-account",
    ),
  );
  await page
    .getByRole("textbox", { name: "Message Rep & Plate" })
    .fill("Do not send someone else’s history");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText(/These device records belong to another account/),
  ).toBeVisible();
  expect(calls).toBe(1);
});
