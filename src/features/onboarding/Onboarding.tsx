import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, LogOut } from "lucide-react";
import { readState } from "../../domain";
import {
  hydrateBrowserRecords,
  persistBrowserRecords,
} from "../../platform/browser-records";
import { introduction, focusChoices, ONBOARDING_KEY } from "./model";
import { useOnboarding, type OnboardingAdapter } from "./useOnboarding";
import { spotScenes } from "../spot/scenes";
import "./onboarding.css";
import { PasswordRecovery } from "../cloud/PasswordRecovery";

const adapter: OnboardingAdapter = {
  read: async () => {
    await hydrateBrowserRecords();
    return localStorage.getItem(ONBOARDING_KEY);
  },
  write: async (value) => {
    localStorage.setItem(ONBOARDING_KEY, value);
  },
  owner: async () => localStorage.getItem("health.records.owner"),
  client: async () => (await import("../cloud/client")).getCloudClient(),
  verifyOwner: async (client, bind) =>
    (await import("../cloud/client")).requireBrowserOwner(client, bind),
};
export default function Onboarding({
  children,
}: {
  children: (replay: () => void) => ReactNode;
}) {
  const flow = useOnboarding(adapter);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [name, setName] = useState(""),
    [focus, setFocus] = useState(focusChoices[2]);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    title.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [flow.step, flow.slide]);
  const intro = introduction[flow.slide];
  const scene =
    flow.step === "intro"
      ? intro.scene
      : flow.step === "setup"
        ? "dinner-conspiracy"
        : flow.step === "ready"
          ? "shaker-ritual"
          : "press-conference";
  const complete = () =>
    flow.finish(focus, async () => {
      const saved = readState();
      const next = {
        ...saved,
        profile: {
          ...saved.profile,
          ...(name.trim() ? { name: name.trim() } : {}),
        },
        spot: { ...saved.spot, introSeen: true },
      };
      await persistBrowserRecords(next);
      location.hash = "chat";
    });
  const show = !flow.entered || flow.replaying;
  return (
    <>
      {flow.entered && (
        <div hidden={flow.replaying}>{children(flow.replay)}</div>
      )}
      {show && (
        <main className="welcome-shell" aria-label="Welcome to Rep & Plate">
          <header className="welcome-header">
            <span className="welcome-brand">
              Rep & Plate<span aria-hidden="true">®</span>
            </span>
            {flow.replaying ? (
              <button onClick={flow.closeReplay}>Close tour</button>
            ) : flow.user ? (
              <button disabled={flow.busy} onClick={() => void flow.signOut()}>
                <LogOut size={16} />
                Sign out
              </button>
            ) : (
              <button
                disabled={flow.busy}
                onClick={() => flow.account("signin")}
              >
                Sign in <ArrowRight size={16} />
              </button>
            )}
          </header>
          <div className="welcome-layout">
            <div className={`welcome-art welcome-art-${flow.step}`}>
              <span className="welcome-sticker">
                SMALL PLATE.
                <br />
                BIG PERSONALITY.
              </span>
              <img
                key={scene}
                src={`/images/spot/scenes/${scene}.png`}
                alt={spotScenes[scene].alt}
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
              <p>
                {flow.step === "intro"
                  ? intro.line
                  : flow.step === "ready"
                    ? "The prophecy is complete."
                    : "I have been preparing for this my entire shelf life."}
              </p>
            </div>
            <section className="welcome-content" key={flow.step}>
              {flow.loading ? (
                <>
                  <p className="welcome-eyebrow">ONE MOMENT</p>
                  <h1 ref={title} tabIndex={-1}>
                    Spot’s getting ready.
                  </h1>
                  <p role="status">Checking your account and this device…</p>
                </>
              ) : (
                <>
                  {flow.step !== "welcome" && (
                    <div
                      className="welcome-progress"
                      aria-label={
                        flow.step === "intro"
                          ? `Meet Spot, ${flow.slide + 1} of ${introduction.length}`
                          : "Your setup"
                      }
                    >
                      <span>01 · Meet Spot</span>
                      <span
                        className={flow.step === "account" ? "current" : ""}
                      >
                        02 · Your account
                      </span>
                      <span
                        className={
                          ["setup", "ready"].includes(flow.step)
                            ? "current"
                            : ""
                        }
                      >
                        03 · Make it yours
                      </span>
                    </div>
                  )}
                  {flow.step === "welcome" && (
                    <>
                      <p className="welcome-eyebrow">
                        YOUR NEW SIDEKICK HAS ARRIVED
                      </p>
                      <h1 ref={title} tabIndex={-1}>
                        Good food.
                        <br />
                        Real life.
                        <br />
                        <em>A very invested plate.</em>
                      </h1>
                      <p>
                        Meet Spot. Your food and workout buddy with helpful
                        ideas, questionable levels of enthusiasm, and absolutely
                        no chill about your small wins.
                      </p>
                      <button
                        className="welcome-primary"
                        onClick={flow.startTour}
                      >
                        Meet Spot <ArrowRight size={19} />
                      </button>
                      {flow.user ? (
                        <button
                          className="welcome-secondary"
                          onClick={() => flow.setStep("setup")}
                        >
                          Continue with my account
                        </button>
                      ) : (
                        <button
                          className="welcome-secondary"
                          onClick={() => flow.account("signup")}
                        >
                          Create account
                        </button>
                      )}
                      <p className="welcome-fine">
                        A little introduction. A little setup. A lot of
                        personality.
                      </p>
                    </>
                  )}
                  {flow.step === "intro" && (
                    <>
                      <p className="welcome-eyebrow">
                        MEET SPOT · {flow.slide + 1} OF {introduction.length}
                      </p>
                      <h1 ref={title} tabIndex={-1}>
                        {intro.title}
                      </h1>
                      <h2>{intro.line}</h2>
                      <p>{intro.detail}</p>
                      <div className="welcome-dots" aria-hidden="true">
                        {introduction.map((_, i) => (
                          <span
                            className={i === flow.slide ? "active" : ""}
                            key={i}
                          />
                        ))}
                      </div>
                      <button
                        className="welcome-primary"
                        onClick={() =>
                          flow.slide < introduction.length - 1
                            ? flow.setSlide(flow.slide + 1)
                            : flow.nextAfterTour()
                        }
                      >
                        {flow.slide < introduction.length - 1
                          ? "Next"
                          : flow.replaying
                            ? "Back to my app"
                            : "Let’s make this official"}
                        <ArrowRight size={19} />
                      </button>
                      <div className="welcome-text-actions">
                        <button
                          onClick={() =>
                            flow.slide
                              ? flow.setSlide(flow.slide - 1)
                              : flow.replaying
                                ? flow.closeReplay()
                                : flow.setStep("welcome")
                          }
                        >
                          <ArrowLeft size={16} />
                          Back
                        </button>
                        <button onClick={flow.nextAfterTour}>
                          {flow.replaying ? "Close tour" : "Skip to account"}
                        </button>
                      </div>
                    </>
                  )}
                  {flow.step === "account" && (
                    <>
                      <p className="welcome-eyebrow">SPOT SAVED YOU A SEAT</p>
                      <h1 ref={title} tabIndex={-1}>
                        {flow.mode === "signup"
                          ? "Make it official."
                          : "Welcome back."}
                      </h1>
                      <p>
                        {flow.mode === "signup"
                          ? "Create your Rep & Plate account. Spot is already rehearsing your welcome speech."
                          : "Sign in to your account. Your plate has been very normal about waiting."}
                      </p>
                      {flow.user ? (
                        <>
                          <p>Signed in as {flow.user.email}</p>
                          <button
                            className="welcome-primary"
                            onClick={() => flow.setStep("setup")}
                          >
                            Continue setup <ArrowRight size={19} />
                          </button>
                        </>
                      ) : (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void flow
                              .authenticate(email, password)
                              .then(() => setPassword(""));
                          }}
                        >
                          <label>
                            Email
                            <input
                              type="email"
                              required
                              autoComplete="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              disabled={flow.busy}
                              maxLength={254}
                            />
                          </label>
                          <label>
                            Password
                            <input
                              type="password"
                              required
                              autoComplete={
                                flow.mode === "signup"
                                  ? "new-password"
                                  : "current-password"
                              }
                              minLength={flow.mode === "signup" ? 8 : 1}
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              disabled={flow.busy}
                            />
                          </label>
                          {flow.mode === "signup" && (
                            <small>At least 8 characters.</small>
                          )}
                          <button
                            className="welcome-primary"
                            disabled={flow.busy || !flow.client}
                          >
                            {flow.busy
                              ? "One moment…"
                              : flow.mode === "signup"
                                ? "Create account"
                                : "Sign in"}
                            <ArrowRight size={19} />
                          </button>
                        </form>
                      )}
                      {!flow.user && (
                        <button
                          className="welcome-link"
                          disabled={flow.busy}
                          onClick={() => {
                            setPassword("");
                            flow.account(
                              flow.mode === "signup" ? "signin" : "signup",
                            );
                          }}
                        >
                          {flow.mode === "signup"
                            ? "Already have an account? Sign in"
                            : "New here? Create account"}
                        </button>
                      )}
                      {flow.available === false && (
                        <div className="welcome-feedback">
                          <p>Account connection is unavailable right now.</p>
                          <button onClick={flow.retry}>Retry connection</button>
                        </div>
                      )}
                      {!flow.user && flow.mode === "signin" && (
                        <PasswordRecovery client={flow.client} />
                      )}
                      {!flow.owner && !flow.user && (
                        <>
                          <button
                            className="welcome-link"
                            onClick={flow.tryLocal}
                          >
                            Try on this device first
                          </button>
                          <p className="welcome-fine">
                            Manual tracking works without an account. AI and
                            connected tools need an approved account during
                            private preview.
                          </p>
                        </>
                      )}
                      {flow.owner && (
                        <p className="welcome-fine">
                          Each account keeps separate records on this device.
                          Sign in to open yours.
                        </p>
                      )}
                      <button
                        className="welcome-link"
                        disabled={flow.busy}
                        onClick={flow.startTour}
                      >
                        Meet Spot first
                      </button>
                    </>
                  )}
                  {flow.step === "setup" && (
                    <>
                      <p className="welcome-eyebrow">
                        YOUR PACE. SPOT’S ENTHUSIASM.
                      </p>
                      <h1 ref={title} tabIndex={-1}>
                        What should I call you?
                      </h1>
                      <p>
                        One tiny introduction before I become unnecessarily
                        invested in your day.
                      </p>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          void flow.prepare();
                        }}
                      >
                        <label>
                          Your name <span>(optional)</span>
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="given-name"
                            maxLength={60}
                            placeholder="What you like to be called"
                            disabled={flow.busy}
                          />
                        </label>
                        <fieldset>
                          <legend>Where would you like to start?</legend>
                          {focusChoices.map((choice) => (
                            <label className="welcome-choice" key={choice}>
                              <input
                                type="radio"
                                name="focus"
                                value={choice}
                                checked={focus === choice}
                                onChange={() => setFocus(choice)}
                              />
                              {choice}
                              {focus === choice && <Check size={17} />}
                            </label>
                          ))}
                        </fieldset>
                        {!flow.localMode && (
                          <label className="welcome-confirm">
                            <input
                              type="checkbox"
                              checked={flow.confirmed}
                              onChange={(e) =>
                                flow.setConfirmed(e.target.checked)
                              }
                            />
                            {flow.owner
                              ? "Open this account’s separate records. Existing records stay with their original account."
                              : `These device records are mine. Link them to ${flow.user?.email || "my account"}.`}
                          </label>
                        )}
                        <p className="welcome-fine">
                          {flow.localMode
                            ? "Guest records stay on this device. Sign in later to link them and enable account saving."
                            : "Your account saves changes automatically. Other accounts keep separate records."}
                        </p>
                        <button
                          className="welcome-primary"
                          disabled={
                            flow.busy || (!flow.localMode && !flow.confirmed)
                          }
                        >
                          {flow.busy ? "One moment…" : "That’s me. Let’s go."}
                          <ArrowRight size={19} />
                        </button>
                      </form>
                      <button
                        className="welcome-link"
                        disabled={flow.busy}
                        onClick={() => flow.account("signin")}
                      >
                        Back to account
                      </button>
                    </>
                  )}
                  {flow.step === "ready" && (
                    <>
                      <p className="welcome-eyebrow">
                        OFFICIALLY IN YOUR CORNER
                      </p>
                      <h1 ref={title} tabIndex={-1}>
                        {name.trim()
                          ? `We’re a team, ${name.trim()}.`
                          : "We’re a team."}
                      </h1>
                      <p>
                        You bring the real life. Spot brings the backup dancers
                        nobody asked for.
                      </p>
                      <div className="welcome-ready">
                        <strong>Your first small step</strong>
                        <p>
                          {focus === focusChoices[0]
                            ? "Start with one meal. A few words are enough."
                            : focus === focusChoices[1]
                              ? "Start with a walk or a workout. It doesn’t have to be epic."
                              : "Start with one meal or one bit of movement. Small is a perfectly good start."}
                        </p>
                      </div>
                      {flow.localMode && (
                        <p className="welcome-fine">
                          You’re starting with manual tracking on this device.
                          Create an account from your profile when you’re ready
                          for connected features.
                        </p>
                      )}
                      {!flow.localMode && (
                        <p className="welcome-fine">
                          During private preview, AI tools require an approved
                          account. You can start manual tracking now.
                        </p>
                      )}
                      <button
                        className="welcome-primary"
                        disabled={flow.busy}
                        onClick={() => void complete()}
                      >
                        {flow.busy ? "Getting ready…" : "Let’s do this"}
                        <ArrowRight size={19} />
                      </button>
                      <button
                        className="welcome-link"
                        disabled={flow.busy}
                        onClick={() => flow.setStep("setup")}
                      >
                        Back
                      </button>
                    </>
                  )}
                </>
              )}
              {flow.error && (
                <p role="alert" className="welcome-feedback error">
                  {flow.error}
                </p>
              )}
              {flow.notice && (
                <p role="status" className="welcome-feedback">
                  {flow.notice}
                </p>
              )}
            </section>
          </div>
          <footer className="welcome-footer">
            GOOD FOOD. SOLID WORK. BRIGHTER DAYS.
          </footer>
        </main>
      )}
    </>
  );
}
