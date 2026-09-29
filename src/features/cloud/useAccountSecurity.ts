import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { changeAccountPassword } from "./account-client";
import { pauseCloudSync, resumeCloudSync } from "./sync-control";

export type AccountDeletionTransport = (
  body: { confirmation: string; password: string },
  expectedUserId: string,
) => Promise<{ deleted: true }>;
export function useAccountSecurity(
  client: SupabaseClient,
  deleteAccount: AccountDeletionTransport,
  clearLocal: (expectedUserId: string) => Promise<void>,
) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const locked = useRef(false),
    deletedUser = useRef<string | null>(null);
  const [cleanupNeeded, setCleanupNeeded] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The request could not finish. Please retry.",
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  const cleanup = async () => {
    const id = deletedUser.current;
    if (!id) return;
    try {
      await clearLocal(id);
      const session = await client.auth.getSession();
      if (session.data.session?.user.id === id)
        await client.auth.signOut({ scope: "local" });
      else if (session.data.session?.user.id) resumeCloudSync();
      setCleanupNeeded(false);
      setNotice("Your account and its records have been deleted.");
    } catch {
      setCleanupNeeded(true);
      throw Error(
        "Your account was deleted, but this device could not finish clearing its local copy. Retry device cleanup.",
      );
    }
  };
  return {
    busy,
    error,
    notice,
    cleanupNeeded,
    changePassword: (current: string, next: string) =>
      run(async () => {
        await changeAccountPassword(client, current, next);
        setNotice("Your password has been updated.");
      }),
    deleteAccount: (confirmation: string, password: string) =>
      run(async () => {
        if (confirmation !== "DELETE" || !password)
          throw Error("Type DELETE and enter your current password.");
        const session = await client.auth.getSession();
        if (session.error || !session.data.session)
          throw Error("Sign in again before deleting your account.");
        const id = session.data.session.user.id;
        pauseCloudSync();
        try {
          const result = await deleteAccount({ confirmation, password }, id);
          if (result.deleted !== true)
            throw Error(
              "Account deletion could not be confirmed. Retry before clearing this device.",
            );
          deletedUser.current = id;
        } catch (e) {
          resumeCloudSync();
          throw e;
        }
        await cleanup();
      }),
    retryCleanup: () => run(cleanup),
  };
}

export async function browserAccountDeletion(
  client: SupabaseClient,
  body: { confirmation: string; password: string },
  expectedUserId: string,
): Promise<{ deleted: true }> {
  const session = await client.auth.getSession();
  if (
    session.error ||
    !session.data.session ||
    session.data.session.user.id !== expectedUserId
  )
    throw Error(
      "Your account changed. Sign in again before deleting your account.",
    );
  const response = await fetch("/api/account/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.data.session.access_token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.deleted !== true)
    throw Error(
      result?.error || "Account deletion could not finish. Please retry.",
    );
  return { deleted: true };
}
