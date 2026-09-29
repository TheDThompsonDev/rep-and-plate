import { useEffect, useState, useRef } from "react";
import { Text } from "react-native";
import { type SupabaseClient } from "@supabase/supabase-js";
import { Button, Card, Field, Sheet, s } from "./ui";
import { useHealth } from "./store";
import { cloudClient } from "./api";
import { requireDeviceOwner, invalidateSession } from "./auth";
import { exportRecords, importRecords } from "./storage";
import {
  loadSnapshot,
  saveSnapshot,
  readSnapshotMetadata,
  snapshotSummary,
  deleteSnapshot,
} from "../../src/features/cloud/client";
import { type AppState } from "../../src/domain";
import { PasswordRecovery } from "./PasswordRecovery";
import { AccountSecurity } from "./AccountSecurity";
import {
  pauseCloudSync,
  resumeCloudSync,
} from "../../src/features/cloud/sync-control";
export function Cloud() {
  const h = useHealth(),
    [client, setClient] = useState<SupabaseClient | null>(null),
    [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [signingUp, setSigningUp] = useState(false),
    [user, setUser] = useState<string | null>(null),
    [revision, setRevision] = useState<number | null>(null),
    [restore, setRestore] = useState<AppState | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const identity = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    let unsubscribe = () => {};
    void (async () => {
      try {
        const c = await cloudClient();
        const { data } = await c.auth.getSession();
        if (!alive) return;
        setClient(c);
        identity.current = data.session?.user.id ?? null;
        setUser(identity.current);
        const sub = c.auth.onAuthStateChange((_event, session) => {
          const next = session?.user.id ?? null;
          if (next !== identity.current) {
            identity.current = next;
            setUser(next);
            setRevision(null);
            setRestore(null);
            setConfirmDelete(false);
          }
        });
        unsubscribe = () => {
          sub.data.subscription.unsubscribe();
        };
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
      identity.current = null;
      unsubscribe();
    };
  }, []);
  const checkIdentity = (expected: string) => {
    if (identity.current !== expected)
      throw new Error("Your account changed. Review the cloud copy again.");
  };
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Cloud & your records" onClose={() => h.setTool(null)}>
      <Text style={s.muted}>
        Your account saves changes automatically. Export a backup or review a
        saved copy here. Other accounts keep separate records.
      </Text>
      <Button
        label="Export this device"
        secondary
        onPress={() => void run(() => exportRecords(h.state!))}
      />
      <Button
        label="Import a backup file"
        secondary
        disabled={h.busy || busy}
        onPress={() =>
          void run(async () => {
            const state = await importRecords();
            if (state) setRestore(state);
          })
        }
      />
      {!!error && <Text style={s.muted}>{error}</Text>}
      {client && !user && (
        <>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={signingUp ? "new-password" : "current-password"}
          />
          <Button
            label={signingUp ? "Create account" : "Sign in"}
            disabled={
              busy || !email.trim() || password.length < (signingUp ? 8 : 1)
            }
            onPress={() =>
              void run(async () => {
                const r = signingUp
                  ? await client.auth.signUp({ email: email.trim(), password })
                  : await client.auth.signInWithPassword({
                      email: email.trim(),
                      password,
                    });
                if (r.error)
                  throw new Error(
                    signingUp
                      ? "Account creation didn’t complete. Try again or sign in if you have an account."
                      : "Sign-in didn’t work. Check your email and password, and confirm your email first.",
                  );
                setPassword("");
                if (!r.data.session) {
                  setError(
                    "Check your email to confirm your account, then sign in here.",
                  );
                  setSigningUp(false);
                }
              })
            }
          />
          <Button
            secondary
            label={
              signingUp
                ? "Already have an account? Sign in"
                : "Create an account"
            }
            onPress={() => {
              setSigningUp(!signingUp);
              setPassword("");
            }}
          />
          <Button
            label="Email me a sign-in code"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const r = await client.auth.signInWithOtp({
                  email: email.trim(),
                  options: { shouldCreateUser: false },
                });
                if (r.error) throw r.error;
                setError("Check your email for a sign-in code.");
              })
            }
          />
          <Field
            label="Email code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
          />
          <Button
            label="Verify code"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const r = await client.auth.verifyOtp({
                  email,
                  token: code,
                  type: "email",
                });
                if (r.error) throw r.error;
                setUser(r.data.user?.id ?? null);
              })
            }
          />
        </>
      )}
      {client && user && (
        <>
          <AccountSecurity client={client} />
          <Text style={s.h3}>Signed in</Text>
          <Button
            label="Sign out"
            secondary
            disabled={busy}
            onPress={() =>
              void run(async () => {
                invalidateSession();
                const r = await client.auth.signOut({ scope: "local" });
                if (r.error) throw r.error;
                setUser(null);
                setRestore(null);
              })
            }
          />
          <Text style={s.muted}>
            This is a personal device. Confirm these local records belong to you
            before connecting them to your account. Signing out keeps them on
            this phone; another account cannot send or upload them.
          </Text>
          <Button
            label="These device records are mine"
            disabled={busy || h.busy}
            onPress={() =>
              void run(async () => {
                await requireDeviceOwner(client, true);
                setError(
                  "Device records linked to your account. Chat and cloud access are ready.",
                );
              })
            }
          />
          <Button
            label="Check saved cloud copy"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const metadata = await readSnapshotMetadata(client, user);
                checkIdentity(user);
                setRevision(metadata?.revision ?? 0);
                setError(
                  metadata
                    ? `Cloud revision ${metadata.revision} · ${metadata.updated_at}`
                    : "No cloud copy yet.",
                );
              })
            }
          />
          <Button
            label="Upload this device to cloud"
            disabled={busy || h.busy || revision === null}
            onPress={() =>
              void run(async () => {
                await requireDeviceOwner(client);
                const result = await saveSnapshot(
                  client,
                  user,
                  h.state!,
                  revision!,
                );
                checkIdentity(user);
                setRevision(result.revision);
                setError("Cloud copy saved.");
              })
            }
          />
          <Button
            label="Review cloud copy to restore"
            disabled={busy || h.busy}
            secondary
            onPress={() =>
              void run(async () => {
                await requireDeviceOwner(client);
                const saved = await loadSnapshot(client, user);
                checkIdentity(user);
                if (saved) {
                  setRestore(saved.state);
                  setRevision(saved.revision);
                } else setError("No cloud copy found.");
              })
            }
          />
          <Button
            secondary
            label={
              confirmDelete ? "Confirm delete cloud copy" : "Delete cloud copy"
            }
            disabled={busy || revision === null || revision < 1}
            onPress={() => {
              if (!confirmDelete) {
                setConfirmDelete(true);
                return;
              }
              void run(async () => {
                pauseCloudSync();
                try {
                  await deleteSnapshot(client, user, revision!);
                } catch (error) {
                  resumeCloudSync();
                  throw error;
                }
                checkIdentity(user);
                setRevision(0);
                setRestore(null);
                setConfirmDelete(false);
                setError(
                  "Cloud copy deleted. Automatic saving is paused on this device. Other devices can still save their copies. Use Delete my account to remove the entire account.",
                );
              });
            }}
          />
          {confirmDelete && (
            <Button
              secondary
              label="Keep cloud copy"
              onPress={() => setConfirmDelete(false)}
            />
          )}
        </>
      )}
      {client && !user && <PasswordRecovery client={client} />}
      {restore && (
        <Card>
          <Text style={s.h3}>Replace this phone’s records?</Text>
          <Text style={s.muted}>
            {snapshotSummary(restore).meals} meals ·{" "}
            {snapshotSummary(restore).groceries} receipts ·{" "}
            {snapshotSummary(restore).messages} messages. Export this device
            first if you want to keep both copies.
          </Text>
          <Button
            label="Restore these records"
            disabled={h.busy}
            onPress={() => {
              if (h.change(() => restore)) {
                setRestore(null);
                h.setNotice("Records restored on this device.");
              }
            }}
          />
          <Button
            secondary
            label="Keep current records"
            onPress={() => setRestore(null)}
          />
        </Card>
      )}
    </Sheet>
  );
}
