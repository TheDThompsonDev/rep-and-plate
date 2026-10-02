import { useQuickAccount } from "./useQuickAccount";
import "../progress/fitness-setup.css";
const getQuickClient = async () => (await import("./client")).getCloudClient();

export function QuickAccount({
  onSignIn,
  onCreateAccount,
}: {
  onSignIn: () => void;
  onCreateAccount: () => void;
}) {
  const account = useQuickAccount(getQuickClient);
  return (
    <section className="quick-account" aria-label="Quick account access">
      <p>
        {account.loading
          ? "Checking your account…"
          : account.user
            ? `Signed in as ${account.user.email ?? "your account"}`
            : "Using this device. Sign in to connect your account."}
      </p>
      {account.user ? (
        <button
          disabled={account.busy || account.loading}
          onClick={() => void account.signOut()}
        >
          {account.busy ? "Signing out…" : "Sign out"}
        </button>
      ) : (
        <>
          <button disabled={account.loading} onClick={onSignIn}>
            Sign in
          </button>
          <button
            className="secondary"
            disabled={account.loading}
            onClick={onCreateAccount}
          >
            Create account
          </button>
        </>
      )}
      {account.error && <p role="alert">{account.error}</p>}
    </section>
  );
}
