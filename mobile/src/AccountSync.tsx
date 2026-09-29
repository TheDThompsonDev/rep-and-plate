import { Text, View } from "react-native";
import { useMemo } from "react";
import * as Crypto from "expo-crypto";
import {
  useAccountSync,
  type SyncPlatform,
} from "../../src/features/cloud/useAccountSync";
import { syncLabels } from "../../src/features/cloud/sync";
import { cloudClient, hostedConnection } from "./api";
import { requireDeviceOwner } from "./auth";
import { accountFiles, deviceOwnership, exportRecords } from "./storage";
import { useHealth } from "./store";
import { Button, s } from "./ui";
const platform: SyncPlatform = {
  account: async () => {
    if (!(await hostedConnection())) return null;
    const client = await cloudClient();
    const { data } = await client.auth.getSession();
    if (!data.session) return null;
    const session = await requireDeviceOwner(client);
    return {
      client,
      user: session.user.id,
      identity: (await deviceOwnership.get())!,
    };
  },
  get: accountFiles.get,
  set: accountFiles.set,
  digest: (value) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value),
};
export function AccountSync() {
  const h = useHealth();
  const {readyRecords,waitForRecords}=h;
  const ownedPlatform = useMemo<SyncPlatform>(
    () => ({
      ...platform,
      current: readyRecords,
      account: async () => {
        await waitForRecords();
        return platform.account();
      },
    }),
    [readyRecords,waitForRecords],
  );
  const sync = useAccountSync(
    h.recordsReady ? h.state : null,
    h.restoreRecords,
    ownedPlatform,
  );
  if (sync.status === "device") return null;
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 5,
        backgroundColor: "#edf6f1",
      }}
    >
      <Text accessibilityLiveRegion="polite" style={s.tiny}>
        {syncLabels[sync.status]}
      </Text>
      {(sync.status === "offline" || sync.status === "paused") && (
        <>
          <Text style={s.tiny}>{sync.error}</Text>
          <Button label="Retry account saving" secondary onPress={sync.retry} />
        </>
      )}
      {sync.status === "conflict" && (
        <>
          <Text style={s.muted}>
            Both copies are safe. Export this device before choosing which copy
            to continue with.
          </Text>
          <Button
            label="Export this device"
            secondary
            onPress={() => void exportRecords(h.state!)}
          />
          <Button
            label="Use account copy"
            secondary
            onPress={() => void sync.resolve("cloud")}
          />
          <Button
            label="Keep this device’s copy"
            secondary
            onPress={() => void sync.resolve("device")}
          />
        </>
      )}
    </View>
  );
}
