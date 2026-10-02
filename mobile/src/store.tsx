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
import { resolveAgentMeal } from "../../src/features/connections/context";
import type { AgentAction } from "../../src/features/connections/contracts";
import { sessionSignal } from "./auth";
import { OwnedStateGate } from "../../src/platform/owned-state";
import { applyFitnessSetup, type FitnessSetupDraft } from '../../src/features/progress/fitness-goal';
import { applyNutritionSetup, type NutritionSetupResult } from '../../src/features/progress/nutrition-setup';
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
  | "agents"
  | "cloud"
  | null;
type Store = {
  recordsRevision: number;
  recordScope: () => number;
  recipeDraft: {
    name: string;
    portions: string;
    amounts: Record<string, string>;
  };
  setRecipeDraft: (draft: {
    name: string;
    portions: string;
    amounts: Record<string, string>;
  }) => void;
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
  captureDay: string;
  setCaptureDay: (day: string) => void;
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
  saveOnboardingProfile: (name: string, fitness?: FitnessSetupDraft | null, weightEntryId?: string, nutrition?: NutritionSetupResult | null) => Promise<void>;
  restoreRecords: (state: AppState) => Promise<void>;
  applyAgentAction: (
    action: AgentAction,
    status: "accepted" | "dismissed",
  ) => Promise<void>;
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
  const [captureDate, setCaptureDay] = useState("");
  const [recipeDraft, setRecipeDraft] = useState({
    name: "",
    portions: "4",
    amounts: {} as Record<string, string>,
  });
  const captureDay = captureDate || day;
  const [recordsReady, setRecordsReady] = useState(false);
  const scope = useRef(0);
  const [recordsRevision, setRecordsRevision] = useState(0);
  const recordScope = useCallback(() => scope.current, []);
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
  const readyRecords = useCallback(() => gate.current, [gate]);
  const waitForRecords = useCallback(() => gate.wait(), [gate]);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      const previousOwner = gate.owner;
      controller.current?.abort();
      setTool((previous) => (previous === "planner" ? null : previous));
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
            scope.current++;
            setRecordsRevision(scope.current);
            setDraft("");
            setCaptureDay("");
            setRecipeDraft({ name: "", portions: "4", amounts: {} });
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
    if (recordsRevision !== scope.current || !gate.current || !current.current)
      return false;
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
  async function saveOnboardingProfile(name: string, fitness?: FitnessSetupDraft | null, weightEntryId?: string, nutrition?: NutritionSetupResult | null) {
    const before = await gate.wait(),
      epoch = cloudEpoch();
    const named = stateSchema.parse({
      ...before,
      profile: {
        ...before.profile,
        ...(name.trim() ? { name: name.trim() } : {}),
      },
      spot: { ...before.spot, introSeen: true },
    });
    const started = fitness ? applyFitnessSetup(named, fitness, today(), weightEntryId ?? id()) : named;
    const next = stateSchema.parse(nutrition ? applyNutritionSetup(started, nutrition) : started);
    await saveDevice(next);
    if (epoch !== cloudEpoch() || gate.current !== before)
      throw Error("Your account changed. Please try setup again.");
    gate.set(next);
    current.current = next;
    setState(next);
  }
  async function applyAgentAction(
    action: AgentAction,
    status: "accepted" | "dismissed",
  ) {
    const before = gate.current;
    if (!before) throw Error("Your records are still loading.");
    const epoch = cloudEpoch(),
      signal = sessionSignal();
    signal.throwIfAborted();
    const next = stateSchema.parse(resolveAgentMeal(before, action, status));
    // saveDevice serializes writes for the captured owner. A successful server
    // acknowledgment must follow a durable meal AND its independent receipt.
    await saveDevice(next);
    if (signal.aborted || epoch !== cloudEpoch())
      throw Error(
        "Your account changed. Reopen Connections to check your saved review.",
      );
    if (current.current !== before) {
      if (current.current) await saveDevice(current.current);
      throw Error(
        "Your records changed during this review. Please review the proposal again.",
      );
    }
    current.current = next;
    gate.set(next);
    setState(next);
    setNotice(
      status === "accepted"
        ? "Meal logged on this device."
        : "Proposal dismissed.",
    );
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
          captureDay,
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
        recordsRevision,
        recordScope,
        recipeDraft,
        setRecipeDraft,
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
        captureDay,
        setCaptureDay,
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
        applyAgentAction,
        restoreRecords: async (next) => {
          const before = await gate.wait(),
            epoch = cloudEpoch();
          // Invalidate pending tools before replacing their input records. A
          // late generation must not write an old draft into the new snapshot.
          scope.current++;
          setRecordsRevision(scope.current);
          controller.current?.abort();
          setTool(null);
          setDraft("");
          setCaptureDay("");
          setLabelBarcode("");
          setRecipeDraft({ name: "", portions: "4", amounts: {} });
          try {
            await saveDevice(next);
          } catch (cause) {
            setNotice(
              "Records could not be replaced. Reopen your backup tools to try again.",
            );
            throw cause;
          }
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
