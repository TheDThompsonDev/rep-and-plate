import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, LogOut } from "lucide-react";
import { readState, today } from "../../domain";
import { FitnessSetup } from '../progress/FitnessSetup';
import { applyFitnessSetup, type FitnessSetupDraft } from '../progress/fitness-goal';
import { NutritionSetup } from '../progress/NutritionSetup';
import { applyNutritionSetup, type NutritionSetupDraft, type NutritionSetupResult } from '../progress/nutrition-setup';
import {
  hydrateBrowserRecords,
  persistBrowserRecords,
} from "../../platform/browser-records";
import { introduction, focusChoices, firstStepForFocus, ONBOARDING_KEY } from "./model";
import { useOnboarding, type OnboardingAdapter } from "./useOnboarding";
import { spotScenes } from "../spot/scenes";
import "./onboarding.css";
import { PasswordRecovery } from "../cloud/PasswordRecovery";
import InteractionGuide from './InteractionGuide';
import { interactionTitle } from './interaction-examples';

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
  readDraft: async key => localStorage.getItem(key),
  writeDraft: async (key, value) => { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); },
};
export default function Onboarding({
  children,
}: {
  children: (replay: () => void, firstLog: string | null, dismissFirstLog: () => void) => ReactNode;
}) {
  const flow = useOnboarding(adapter);
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const { name, focus, fitness, nutrition, nutritionInput } = flow.draft;
  const setName = (name: string) => flow.patchDraft({ name });
  const setFocus = (focus: string) => flow.patchDraft({ focus });
  const setFitness = (fitness: FitnessSetupDraft | null) => flow.patchDraft({ fitness });
  const setNutrition = (nutrition: NutritionSetupResult | null) => flow.patchDraft({ nutrition });
  const setNutritionInput = (nutritionInput: NutritionSetupDraft) => flow.patchDraft({ nutritionInput });
  const title = useRef<HTMLHeadingElement>(null);
  const savedSetup = flow.step === 'nutrition' ? readState() : null;
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
    flow.finish(focus, name, async (normalizedName) => {
      const saved = readState();
      const named = {
        ...saved,
        profile: {
          ...saved.profile,
          name: normalizedName,
        },
        spot: { ...saved.spot, introSeen: true },
      };
      const started = fitness ? applyFitnessSetup(named, fitness, today(), flow.draft.weightEntry) : named;
      const next = nutrition ? applyNutritionSetup(started, nutrition) : started;
      await persistBrowserRecords(next);
      location.hash = focus === 'Groceries & dinner' ? 'receipt' : 'chat';
    });
  const show = !flow.entered || flow.replaying;
  return (
    <>
      {flow.entered && (
        <div hidden={flow.replaying}>{children(flow.replay, flow.firstLog, flow.dismissFirstLog)}</div>
      )}
      {show && (
        <main className={`welcome-shell welcome-shell-${flow.step}`} aria-label="Welcome to Rep & Plate">
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
                width={1024}
                height={1024}
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
                          flow.step === 'setup'
                            ? "current"
                            : ""
                        }
                      >
                        03 · Make it yours
                      </span>
                      <span className={flow.step === 'goals' ? 'current' : ''}>04 · Your goals</span>
                      <span className={['nutrition', 'ready'].includes(flow.step) ? 'current' : ''}>05 · Daily targets</span>
                    </div>
                  )}
                  {flow.step === "welcome" && (
                    <>
                      <p className="welcome-eyebrow">
                        YOUR NEW SIDEKICK HAS ARRIVED
                      </p>
                      <h1 ref={title} tabIndex={-1}>
                        Track your food.
                        <br />
                        Build your fitness.
                        <br />
                        <em>With a little help from Spot.</em>
                      </h1>
                      <p>
                        Tell Spot what you ate or how you moved. Review the details,
                        track your calories and workouts, and see your day add up.
                        Grocery receipts help keep the foods you buy handy for later.
                      </p>
                      <button
                        className="welcome-primary"
                        onClick={flow.startTour}
                      >
                        Meet Spot <ArrowRight size={19} />
                      </button>
                      <button className="welcome-secondary" onClick={() => flow.setStep('guide')}>See what I can do</button>
                      <button className="welcome-link" onClick={() => { setFocus('Groceries & dinner'); flow.user ? flow.setStep('setup') : flow.account('signup'); }}>Start with my groceries</button>
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
                        Start with one meal or workout. Manual tracking works on this device.
                        Connected AI needs an approved account during private preview.
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
                          flow.slide === 0
                            ? flow.setStep('guide')
                            : flow.slide < introduction.length - 1
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
                  {flow.step === 'guide' && <>
                    <p className="welcome-eyebrow">A FEW WORDS. A USEFUL NEXT STEP.</p>
                    <h1 ref={title} tabIndex={-1}>{interactionTitle}</h1>
                    <InteractionGuide onTry={flow.nextAfterTour} tryLabel={flow.replaying ? 'Back to my app' : 'Set up my tracking'}/>
                    <div className="welcome-text-actions">
                      <button onClick={() => { flow.setSlide(0); flow.setStep('intro'); }}><ArrowLeft size={16}/>Back</button>
                      <button onClick={() => { flow.setSlide(1); flow.setStep('intro'); }}>More about Spot</button>
                    </div>
                  </>}
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
                          void flow.prepare(name);
                        }}
                      >
                        <label>
                          Your name
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="given-name"
                            maxLength={60}
                            required
                            pattern=".*\S.*"
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
                            flow.busy || !name.trim() || (!flow.localMode && !flow.confirmed)
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
                  {flow.step === "goals" && <>
                    <p className="welcome-eyebrow">YOUR STARTING POINT</p>
                    <h1 ref={title} tabIndex={-1}>What are you working toward?</h1>
                    <p>Let’s give your tracking a little direction. Start with what you know today.</p>
                    <FitnessSetup initialDraft={flow.draft.fitnessInput ?? fitness ?? undefined} onDraftChange={fitnessInput => flow.patchDraft({ fitnessInput })} onSave={draft => { setFitness(draft); setNutrition(null); flow.patchDraft({ nutritionSession: undefined }); flow.setStep('nutrition'); }} onSkip={() => { setFitness(null); setNutrition(null); flow.patchDraft({ nutritionSession: undefined }); flow.setStep('nutrition'); }} busy={flow.busy} />
                    <button className="welcome-link" disabled={flow.busy} onClick={() => flow.setStep('setup')}>Back to your introduction</button>
                  </>}
                  {flow.step === 'nutrition' && <>
                    <p className="welcome-eyebrow">A STARTING POINT THAT FITS YOU</p>
                    <h1 ref={title} tabIndex={-1}>Your daily targets.</h1>
                    <NutritionSetup initialDraft={nutritionInput} onDraftChange={setNutritionInput} initialSession={flow.draft.nutritionSession} onSessionChange={nutritionSession => flow.patchDraft({ nutritionSession })} baseline={savedSetup?.profile.nutritionBaseline} kind={fitness?.kind} weight={fitness?.currentWeight.trim() ? {value:Number(fitness.currentWeight),unit:fitness.unit} : savedSetup?.bodyWeights?.filter(entry => entry.day <= today()).slice().sort((a,b) => a.day.localeCompare(b.day)).at(-1)} existingTargets={savedSetup?.profile.targetsConfigured ? savedSetup.profile : undefined} onSave={result => {setNutrition(result);flow.setStep('ready');}} onSkip={() => {setNutrition(null);flow.setStep('ready');}} busy={flow.busy} />
                    <button className="welcome-link" disabled={flow.busy} onClick={() => flow.setStep('goals')}>Back to your goals</button>
                  </>}
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
                          {firstStepForFocus(focus)}
                        </p>
                      </div>
                      {fitness && <div className="welcome-ready"><strong>Your progress starts here</strong><p>{fitness.currentWeight ? `${fitness.currentWeight} ${fitness.unit} will be saved as today’s starting weight. ` : 'Add your first weight from your profile when you’re ready. '}{fitness.cadence === 'none' ? 'Log again whenever you choose.' : `Your ${fitness.cadence} check-in appears in your profile.`}</p></div>}
                      {nutrition && <div className="welcome-ready"><strong>{nutrition.targets ? 'Your daily starting targets' : 'Your details are ready'}</strong><p>{nutrition.targets ? `${nutrition.targets.calories} calories · ${nutrition.targets.protein}g protein · ${nutrition.targets.carbs}g carbs · ${nutrition.targets.fat}g fat. Change them anytime in your profile.` : 'Your age, height and usual activity will be saved. Your daily targets stay as they are.'}</p></div>}
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
                        onClick={() => flow.setStep("nutrition")}
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
