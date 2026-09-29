import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, Share } from "react-native";
import { stateSchema, type AppState } from "../../src/domain";
import { chunkedStorage } from "../../src/platform/secure-values";
import {
  restoreDeviceSnapshot,
  serialWriter,
} from "../../src/platform/snapshot";

const file = `${FileSystem.documentDirectory}dannys-health.json`;
const key = "dannys-health.native.v1";
export const spotVisit = {
  get: () => AsyncStorage.getItem('rep-and-plate.spot.last-visit'),
  touch: () => AsyncStorage.setItem('rep-and-plate.spot.last-visit',new Date().toISOString()),
};
export async function loadDevice() {
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
export const saveDevice = serialWriter(async (raw) => {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, raw);
    return;
  }
  // Two generations keep the last good copy available if the app closes during a write.
  await FileSystem.writeAsStringAsync(`${file}.next`, raw);
  if ((await FileSystem.getInfoAsync(file)).exists)
    await FileSystem.copyAsync({ from: file, to: `${file}.backup` });
  await FileSystem.moveAsync({ from: `${file}.next`, to: file });
});
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
  const value = JSON.parse(raw);
  return restoreDeviceSnapshot(
    JSON.stringify(stateSchema.parse(value.state ?? value)),
  );
}
