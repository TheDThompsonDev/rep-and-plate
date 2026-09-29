import {
  createContext,
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
import { loadDevice, saveDevice, spotVisit } from "./storage";
import { isComeback } from '../../src/features/spot/model';
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
  send: (text: string, image?: string, retry?: string) => Promise<void>;
  cancel: () => void;
};
const Context = createContext<Store>(null!);
export const useHealth = () => useContext(Context);
export function HealthProvider({ children }: { children: ReactNode }) {
  const [captureRequest,setCaptureRequest]=useState(0);
  const [spotReturning,setSpotReturning]=useState(false);
  const [spotIntroReplay,setSpotIntroReplay]=useState(false);
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
  const current = useRef<AppState | null>(null),
    controller = useRef<AbortController | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([loadDevice(),spotVisit.get().catch(()=>null)])
      .then(([s,lastVisit]) => {
        if (live) {
          current.current = s;
          setState(s);
          setSpotReturning(isComeback(lastVisit ?? s.spot?.lastVisit));
          void spotVisit.touch().catch(()=>{});
        }
      })
      .catch((e) => {
        if (live) setError(String(e.message));
      });
    loadConnection().catch(() => {});
    return () => {
      live = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    const refresh = () => setDay(today());
    const sub = Lifecycle.addEventListener("change", (v) => {
      if (v === "active") refresh();
      void spotVisit.touch().catch(()=>{});
    });
    const timer = setInterval(refresh, 15000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  function change(update: (s: AppState) => AppState) {
    if (!current.current) return false;
    try {
      const next = stateSchema.parse(update(current.current));
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
  async function send(text: string, image?: string, retry?: string) {
    if (controller.current || !current.current || (!text.trim() && !image))
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
        setProgress,
        abort.signal,
      );
      if (!abort.signal.aborted) change((s) => applyAIResult(s, result));
    } catch (e) {
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
      controller.current = null;
      setBusy(false);
      setProgress("");
    }
  }
  return (
    <Context.Provider
      value={{
        captureRequest,
        tellSpot: () => {setTab('Chat');setCaptureRequest(n=>n+1);},
        spotReturning,
        dismissSpotReturn: () => setSpotReturning(false),
        spotIntroReplay,
        replaySpotIntro: () => {setSpotIntroReplay(true);setSpotReturning(false);setTab('Chat');},
        dismissSpotIntro: () => setSpotIntroReplay(false),
        state,
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
        send,
        cancel: () => controller.current?.abort(),
      }}
    >
      {children}
    </Context.Provider>
  );
}
