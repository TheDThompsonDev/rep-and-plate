import { test, expect } from "@playwright/test";

test("deletion removes IndexedDB-only account archives while preserving other accounts and guest records", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    // Exercise the shipped persistence implementation, including its IDB-only path.
    const storage = await import("/src/platform/browser-records.ts");
    const accounts = await import("/src/features/cloud/account-storage.ts");
    const deleted = "11111111-1111-4111-8111-111111111111";
    const other =
      "https://project.supabase.co:22222222-2222-4222-8222-222222222222";
    const identity = `https://project.supabase.co:${deleted}`;
    const ownKeys = [
      accounts.accountStorageKey(identity),
      accounts.syncStorageKey(identity),
      `health.sync.recovery.${encodeURIComponent(identity)}`,
      `health.pending.${encodeURIComponent(identity)}`,
    ];
    for (const key of ownKeys) {
      await storage.browserSet(key, "private old account");
      localStorage.removeItem(key);
    }
    await storage.browserSet(
      accounts.accountStorageKey(other),
      "other private account",
    );
    await storage.browserSet("fuel.prototype.v1", "guest records");
    localStorage.removeItem("health.records.owner");
    await accounts.clearBrowserAccount(deleted);
    return {
      own: await Promise.all(ownKeys.map(storage.browserGet)),
      other: await storage.browserGet(accounts.accountStorageKey(other)),
      guest: await storage.browserGet("fuel.prototype.v1"),
    };
  });
  expect(result).toEqual({
    own: [null, null, null, null],
    other: "other private account",
    guest: "guest records",
  });
});

test("deleting an inactive account cannot remove the currently selected account", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const storage = await import("/src/platform/browser-records.ts");
    const accounts = await import("/src/features/cloud/account-storage.ts");
    const targetId = "11111111-1111-4111-8111-111111111111";
    const target = `https://project.supabase.co:${targetId}`;
    const selected =
      "https://project.supabase.co:22222222-2222-4222-8222-222222222222";
    localStorage.setItem("health.records.owner", selected);
    localStorage.setItem("rep-and-plate.onboarding.v1", "selected onboarding");
    await storage.browserSet(
      accounts.accountStorageKey(target),
      "deleted account",
    );
    await storage.browserSet("fuel.prototype.v1", "selected records");
    await accounts.clearBrowserAccount(targetId);
    return {
      target: await storage.browserGet(accounts.accountStorageKey(target)),
      active: await storage.browserGet("fuel.prototype.v1"),
      owner: localStorage.getItem("health.records.owner"),
      onboarding: localStorage.getItem("rep-and-plate.onboarding.v1"),
    };
  });
  expect(result.target).toBeNull();
  expect(result.active).toBe("selected records");
  expect(result.owner).toContain("22222222");
  expect(result.onboarding).toBe("selected onboarding");
});
