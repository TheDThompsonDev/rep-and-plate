import { useState } from "react";
import { Text } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearNativeAccount } from "./storage";
import { accountRequest } from "./api";
import { useAccountSecurity } from "../../src/features/cloud/useAccountSecurity";
import { Button, Card, Field, s } from "./ui";

export function AccountSecurity({ client }: { client: SupabaseClient }) {
  const actions = useAccountSecurity(
    client,
    accountRequest,
    clearNativeAccount,
  );
  const [mode, setMode] = useState<"password" | "delete" | null>(null),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  return (
    <Card>
      <Text style={s.h3}>Account security</Text>
      {!mode && (
        <>
          <Button
            secondary
            label="Change password"
            onPress={() => setMode("password")}
          />
          <Button
            secondary
            label="Delete my account"
            onPress={() => setMode("delete")}
          />
        </>
      )}
      {mode && !actions.cleanupNeeded && (
        <>
          <Text style={s.h3}>
            {mode === "password"
              ? "Choose a new password"
              : "Permanently delete your account?"}
          </Text>
          {mode === "delete" && (
            <Text style={s.muted}>
              This deletes your sign-in account, saved conversations, food and
              workout records, plans, and uploaded photos. This account’s copy
              on this device is cleared. Offline copies on other devices and
              downloaded exports may remain until removed. Export any records
              you want to keep first. This cannot be undone.
            </Text>
          )}
          <Field
            label="Current password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            value={current}
            editable={!actions.busy}
            onChangeText={setCurrent}
          />
          {mode === "password" ? (
            <Field
              label="New password"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              value={password}
              editable={!actions.busy}
              onChangeText={setPassword}
            />
          ) : (
            <Field
              label="Type DELETE to delete your account"
              autoCapitalize="characters"
              value={confirmation}
              editable={!actions.busy}
              onChangeText={setConfirmation}
            />
          )}
          <Button
            label={
              actions.busy
                ? "Please wait…"
                : mode === "password"
                  ? "Update password"
                  : "Permanently delete account"
            }
            disabled={
              actions.busy ||
              !current ||
              (mode === "delete"
                ? confirmation !== "DELETE"
                : password.length < 8)
            }
            onPress={() =>
              void (
                mode === "password"
                  ? actions.changePassword(current, password)
                  : actions.deleteAccount(confirmation, current)
              ).finally(() => {
                setCurrent("");
                setPassword("");
              })
            }
          />
          <Button
            secondary
            label="Cancel"
            disabled={actions.busy}
            onPress={() => {
              setMode(null);
              setCurrent("");
              setPassword("");
              setConfirmation("");
            }}
          />
        </>
      )}
      {actions.cleanupNeeded && (
        <Button
          label="Retry device cleanup"
          disabled={actions.busy}
          onPress={() => void actions.retryCleanup()}
        />
      )}
      {!!actions.error && (
        <Text accessibilityRole="alert" style={s.muted}>
          {actions.error}
        </Text>
      )}
      {!!actions.notice && (
        <Text accessibilityRole="alert" style={s.muted}>
          {actions.notice}
        </Text>
      )}
    </Card>
  );
}
