import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { parseOnboarding, type OnboardingRecord } from "./model";

export type OnboardingAdapter = {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
  owner: () => Promise<string | null>;
  client: () => Promise<SupabaseClient | null>;
  verifyOwner: (client: SupabaseClient, bind?: boolean) => Promise<unknown>;
};
export function useOnboarding(adapter: OnboardingAdapter) {
  const [loading, setLoading] = useState(true);
  const [entered, setEntered] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [step, setStep] = useState<
    "welcome" | "intro" | "account" | "setup" | "ready"
  >("welcome");
  const [slide, setSlide] = useState(0);
  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const alive = useRef(true),
    locked = useRef(false),
    identity = useRef<string | null>(null);
  const authEpoch = useRef(0);
  const record = useRef<OnboardingRecord | null>(null);
  const retryGeneration = useRef(0);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    alive.current = true;
    let active = true,
      unsubscribe = () => {};
    void (async () => {
      const [raw, savedOwner] = await Promise.all([
        adapter.read(),
        adapter.owner(),
      ]);
      if (!active) return;
      record.current = parseOnboarding(raw);
      setOwner(savedOwner);
      if (!record.current && !savedOwner) setLoading(false);
      try {
        const c = await adapter.client();
        if (!active) return;
        setClient(c);
        setAvailable(!!c);
        if (c) {
          const sub = c.auth.onAuthStateChange((event, session) => {
            if (!active) return;
            const nextIdentity = session?.user.id ?? null;
            if (identity.current !== nextIdentity || event === "SIGNED_OUT")
              authEpoch.current++;
            if (identity.current && identity.current !== nextIdentity) {
              setEntered(false);
              setReplaying(false);
              setStep("welcome");
              setConfirmed(false);
            }
            identity.current = nextIdentity;
            setUser(session?.user ?? null);
            if (event === "SIGNED_OUT") {
              setEntered(false);
              setReplaying(false);
              setStep("welcome");
              setLocalMode(false);
              setConfirmed(false);
              setNotice("Signed out. Your records stay on this device.");
            }
          });
          unsubscribe = () => sub.data.subscription.unsubscribe();
          const session = await c.auth.getSession();
          if (!active) return;
          if (session.error) throw session.error;
          const current = session.data.session?.user ?? null;
          identity.current = current?.id ?? null;
          setUser(current);
          if (
            record.current?.mode === "account" &&
            record.current.userId === current?.id &&
            current
          ) {
            await adapter.verifyOwner(c);
            if (active && identity.current === current.id) setEntered(true);
          } else if (
            record.current?.mode === "guest" &&
            !(await adapter.owner()) &&
            active
          )
            setEntered(true);
        } else if (
          record.current?.mode === "guest" &&
          !(await adapter.owner()) &&
          active
        )
          setEntered(true);
      } catch {
        if (active) {
          setAvailable(false);
          if (
            record.current?.mode === "guest" &&
            !(await adapter.owner()) &&
            active
          )
            setEntered(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    })().catch(() => {
      if (active) {
        setError(
          "Your device settings could not be read. Retry before continuing.",
        );
        setLoading(false);
      }
    });
    return () => {
      active = false;
      alive.current = false;
      unsubscribe();
    };
  }, [adapter, retry]);
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "Something went wrong. Please try again.",
        );
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function account(next: "signup" | "signin") {
    setMode(next);
    setStep("account");
    setError("");
    setNotice("");
    setLocalMode(false);
  }
  async function authenticate(email: string, password: string) {
    await run(async () => {
      if (!client)
        throw Error(
          "Account connection is unavailable. Retry the connection or use this device without an account.",
        );
      const result =
        mode === "signup"
          ? await client.auth.signUp({ email: email.trim(), password })
          : await client.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
      if (result.error) {
        const code = result.error.code;
        throw Error(
          code === "email_not_confirmed"
            ? "Confirm your email, then sign in here."
            : code === "weak_password"
              ? "Choose a stronger password with at least 8 characters."
              : code?.includes("rate_limit")
                ? "Too many attempts. Please wait a little and try again."
                : mode === "signin"
                  ? "Sign-in didn’t work. Check your email and password."
                  : "Account creation didn’t complete. Try again, or sign in if you already have an account.",
        );
      }
      if (!alive.current) return;
      if (!result.data.session) {
        setNotice(
          "Check your email to confirm your account, then return here to sign in.",
        );
        setMode("signin");
        return;
      }
      identity.current = result.data.session.user.id;
      setUser(result.data.session.user);
      setLocalMode(false);
      setConfirmed(false);
      if (
        record.current?.mode === "account" &&
        record.current.userId === result.data.session.user.id
      ) {
        await adapter.verifyOwner(client);
        if (alive.current && identity.current === result.data.session.user.id)
          setEntered(true);
      } else setStep("setup");
    });
  }
  async function prepare() {
    await run(async () => {
      if (!localMode) {
        if (!client || !user || !confirmed)
          throw Error(
            "Confirm that these device records are yours to continue.",
          );
        const id = user.id;
        await adapter.verifyOwner(client, true);
        if (!alive.current || identity.current !== id)
          throw Error("Your account changed. Sign in again.");
        setOwner(await adapter.owner());
      } else if (await adapter.owner())
        throw Error(
          "These records are linked to an account. Sign in with that account to continue.",
        );
      if (alive.current) setStep("ready");
    });
  }
  async function finish(focus: string, saveProfile: () => Promise<void>) {
    await run(async () => {
      const epoch = authEpoch.current;
      const expectedIdentity = identity.current;
      const stillCurrent = () => {
        if (
          !alive.current ||
          authEpoch.current !== epoch ||
          identity.current !== expectedIdentity
        )
          throw Error(
            "Your account changed. Please continue with your current account.",
          );
      };
      if (!localMode) {
        if (!client || !user) throw Error("Sign in to continue.");
        await adapter.verifyOwner(client);
        if (identity.current !== user.id)
          throw Error("Your account changed. Sign in again.");
      } else if (await adapter.owner())
        throw Error("Sign in with the account linked to these device records.");
      stillCurrent();
      await saveProfile();
      stillCurrent();
      const value: OnboardingRecord = {
        version: 1,
        mode: localMode ? "guest" : "account",
        ...(localMode ? {} : { userId: user!.id }),
        focus,
      };
      await adapter.write(JSON.stringify(value));
      stillCurrent();
      if (alive.current) {
        record.current = value;
        setEntered(true);
        setStep("welcome");
      }
    });
  }
  const startTour = () => {
    setSlide(0);
    setStep("intro");
    setError("");
    setNotice("");
  };
  return {
    loading,
    entered,
    replaying,
    step,
    setStep,
    slide,
    setSlide,
    mode,
    account,
    client,
    user,
    owner,
    available,
    busy,
    error,
    notice,
    confirmed,
    setConfirmed,
    localMode,
    authenticate,
    prepare,
    finish,
    startTour,
    replay: () => {
      setReplaying(true);
      startTour();
    },
    closeReplay: () => {
      setReplaying(false);
      setStep("welcome");
    },
    nextAfterTour: () => {
      if (replaying) {
        setReplaying(false);
        setStep("welcome");
      } else if (user) {
        setStep("setup");
      } else account("signup");
    },
    tryLocal: () => {
      if (!owner) {
        setLocalMode(true);
        setStep("setup");
        setError("");
        setNotice("");
      }
    },
    signOut: () =>
      run(async () => {
        if (client) {
          const r = await client.auth.signOut({ scope: "local" });
          if (r.error)
            throw Error(
              "The server could not confirm sign-out. Check your connection.",
            );
        }
      }),
    retry: () => {
      setLoading(true);
      setAvailable(null);
      retryGeneration.current++;
      setRetry(retryGeneration.current);
    },
  };
}
