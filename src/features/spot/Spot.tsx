import {
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ArrowRight, Check, CircleDot, RotateCcw } from "lucide-react";
import type { AppState } from "../../domain";
import type { WorkoutCapture } from "./contracts";
import {
  spotIntro,
  spotPose,
  spotWeek,
  type SpotExpression,
  type SpotSide,
} from "./model";
import "./spot.css";
import { spotScenes, type SpotSceneName } from "./scenes";
import {
  spotGreetingMoods,
  spotMoments,
  spotReactionFrame,
  spotReactionAsset,
  type SpotMomentName,
  type SpotReactionName,
} from "./personality";

export const SpotVisuals = createContext(true);
export function SpotScene({
  scene,
  compact = false,
}: {
  scene: SpotSceneName;
  compact?: boolean;
}) {
  const enabled = useContext(SpotVisuals);
  const [failedScene, setFailedScene] = useState<SpotSceneName | null>(null);
  if (!enabled || failedScene === scene) return null;
  return (
    <div
      className={`spot-scene ${compact ? "spot-scene--compact" : "spot-scene--hero"}`}
      data-spot-scene={scene}
    >
      <img
        key={scene}
        src={`/images/spot/scenes/${scene}.png`}
        alt={spotScenes[scene].alt}
        width={1254}
        height={1254}
        decoding="async"
        onError={() => setFailedScene(scene)}
      />
    </div>
  );
}
export function SpotReaction({
  reaction,
  size = 120,
}: {
  reaction: SpotReactionName;
  size?: number;
}) {
  const enabled = useContext(SpotVisuals);
  const [failed, setFailed] = useState(false);
  if (!enabled || failed) return null;
  const frame = spotReactionFrame(reaction, 100);
  return (
    <span
      className="spot-reaction"
      data-reaction={reaction}
      aria-hidden="true"
      style={{ "--spot-size": `${size}px` } as CSSProperties}
    >
      <span
        className="spot-reaction-frame"
        style={{ width: `${frame.width}%`, height: `${frame.height}%` }}
      >
        <img
          src={`/images/spot/${spotReactionAsset(reaction)}`}
          alt=""
          draggable={false}
          onError={() => setFailed(true)}
          style={{
            width: `${(frame.atlasSize / frame.width) * 100}%`,
            height: `${(frame.atlasSize / frame.height) * 100}%`,
            left: `${(frame.left / frame.width) * 100}%`,
            top: `${(frame.top / frame.height) * 100}%`,
          }}
        />
      </span>
    </span>
  );
}
export function SpotMoment({ moment }: { moment: SpotMomentName }) {
  const copy = spotMoments[moment];
  return (
    <aside className="spot-moment" aria-label="A moment with Spot">
      {"scene" in copy ? (
        <SpotScene scene={copy.scene} compact />
      ) : (
        <SpotReaction reaction={copy.reaction} size={96} />
      )}
      <div>
        <span className="spot-eyebrow">VERY MUCH IN YOUR CORNER</span>
        <strong>{copy.title}</strong>
        <p>{copy.caption}</p>
      </div>
    </aside>
  );
}
export function SpotLean() {
  const enabled = useContext(SpotVisuals);
  const [failed, setFailed] = useState(false);
  if (!enabled || failed) return null;
  return (
    <img
      className="spot-wordmark-lean"
      src="/images/spot/spot-lean.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
export function PlateMark({ className = "" }: { className?: string }) {
  return (
    <CircleDot
      className={className}
      size={26}
      strokeWidth={1.8}
      aria-hidden="true"
    />
  );
}
export function SpotAvatar({
  side = "plate",
  expression = "default",
  size = 72,
  label,
  className = "",
}: {
  side?: SpotSide;
  expression?: SpotExpression;
  size?: number;
  label?: string;
  className?: string;
}) {
  const enabled = useContext(SpotVisuals);
  const [failed, setFailed] = useState(false);
  const pose = spotPose({ side, expression });
  return (
    <span
      className={`spot-avatar ${className}`}
      data-side={side}
      style={{ "--spot-size": `${size}px` } as CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {enabled && !failed ? (
        <span key={side} className="spot-pivot">
          <img
            src="/images/spot/spot-atlas.png"
            alt=""
            draggable={false}
            onError={() => setFailed(true)}
            style={{
              left: `${-(pose % 3) * 100}%`,
              top: `${-Math.floor(pose / 3) * 100}%`,
            }}
          />
        </span>
      ) : (
        <span className="spot-fallback">
          <PlateMark />
        </span>
      )}
    </span>
  );
}
export function SpotCheck({
  children,
  side = "plate",
}: {
  children: ReactNode;
  side?: SpotSide;
}) {
  return (
    <section className="spot-check">
      <div className="spot-check-heading">
        {side === "plate" ? (
          <SpotReaction size={46} reaction="detective" />
        ) : (
          <SpotAvatar size={46} side={side} expression="confused" />
        )}
        <div>
          <small>{side === "rep" ? "WORKOUT" : "PLATE"}</small>
          <h3>Spot Check</h3>
        </div>
      </div>
      {children}
    </section>
  );
}
export function SpotProcessing({
  side = "plate",
  detail,
}: {
  side?: SpotSide;
  detail?: string;
}) {
  return (
    <div className="spot-processing" role="status">
      {side === "plate" ? (
        <SpotReaction reaction="calculator" size={54} />
      ) : (
        <SpotAvatar side={side} size={54} />
      )}
      <div>
        <strong>Got it. Tiny plate. Big thinking.</strong>
        <p>{detail || "Checking the details…"}</p>
      </div>
    </div>
  );
}
export function SpotResult({
  side = "plate",
  children,
}: {
  side?: SpotSide;
  children?: ReactNode;
}) {
  return (
    <div className="spot-saved">
      <div className="spot-result">
        <Check size={17} />
        <strong>Logged.</strong>
        <span>
          {side === "rep" ? "Workout" : "Meal"}
          {children ? " · " : ""}
          {children}
        </span>
      </div>
      <SpotMoment moment={side === "rep" ? "workoutSaved" : "mealSaved"} />
    </div>
  );
}
export function SpotWelcome({
  intro,
  comeback,
  onDone,
  onCapture,
  onCatchup,
}: {
  intro: boolean;
  comeback: boolean;
  onDone: () => void;
  onCapture: () => void;
  onCatchup: () => void;
}) {
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState(0);
  const screen = spotIntro[step];
  const greeting = spotMoments[spotGreetingMoods[mood]];
  const finish = () => {
    onDone();
    onCapture();
  };
  if (intro)
    return (
      <section className="spot-onboarding" aria-label="Meet Spot">
        <div className="spot-onboarding-top">
          <span className="spot-eyebrow">
            MEET SPOT · {step + 1} OF {spotIntro.length}
          </span>
          <button className="spot-text-button" onClick={finish}>
            Skip intro
          </button>
        </div>
        <div className="spot-onboarding-body">
          <SpotScene scene={screen.scene} />
          <div className="spot-onboarding-copy">
            <div aria-live="polite" aria-atomic="true">
              <h2>{screen.title}</h2>
              <p className="spot-onboarding-punchline">{screen.punchline}</p>
              <p>{screen.detail}</p>
            </div>
            <div className="spot-onboarding-actions">
              {step > 0 && (
                <button
                  className="spot-text-button"
                  onClick={() => setStep((s) => s - 1)}
                >
                  Back
                </button>
              )}
              <button
                className="spot-primary"
                onClick={() =>
                  step < spotIntro.length - 1 ? setStep((s) => s + 1) : finish()
                }
              >
                {step < spotIntro.length - 1
                  ? "Next"
                  : "Try it. What happened today?"}
                <ArrowRight size={16} />
              </button>
            </div>
            <span
              className="spot-steps"
              aria-label={`Introduction ${step + 1} of ${spotIntro.length}`}
            >
              {spotIntro.map((_, i) => (
                <i key={i} className={i === step ? "active" : ""} />
              ))}
            </span>
          </div>
        </div>
      </section>
    );
  return (
    <section
      className={`spot-welcome ${!comeback && "scene" in greeting ? "spot-welcome-scene" : ""}`}
      aria-label="Tell Spot"
    >
      <div className="spot-welcome-copy">
        <span className="spot-eyebrow">YOUR FOOD. YOUR REPS. YOUR PACE.</span>
        <h2>{comeback ? "Oh hey." : greeting.title}</h2>
        <p>{comeback ? "Start with today." : greeting.caption}</p>
        {comeback ? (
          <p className="spot-punchline">Same tiny shoes. Same big support.</p>
        ) : (
          <small>Tell me what you ate or what you did.</small>
        )}
        <div className="spot-welcome-actions">
          {comeback ? (
            <>
              <button className="spot-primary" onClick={finish}>
                Log something
                <ArrowRight size={16} />
              </button>
              <button
                className="spot-text-button"
                onClick={() => {
                  onDone();
                  onCatchup();
                }}
              >
                Catch me up
              </button>
            </>
          ) : (
            <>
              <button className="spot-primary" onClick={onCapture}>
                Tell Spot
                <ArrowRight size={16} />
              </button>
              <button
                className="spot-text-button spot-mood-button"
                onClick={() =>
                  setMood((m) => (m + 1) % spotGreetingMoods.length)
                }
              >
                Another Spot mood
                <RotateCcw size={13} />
              </button>
            </>
          )}
        </div>
      </div>
      {!comeback && "scene" in greeting ? (
        <SpotScene scene={greeting.scene} />
      ) : (
        <SpotReaction
          reaction={comeback ? "peek" : greeting.reaction}
          size={190}
        />
      )}
    </section>
  );
}

export function SpotEmptyState({
  side,
  onCapture,
}: {
  side: SpotSide;
  onCapture: () => void;
}) {
  return (
    <div className="spot-empty">
      <SpotMoment moment={side === "rep" ? "emptyWorkout" : "emptyFood"} />
      <h3>{side === "rep" ? "No reps yet." : "Nothing here yet."}</h3>
      <p>Tell Spot what you {side === "rep" ? "did" : "ate"}.</p>
      <button className="spot-primary" onClick={onCapture}>
        Tell Spot
        <ArrowRight size={16} />
      </button>
    </div>
  );
}
export function SpotWorkoutCheck({
  proposal,
  status,
  onResolve,
  onFix,
}: {
  proposal: WorkoutCapture;
  status: string;
  onResolve: (accept: boolean) => void;
  onFix: () => void;
}) {
  if (status === "accepted")
    return <SpotResult side="rep">{proposal.title}</SpotResult>;
  if (status === "dismissed")
    return (
      <p className="spot-caption">
        Workout not saved. Send Spot the corrected details.
      </p>
    );
  return (
    <SpotCheck side="rep">
      <h4>{proposal.title}</h4>
      <p>{proposal.day} · Check the date, loads and completed sets.</p>
      <ul className="spot-exercises">
        {proposal.exercises.map((e, i) => (
          <li key={i}>
            <strong>{e.name}</strong>
            <span>
              {e.weight ? `${e.weight} lb` : "Bodyweight"} · {e.reps.join(", ")}{" "}
              reps
            </span>
          </li>
        ))}
      </ul>
      {proposal.note && <p>{proposal.note}</p>}
      <div className="spot-actions">
        <button className="spot-primary" onClick={() => onResolve(true)}>
          Yep, log workout
          <Check size={16} />
        </button>
        <button className="spot-text-button" onClick={onFix}>
          Fix it
        </button>
        <button className="spot-text-button" onClick={() => onResolve(false)}>
          Not now
        </button>
      </div>
    </SpotCheck>
  );
}
export function SpotWeeklyReview({ state }: { state: AppState }) {
  const [side, setSide] = useState<SpotSide>("plate");
  const week = spotWeek(state);
  return (
    <section className="spot-weekly" aria-label="Weekly Spot Check">
      <div className="spot-weekly-heading">
        <div>
          <span className="spot-eyebrow">A LITTLE PERSPECTIVE</span>
          <h3>Weekly Spot Check</h3>
          <p>
            {week.start} – {week.end}
          </p>
        </div>
        <SpotAvatar side={side} expression="proud" size={112} />
      </div>
      <div className="spot-side-tabs" role="group" aria-label="Weekly view">
        <button
          aria-pressed={side === "plate"}
          onClick={() => setSide("plate")}
        >
          Plate · Food
        </button>
        <button aria-pressed={side === "rep"} onClick={() => setSide("rep")}>
          Rep · Training
        </button>
      </div>
      <div className="spot-week-numbers">
        {side === "plate" ? (
          <>
            <div>
              <strong>{week.calories?.toLocaleString() ?? "—"}</strong>
              <span>avg recorded cal</span>
            </div>
            <div>
              <strong>
                {week.protein === null ? "—" : `${week.protein}g`}
              </strong>
              <span>avg recorded protein</span>
            </div>
          </>
        ) : (
          <>
            <div>
              <strong>{week.completed}</strong>
              <span>completed workouts</span>
            </div>
            <div>
              <strong>{week.volume.toLocaleString()}</strong>
              <span>lb recorded volume</span>
            </div>
          </>
        )}
      </div>
      <p>
        {side === "plate"
          ? `Based on ${week.loggedDays} days with meals logged. These are recorded amounts, not estimates of everything you ate.`
          : "Completed sessions only. Volume is recorded load × reps; bodyweight and unrecorded work are not added."}
      </p>
      <p className="spot-caption">
        Unlogged days are unknown. Start wherever you are.
      </p>
      <button
        className="spot-text-button"
        onClick={() => setSide(side === "plate" ? "rep" : "plate")}
      >
        <RotateCcw size={15} />
        See the {side === "plate" ? "Rep" : "Plate"} side
      </button>
    </section>
  );
}
