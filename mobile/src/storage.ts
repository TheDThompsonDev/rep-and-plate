import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { initialState, stateSchema, type AppState } from "../../src/domain";
import { draftKey } from '../../src/features/onboarding/draft';
import {
  invalidateCloudSync,
  cloudEpoch,
  resumeCloudSync,
  pauseCloudSync,
} from "../../src/features/cloud/sync-control";
import { chunkedStorage } from "../../src/platform/secure-values";
import { restoreDeviceSnapshot } from "../../src/platform/snapshot";

const file = `${FileSystem.documentDirectory}dannys-health.json`;
const key = "dannys-health.native.v1";
let activeOwner: string | null = null;
let writes: Promise<unknown> = Promise.resolve();
function recordTransaction<T>(work: () => Promise<T>): Promise<T> {
  const result = writes.then(work, work);
  writes = result.catch(() => {});
  return result;
}
const fileWrites = new Map<string, Promise<unknown>>();
function accountFileTransaction<T>(name: string, work: () => Promise<T>) {
  const result = (fileWrites.get(name) ?? Promise.resolve()).then(work, work);
  fileWrites.set(
    name,
    result.catch(() => {}),
  );
  return result;
}
export const accountFiles = {
  async get(name: string) {
    return Platform.OS === "web"
      ? AsyncStorage.getItem(name)
      : (
            await FileSystem.getInfoAsync(
              `${FileSystem.documentDirectory}${encodeURIComponent(name)}.json`,
            )
          ).exists
        ? FileSystem.readAsStringAsync(
            `${FileSystem.documentDirectory}${encodeURIComponent(name)}.json`,
          )
        : null;
  },
  async set(name: string, value: string) {
    return accountFileTransaction(name, async () => {
      if (Platform.OS === "web") await AsyncStorage.setItem(name, value);
      else {
        const target = `${FileSystem.documentDirectory}${encodeURIComponent(name)}.json`;
        await FileSystem.writeAsStringAsync(`${target}.next`, value);
        await FileSystem.moveAsync({ from: `${target}.next`, to: target });
      }
    });
  },
  async remove(name: string) {
    return accountFileTransaction(name, async () => {
      if (Platform.OS === "web") await AsyncStorage.removeItem(name);
      else {
        const target = `${FileSystem.documentDirectory}${encodeURIComponent(name)}.json`;
        for (const path of [target, `${target}.next`, `${target}.backup`])
          await FileSystem.deleteAsync(path, { idempotent: true });
      }
    });
  },
  async keys(): Promise<string[]> {
    if (Platform.OS === "web")
      return [
        ...new Set([
          ...(await AsyncStorage.getAllKeys()),
          ...fileWrites.keys(),
        ]),
      ];
    if (!FileSystem.documentDirectory)
      throw Error("Device storage is unavailable.");
    const files = await FileSystem.readDirectoryAsync(
      FileSystem.documentDirectory,
    );
    return [
      ...new Set([
        ...files
          .filter((name) => /\.json(?:\.next|\.backup)?$/.test(name))
          .flatMap((name) => {
            try {
              return [
                decodeURIComponent(
                  name.replace(/\.json(?:\.next|\.backup)?$/, ""),
                ),
              ];
            } catch {
              return [];
            }
          }),
        ...fileWrites.keys(),
      ]),
    ];
  },
};
const archiveKey = (identity: string) =>
  `health.account.${encodeURIComponent(identity)}`;
