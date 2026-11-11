import { useCallback, useReducer } from "react";

/** Every overlay App.tsx can show. Dialogs are independent, not mutually
 * exclusive: the account dialog can sit on top of the pantry (a dinner request
 * from an open PantryDialog that needs sign-in), and receipt capture reopens
 * after the account dialog closes. Three kinds carry what they were opened for. */
export type Dialog =
  | { kind: "coaching" }
  | { kind: "decisions" }
  | { kind: "lifeContext" }
  | { kind: "household" }
  | { kind: "captureInbox" }
  | { kind: "profile" }
  | { kind: "capture" }
  | { kind: "scanner" }
  | { kind: "preferences" }
  | { kind: "shopping" }
  | { kind: "recipes" }
  | { kind: "planner" }
  | { kind: "workoutBuilder" }
  | { kind: "voice" }
  | { kind: "cloud" }
  | { kind: "headerAccount" }
  | { kind: "connections" }
  | { kind: "pantry"; receiptId: string }
  | { kind: "label"; gtin: string }
  | { kind: "pantryLinks"; mealId: string };
export type DialogKind = Dialog["kind"];
/** Kinds that open without a payload. */
export type PlainDialogKind = Exclude<Dialog, { kind: "pantry" | "label" | "pantryLinks" }>["kind"];
export type DialogState = { readonly [K in DialogKind]?: Extract<Dialog, { kind: K }> };
export type DialogAction =
  | { type: "open"; dialog: Dialog }
  | { type: "close"; kind: DialogKind }
  | { type: "close-many"; kinds: readonly DialogKind[] };

/** The record-bound dialogs that an owner change, restore or reset closes
 * (`clearCaptureDrafts`). Capture is handled separately because a receipt
 * capture may survive the sign-in it asked for; cloud, header account and
 * connections stay open on purpose. */
export const RECORD_BOUND_DIALOGS = [
  "coaching",
  "decisions",
  "lifeContext",
  "household",
  "captureInbox",
  "planner",
  "preferences",
  "shopping",
  "workoutBuilder",
  "voice",
  "profile",
  "pantry",
  "pantryLinks",
  "recipes",
  "scanner",
  "label",
] as const satisfies readonly DialogKind[];

function sameDialog(a: Dialog | undefined, b: Dialog): boolean {
  if (!a || a.kind !== b.kind) return false;
  const left = Object.entries(a), right = Object.entries(b);
  return left.length === right.length && left.every(([key, value]) => (b as Record<string, unknown>)[key] === value);
}

/** Pure transitions. Reopening an already open dialog with the same payload
 * and closing a closed one return the same state object, matching the
 * `setX(false)` bail-out the booleans had. */
export function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case "open":
      if (sameDialog(state[action.dialog.kind], action.dialog)) return state;
      return { ...state, [action.dialog.kind]: action.dialog };
    case "close": {
      if (!state[action.kind]) return state;
      const next = { ...state };
      delete next[action.kind];
      return next;
    }
    case "close-many": {
      let next = state;
      for (const kind of action.kinds) {
        if (!next[kind]) continue;
        if (next === state) next = { ...state };
        delete (next as { [K in DialogKind]?: Dialog })[kind];
      }
      return next;
    }
  }
}

/** Deep links: `#receipt` opens receipt capture, `#connections` the agent hub. */
export function initialDialogs(hash: string): DialogState {
  const state: { [K in DialogKind]?: Dialog } = {};
  if (hash === "#receipt") state.capture = { kind: "capture" };
  if (hash === "#connections") state.connections = { kind: "connections" };
  return state as DialogState;
}

export function useDialogs() {
  const [dialogs, dispatch] = useReducer(dialogReducer, location.hash, initialDialogs);
  const openDialog = useCallback(
    (dialog: Dialog | PlainDialogKind) =>
      dispatch({ type: "open", dialog: typeof dialog === "string" ? ({ kind: dialog } as Dialog) : dialog }),
    [],
  );
  const closeDialog = useCallback((kind: DialogKind) => dispatch({ type: "close", kind }), []);
  const closeDialogs = useCallback((kinds: readonly DialogKind[]) => dispatch({ type: "close-many", kinds }), []);
  return { dialogs, openDialog, closeDialog, closeDialogs };
}
