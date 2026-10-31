import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { apiFetch } from "../../api-fetch";
import { AccountAccessError } from "../../account-access";
import {
  applyAIResult,
  buildAIRequest,
  markCaptureStopped,
  requestAI,
} from "../../ai-client";
import type { AIStatus } from "../../ai-contract";
import { clockTime, id, timestamp, type AppState } from "../../domain";

export type ChatAccess = "signin" | "setup" | "restricted";
/** `/api/status` as the web app sees it; `null` while a probe is in flight. */
export type ChatStatus = AIStatus & { access?: ChatAccess };

type Options = {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  /** Nutrition day a capture is being logged for, when the user picked one. */
  captureDay: string | null;
  notify: (message: string) => void;
  /** Called when a send needs sign-in or account setup first. */
  onAccountRequired: () => void;
};

/** Owns one in-flight AI request at a time: the AbortController, the
 * generation counter that rejects late results (ledger CHAT-COMPOSER-001),
 * processing/stage state and the `/api/status` probe. */
export function useAIRequest({
  state,
  setState,
  captureDay,
  notify,
  onAccountRequired,
}: Options) {
  const [processing, setProcessing] = useState(false);
  const [connectionRevision, setConnectionRevision] = useState(0);
  // The probe result is keyed by revision so a reconnect shows "checking"
  // (null) until its own probe answers, without a setState inside the effect.
  const [probe, setProbe] = useState<{ revision: number; status: ChatStatus } | null>(null);
  const aiStatus = probe && probe.revision === connectionRevision ? probe.status : null;
  const [aiStage, setAIStage] = useState("");
  const aiBusy = useRef(false);
  const aiGeneration = useRef(0);
  const aiRequestController = useRef<AbortController | null>(null);
  const aiRequestMessageId = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      aiGeneration.current++;
      aiRequestController.current?.abort();
    },
    [],
  );
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const setAIStatus = (status: ChatStatus) =>
      setProbe({ revision: connectionRevision, status });
    apiFetch("/api/status", {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then((r) => {
        if (r.status === 401) throw new AccountAccessError('signin', 'Sign in to chat with Spot.');
        if (r.status === 403) return { available: false, access: 'restricted' };
        if (!r.ok) throw new Error("Connection unavailable");
        return r.json();
      })
      .then((value) => {
        if (live)
          setAIStatus({
            available: value.available === true,
            jev: value.jev === true,
            model: value.model,
            access: value.access,
          });
      })
      .catch((error) => {
        if (live) setAIStatus({ available: false, jev: false, access: error instanceof AccountAccessError ? error.reason : undefined });
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [connectionRevision]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  /** Re-run the status probe (account change, reconnect button, back online). */
  const reconnect = useCallback(
    () => setConnectionRevision((revision) => revision + 1),
    [],
  );
  /** Abort and forget the pending request; the capture keeps whatever status it had. */
  const cancelPendingAI = useCallback(() => {
    aiGeneration.current++;
    aiRequestController.current?.abort();
    aiRequestController.current = null;
    aiRequestMessageId.current = null;
    aiBusy.current = false;
    setProcessing(false);
    setAIStage("");
  }, []);
  /** User-initiated stop: abort like a reset, but keep the capture as a retryable error. */
  function stopResponse() {
    const messageId = aiRequestMessageId.current;
    cancelPendingAI();
    if (messageId) setState((s) => markCaptureStopped(s, messageId));
  }
  async function sendAI(text: string, image?: string, retryId?: string, captureIntent?: "meal") {
    if (aiBusy.current) return;
    if (aiStatus?.access === 'signin' || aiStatus?.access === 'setup') {
      onAccountRequired();
      return;
    }
    if (!aiStatus?.available) {
      notify(
        "Connected chat isn’t available right now. Your capture is saved; reconnect and try again.",
      );
      return;
    }
    const previousMessage = retryId ? state.messages.find(m => m.id === retryId) : undefined;
    const reread = previousMessage?.captureIntent === 'receipt' && previousMessage.aiStatus === 'complete' &&
      !state.messages.some(m => m.requestId === retryId && m.receiptId);
    const message = reread
      ? { ...previousMessage!, id: id(), time: clockTime(), at: timestamp(), aiStatus: 'pending' as const, aiError: undefined }
      : retryId
      ? state.messages.find((m) => m.id === retryId)
      : {
          id: id(),
          role: "user" as const,
          text,
          time: clockTime(),
          at: timestamp(),
          image,
          captureIntent: image ? captureIntent : undefined,
          ai: true,
          aiStatus: "pending" as const,
          captureDay: captureDay ?? undefined,
        };
    if (!message) return;
    if (message.aiStatus === 'complete') return;
    const generation = ++aiGeneration.current;
    const controller = new AbortController();
    aiRequestController.current = controller;
    aiRequestMessageId.current = message.id;
    aiBusy.current = true;
    setProcessing(true);
    setAIStage("Connecting to Rep & Plate…");
    setState((s) => ({
      ...s,
      messages: reread
        ? [...s.messages.map(m => m.id === retryId ? { ...m, captureReviewId: undefined } : m), message]
        : retryId
        ? s.messages.map((m) =>
            m.id === retryId
              ? { ...m, aiStatus: "pending", aiError: undefined }
              : m,
          )
        : [...s.messages, message],
    }));
    try {
      const result = await requestAI(
        buildAIRequest(state, message),
        (stage) => {
          if (generation === aiGeneration.current) setAIStage(stage);
        },
        controller.signal,
      );
      if (generation !== aiGeneration.current) return;
      setState((s) =>
        generation === aiGeneration.current ? applyAIResult(s, result) : s,
      );
    } catch (error) {
      if (generation !== aiGeneration.current) return;
      const messageText =
        error instanceof Error && error.name === "TimeoutError"
          ? "That took longer than expected. Your capture is still here; please retry."
          : error instanceof Error
            ? error.message
            : "Something interrupted that response. Please retry.";
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === message.id
            ? { ...m, aiStatus: "error", aiError: messageText }
            : m,
        ),
      }));
    } finally {
      if (generation === aiGeneration.current) {
        aiRequestController.current = null;
        aiRequestMessageId.current = null;
        aiBusy.current = false;
        setProcessing(false);
        setAIStage("");
      }
    }
  }
  /** Retry a failed or stopped capture by its message id. */
  function retry(messageId: string) {
    void sendAI("", undefined, messageId);
  }
  /** Local (non-AI) replies show the processing indicator briefly; presentation only. */
  function showLocalProcessing() {
    setProcessing(true);
    timer.current = setTimeout(() => setProcessing(false), 600);
  }
  return {
    aiStatus,
    processing,
    aiStage,
    isBusy: () => aiBusy.current,
    sendAI,
    stopResponse,
    cancelPendingAI,
    retry,
    reconnect,
    showLocalProcessing,
  };
}