export const spotVisit = {
  get: () => AsyncStorage.getItem("rep-and-plate.spot.last-visit"),
  touch: () =>
    AsyncStorage.setItem(
      "rep-and-plate.spot.last-visit",
      new Date().toISOString(),
    ),
};
export async function loadDevice() {
  const epoch = cloudEpoch();
  const owner = await deviceOwnership.get();
  if (epoch !== cloudEpoch())
    throw Error("Your account changed while loading records.");
  activeOwner = owner;
  // Account archives are the source of truth after an interrupted switch.
  // The shared active file and its backup may belong to the prior account.
  if (activeOwner) {
    const owned = await accountFiles.get(archiveKey(activeOwner));
    if (owned !== null) return restoreDeviceSnapshot(owned);
  }
  if (Platform.OS === "web")
    return restoreDeviceSnapshot(await AsyncStorage.getItem(key));
  const info = await FileSystem.getInfoAsync(file);
  if (!info.exists) {
    const pending = await FileSystem.getInfoAsync(`${file}.next`);
    if (pending.exists)
      return restoreDeviceSnapshot(
        await FileSystem.readAsStringAsync(`${file}.next`),
      );
    const backup = await FileSystem.getInfoAsync(`${file}.backup`);
    if (backup.exists)
      return restoreDeviceSnapshot(
        await FileSystem.readAsStringAsync(`${file}.backup`),
      );
  }
  return restoreDeviceSnapshot(
    info.exists ? await FileSystem.readAsStringAsync(file) : null,
  );
}
async function writeActive(raw: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, raw);
    return;
  }
  // Two generations keep the last good copy available if the app closes during a write.
  await FileSystem.writeAsStringAsync(`${file}.next`, raw);
  if ((await FileSystem.getInfoAsync(file)).exists)
    await FileSystem.copyAsync({ from: file, to: `${file}.backup` });
  await FileSystem.moveAsync({ from: `${file}.next`, to: file });
}
export function saveDevice(state: AppState) {
  const owner = activeOwner;
  const raw = JSON.stringify(stateSchema.parse(state));
  return recordTransaction(async () => {
    if (owner !== activeOwner)
      throw Error("Your account changed before saving.");
    if (owner) await accountFiles.set(archiveKey(owner), raw);
    if (owner === activeOwner) await writeActive(raw);
  });
}
export async function switchNativeAccount(identity: string) {
  return recordTransaction(async () => {
    const owner = await deviceOwnership.get();
    if (owner === identity) {
      activeOwner = identity;
      return;
    }
    if (owner) {
      const old = await loadDevice();
      await accountFiles.set(archiveKey(owner), JSON.stringify(old));
      const raw = await accountFiles.get(archiveKey(identity));
      const selected = JSON.stringify(
        raw ? stateSchema.parse(JSON.parse(raw)) : initialState(),
      );
      await accountFiles.set(archiveKey(identity), selected);
      await writeActive(selected);
      if (Platform.OS !== "web")
        for (const path of [`${file}.next`, `${file}.backup`])
          await FileSystem.deleteAsync(path, { idempotent: true });
    } else {
      // First account binding explicitly claims the existing guest records.
      await accountFiles.set(
        archiveKey(identity),
        JSON.stringify(await loadDevice()),
      );
    }
    await deviceOwnership.set(identity);
    activeOwner = identity;
    resumeCloudSync();
  });
}
export async function clearNativeAccount(expectedUserId?: string) {
  pauseCloudSync();
  return recordTransaction(async () => {
    const owner = await deviceOwnership.get();
    if (expectedUserId) {
      await AsyncStorage.removeItem(draftKey(expectedUserId));
      for (const name of await accountFiles.keys())
        if (
          /^(health\.account\.|health\.sync\.)/.test(name) &&
          name.endsWith(encodeURIComponent(`:${expectedUserId}`))
        )
          await accountFiles.remove(name);
      if (!owner?.endsWith(`:${expectedUserId}`)) return;
    }
    if (!owner) return;
    if (!expectedUserId) await AsyncStorage.removeItem(draftKey(owner.slice(owner.lastIndexOf(':') + 1)));
    if (owner) {
      await accountFiles.remove(archiveKey(owner));
      await accountFiles.remove(`health.sync.${encodeURIComponent(owner)}`);
      await accountFiles.remove(
        `health.sync.recovery.${encodeURIComponent(owner)}`,
      );
    }
    // Remove every active generation; writing an empty state here would first
    // copy the deleted user's old file into .backup.
    if (Platform.OS === "web") await AsyncStorage.removeItem(key);
    else
      for (const path of [file, `${file}.next`, `${file}.backup`])
        await FileSystem.deleteAsync(path, { idempotent: true });
    await AsyncStorage.removeItem("rep-and-plate.onboarding.v1");
    await credentials.removeItem("health.records.owner");
    if (Platform.OS === "web") localStorage.removeItem("health.records.owner");
    activeOwner = null;
    invalidateCloudSync();
  });
}
const rawCredentials = {
  async getItem(key: string) {
    return Platform.OS === "web"
      ? sessionStorage.getItem(key)
      : SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === "web") sessionStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === "web") sessionStorage.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  },
};
export const credentials =
  Platform.OS === "web"
    ? rawCredentials
    : chunkedStorage(rawCredentials, () => crypto.randomUUID());
// Ownership must outlive a browser-preview session, just like its local records.
export const deviceOwnership = {
  get: () =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.getItem("health.records.owner"))
      : credentials.getItem("health.records.owner"),
  set: (value: string) =>
    Platform.OS === "web"
      ? Promise.resolve(localStorage.setItem("health.records.owner", value))
      : credentials.setItem("health.records.owner", value),
};
export async function exportRecords(state: AppState) {
  const json = JSON.stringify(
    { format: "fuel-snapshot", exportedAt: new Date().toISOString(), state },
    null,
    2,
  );
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "rep-and-plate-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const uri = `${FileSystem.cacheDirectory}rep-and-plate-backup.json`;
  await FileSystem.writeAsStringAsync(uri, json);
  await Sharing.shareAsync(uri, {
    mimeType: "application/json",
    dialogTitle: "Keep a copy of your records",
  });
}
export async function importRecords(): Promise<AppState | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  if ((result.assets[0].size ?? 0) > 50_000_000)
    throw new Error("This backup is too large to import on this device.");
  const raw =
    Platform.OS === "web"
      ? await (await fetch(result.assets[0].uri)).text()
      : await FileSystem.readAsStringAsync(result.assets[0].uri);
  try {
    const value = JSON.parse(raw);
    return restoreDeviceSnapshot(
      JSON.stringify(stateSchema.parse(value.state ?? value)),
    );
  } catch {
    throw new Error(
      "This file is not a valid Rep & Plate backup. Your current records are unchanged. Choose another backup file.",
    );
  }
}
