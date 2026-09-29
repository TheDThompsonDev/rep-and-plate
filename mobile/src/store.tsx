import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState as Lifecycle } from "react-native";
import {
  type AppState,
  type Message,
  clockTime,
  id,
  today,
  stateSchema,
} from "../../src/domain";
import { applyAIResult, buildAIRequest } from "../../src/ai-client";
import { loadDevice, saveDevice, spotVisit, deviceOwnership } from "./storage";
import { isComeback } from "../../src/features/spot/model";
import {
  cloudEpoch,
  onAccountChange,
} from "../../src/features/cloud/sync-control";
import { OwnedStateGate } from "../../src/platform/owned-state";
import { chat, loadConnection } from "./api";
export type Tab = "Chat" | "Nutrition" | "Workouts" | "Kitchen" | "You";
export type Tool =
  | "label"
  | "capture"
  | "receipt"
  | "scan"
  | "voice"
  | "pantry"
  | "recipes"
  | "planner"
  | "shopping"
  | "preferences"
  | "profile"
  | "workout"
  | "review"
  | "connection"
  | "cloud"
  | null;
type Store = {
  captureRequest: number;
  tellSpot: () => void;
  spotReturning: boolean;
  dismissSpotReturn: () => void;
  spotIntroReplay: boolean;
  replaySpotIntro: () => void;
  dismissSpotIntro: () => void;
  state: AppState | null;
  recordsReady: boolean;
  readyRecords: () => AppState | null;
  waitForRecords: () => Promise<AppState>;
  error: string;
  notice: string;
  day: string;
  tab: Tab;
  tool: Tool;
  busy: boolean;
  progress: string;
  draft: string;
  labelBarcode: string;
  setLabelBarcode: (value: string) => void;
  setDraft: (s: string) => void;
  setNotice: (s: string) => void;
  setTab: (t: Tab) => void;
  setTool: (t: Tool) => void;
  change: (update: (s: AppState) => AppState) => boolean;
  saveOnboardingProfile: (name: string) => Promise<void>;
  restoreRecords: (state: AppState) => Promise<void>;
  send: (text: string, image?: string, retry?: string) => Promise<void>;
  cancel: () => void;
};
const Context = createContext<Store>(null!);
export const useHealth = () => useContext(Context);
export function HealthProvider({ children }: { children: ReactNode }) {
  const [captureRequest, setCaptureRequest] = useState(0);
  const [spotReturning, setSpotReturning] = useState(false);
  const [spotIntroReplay, setSpotIntroReplay] = useState(false);
  const [state, setState] = useState<AppState | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [day, setDay] = useState(today),
    [tab, setTab] = useState<Tab>("Chat"),
    [tool, setTool] = useState<Tool>(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(""),
    [draft, setDraft] = useState("");
  const [labelBarcode, setLabelBarcode] = useState("");
  const [recordsReady, setRecordsReady] = useState(false);
  const current = useRef<AppState | null>(null),
    controller = useRef<AbortController | null>(null);
  const gateRef = useRef<OwnedStateGate<AppState> | null>(null);
  if (!gateRef.current)
    gateRef.current = new OwnedStateGate({
      epoch: cloudEpoch,
      owner: deviceOwnership.get,
      load: loadDevice,
    });
  const gate = gateRef.current;
  const readyRecords=useCallback(()=>gate.current,[gate]);
  const waitForRecords=useCallback(()=>gate.wait(),[gate]);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      const previousOwner = gate.owner;
      controller.current?.abort();
      void gate.refresh(
        (next, firstBinding) => {
          if (!live) return;
          if (!next) {
            setRecordsReady(false);
            return;
          }
          current.current = next;
          setState(next);
          setRecordsReady(true);
          setError("");
          if (previousOwner !== gate.owner) {
            setDraft("");
            setTool((previous) =>
              firstBinding && previous === "cloud" ? "cloud" : null,
            );
          }
        },
        (e) => {
          if (live) {
            setError(
              e instanceof Error
                ? e.message
                : "Your account records could not be loaded.",
            );
            setNotice("Your account records could not be loaded.");
          }
        },
      );
    };
    refresh();
    const unsubscribe = onAccountChange(refresh);
    void Promise.all([spotVisit.get(), gate.wait()])
      .then(([lastVisit, records]) => {
        if (live) {
          setSpotReturning(isComeback(lastVisit ?? records.spot?.lastVisit));
          void spotVisit.touch().catch(() => {});
        }
      })
      .catch(() => {});
    loadConnection().catch(() => {});
    return () => {
      live = false;
      unsubscribe();
      gate.close();
      controller.current?.abort();
    };
  }, [gate]);
  useEffect(() => {
    const refresh = () => setDay(today());
    const sub = Lifecycle.addEventListener("change", (v) => {
      if (v === "active") refresh();
      void spotVisit.touch().catch(() => {});
    });
    const timer = setInterval(refresh, 15000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  function change(update: (s: AppState) => AppState) {
    if (!gate.current || !current.current) return false;
    try {
      const next = stateSchema.parse(update(current.current));
      gate.set(next);
      current.current = next;
      setState(next);
      void saveDevice(next).catch(() =>
        setNotice(
          "Your changes are visible but could not be saved. Export a backup before closing.",
        ),
      );
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please check those details.");
      return false;
    }
  }
  async function saveOnboardingProfile(name: string) {
    const before = await gate.wait(),
      epoch = cloudEpoch();
    const next = stateSchema.parse({
      ...before,
      profile: {
        ...before.profile,
        ...(name.trim() ? { name: name.trim() } : {}),
      },
      spot: { ...before.spot, introSeen: true },
    });
    await saveDevice(next);
    if (epoch !== cloudEpoch() || gate.current !== before)
      throw Error("Your account changed. Please try setup again.");
    gate.set(next);
    current.current = next;
    setState(next);
  }
  async function send(text: string, image?: string, retry?: string) {
    if (
      controller.current ||
      !gate.current ||
      !current.current ||
      (!text.trim() && !image)
    )
      return;
    const message: Message = retry
      ? current.current.messages.find((m) => m.id === retry)!
      : {
          id: id(),
          role: "user",
          text: text.trim(),
          image,
          time: clockTime(),
          ai: true,
          aiStatus: "pending",
        };
    if (!message) return;
    const source = current.current,
      abort = new AbortController();
    const attemptEpoch = cloudEpoch();
    controller.current = abort;
    setBusy(true);
    setProgress("Thinking through the details…");
    setTab("Chat");
    setTool(null);
    change((s) => ({
      ...s,
      messages: retry
        ? s.messages.map((m) =>
            m.id === retry
              ? { ...m, aiStatus: "pending", aiError: undefined }
              : m,
          )
        : [...s.messages, message],
    }));
    const timeout = setTimeout(() => abort.abort(), 185000);
    try {
      const result = await chat(
        buildAIRequest(source, message),
        (text) => {
          if (attemptEpoch === cloudEpoch() && controller.current === abort)
            setProgress(text);
        },
        abort.signal,
      );
      if (!abort.signal.aborted && attemptEpoch === cloudEpoch())
        change((s) => applyAIResult(s, result));
    } catch (e) {
      if (attemptEpoch === cloudEpoch() && controller.current === abort)
        change((s) => ({
          ...s,
          messages: s.messages.map((m) =>
            m.id === message.id
              ? {
                  ...m,
                  aiStatus: "error",
                  aiError: abort.signal.aborted
                    ? "Stopped. Your capture is saved; you can retry."
                    : e instanceof Error
                      ? e.message
                      : "Please retry.",
                }
              : m,
          ),
        }));
    } finally {
      clearTimeout(timeout);
      if (controller.current === abort) {
        controller.current = null;
        setBusy(false);
        setProgress("");
      }
    }
  }
  return (
    <Context.Provider
      value={{
        captureRequest,
        tellSpot: () => {
          setTab("Chat");
          setCaptureRequest((n) => n + 1);
        },
        spotReturning,
        dismissSpotReturn: () => setSpotReturning(false),
        spotIntroReplay,
        replaySpotIntro: () => {
          setSpotIntroReplay(true);
          setSpotReturning(false);
          setTab("Chat");
        },
        dismissSpotIntro: () => setSpotIntroReplay(false),
        state,
        recordsReady,
        readyRecords,
        waitForRecords,
        error,
        notice,
        day,
        tab,
        tool,
        busy,
        progress,
        draft,
        labelBarcode,
        setLabelBarcode,
        setDraft,
        setNotice,
        setTab,
        setTool,
        change,
        saveOnboardingProfile,
        restoreRecords: async (next) => {
          const before = await gate.wait(),
            epoch = cloudEpoch();
          await saveDevice(next);
          if (epoch !== cloudEpoch() || gate.current !== before) {
            throw Error(
              "Your records changed while loading. Sync will check again.",
            );
          }
          gate.set(next);
          current.current = next;
          setState(next);
        },
        send,
        cancel: () => controller.current?.abort(),
      }}
    >
      {children}
    </Context.Provider>
  );
}
