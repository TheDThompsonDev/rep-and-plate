import { useState } from "react";
import { Text } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usePasswordRecovery } from "../../src/features/cloud/usePasswordRecovery";
import { Button, Card, Field, s } from "./ui";

export function PasswordRecovery({
  client,
}: {
  client: SupabaseClient | null;
}) {
  const recovery = usePasswordRecovery(client);
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState("");
  return (
    <>
      {!recovery.open ? (
        <Button
          secondary
          label="Forgot password?"
          disabled={!client}
          onPress={recovery.start}
        />
      ) : (
        <Card>
          <Text style={s.h3}>Let’s get you back in.</Text>
          {!recovery.sentTo ? (
            <Field
              label="Account email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={email}
              editable={!recovery.busy}
              onChangeText={setEmail}
            />
          ) : (
            <>
              <Text style={s.text}>
                Enter the code sent to {recovery.sentTo}.
              </Text>
              <Field
                label="Email code"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                value={code}
                editable={!recovery.busy}
                onChangeText={setCode}
              />
              <Field
                label="New password"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                value={password}
                editable={!recovery.busy}
                onChangeText={setPassword}
              />
            </>
          )}
          <Button
            label={
              recovery.busy
                ? "Please wait…"
                : recovery.sentTo
                  ? "Set new password"
                  : "Send recovery code"
            }
            disabled={recovery.busy || !client}
            onPress={() =>
              void (recovery.sentTo
                ? recovery.finish(code, password).then(() => {
                    setCode("");
                    setPassword("");
                  })
                : recovery.send(email))
            }
          />
          {!!recovery.sentTo && (
            <Button
              secondary
              label="Send another code"
              disabled={recovery.busy}
              onPress={() => void recovery.send(recovery.sentTo)}
            />
          )}
          <Button
            secondary
            label="Back to sign in"
            disabled={recovery.busy}
            onPress={() => {
              recovery.close();
              setCode("");
              setPassword("");
            }}
          />
        </Card>
      )}
      {!!recovery.error && (
        <Text accessibilityRole="alert" style={s.muted}>
          {recovery.error}
        </Text>
      )}
      {!!recovery.notice && (
        <Text accessibilityRole="alert" style={s.muted}>
          {recovery.notice}
        </Text>
      )}
    </>
  );
}
