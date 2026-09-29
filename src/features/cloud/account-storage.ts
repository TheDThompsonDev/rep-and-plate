import { initialState, STORAGE_KEY, stateSchema } from "../../domain";
import { ONBOARDING_KEY } from "../onboarding/model";
import { resumeCloudSync, pauseCloudSync } from "./sync-control";
import {
  browserGet,
  browserSet,
  browserRemove,
  currentBrowserRaw,
  hydrateBrowserRecords,
  forgetBrowserCache,
  browserRecordTransaction,
  browserKeys,
} from "../../platform/browser-records";
export const accountStorageKey = (identity: string) =>
  `health.account.${encodeURIComponent(identity)}`;
export const syncStorageKey = (identity: string) =>
  `health.sync.${encodeURIComponent(identity)}`;
export async function switchBrowserAccount(identity: string) {
  return browserRecordTransaction(async () => {
    const owner = localStorage.getItem("health.records.owner");
    if (owner === identity) return;
    const raw = currentBrowserRaw();
    if (owner && raw) await browserSet(accountStorageKey(owner), raw);
    if (owner) {
      const saved = await browserGet(accountStorageKey(identity));
      const next = saved
        ? stateSchema.parse(JSON.parse(saved))
        : initialState();
      await browserSet(accountStorageKey(identity), JSON.stringify(next));
      await browserSet(STORAGE_KEY, JSON.stringify(next));
      await hydrateBrowserRecords();
      localStorage.removeItem(ONBOARDING_KEY);
    }
    localStorage.setItem("health.records.owner", identity);
    await hydrateBrowserRecords();
    resumeCloudSync();
  });
}
export async function clearBrowserAccount(expectedUserId?: string) {
  pauseCloudSync();
  return browserRecordTransaction(async () => {
    const owner = localStorage.getItem("health.records.owner");
    if (expectedUserId) {
      for (const key of await browserKeys())
        if (
          /^(health\.account\.|health\.sync\.|health\.pending\.)/.test(key) &&
          key.endsWith(encodeURIComponent(`:${expectedUserId}`))
        )
          await browserRemove(key);
      if (!owner?.endsWith(`:${expectedUserId}`)) return;
    }
    if (!owner) return;
    if (owner) {
      await browserRemove(accountStorageKey(owner));
      await browserRemove(syncStorageKey(owner));
      await browserRemove(`health.sync.recovery.${encodeURIComponent(owner)}`);
      await browserRemove(`health.pending.${encodeURIComponent(owner)}`);
    }
    await browserRemove(STORAGE_KEY);
    forgetBrowserCache();
    localStorage.removeItem(ONBOARDING_KEY);
    localStorage.removeItem("health.records.owner");
  });
}
