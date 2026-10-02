import { useEffect, useRef, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { Cloud, Download, Upload, LogOut, Trash2, Check } from "lucide-react";
import { Modal } from "../../components";
import type { AppState } from "../../domain";
import {
  deleteSnapshot,
  exportDevice,
  getCloudClient,
  loadSnapshot,
  prepareSnapshot,
  readSnapshotMetadata,
  saveSnapshot,
  snapshotSummary,
  SnapshotConflict,
  type SavedSnapshot,
  type SnapshotMetadata,
} from "./client";
import "./cloud.css";
import { isHostedBrowser } from "../../api-fetch";
import { requireBrowserOwner } from "./client";
import { PasswordRecovery } from "./PasswordRecovery";
import { AccountSecurity } from "./AccountSecurity";
import { pauseCloudSync, resumeCloudSync } from "./sync-control";
import { ONBOARDING_KEY, parseOnboarding, defaultFocus } from '../onboarding/model';

type Review =
  | { kind: "upload"; state: AppState }
  | { kind: "load"; snapshot: SavedSnapshot }
  | { kind: "delete" }
  | null;

export default function CloudAccount({
  state,
  onRestore,
  onClose,
  initialMode = 'signin',
  forChat = false,
  forReceipt = false,
  onChatReady,
}: {
  state: AppState;
  onRestore: (state: AppState) => void;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  forChat?: boolean;
  forReceipt?: boolean;
  onChatReady?: () => void;
}) {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [signingUp, setSigningUp] = useState(initialMode === 'signup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [metadata, setMetadata] = useState<SnapshotMetadata | null>(null);
  const [checked, setChecked] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [review, setReview] = useState<Review>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const alive = useRef(true);
  const currentUser = useRef<string | null>(null);
  const busyRef = useRef(false);
  const local = snapshotSummary(state);

  useEffect(() => {
    alive.current = true;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getCloudClient()
      .then(async (connection) => {
        if (!active) return;
        setConfigured(!!connection);
        setClient(connection);
        if (!connection) return;
        const update = (next: User | null) => {
          currentUser.current = next?.id ?? null;
          setUser(next);
        };
        const { data } = connection.auth.onAuthStateChange(
          (_event, session) => {
            if (active) update(session?.user ?? null);
          },
        );
        unsubscribe = () => data.subscription.unsubscribe();
        const session = await connection.auth.getSession();
        if (active) update(session.data.session?.user ?? null);
      })
      .catch(() => {
        if (active) {
          setConfigured(false);
          setError(
            "Account settings could not be loaded. Close this window and try again.",
          );
        }
      });
    return () => {
      active = false;
      alive.current = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    setMetadata(null);
    setChecked(false);
    setReview(null);
    setConflict(false);
    if (!client || !user || forChat) return;
    let cancelled = false;
    readSnapshotMetadata(client, user.id)
      .then((saved) => {
        if (!cancelled) {
          setMetadata(saved);
          setChecked(true);
        }
      })
      .catch((caught) => {
        if (!cancelled)
          setError(
            caught instanceof Error
              ? caught.message
              : "Your saved copy could not be checked.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [client, user?.id, forChat]);

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (caught) {
      if (alive.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : "That request could not be completed.",
        );
        if (caught instanceof SnapshotConflict) setConflict(true);
      }
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const accountStillCurrent = (id: string) =>
    alive.current && currentUser.current === id;
  const checkSaved = () =>
    run(async () => {
      if (!client || !user) return;
      const saved = await readSnapshotMetadata(client, user.id);
      if (accountStillCurrent(user.id)) {
        setMetadata(saved);
        setChecked(true);
      }
    });
  const requestLoad = () =>
    run(async () => {
      if (!client || !user) return;
      if (isHostedBrowser()) await requireBrowserOwner(client);
      const saved = await loadSnapshot(client, user.id);
      if (!accountStillCurrent(user.id)) return;
      if (!saved) {
        setNotice("This account does not have a saved copy yet.");
        setMetadata(null);
        setChecked(true);
        setConflict(false);
        return;
      }
      setReview({ kind: "load", snapshot: saved });
      setAcknowledged(false);
    });
  const confirm = () =>
    run(async () => {
      if (!client || !user || !review) return;
      if (review.kind === "upload") {
        if (!acknowledged || !checked || conflict) return;
        if (isHostedBrowser()) await requireBrowserOwner(client);
        const saved = await saveSnapshot(
          client,
          user.id,
          review.state,
          metadata?.revision ?? 0,
        );
        if (accountStillCurrent(user.id)) {
          setMetadata(saved);
          setReview(null);
          setNotice(
            "This device's records are saved to your account. The account save status shows when later changes are saved.",
          );
        }
      } else if (review.kind === "load") {
        if (
          !acknowledged ||
          !accountStillCurrent(user.id) ||
          review.snapshot.user_id !== user.id
        )
          return;
        onRestore(review.snapshot.state);
        setMetadata(review.snapshot);
        setChecked(true);
        setConflict(false);
        setReview(null);
        setNotice("Your saved records replaced the records on this device.");
      } else {
        if (deleteText !== "DELETE" || !metadata) return;
        pauseCloudSync();
        try {
          await deleteSnapshot(client, user.id, metadata.revision);
        } catch (error) {
          resumeCloudSync();
          throw error;
        }
        if (accountStillCurrent(user.id)) {
          setMetadata(null);
          setChecked(true);
          setReview(null);
          setNotice(
            "Your cloud copy was deleted and automatic saving is paused on this device. Other devices can still save their copies. Use Delete my account to remove the entire account.",
          );
        }
      }
    });

  return (
    <Modal title={forReceipt ? 'Read receipts with Spot' : forChat ? 'Chat with Spot' : 'Your account & saved records'} onClose={onClose}>
      <div className="fuel-cloud">
        {forReceipt ? <p className="cloud-feedback">Sign in and confirm your device records to read receipts. Your photo stays ready while you finish. During private preview, receipt reading needs an approved account.</p> : forChat && <p className="cloud-feedback">Chat is available to signed-in users. Create an account or sign in to ask health and fitness questions and log meals with Spot. Your unsent message stays in the composer.</p>}
        {forChat && <p className="cloud-footnote">During the private beta, your account also needs chat access enabled.</p>}
        {user && (
          <section className="cloud-account" aria-label="Signed-in account">
            <strong>Signed in as {user.email || "your account"}</strong>
            <button
              className="button secondary cloud-sign-out"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const response = await client!.auth.signOut({
                    scope: "local",
                  });
                  if (response.error) {
                    const remaining = await client!.auth.getSession();
                    throw new Error(
                      remaining.data.session
                        ? "Sign-out could not be completed. Try again."
                        : "Signed out on this device, but the server could not confirm sign-out. Your saved records remain here.",
                    );
                  }
                  if (alive.current)
                    setNotice(
                      "Signed out. This device's Rep & Plate records remain here.",
                    );
                })
              }
            >
              <LogOut size={16} /> Sign out on this device
            </button>
            <p>
              Signing out keeps this browser’s records. To see the introduction
              again, choose Meet Spot at the top of You.
            </p>
          </section>
        )}
        {configured && !user && (
          <p className="cloud-feedback">
            You’re not signed in to an account. Your profile and records are
            saved in this browser.
          </p>
        )}
        {!forChat && <div className="cloud-intro">
          <span>
            <Cloud size={24} />
          </span>
          <div>
            <h3>Your records, wherever you are.</h3>
            <p>
              Your account saves changes automatically. You can also export or
              review a saved copy here.
            </p>
          </div>
        </div>}
        {error && (
          <p role="alert" className="cloud-feedback cloud-error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="cloud-feedback">
            {notice}
          </p>
        )}
        {configured === null && <p role="status">Checking account settings…</p>}
        {client && user && isHostedBrowser() && (
          <div className="cloud-feedback">
            <p>
              Link these browser records to your account before using the beta.
              Signing out keeps records on this personal device.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const session = await requireBrowserOwner(client, true);
                  if (!accountStillCurrent(session.user.id)) return;
                  const onboarding = parseOnboarding(localStorage.getItem(ONBOARDING_KEY));
                  localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ version: 1, mode: 'account', userId: session.user.id, focus: onboarding?.focus ?? defaultFocus }));
                  setNotice("Device records linked. Return to chat to check your connection.");
                  if (forChat) onChatReady?.();
                })
              }
            >
              These device records are mine
            </button>
          </div>
        )}
        {configured === false && (
          <p>
            Cloud accounts are not connected yet. Your records are still saved
            on this device, and you can export a copy below.
          </p>
        )}
        {configured && !user && (
          <form
            className="edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const values = new FormData(form);
              void run(async () => {
                if (!client) return;
                const email = String(values.get("email")).trim();
                const password = String(values.get("password"));
                const response = signingUp
                  ? await client.auth.signUp({ email, password })
                  : await client.auth.signInWithPassword({ email, password });
                if (response.error) {
                  const code = response.error.code;
                  if (code === "email_not_confirmed")
                    throw new Error("Confirm your email first, then sign in.");
                  if (
                    [
                      "over_email_send_rate_limit",
                      "over_request_rate_limit",
                    ].includes(code || "")
                  )
                    throw new Error(
                      "Too many attempts. Wait a little before trying again.",
                    );
                  if (code === "weak_password")
                    throw new Error(
                      "Choose a stronger password that meets your account's password rules.",
                    );
                  throw new Error(
                    signingUp
                      ? "The account could not be created. Check your email and password, or try signing in if you already have an account."
                      : "Sign-in did not work. Check your email and password, and confirm your email if needed.",
                  );
                }
                if (!alive.current) return;
                form.reset();
                setNotice(
                  signingUp && !response.data.session
                    ? "Check your email for the confirmation link, then return here and sign in."
                    : "Signed in. Nothing was uploaded or replaced automatically.",
                );
              });
            }}
          >
            <h3>{signingUp ? "Create your account" : "Sign in"}</h3>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                disabled={busy}
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={signingUp ? "new-password" : "current-password"}
                minLength={signingUp ? 8 : 1}
                required
                disabled={busy}
              />
            </label>
            <button className="button primary full-width" disabled={busy}>
              {busy ? "Please wait…" : signingUp ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              className="cloud-link"
              disabled={busy}
              onClick={() => {
                setSigningUp(!signingUp);
                setError("");
              }}
            >
              {signingUp
                ? "Already have an account? Sign in"
                : "Create an account"}
            </button>
          </form>
        )}
        {user && !forChat && (
          <>
            {client && <AccountSecurity client={client} />}
            <section className="cloud-account">
              <strong>{user.email || "Signed-in account"}</strong>
              <span>
                {metadata
                  ? `Saved revision ${metadata.revision} · ${new Date(metadata.updated_at).toLocaleString()}`
                  : checked
                    ? "No saved copy yet"
                    : "Checking your saved copy…"}
              </span>
              <button
                className="cloud-link"
                disabled={busy}
                onClick={checkSaved}
              >
                Check saved copy
              </button>
            </section>
            {!review && (
              <div className="cloud-actions">
                <button
                  disabled={busy || !checked || conflict}
                  onClick={() => {
                    try {
                      setReview({
                        kind: "upload",
                        state: prepareSnapshot(state),
                      });
                      setAcknowledged(false);
                      setError("");
                    } catch (caught) {
                      setError(
                        caught instanceof Error
                          ? caught.message
                          : "These records need a check.",
                      );
                    }
                  }}
                >
                  <Upload size={18} />
                  <span>
                    <strong>Upload this device's records</strong>
                    <small>
                      {metadata
                        ? "Replace the saved copy after review"
                        : "Create your first saved copy"}
                    </small>
                  </span>
                </button>
                <button disabled={busy} onClick={requestLoad}>
                  <Download size={18} />
                  <span>
                    <strong>Load my saved records</strong>
                    <small>Review before replacing this device</small>
                  </span>
                </button>
                <button
                  disabled={busy || !metadata}
                  onClick={() => {
                    setReview({ kind: "delete" });
                    setDeleteText("");
                  }}
                >
                  <Trash2 size={18} />
                  <span>
                    <strong>Delete my cloud copy</strong>
                    <small>Your device records will remain</small>
                  </span>
                </button>
              </div>
            )}
            {review && (
              <section className="cloud-review">
                <h3>
                  {review.kind === "upload"
                    ? "Review your upload"
                    : review.kind === "load"
                      ? "Replace this device's records?"
                      : "Delete your cloud copy?"}
                </h3>
                {review.kind !== "delete" && (
                  <>
                    <p>
                      {review.kind === "upload"
                        ? "These device records will be sent to your Supabase account. This includes conversations, nutrition records, pantry, preferences, plans, workouts, timed activities, body measurements, and any photos stored with them."
                        : "The saved copy will replace meals, conversations, pantry, preferences, plans, workouts, timed activities and body measurements on this device. Device-only changes will be lost unless you export them first."}
                    </p>
                    <RecordCounts
                      state={
                        review.kind === "upload"
                          ? review.state
                          : review.snapshot.state
                      }
                    />
                    <label className="cloud-ack">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(event) =>
                          setAcknowledged(event.target.checked)
                        }
                      />
                      {review.kind === "upload"
                        ? "I want these records saved to this account."
                        : "I understand this replaces this device's records."}
                    </label>
                  </>
                )}
                {review.kind === "delete" && (
                  <>
                    <p>
                      This deletes the saved Rep & Plate data for{" "}
                      {user.email || "your account"}. It does not delete your
                      sign-in account or the copy on this device.
                    </p>
                    <label>
                      Type DELETE to confirm
                      <input
                        value={deleteText}
                        onChange={(event) => setDeleteText(event.target.value)}
                        autoComplete="off"
                      />
                    </label>
                  </>
                )}
                <button
                  className="button primary full-width"
                  disabled={
                    busy ||
                    (review.kind === "upload" && (conflict || !checked)) ||
                    (review.kind === "delete"
                      ? deleteText !== "DELETE"
                      : !acknowledged)
                  }
                  onClick={confirm}
                >
                  <Check size={17} />
                  {busy
                    ? "Please wait…"
                    : review.kind === "upload"
                      ? "Upload reviewed records"
                      : review.kind === "load"
                        ? "Replace this device"
                        : "Delete cloud copy"}
                </button>
                <button
                  className="cloud-link"
                  disabled={busy}
                  onClick={() => setReview(null)}
                >
                  Cancel
                </button>
              </section>
            )}
          </>
        )}
        {configured && !user && <PasswordRecovery client={client} />}
        {!forChat && <section className="cloud-local">
          <h3>On this device</h3>
          <p>
            {local.meals} meals · {local.groceries} grocery trips ·{" "}
            {local.messages} messages · {local.recipeBatches} prepared batches · {local.workouts} workouts · {local.activities} timed activities · {local.bodyWeights} body measurements
          </p>
          <button
            className="you-dialog-action"
            onClick={() => exportDevice(state)}
          >
            <Download size={17} /> Export this device's records
          </button>
          <p className="cloud-footnote">
            Changes save automatically while connected. Export a backup for your
            own records. Signing out keeps this account’s separate local copy on
            this device.
          </p>
        </section>}
      </div>
    </Modal>
  );
}

function RecordCounts({ state }: { state: AppState }) {
  const summary = snapshotSummary(state);
  return (
    <div className="cloud-counts">
      <span>{summary.meals} meals</span>
      <span>{summary.groceries} grocery trips</span>
      <span>{summary.messages} messages</span>
      <span>{summary.plans} plans</span>
      <span>{summary.recipeBatches} prepared batches</span>
      <span>{summary.workouts} workouts</span>
      <span>{summary.activities} timed activities</span>
      <span>{summary.bodyWeights} body measurements</span>
      <span>{summary.embeddedPhotos} embedded photos</span>
      <span>{(summary.bytes / 1000000).toFixed(2)} MB</span>
    </div>
  );
}
