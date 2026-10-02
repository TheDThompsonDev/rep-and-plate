import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppState } from "../../domain";
import { loadSnapshot, saveSnapshot } from "./client";
import { recordMedia, browserDigest } from "./media";
import {
  SyncEngine,
  isFreshDevice,
  type Checkpoint,
  type SyncStatus,
} from "./sync";
import {
  cloudEpoch,
  cloudPaused,
  onAccountChange,
  resumeCloudSync,
} from "./sync-control";
export type SyncPlatform = {
  account: () => Promise<{
    client: SupabaseClient;
    user: string;
    identity: string;
  } | null>;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  digest?: (value: string) => Promise<string>;
  current?: () => AppState | null;
};
export function useAccountSync(
  state: AppState | null,
  replace: (value: AppState) => Promise<void>,
  platform: SyncPlatform,
) {
  const current = useRef(state),
    apply = useRef(replace);
  current.current = state;
  apply.current = replace;
  const engine = useRef<SyncEngine | null>(null);
  const [view, setView] = useState<{ status: SyncStatus; error: string }>({
    status: "device",
    error: "",
  });
  const [epoch, setEpoch] = useState(0);
  const ready = !!state;
  useEffect(() => onAccountChange(() => setEpoch((v) => v + 1)), []);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    let unsubscribe = () => {};
    let timer: ReturnType<typeof setInterval> | undefined;
    const generation = cloudEpoch();
    const active = () =>
      live &&
      generation === cloudEpoch() &&
      !cloudPaused() &&
      (!platform.current || !!platform.current());
    const local = () => {
      const value = platform.current ? platform.current() : current.current;
      if (!value) throw Error("Your account records are still loading.");
      return value;
    };
    engine.current = null;
    if (cloudPaused()) {
      setView({ status: "paused", error: "" });
      return;
    }
    void (async () => {
      const account = await platform.account();
      if (!active()) return;
      if (!account) {
        setView({ status: "device", error: "" });
        return;
      }
      const { client, user, identity } = account;
      const key = `health.sync.${encodeURIComponent(identity)}`;
      const media = recordMedia(client, user, platform.digest ?? browserDigest);
      let base: Checkpoint | null = null;
      const raw = await platform.get(key);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as Checkpoint;
          if (!Number.isSafeInteger(saved.revision) || saved.revision < 1)
            throw Error("checkpoint");
          base = {
            revision: saved.revision,
            state: await media.decode(saved.state),
          };
        } catch {
          base = null;
        }
      }
      if (!active()) return;
      const sub = client.auth.onAuthStateChange((_event, session) => {
        if (!live || generation !== cloudEpoch()) return;
        if (session?.user.id !== user) {
          live = false;
          engine.current = null;
          setView({ status: "device", error: "" });
        }
      });
      unsubscribe = () => sub.data.subscription.unsubscribe();
      const instance = new SyncEngine({
        local,
        active,
        empty: (account) => isFreshDevice(local(), account?.profile.name),
        baseline: () => base,
        read: async () => {
          const saved = await loadSnapshot(client, user);
          return saved
            ? {
                revision: saved.revision,
                state: await media.decode(saved.state),
              }
            : null;
        },
        write: async (value, revision) => {
          const encoded = await media.encode(value);
          if (!active()) throw Error("Your account changed.");
          return (await saveSnapshot(client, user, encoded, revision)).revision;
        },
        replace: async (value) => {
          if (!active()) throw Error("Your account changed.");
          await apply.current(value);
          current.current = value;
        },
        checkpoint: async (value) => {
          const encoded = await media.encode(value.state);
          if (!active()) return;
          await platform.set(key, JSON.stringify({ ...value, state: encoded }));
          base = value;
        },
        archive: async (value, source) =>
          platform.set(
            `health.sync.recovery.${source === "cloud" ? "cloud." : ""}${encodeURIComponent(identity)}`,
            JSON.stringify(await media.encode(value)),
          ),
      });
      engine.current = instance;
      const tick = async () => {
        if (!active()) return;
        const promise = instance.tick();
        setView({ status: instance.status, error: instance.error });
        await promise;
        if (active())
          setView({ status: instance.status, error: instance.error });
      };
      await tick();
      if (active()) timer = setInterval(() => void tick(), 5000);
    })().catch(() => {
      if (active())
        setView({
          status: "offline",
          error:
            "Account saving could not connect. Your records remain here. Retry when you are online.",
        });
    });
    return () => {
      live = false;
      unsubscribe();
      if (timer) clearInterval(timer);
      engine.current = null;
    };
  }, [platform, ready, epoch]);
  const resolve = async (choice?: "device" | "cloud") => {
    if (!engine.current) {
      resumeCloudSync();
      setEpoch((v) => v + 1);
      return;
    }
    const instance = engine.current;
    const epoch = cloudEpoch();
    const p = instance.tick(choice);
    setView({ status: instance.status, error: instance.error });
    await p;
    if (engine.current === instance && epoch === cloudEpoch())
      setView({ status: instance.status, error: instance.error });
  };
  return { ...view, retry: () => void resolve(), resolve };
}
