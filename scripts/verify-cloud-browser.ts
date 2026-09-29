/**
 * Opt-in live check: npx tsx scripts/verify-cloud-browser.ts --run
 * Uses one synthetic account and an isolated headless browser; sends no email.
 * Never run from npm test. Start the local app on 127.0.0.1:5173 first.
 * The temporary Auth user and snapshot are deleted in finally. No credentials,
 * tokens, screenshots, traces, or browser storage are written to disk or logs.
 */
import dotenv from "dotenv";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Browser } from "@playwright/test";
import { initialState, stateSchema } from "../src/domain.ts";
import {
  prepareRecipeBatch,
  logRecipePortion,
} from "../src/features/recipes/batches.ts";

dotenv.config({ quiet: true });
const appUrl = "http://127.0.0.1:5173";
let stage = "preflight";
function ensure(value: unknown): asserts value {
  if (!value) throw new Error("Verification check failed.");
}

async function run() {
  if (!process.argv.includes("--run")) {
    console.log(
      "Opt-in only: start Rep & Plate locally, then run npx tsx scripts/verify-cloud-browser.ts --run. Creates and deletes one synthetic confirmed account; no emails.",
    );
    return;
  }
  const url = process.env.SUPABASE_URL;
  const adminKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  ensure(
    url &&
      adminKey &&
      publicKey &&
      /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url),
  );
  const config = await fetch(`${appUrl}/api/cloud/config`, {
    signal: AbortSignal.timeout(10000),
  }).then((response) => response.json());
  ensure(
    config.url.replace(/\/$/, "") === url.replace(/\/$/, "") &&
      config.publishableKey === publicKey,
  );
  const admin = createClient(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: AbortSignal.any([
            ...(init?.signal ? [init.signal] : []),
            AbortSignal.timeout(20000),
          ]),
        }),
    },
  });
  const userId = randomUUID();
  const email = `fuel-browser-${userId}@example.invalid`;
  const password = `Fu3l!${randomBytes(32).toString("base64url")}`;
  const report: string[] = [];
  let browser: Browser | undefined;
  let createAttempted = false;
  let cleaned = false;
  let failed = false;
  try {
    stage = "admin access preflight";
    const absent = await admin.auth.admin.getUserById(userId);
    ensure(absent.error?.status === 404 && !absent.data.user);
    stage = "create synthetic confirmed account";
    createAttempted = true;
    const created = await admin.auth.admin.createUser({
      id: userId,
      email,
      password,
      email_confirm: true,
      user_metadata: { fuel_verification_id: userId },
    });
    ensure(!created.error && created.data.user?.id === userId);
    report.push("synthetic confirmed account created without email delivery");

    let fixture = initialState();
    fixture.profile.name = "Synthetic cloud verification";
    fixture.meals = [];
    fixture.messages = [];
    fixture.reviews = [];
    fixture.products = [];
    fixture.pantryEvents = [];
    fixture.recipeBatches = [];
    fixture.mealPlans = [];
    fixture.workout = {
      status: "ready",
      exercises: [],
      startedAt: null,
      finishedAt: null,
      history: [],
    };
    fixture.groceries = [
      {
        id: "synthetic-receipt",
        fingerprint: "synthetic-cloud-check",
        store: "Synthetic market",
        date: "2026-09-25",
        sources: [],
        note: "Synthetic fixture only",
        items: [
          {
            id: "synthetic-milk",
            name: "Whole milk",
            receiptText: "TEST MILK",
            quantity: "1 bottle",
            serving: "1 cup",
            servingsPurchased: 8,
            nutrition: { calories: 150, protein: 8, carbs: 12, fat: 8 },
            match: "user",
            sources: [],
            needsReview: false,
            note: "Synthetic fixture only",
            availability: "available",
            pantryDates: {
              labelKind: "best-before",
              labelDate: "2026-10-01",
              openedDate: "2026-09-25",
            },
          },
        ],
      },
    ];
    fixture = prepareRecipeBatch(fixture, {
      id: "synthetic-batch",
      name: "Synthetic milk portions",
      totalPortions: 4,
      ingredients: [
        { lotId: "synthetic-receipt::synthetic-milk", servings: 2 },
      ],
    });
    fixture = stateSchema.parse(
      logRecipePortion(
        fixture,
        "synthetic-batch",
        1,
        "Snack",
        "synthetic-portion",
      ),
    );
    stage = "isolated browser sign-in";
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const calls = { save: 0, remove: 0, email: 0 };
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path === "/rest/v1/rpc/fuel_save_snapshot") calls.save++;
      if (path === "/rest/v1/rpc/fuel_delete_snapshot") calls.remove++;
      if (
        [
          "/auth/v1/signup",
          "/auth/v1/recover",
          "/auth/v1/otp",
          "/auth/v1/invite",
        ].includes(path)
      )
        calls.email++;
    });
    await page.goto(appUrl);
    await page.evaluate(
      (state) =>
        localStorage.setItem("fuel.prototype.v1", JSON.stringify(state)),
      fixture,
    );
    await page.reload();
    const openAccount = async () => {
      await page.goto(`${appUrl}/#you`);
      await page.getByRole("button", { name: /Account & backups/ }).click();
    };
    await openAccount();
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByText("No saved copy yet", { exact: true }).waitFor();
    ensure(calls.save === 0);
    report.push("normal browser password sign-in; no automatic upload");

    stage = "reviewed snapshot upload";
    await page.getByRole("button", { name: /Upload this device/ }).click();
    ensure(
      await page
        .getByRole("button", { name: "Upload reviewed records" })
        .isDisabled(),
    );
    ensure(calls.save === 0);
    await page
      .getByRole("checkbox", {
        name: "I want these records saved to this account.",
      })
      .check();
    await page.getByRole("button", { name: "Upload reviewed records" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "records are saved" })
      .waitFor();
    ensure(calls.save === 1);
    stage = "verify uploaded synthetic content";
    const saved = await admin
      .from("fuel_snapshots")
      .select("state")
      .eq("user_id", userId)
      .maybeSingle();
    ensure(
      !saved.error &&
        saved.data?.state?.profile?.name === fixture.profile.name &&
        saved.data.state.recipeBatches?.[0]?.id === "synthetic-batch" &&
        saved.data.state.groceries?.[0]?.items?.[0]?.pantryDates?.labelDate ===
          "2026-10-01",
    );
    report.push(
      "explicitly reviewed upload persisted synthetic recipe batch, portion history and pantry dates",
    );

    stage = "reviewed restore";
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("fuel.prototype.v1")!);
      state.profile.name = "Synthetic local change";
      state.recipeBatches = [];
      localStorage.setItem("fuel.prototype.v1", JSON.stringify(state));
    });
    await page.reload();
    await page.getByRole("button", { name: /Account & backups/ }).click();
    await page.getByRole("button", { name: /Load my saved records/ }).click();
    const replace = page.getByRole("button", {
      name: "Replace this device",
      exact: true,
    });
    await replace.waitFor();
    ensure(await replace.isDisabled());
    ensure(
      (await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("fuel.prototype.v1")!).profile.name,
      )) === "Synthetic local change",
    );
    await page
      .getByRole("checkbox", {
        name: "I understand this replaces this device's records.",
      })
      .check();
    await replace.click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("fuel.prototype.v1")!).profile.name ===
        "Synthetic cloud verification",
    );
    const restored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("fuel.prototype.v1")!),
    );
    ensure(
      restored.recipeBatches?.[0]?.consumptions?.length === 1 &&
        restored.groceries?.[0]?.items?.[0]?.pantryDates?.openedDate ===
          "2026-09-25",
    );
    ensure(calls.save === 1);
    report.push(
      "restore required review; synthetic local changes replaced; batch consumption and dates restored",
    );

    stage = "reviewed delete and sign-out";
    await page.getByRole("button", { name: /Delete my cloud copy/ }).click();
    ensure(
      await page
        .getByRole("button", { name: "Delete cloud copy", exact: true })
        .isDisabled(),
    );
    await page
      .getByRole("textbox", { name: "Type DELETE to confirm" })
      .fill("DELETE");
    await page
      .getByRole("button", { name: "Delete cloud copy", exact: true })
      .click();
    await page
      .getByRole("status")
      .filter({ hasText: "cloud copy was deleted" })
      .waitFor();
    ensure(calls.remove === 1 && calls.email === 0);
    const deleted = await admin
      .from("fuel_snapshots")
      .select("user_id")
      .eq("user_id", userId);
    ensure(!deleted.error && deleted.data?.length === 0);
    await page.getByRole("button", { name: "Sign out on this device" }).click();
    await page.getByRole("button", { name: "Sign in", exact: true }).waitFor();
    ensure(
      (await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("fuel.prototype.v1")!).profile.name,
      )) === fixture.profile.name,
    );
    report.push(
      "reviewed cloud deletion verified; signed out; local fixture retained; no email endpoints called",
    );
  } catch {
    failed = true;
    report.push(`FAILED at ${stage}; sensitive upstream details suppressed`);
  } finally {
    await browser?.close().catch(() => {});
    try {
      if (createAttempted) {
        const existing = await admin.auth.admin.getUserById(userId);
        if (
          existing.data.user?.id === userId &&
          existing.data.user.email === email &&
          existing.data.user.user_metadata?.fuel_verification_id === userId
        ) {
          const removed = await admin.auth.admin.deleteUser(userId);
          const missing = await admin.auth.admin.getUserById(userId);
          const snapshot = await admin
            .from("fuel_snapshots")
            .select("user_id")
            .eq("user_id", userId);
          cleaned =
            !removed.error &&
            missing.error?.status === 404 &&
            !missing.data.user &&
            !snapshot.error &&
            snapshot.data?.length === 0;
        } else cleaned = existing.error?.status === 404 && !existing.data.user;
      } else cleaned = true;
    } catch {
      cleaned = false;
      report.push(
        "Cleanup could not be verified; inspect only the reported synthetic user ID.",
      );
    }
    console.log(
      JSON.stringify(
        {
          status: failed || !cleaned ? "failed" : "passed",
          checks: report,
          cleanupVerified: cleaned,
          syntheticUserId: createAttempted ? userId : null,
        },
        null,
        2,
      ),
    );
    if (failed || !cleaned) process.exitCode = 1;
  }
}
run().catch(() => {
  console.log(
    JSON.stringify({
      status: "blocked",
      stage,
      message:
        "Live verification could not initialize; sensitive details suppressed. No fallback credentials or auth configuration changes attempted.",
    }),
  );
  process.exitCode = 1;
});
