import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { isHostedBrowser } from "../../api-fetch";
import { onAccountChange } from "../cloud/sync-control";
import { initialState, type AppState } from "../../domain";

export type AccountMode = "signin" | "signup";

type Options = {
  setState: Dispatch<SetStateAction<AppState>>;
  /** Stable: abort the in-flight AI request (owner change, restore, reset). */
  cancelPendingAI: () => void;
  /** Stable: close record-bound dialogs and drop capture drafts. */
  clearCaptureDrafts: (keepComposer?: boolean) => void;
  /** Stable: re-run the chat status probe. */
  reconnect: () => void;
  openDialog: (kind: "cloud") => void;
  closeDialog: (kind: "cloud") => void;
};

/** The account side of the shell: which owner the records belong to, when the
 * account dialog is open for chat versus the profile, and the resets that an
 * owner change, a restore or a fresh start require (ledger PERSONA-PLAN-002,
 * READINESS-001). */
export function useAccountSession({
  setState,
  cancelPendingAI,
  clearCaptureDrafts,
  reconnect,
  openDialog,
  closeDialog,
}: Options) {
  /** A guest who opened the account dialog from chat keeps the composer draft
   * through the owner switch that sign-in causes. */
  const preserveGuestChatDraft = useRef(false);
  const [profileAccountMode, setProfileAccountMode] = useState<AccountMode>("signin");
  const [chatAccountMode, setChatAccountMode] = useState<AccountMode | null>(null);
  useEffect(() => {
    let owner = localStorage.getItem("health.records.owner");
    return onAccountChange(() => {
      const next = localStorage.getItem("health.records.owner");
      if (next !== owner) {
        const keepDraft = !owner && !!next && preserveGuestChatDraft.current;
        preserveGuestChatDraft.current = false;
        owner = next;
        clearCaptureDrafts(keepDraft);
        cancelPendingAI();
      }
    });
  }, [cancelPendingAI, clearCaptureDrafts]);
  useEffect(() => {
    const refresh = reconnect;
    const unsubscribe = onAccountChange(refresh);
    let active = true;
    let unsubscribeAuth = () => {};
    if (isHostedBrowser()) void import('../cloud/client').then(async ({ getCloudClient }) => {
      const client = await getCloudClient();
      if (!active || !client) return;
      const sub = client.auth.onAuthStateChange(() => refresh());
      unsubscribeAuth = () => sub.data.subscription.unsubscribe();
    }).catch(() => {});
    window.addEventListener("online", refresh);
    return () => {
      unsubscribe();
      active = false;
      unsubscribeAuth();
      window.removeEventListener("online", refresh);
    };
  }, [reconnect]);

  /** Chat needs an account: open the dialog in chat framing. */
  function openChatAccount(mode: AccountMode = "signin") {
    preserveGuestChatDraft.current = !localStorage.getItem("health.records.owner");
    setChatAccountMode(mode);
    openDialog("cloud");
  }
  /** Profile/header entry: open the dialog in account framing. */
  function openProfileAccount(mode: AccountMode = "signin") {
    setProfileAccountMode(mode);
    openDialog("cloud");
  }
  /** CloudAccount finished for chat (`ready`) or was dismissed (`closed`);
   * either way the status probe runs again. */
  function dismissCloud(reason: "ready" | "closed") {
    closeDialog("cloud");
    setChatAccountMode(null);
    if (reason === "closed") preserveGuestChatDraft.current = false;
    reconnect();
  }
  /** Replace device records with an account copy (manual or automatic restore). */
  function restoreRecords(value: AppState) {
    cancelPendingAI();
    clearCaptureDrafts();
    setState(value);
  }
  /** Fresh start from the profile editor. */
  function resetRecords() {
    cancelPendingAI();
    setState(initialState());
    clearCaptureDrafts();
  }
  return {
    chatAccountMode,
    profileAccountMode,
    openChatAccount,
    openProfileAccount,
    dismissCloud,
    restoreRecords,
    resetRecords,
  };
}
