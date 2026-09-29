import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { usePasswordRecovery } from "./usePasswordRecovery";

export function PasswordRecovery({
  client,
}: {
  client: SupabaseClient | null;
}) {
  const recovery = usePasswordRecovery(client);
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState("");
  return (
    <section aria-label="Password recovery">
      {!recovery.open ? (
        <button
          type="button"
          className="cloud-link welcome-link"
          disabled={!client}
          onClick={recovery.start}
        >
          Forgot password?
        </button>
      ) : (
        <form
          className="edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            void (recovery.sentTo
              ? recovery.finish(code, password).then(() => {
                  setCode("");
                  setPassword("");
                })
              : recovery.send(email));
          }}
        >
          <h3>Let’s get you back in.</h3>
          {!recovery.sentTo ? (
            <label>
              Account email
              <input
                type="email"
                autoComplete="email"
                value={email}
                required
                maxLength={254}
                disabled={recovery.busy}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          ) : (
            <>
              <p>Enter the code sent to {recovery.sentTo}.</p>
              <label>
                Email code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  required
                  maxLength={10}
                  disabled={recovery.busy}
                  onChange={(e) => setCode(e.target.value)}
                />
              </label>
              <label>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  required
                  minLength={8}
                  maxLength={128}
                  disabled={recovery.busy}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </>
          )}
          <button
            className="button primary welcome-primary"
            disabled={recovery.busy || !client}
          >
            {recovery.busy
              ? "Please wait…"
              : recovery.sentTo
                ? "Set new password"
                : "Send recovery code"}
          </button>
          {recovery.sentTo && (
            <button
              type="button"
              className="cloud-link"
              disabled={recovery.busy}
              onClick={() => void recovery.send(recovery.sentTo)}
            >
              Send another code
            </button>
          )}
          <button
            type="button"
            className="cloud-link welcome-link"
            disabled={recovery.busy}
            onClick={() => {
              recovery.close();
              setCode("");
              setPassword("");
            }}
          >
            Back to sign in
          </button>
        </form>
      )}
      {recovery.error && (
        <p role="alert" className="cloud-feedback cloud-error">
          {recovery.error}
        </p>
      )}
      {recovery.notice && (
        <p role="status" className="cloud-feedback">
          {recovery.notice}
        </p>
      )}
    </section>
  );
}
