import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clearBrowserAccount } from "./account-storage";
import {
  browserAccountDeletion,
  useAccountSecurity,
} from "./useAccountSecurity";

export function AccountSecurity({ client }: { client: SupabaseClient }) {
  const actions = useAccountSecurity(
    client,
    (body, expectedUserId) =>
      browserAccountDeletion(client, body, expectedUserId),
    clearBrowserAccount,
  );
  const [mode, setMode] = useState<"password" | "delete" | null>(null),
    [current, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  return (
    <section className="cloud-account" aria-label="Account security">
      <h3>Account security</h3>
      {!mode && (
        <>
          <button
            type="button"
            className="cloud-link"
            onClick={() => setMode("password")}
          >
            Change password
          </button>
          <button
            type="button"
            className="cloud-link"
            onClick={() => setMode("delete")}
          >
            Delete my account
          </button>
        </>
      )}
      {mode && !actions.cleanupNeeded && (
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            void (
              mode === "password"
                ? actions.changePassword(current, password)
                : actions.deleteAccount(confirmation, current)
            ).finally(() => {
              setCurrent("");
              setPassword("");
            });
          }}
        >
          <h3>
            {mode === "password"
              ? "Choose a new password"
              : "Permanently delete your account?"}
          </h3>
          {mode === "delete" && (
            <p>
              This deletes your sign-in account, saved conversations, food and
              workout records, plans, and uploaded photos. This account’s copy
              on this device is cleared. Offline copies on other devices and
              downloaded exports may remain until removed. Export any records
              you want to keep first. This cannot be undone.
            </p>
          )}
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={current}
              disabled={actions.busy}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </label>
          {mode === "password" ? (
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                required
                value={password}
                disabled={actions.busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          ) : (
            <label>
              Type DELETE to delete your account
              <input
                autoComplete="off"
                value={confirmation}
                required
                disabled={actions.busy}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
          )}
          <button
            className="button primary"
            disabled={
              actions.busy || (mode === "delete" && confirmation !== "DELETE")
            }
          >
            {actions.busy
              ? "Please wait…"
              : mode === "password"
                ? "Update password"
                : "Permanently delete account"}
          </button>
          <button
            type="button"
            className="cloud-link"
            disabled={actions.busy}
            onClick={() => {
              setMode(null);
              setCurrent("");
              setPassword("");
              setConfirmation("");
            }}
          >
            Cancel
          </button>
        </form>
      )}
      {actions.cleanupNeeded && (
        <button
          type="button"
          className="button primary"
          disabled={actions.busy}
          onClick={() => void actions.retryCleanup()}
        >
          Retry device cleanup
        </button>
      )}
      {actions.error && (
        <p role="alert" className="cloud-feedback cloud-error">
          {actions.error}
        </p>
      )}
      {actions.notice && (
        <p role="status" className="cloud-feedback">
          {actions.notice}
        </p>
      )}
    </section>
  );
}
