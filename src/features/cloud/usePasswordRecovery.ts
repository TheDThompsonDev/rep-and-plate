import { useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recoverPassword, requestPasswordCode } from "./account-client";

export function usePasswordRecovery(client: SupabaseClient | null) {
  const [open, setOpen] = useState(false),
    [sentTo, setSentTo] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const locked = useRef(false);
  const run = async (fn: () => Promise<void>) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return {
    open,
    sentTo,
    busy,
    error,
    notice,
    start: () => {
      setOpen(true);
      setSentTo("");
      setError("");
      setNotice("");
    },
    close: () => {
      if (!locked.current) {
        setOpen(false);
        setSentTo("");
        setError("");
        setNotice("");
      }
    },
    send: (email: string) =>
      run(async () => {
        if (!client)
          throw Error("Account connection is unavailable. Please reconnect.");
        await requestPasswordCode(client, email);
        setSentTo(email.trim());
        setNotice(
          "If an account exists for this email, a sign-in code is on its way. Enter it here to choose a new password.",
        );
      }),
    finish: (code: string, password: string) =>
      run(async () => {
        if (!client || !sentTo) throw Error("Request a code first.");
        await recoverPassword(client, sentTo, code, password);
        setSentTo("");
        setOpen(false);
        setNotice("Password updated. Sign in with your new password.");
      }),
  };
}
