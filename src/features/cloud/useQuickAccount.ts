import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export function useQuickAccount(
  getClient: () => Promise<SupabaseClient | null>,
  beforeSignOut?: () => void,
) {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const client = useRef<SupabaseClient | null>(null),
    locked = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    let active = true,
      revision = 0,
      unsubscribe = () => {};
    alive.current = true;
    void (async () => {
      try {
        const c = await getClient();
        if (!active) return;
        client.current = c;
        if (!c) return;
        const sub = c.auth.onAuthStateChange((_event, session) => {
          revision++;
          if (active) setUser(session?.user ?? null);
        });
        unsubscribe = () => sub.data.subscription.unsubscribe();
        const observed = revision,
          session = await c.auth.getSession();
        if (session.error) throw session.error;
        if (active && observed === revision)
          setUser(session.data.session?.user ?? null);
      } catch {
        if (active)
          setError(
            "Account status could not be checked. Open account settings to retry.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      alive.current = false;
      client.current = null;
      unsubscribe();
    };
  }, [getClient]);
  const signOut = async () => {
    if (locked.current || !client.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      beforeSignOut?.();
      const result = await client.current.auth.signOut({ scope: "local" });
      if (result.error)
        throw Error(
          "Sign-out could not be confirmed. Check your account status and try again.",
        );
      if (alive.current) setUser(null);
    } catch (cause) {
      if (alive.current) setError((cause as Error).message);
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return { user, loading, busy, error, signOut };
}
