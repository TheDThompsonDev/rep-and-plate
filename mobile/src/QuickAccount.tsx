import { Text, View } from "react-native";
import { useQuickAccount } from "../../src/features/cloud/useQuickAccount";
import { cloudClient } from "./api";
import { invalidateSession } from "./auth";
import { useHealth } from "./store";
import { Button, s } from "./ui";

export function QuickAccount() {
  const h = useHealth(),
    account = useQuickAccount(cloudClient, invalidateSession);
  return (
    <View accessibilityLabel="Quick account access" style={s.hero}>
      <Text style={s.h3}>Your account</Text>
      <Text style={s.muted}>
        {account.loading
          ? "Checking your account…"
          : account.user
            ? `Signed in as ${account.user.email ?? "your account"}`
            : "Using this device. Sign in to connect your account."}
      </Text>
      {account.user ? (
        <Button
          label={account.busy ? "Signing out…" : "Sign out"}
          disabled={account.busy || account.loading}
          onPress={() => void account.signOut()}
        />
      ) : (
        <Button
          label="Sign in"
          disabled={account.loading}
          onPress={() => h.setTool("cloud")}
        />
      )}
      {!!account.error && (
        <Text accessibilityRole="alert" style={s.muted}>
          {account.error}
        </Text>
      )}
    </View>
  );
}
