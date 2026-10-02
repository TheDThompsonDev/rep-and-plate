import { SpotAvatar, SpotEmptyState, SpotMoment } from "./features/spot/Spot";
import { setLoad, setWorkoutLoad } from "./features/progress/set-loads";
import { addActivity } from "./activities";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  Check,
  CheckCheck,
  ChevronRight,
  Dumbbell,
  Mic,
} from "lucide-react";
import { FuelHeader, FuelTabs } from "./FuelNavigation";
import { PlateMark } from "./features/spot/Spot";
import { Modal } from "./components";
import { today, type AppState, type Exercise, type Page } from "./domain";
import {
  completedWorkoutHistory,
  lastExerciseEvidence,
} from "./features/workout-planning/history";
import {
  recordSet,
  replyToWorkout,
  startPlan,
  workoutPhoto,
  workoutPlans,
  adjustWorkoutExercise,
  displayLoad,
  storedLoad,
  reopenWorkout,
  finishWorkout,
  reopenHistoryWorkout,
  moveWorkoutExercise,
  exerciseTechnique,
  saveWorkoutRoutine,
  startWorkoutRoutine,
  deleteWorkoutRoutine,
  applyLoadToRemainingSets,
  startWorkoutRest,
  endWorkoutRest,
  type ExerciseAdjustment,
  type Workout,
} from "./workouts";
import "./workouts.css";

function Photo({ name = "", hero = false }: { name?: string; hero?: boolean }) {
  const tile = hero ? 0 : workoutPhoto(name);
  return (
    <span
      className={`workout-photo ${hero ? "hero-photo" : ""}`}
      role="img"
      aria-label={hero ? "Dumbbells on a gym bench" : `${name} illustration`}
      style={{
        backgroundPosition: `${(tile % 2) * 100}% ${Math.floor(tile / 2) * 50}%`,
      }}
    />
  );
}
function Prescription({
  ex,
  unit = "lb",
}: {
  ex: Exercise;
  unit?: "lb" | "kg";
}) {
  return (
    <>
      {ex.weightConfirmed === false
        ? "Choose load · "
        : ex.weight
          ? `${displayLoad(ex.weight, unit)} ${unit} · `
          : "Bodyweight · "}
      {ex.sets.length} × {ex.target}
    </>
  );
}

function recordedDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function previousSession(
  workout: Workout,
  name: string,
  unit: "lb" | "kg" = "lb",
) {
  const evidence = lastExerciseEvidence(workout, name);
  return evidence
    ? `Last recorded: ${evidence.setWeights ? evidence.sets.map((reps, index) => `${displayLoad(evidence.setWeights?.[index] ?? evidence.weight, unit)} ${unit} × ${reps}`).join(", ") : `${evidence.weight ? `${displayLoad(evidence.weight, unit)} ${unit}` : "Bodyweight"} · ${evidence.sets.join(", ")} reps`} · ${recordedDate(evidence.finishedAt)}`
    : "No finished session recorded for this exercise yet.";
}

export default function WorkoutPage({
  state,
  setState,
  onNavigate,
  onProfile,
  onVoice,
  onBuild,
  onScan,
  startWithMovement = false,
  onFirstMovementClose,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  onNavigate: (page: Page) => void;
  onProfile: () => void;
  onVoice: () => void;
  onBuild: () => void;
  onScan: () => void;
  startWithMovement?: boolean;
  onFirstMovementClose?: () => void;
}) {
  const workout = state.workout;
  const unit = state.profile.workoutUnit ?? "lb";
  const [activityOpen, setActivityOpen] = useState(startWithMovement);
  const [editingActivity, setEditingActivity] = useState<
    NonNullable<AppState["activities"]>[number] | null
  >(null);
  const [activityError, setActivityError] = useState("");
  const [finishConfirm, setFinishConfirm] = useState(false);
  const restUntil = workout.restUntil ?? null;
  const [restSeconds, setRestSeconds] = useState(90);
  const [routineLibrary, setRoutineLibrary] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [routineError, setRoutineError] = useState('');
  const [routineNotice, setRoutineNotice] = useState('');
  const [removeRoutine, setRemoveRoutine] = useState<string|null>(null);
  const [restRemaining, setRestRemaining] = useState(0);
  useEffect(() => {
    if (restUntil === null) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((restUntil - Date.now()) / 1000));
      setRestRemaining(seconds);
      if (!seconds) setState(s=>s.workout.restUntil===restUntil?{...s,workout:endWorkoutRest(s.workout)}:s);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [restUntil,setState]);
  const [selected, setSelected] = useState(workout.planId ?? "upper");
  const [browse, setBrowse] = useState(false);
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState<{ title: string; text: string } | null>(
    null,
  );
  const [history, setHistory] = useState(false);
  const [adjust, setAdjust] = useState<number | null>(null);
  const [edit, setEdit] = useState<{
    exercise: number;
    set: number;
    reps: number;
  } | null>(null);
  const [composer, setComposer] = useState("");
  const scroll = useRef<HTMLDivElement>(null);
  const plan = workoutPlans.find((p) => p.id === selected) ?? workoutPlans[0];
  const session = workout.status !== "ready" && !browse;
  const active = workout.status === "active";
  const historySessions = completedWorkoutHistory(workout);
  const finishedSessions = historySessions.slice(0,5);
  const recentSets = finishedSessions.reduce(
    (count, item) =>
      count +
      item.exercises.reduce((sets, exercise) => sets + exercise.sets.length, 0),
    0,
  );
  const latestSession = finishedSessions[0];
  const title = workout.title ?? "Upper Body";
  const done = workout.exercises.reduce(
    (n, e) => n + e.sets.filter((r) => r !== null).length,
    0,
  );
  const total = workout.exercises.reduce((n, e) => n + e.sets.length, 0);
  const completed = workout.exercises.filter((e) =>
    e.sets.every((r) => r !== null),
  ).length;
  const current = workout.exercises.findIndex((e) =>
    e.sets.some((r) => r === null),
  );
  const progress = total ? Math.round((done / total) * 100) : 0;
  const messages = workout.conversation ?? [];
  function log(exercise: number, set: number, reps: number) {
    setState((s) => ({
      ...s,
      workout: recordSet(s.workout, exercise, set, reps, undefined, s.profile.workoutUnit),
    }));
  }
  function start() {
    setState((s) => ({ ...s, workout: startPlan(s.workout, selected) }));
    setBrowse(false);
    scroll.current?.scrollTo(0, 0);
  }
  function resume() {
    setBrowse(false);
    scroll.current?.scrollTo(0, 0);
  }
  function finish() {
    setState((s) => ({
      ...s,
      workout: finishWorkout(s.workout),
    }));
  }
  function send() {
    if (!composer.trim()) return;
    setState((s) => ({
      ...s,
      workout: replyToWorkout(s.workout, composer.trim(), s.profile.workoutUnit),
    }));
    setComposer("");
  }
  return (
    <section className="fuel-chat fuel-workouts" aria-label="Workouts">
      <FuelHeader
        menuLabel="Open workout menu"
        onHome={() => onNavigate("Chat")}
        onMenu={() => setMenu(true)}
        onNutrition={() => onNavigate("Nutrition")}
        onProfile={onProfile}
      />
      <div className="workout-utilities">
        <button className="button secondary" onClick={()=>{setRoutineLibrary(true);setRoutineName(workout.title??'My workout');setRoutineError('');setRoutineNotice('');}}>Saved routines</button>
        <label>
          Workout units{" "}
          <select
            aria-label="Workout units"
            value={unit}
            onChange={(event) =>
              setState((s) => ({
                ...s,
                profile: {
                  ...s.profile,
                  workoutUnit: event.target.value as "lb" | "kg",
                },
              }))
            }
          >
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </label>
        <button
          className="button secondary"
          onClick={() => {
            setEditingActivity(null);
            setActivityOpen(true);
          }}
        >
          Log walk or cardio
        </button>
      </div>
      {session && !active && (
        <div className="fuel-banner workout-banner">
          <SpotAvatar
            side="rep"
            expression={active ? "default" : "tired"}
            size={48}
          />
          <div>
            <strong>Tell Spot what you did.</strong>
            <span>Workout · Talk, type, or tap your sets.</span>
          </div>
        </div>
      )}
      <div className="workout-scroll" ref={scroll}>
        {!!state.activities?.length && (
          <details className="workout-technique">
            <summary>
              Walks & cardio · {state.activities.length} recorded
            </summary>
            {state.activities
              .slice()
              .reverse()
              .map((item) => (
                <article key={item.id}>
                  <strong>{item.title}</strong>
                  <p>
                    {item.day} · {item.minutes} minutes
                  </p>
                  {item.note && <p>{item.note}</p>}
                  <button
                    className="button secondary"
                    onClick={() => {
                      setEditingActivity(item);
                      setActivityOpen(true);
                    }}
                  >
                    Edit {item.title} on {item.day}
                  </button>
                </article>
              ))}
          </details>
        )}
        {!session ? (
          <>
            <div className="workout-heading">
              <h1>What should you do today?</h1>
              <p>Your next workout, with room for how you feel today.</p>
              <button
                className="button secondary"
                disabled={active}
                onClick={onBuild}
              >
                Create a workout for me
              </button>
            </div>
            {active && (
              <section
                className="workout-resume"
                aria-label="Your active workout"
              >
                <div>
                  <strong>{title} is still in progress</strong>
                  <p>
                    {done} of {total} sets recorded. Continue this session
                    before starting another.
                  </p>
                </div>
                <button onClick={resume}>
                  Resume workout <ArrowRight size={18} />
                </button>
              </section>
            )}
            <div className="workout-choices" aria-label="Choose a workout">
              {workoutPlans.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={selected === p.id}
                  onClick={() => setSelected(p.id)}
                >
                  {p.title}
                  <small>~{p.minutes} min</small>
                </button>
              ))}
            </div>
            <section className="fuel-workout-hero">
              <div>
                <span>Workout option</span>
                <h2>
                  {plan.title} · ~{plan.minutes} min
                </h2>
                <p>{plan.description}</p>
                <p className="workout-target-note">
                  Example rep targets. Choose a comfortable load before logging;
                  no weight is prescribed. Use 0 only for bodyweight work.
                </p>
                <button
                  className="workout-start"
                  onClick={active ? resume : start}
                >
                  {active ? "Continue current workout" : "Start workout"}{" "}
                  <ArrowRight size={21} />
                </button>
              </div>
              <Photo hero />
            </section>
            <div className="workout-section-title">
              <h2>Exercises</h2>
              <span>
                {plan.exercises.length} exercises · ~{plan.minutes} min
              </span>
            </div>
            <div className="workout-plan">
              {plan.exercises.map((ex, i) => (
                <button
                  className="workout-preview"
                  key={ex.name}
                  onClick={() =>
                    setDetail({
                      title: ex.name,
                      text: `${exerciseTechnique(ex.name).cues.join(" ")} ${ex.sets.length} example sets of ${ex.target} reps. Choose your own load. Once you start, adjust or substitute the exercise.`,
                    })
                  }
                >
                  <span className="workout-number">{i + 1}</span>
                  <Photo name={ex.name} />
                  <span className="workout-preview-copy">
                    <strong>{ex.name}</strong>
                    <span>
                      <Prescription ex={ex} unit={unit} />
                    </span>
                    <small>{previousSession(workout, ex.name, unit)}</small>
                  </span>
                  <ChevronRight size={20} />
                </button>
              ))}
            </div>
            <div className="workout-section-title">
              <h2>Your recent training</h2>
              <button onClick={() => setHistory(true)}>
                View history <ChevronRight size={17} />
              </button>
            </div>
            {latestSession ? (
              <>
                <button
                  className="workout-insight"
                  onClick={() => setHistory(true)}
                >
                  <span>
                    <BarChart3 />
                  </span>
                  <div>
                    <strong>
                      {recentSets} sets across{" "}
                      {finishedSessions.length === 1
                        ? "your latest finished session"
                        : `your latest ${finishedSessions.length} finished sessions`}
                      .
                    </strong>
                    <p>Only the sets you recorded are counted.</p>
                  </div>
                  <ChevronRight size={20} />
                </button>
                <button
                  className="workout-insight"
                  onClick={() => setHistory(true)}
                >
                  <span>
                    <Dumbbell />
                  </span>
                  <div>
                    <strong>Last finished: {latestSession.title}</strong>
                    <p>
                      {recordedDate(latestSession.finishedAt)} ·{" "}
                      {latestSession.exercises.length}{" "}
                      {latestSession.exercises.length === 1
                        ? "exercise"
                        : "exercises"}{" "}
                      with recorded sets.
                    </p>
                  </div>
                  <ChevronRight size={20} />
                </button>
              </>
            ) : (
              <SpotEmptyState side="rep" onCapture={() => onNavigate("Chat")} />
            )}
          </>
        ) : (
          <>
            <section className="workout-session-progress">
              <span className="workout-round">
                <Dumbbell size={34} />
              </span>
              <div>
                <h1>
                  {title} {active ? "in progress" : "saved"}
                </h1>
                <p>
                  {completed} of {workout.exercises.length} exercises completed.
                </p>
                <div className="workout-progress-line">
                  <progress
                    aria-label="Workout progress"
                    max={total}
                    value={done}
                  />
                  <span>{progress}%</span>
                </div>
              </div>
            </section>
            {!active && <SpotMoment moment="workoutSaved" />}
            {!active && (
              <button
                className="button secondary"
                onClick={() =>
                  setState((s) => ({ ...s, workout: reopenWorkout(s.workout) }))
                }
              >
                Correct this workout
              </button>
            )}
            {active && (
              <div className="workout-utilities">
                <label>
                  Jump to exercise
                  <select
                    aria-label="Jump to exercise"
                    defaultValue=""
                    onChange={(event) => {
                      document
                        .getElementById(
                          `workout-exercise-${event.target.value}`,
                        )
                        ?.scrollIntoView({ block: "start" });
                      event.target.value = "";
                    }}
                  >
                    <option value="" disabled>
                      Choose an exercise
                    </option>
                    {workout.exercises.map((exercise, index) => (
                      <option value={index} key={index}>
                        {exercise.name}
                      </option>
                    ))}
                  </select>
                </label>
                <details className="workout-rest-tools">
                  <summary>
                    {restUntil !== null
                      ? `${restRemaining}s rest`
                      : "Rest timer"}
                  </summary>
                  <p>
                    Log exercises in any order. Alternate sets for supersets, or
                    leave an unrecorded set empty.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => setState(s=>({...s,workout:startWorkoutRest(s.workout,restSeconds)}))}
                  >
                    Start {restSeconds}-second rest
                  </button>
                  <label>Rest duration<select aria-label="Rest duration" value={restSeconds} onChange={e=>setRestSeconds(Number(e.target.value))}>{[30,60,90,120,180,300].map(seconds=><option key={seconds} value={seconds}>{seconds} seconds</option>)}</select></label>
                  {restUntil !== null ? (
                    <>
                      <output aria-label="Rest remaining">
                        {restRemaining}s remaining
                      </output>
                      <button
                        onClick={() => {
                          setState(s=>({...s,workout:endWorkoutRest(s.workout)}));
                          setRestRemaining(0);
                        }}
                      >
                        End rest
                      </button>
                    </>
                  ) : restRemaining === 0 ? (
                    <span>Ready when you are.</span>
                  ) : null}
                </details>
              </div>
            )}
            {active && (
              <button
                className="workout-browse"
                onClick={() => {
                  setBrowse(true);
                  scroll.current?.scrollTo(0, 0);
                }}
              >
                Browse workout options <ChevronRight size={17} />
              </button>
            )}
            {workout.exercises.map((ex, i) => {
              const next = ex.sets.indexOf(null);
              return (
                <div className="workout-thread-step" key={i}>
                  <section
                    id={`workout-exercise-${i}`}
                    className={`workout-exercise ${i === current ? "current-exercise" : ""}`}
                    aria-label={ex.name}
                  >
                    <div className="workout-exercise-head">
                      <Photo name={ex.name} />
                      <div>
                        <h2>{ex.name}</h2>
                        <button
                          className="workout-prescription"
                          aria-label={`Adjust ${ex.name}`}
                          disabled={!active}
                          onClick={() => setAdjust(i)}
                        >
                          <Prescription ex={ex} unit={unit} />
                        </button>
                        <p>
                          {previousSession(
                            { ...workout, status: "ready" },
                            ex.name,
                            unit,
                          )}
                        </p>
                      </div>
                      <span className="workout-count">
                        {i + 1} of {workout.exercises.length}
                      </span>
                    </div>
                    <details className="workout-technique">
                      <summary>How to approach {ex.name}</summary>
                      <ul>
                        {exerciseTechnique(ex.name).cues.map((cue) => (
                          <li key={cue}>{cue}</li>
                        ))}
                      </ul>
                      <a
                        href={exerciseTechnique(ex.name).source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {exerciseTechnique(ex.name).source.title}
                      </a>
                    </details>
                    <div className="workout-sets">
                      {ex.sets.map((reps, j) => (
                        <div
                          className={`workout-set ${reps !== null ? "recorded" : ""}`}
                          key={j}
                        >
                          <div className="workout-set-line">
                            <span className="workout-set-check">
                              {reps !== null ? <Check size={21} /> : j + 1}
                            </span>
                            <div>
                              <strong>Set {j + 1}</strong>
                              <span>
                                {ex.weightConfirmed === false &&
                                ex.setWeights?.[j] == null
                                  ? "Choose load"
                                  : setLoad(ex, j)
                                    ? `${displayLoad(setLoad(ex, j), unit)} ${unit}`
                                    : "Bodyweight"}{" "}
                                {reps !== null
                                  ? `× ${reps} reps`
                                  : active && j === next
                                    ? "· How many reps?"
                                    : "· Not recorded"}
                              </span>
                            </div>
                            {reps !== null && active && (
                              <button
                                aria-label={`Edit ${ex.name} set ${j + 1}`}
                                onClick={() =>
                                  setEdit({ exercise: i, set: j, reps })
                                }
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          {active && (
                            <SetWeightInput
                              key={`${ex.name}:${j}:${setLoad(ex, j)}:${unit}:${ex.weightConfirmed !== false || ex.setWeights?.[j] != null}`}
                              name={ex.name}
                              index={j}
                              value={setLoad(ex, j)}
                              unit={unit}
                              confirmed={
                                ex.weightConfirmed !== false ||
                                ex.setWeights?.[j] != null
                              }
                              onSave={(weight) =>
                                setState((current) => ({
                                  ...current,
                                  workout: setWorkoutLoad(
                                    current.workout,
                                    i,
                                    j,
                                    weight,
                                  ),
                                }))
                              }
                            />
                          )}
                          {active && j === next && (
                            <div className="workout-reps">
                              {[-2, -1, 0, 1]
                                .map((delta) =>
                                  Math.min(100, Math.max(1, ex.target + delta)),
                                )
                                .filter((v, k, a) => a.indexOf(v) === k)
                                .map((rep) => (
                                  <button
                                    key={rep}
                                    aria-label={`${ex.name} set ${j + 1}: ${rep} reps`}
                                    disabled={
                                      ex.weightConfirmed === false &&
                                      ex.setWeights?.[j] == null
                                    }
                                    onClick={() => log(i, j, rep)}
                                  >
                                    {rep}
                                  </button>
                                ))}
                              <button
                                disabled={
                                  ex.weightConfirmed === false &&
                                  ex.setWeights?.[j] == null
                                }
                                onClick={() =>
                                  setEdit({
                                    exercise: i,
                                    set: j,
                                    reps: ex.target,
                                  })
                                }
                              >
                                Other reps
                              </button>
                              <button
                                className="workout-voice"
                                onClick={onVoice}
                              >
                                <Mic size={20} />
                                <span>Use voice</span>
                              </button>
                            </div>
                          )}
                          {active && j === next && (ex.weightConfirmed!==false||ex.setWeights?.[j]!=null) && ex.sets.slice(j+1).some(value=>value===null) && <button className="button secondary" onClick={()=>setState(s=>({...s,workout:applyLoadToRemainingSets(s.workout,i,j,setLoad(s.workout.exercises[i],j))}))}>Use this load for remaining {ex.name} sets</button>}
                          {active && reps !== null && (
                            <label className="workout-technique">
                              Effort (optional, 1–10)
                              <select
                                aria-label={`${ex.name} set ${j + 1} effort`}
                                value={ex.setEffort?.[j] ?? ""}
                                onChange={(event) => {
                                  const effort = event.target.value
                                    ? Number(event.target.value)
                                    : null;
                                  setState((s) => ({
                                    ...s,
                                    workout: {
                                      ...s.workout,
                                      exercises: s.workout.exercises.map(
                                        (item, index) =>
                                          index !== i
                                            ? item
                                            : {
                                                ...item,
                                                setEffort: item.sets.map(
                                                  (_, set) =>
                                                    set === j
                                                      ? effort
                                                      : (item.setEffort?.[
                                                          set
                                                        ] ?? null),
                                                ),
                                              },
                                      ),
                                    },
                                  }));
                                }}
                              >
                                <option value="">Not recorded</option>
                                {Array.from({ length: 10 }, (_, index) => (
                                  <option key={index + 1} value={index + 1}>
                                    {index + 1}
                                    {index === 0
                                      ? " · very easy"
                                      : index === 9
                                        ? " · maximum effort"
                                        : ""}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                    {active && (
                      <div className="workout-order">
                        <button
                          disabled={i === 0}
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              workout: moveWorkoutExercise(s.workout, i, i - 1),
                            }))
                          }
                        >
                          Move {ex.name} earlier
                        </button>
                        <button
                          disabled={i === workout.exercises.length - 1}
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              workout: moveWorkoutExercise(s.workout, i, i + 1),
                            }))
                          }
                        >
                          Move {ex.name} later
                        </button>
                      </div>
                    )}
                  </section>
                  {messages
                    .filter((m) => m.exerciseIndex === i)
                    .map((m) => (
                      <div className={`workout-message ${m.role}`} key={m.id}>
                        {m.role === "assistant" && (
                          <span className="workout-avatar">
                            <PlateMark />
                          </span>
                        )}
                        <div>
                          <p>{m.text}</p>
                          <small>
                            {m.time}{" "}
                            {m.role === "user" && <CheckCheck size={15} />}
                          </small>
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
            {messages
              .filter((m) => m.exerciseIndex === undefined)
              .map((m) => (
                <div className={`workout-message ${m.role}`} key={m.id}>
                  {m.role === "assistant" && (
                    <span className="workout-avatar">
                      <PlateMark />
                    </span>
                  )}
                  <div>
                    <p>{m.text}</p>
                    <small>{m.time}</small>
                  </div>
                </div>
              ))}
            {active &&
              current >= 0 &&
              current + 1 < workout.exercises.length && (
                <div className="workout-next">
                  <Photo name={workout.exercises[current + 1].name} />
                  <div>
                    <small>UP NEXT</small>
                    <strong>{workout.exercises[current + 1].name}</strong>
                    <span>
                      <Prescription
                        ex={workout.exercises[current + 1]}
                        unit={unit}
                      />
                    </span>
                  </div>
                </div>
              )}
            <div className="workout-encouragement">
              <BarChart3 />
              <div>
                <strong>
                  {!active
                    ? "Session saved. Every recorded set is here."
                    : current === -1
                      ? "Every set is in. Nice work."
                      : "One set at a time. You’ve got this."}
                </strong>
                <p>
                  {done} of {total} sets recorded
                  {active
                    ? ". Keep going at your pace."
                    : ". Your session is saved on this device."}
                </p>
              </div>
            </div>
            {active ? (
              <button
                className="workout-finish"
                disabled={!done}
                onClick={() =>
                  done < total ? setFinishConfirm(true) : finish()
                }
              >
                Finish workout <Check size={18} />
              </button>
            ) : (
              <button
                className="workout-finish"
                onClick={() => {
                  setBrowse(true);
                  scroll.current?.scrollTo(0, 0);
                }}
              >
                Choose your next workout <ArrowRight size={18} />
              </button>
            )}
          </>
        )}
      </div>
      {session && active && (
        <div className="fuel-compose-wrap">
          <form
            className="fuel-composer"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              aria-label="Message about your workout"
              placeholder="Tell me how that set went…"
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
            />
            {composer.trim() ? (
              <button className="fuel-send" aria-label="Send workout message">
                <ArrowUp size={23} />
              </button>
            ) : (
              <button
                type="button"
                className="fuel-send"
                aria-label="Use voice"
                onClick={onVoice}
              >
                <Mic size={23} />
              </button>
            )}
          </form>
        </div>
      )}
      <FuelTabs active="Workouts" onScan={onScan} onNavigate={onNavigate} />
      {routineLibrary && <Modal title="Your saved routines" onClose={()=>setRoutineLibrary(false)}>
        <div className="workout-history">
          <p>Keep an exercise lineup you like. Each use starts with empty sets. Review and choose loads again; earlier performance is never logged automatically.</p>
          {workout.status!=='ready'&&<form className="workout-edit" onSubmit={event=>{event.preventDefault();try{saveWorkoutRoutine(workout,routineName);setState(s=>({...s,workout:saveWorkoutRoutine(s.workout,routineName)}));setRoutineError('');setRoutineNotice('Routine saved. Your current session is unchanged.');}catch(error){setRoutineError(error instanceof Error?error.message:'Review this routine.');}}}>
            <label>Routine name<input value={routineName} maxLength={100} required onChange={event=>setRoutineName(event.target.value)}/></label>
            <button className="button primary">Save current lineup as routine</button>
          </form>}
          {routineError&&<p role="alert">{routineError}</p>}{routineNotice&&<p role="status">{routineNotice}</p>}
          {!(workout.routines?.length)&&<p>No saved routines yet. Start and customize a workout, then save its lineup here.</p>}
          {(workout.routines??[]).map(routine=><section key={routine.id}>
            <h3>{routine.name}</h3><ol>{routine.exercises.map((ex,index)=><li key={index}>{ex.name} · {ex.setCount} × {ex.target} reps{ex.suggestedLoad!==undefined?` · Previous reference ${displayLoad(ex.suggestedLoad,unit)} ${unit}; choose today's load`:''}</li>)}</ol>
            <button className="button primary" disabled={active} aria-label={`Start routine ${routine.name}`} onClick={()=>{try{startWorkoutRoutine(workout,routine.id);setState(s=>({...s,workout:startWorkoutRoutine(s.workout,routine.id)}));setRoutineLibrary(false);setBrowse(false);}catch(error){setRoutineError(error instanceof Error?error.message:'Cannot start this routine.');}}}>Start with empty sets</button>
            <button className="button secondary" aria-label={`Remove routine ${routine.name}`} onClick={()=>setRemoveRoutine(routine.id)}>Remove routine</button>
            {removeRoutine===routine.id&&<div><p>Remove this saved routine? Your performed sessions and current workout stay saved.</p><button onClick={()=>{setState(s=>({...s,workout:deleteWorkoutRoutine(s.workout,routine.id)}));setRemoveRoutine(null);}}>Confirm remove routine</button><button onClick={()=>setRemoveRoutine(null)}>Keep routine</button></div>}
          </section>)}
          {active&&<p>Finish your active session before starting another routine.</p>}
        </div>
      </Modal>}
      {menu && (
        <Modal title="Your workouts" onClose={() => setMenu(false)}>
          <div className="fuel-menu">
            <button
              onClick={() => {
                setMenu(false);
                setHistory(true);
              }}
            >
              Session history <ChevronRight />
            </button>
            <button
              onClick={() => {
                setMenu(false);
                setDetail({
                  title: "About these workouts",
                  text: "Choose a starter workout or create one with your preferences. Starter reps are example targets you can adjust. Choose your own load before recording a set. Exercise history and recent training use your recorded, finished sessions. Your sets, corrections, and completed sessions are saved on this device.",
                });
              }}
            >
              About these workouts <ChevronRight />
            </button>
            <button onClick={() => onNavigate("Chat")}>
              Back to chat <ChevronRight />
            </button>
          </div>
        </Modal>
      )}
      {history && (
        <Modal title="Session history" onClose={() => setHistory(false)}>
          <div className="workout-history">
            {active && (
              <section>
                <h3>{title} · In progress</h3>
                <p>
                  {done} of {total} sets recorded.
                </p>
                <button
                  className="workout-start"
                  onClick={() => {
                    setHistory(false);
                    resume();
                  }}
                >
                  Resume workout <ArrowRight size={17} />
                </button>
              </section>
            )}
            {historySessions.length > 0 && (
              <p>
                Your {historySessions.length} finished{" "}
                {historySessions.length === 1 ? "session" : "sessions"}.
                Unrecorded sets are not included.
              </p>
            )}
            {historySessions.map((item) => (
              <section key={`${item.startedAt}:${item.finishedAt}`}>
                <h3>{item.title} · Saved</h3>
                <p>{recordedDate(item.finishedAt)}</p>
                {item.exercises.map((ex, index) => (
                  <p key={`${ex.name}:${index}`}>
                    <strong>{ex.name}</strong>:{" "}
                    {ex.sets
                      .map(
                        (reps, index) =>
                          `${displayLoad(ex.setWeights?.[index] ?? ex.weight, unit)} ${unit} × ${reps}`,
                      )
                      .join(", ")}
                  </p>
                ))}
                <button
                  disabled={active}
                  className="button secondary"
                  onClick={() => {
                    setState((s) => ({
                      ...s,
                      workout:
                        Date.parse(item.startedAt) === Date.parse(s.workout.startedAt ?? '')
                          ? reopenWorkout(s.workout)
                          : reopenHistoryWorkout(
                              s.workout,
                              (s.workout.history ?? []).findIndex(
                                (entry) => Date.parse(entry.startedAt ?? '') === Date.parse(item.startedAt),
                              ),
                            ),
                    }));
                    setHistory(false);
                    setBrowse(false);
                  }}
                >
                  Correct {item.title}
                </button>
              </section>
            ))}
            {!historySessions.length && (
              <p>
                No finished sessions with recorded sets yet. Finish your workout
                to start building your history.
              </p>
            )}
          </div>
        </Modal>
      )}
      {edit && (
        <Modal title={`Edit set ${edit.set + 1}`} onClose={() => setEdit(null)}>
          <form
            className="workout-edit"
            onSubmit={(e) => {
              e.preventDefault();
              log(edit.exercise, edit.set, edit.reps);
              setEdit(null);
            }}
          >
            <label>
              Reps
              <input
                autoFocus
                type="number"
                min="0"
                max="100"
                required
                value={edit.reps}
                onChange={(e) =>
                  setEdit({ ...edit, reps: e.target.valueAsNumber })
                }
              />
            </label>
            <button className="workout-start">Save reps</button>
          </form>
        </Modal>
      )}
      {adjust !== null && (
        <ExerciseAdjustmentDialog
          unit={unit}
          workout={workout}
          index={adjust}
          onClose={() => setAdjust(null)}
          onSave={(change) =>
            setState((latest) => {
              try {
                return {
                  ...latest,
                  workout: adjustWorkoutExercise(
                    latest.workout,
                    adjust,
                    change,
                  ),
                };
              } catch {
                return latest;
              }
            })
          }
        />
      )}
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          <p className="workout-detail">{detail.text}</p>
        </Modal>
      )}
      {finishConfirm && (
        <Modal
          title="Save this partial workout?"
          onClose={() => setFinishConfirm(false)}
        >
          <p>
            {done} of {total} sets are recorded. Empty sets stay unrecorded. You
            can reopen this session to correct it.
          </p>
          <button
            className="button primary"
            onClick={() => {
              finish();
              setFinishConfirm(false);
            }}
          >
            Save partial workout
          </button>
          <button
            className="button secondary"
            onClick={() => setFinishConfirm(false)}
          >
            Keep training
          </button>
        </Modal>
      )}
      {activityOpen && (
        <Modal
          title="Log walk or cardio"
          onClose={() => { setActivityOpen(false); if (startWithMovement) onFirstMovementClose?.(); }}
        >
          <form
            className="edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const input = {
                title: String(data.get("title")),
                day: String(data.get("day")),
                minutes: Number(data.get("minutes")),
                note: String(data.get("note")),
              };
              try {
                const checked = addActivity(state, input).activities!.at(-1)!;
                setState((s) =>
                  editingActivity
                    ? {
                        ...s,
                        activities: (s.activities ?? []).map((item) =>
                          item.id === editingActivity.id
                            ? { ...checked, id: item.id }
                            : item,
                        ),
                      }
                    : addActivity(s, input),
                );
                setActivityOpen(false);
                if (startWithMovement) onFirstMovementClose?.();
                setActivityError("");
              } catch (error) {
                setActivityError(
                  error instanceof Error ? error.message : "Check the details.",
                );
              }
            }}
          >
            <label>
              Activity
              <input
                name="title"
                required
                defaultValue={editingActivity?.title ?? "Walk"}
                maxLength={120}
              />
            </label>
            <label>
              Activity date
              <input
                name="day"
                type="date"
                max={today()}
                defaultValue={editingActivity?.day ?? today()}
                required
              />
            </label>
            <label>
              Minutes
              <input
                name="minutes"
                type="number"
                defaultValue={editingActivity?.minutes}
                min="0.1"
                max="1440"
                step="any"
                required
              />
            </label>
            <label>
              Notes
              <textarea
                name="note"
                defaultValue={editingActivity?.note}
                maxLength={1000}
              />
            </label>
            <p>
              Record your movement without estimating calorie burn or changing
              food targets.
            </p>
            {activityError && <p role="alert">{activityError}</p>}
            <button className="button primary">Save activity</button>
          </form>
        </Modal>
      )}
    </section>
  );
}

function SetWeightInput({
  name,
  index,
  value,
  onSave,
  unit,
  confirmed,
}: {
  name: string;
  index: number;
  value: number;
  unit: "lb" | "kg";
  confirmed: boolean;
  onSave: (weight: number) => void;
}) {
  const [input, setInput] = useState(
    confirmed ? String(displayLoad(value, unit)) : "",
  );
  const number = Number(input);
  return (
    <div className="workout-set-load">
      <label>
        {name} set {index + 1} weight ({unit})
        <input
          type="number"
          min="0"
          max={unit === "kg" ? 907.18 : 2000}
          step="any"
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={
          !input.trim() ||
          !Number.isFinite(number) ||
          number < 0 ||
          number > (unit === "kg" ? 907.18 : 2000) ||
          (confirmed && number === displayLoad(value, unit))
        }
        onClick={() => onSave(storedLoad(number, unit))}
      >
        Save set weight
      </button>
      <small>0 = bodyweight. Record the load you actually used.</small>
    </div>
  );
}

function ExerciseAdjustmentDialog({
  unit,
  workout,
  index,
  onSave,
  onClose,
}: {
  workout: Workout;
  unit: "lb" | "kg";
  index: number;
  onSave: (change: ExerciseAdjustment) => void;
  onClose: () => void;
}) {
  const exercise = workout.exercises[index];
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<ExerciseAdjustment | null>(null);
  const hasRecorded = exercise?.sets.some((reps) => reps !== null) ?? false;
  const minimumSets = exercise
    ? Math.max(
        1,
        exercise.sets.reduce<number>(
          (last, reps, set) => (reps !== null ? set + 1 : last),
          0,
        ),
      )
    : 1;

  useEffect(() => {
    if (!attempt) return;
    if (
      exercise &&
      exercise.name === attempt.name.trim() &&
      exercise.weight === attempt.weight &&
      exercise.target === attempt.target &&
      exercise.sets.length === attempt.setCount
    ) {
      onClose();
      return;
    }
    try {
      adjustWorkoutExercise(workout, index, attempt);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your workout changed. Check it again.",
      );
      setAttempt(null);
      return;
    }
    const timeout = setTimeout(() => {
      setError(
        "The update has not been confirmed. Check your workout and try again.",
      );
      setAttempt(null);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [workout, index, attempt, onClose]);

  return (
    <Modal
      title={exercise ? `Adjust ${exercise.name}` : "Adjust exercise"}
      onClose={onClose}
    >
      {!exercise ? (
        <p>This exercise is no longer available.</p>
      ) : (
        <form
          className="workout-edit"
          onSubmit={(event) => {
            event.preventDefault();
            if (attempt) return;
            const data = new FormData(event.currentTarget);
            const change = {
              name: hasRecorded
                ? exercise.name
                : String(data.get("name") || ""),
              weight: hasRecorded
                ? exercise.weight
                : exercise.weightConfirmed !== false &&
                    Number(data.get("weight")) ===
                      displayLoad(exercise.weight, unit)
                  ? exercise.weight
                  : storedLoad(Number(data.get("weight")), unit),
              target: Number(data.get("target")),
              setCount: Number(data.get("setCount")),
            };
            try {
              adjustWorkoutExercise(workout, index, change);
              setError("");
              setAttempt(change);
              onSave(change);
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Check the exercise details.",
              );
            }
          }}
        >
          {error && <p role="alert">{error}</p>}
          <label>
            Exercise name or substitution
            <input
              name="name"
              defaultValue={exercise.name}
              maxLength={100}
              required
              disabled={hasRecorded || !!attempt}
            />
          </label>
          <label>
            Weight ({unit})
            <input
              name="weight"
              type="number"
              min="0"
              max={unit === "kg" ? 907.18 : 2000}
              step="any"
              defaultValue={
                exercise.weightConfirmed === false
                  ? ""
                  : displayLoad(exercise.weight, unit)
              }
              required
              disabled={hasRecorded || !!attempt}
            />
          </label>
          {hasRecorded && (
            <p className="workout-detail">
              Name and weight stay fixed after a set is logged. Your recorded
              reps stay as they are; targets apply to your remaining sets.
            </p>
          )}
          <label>
            Number of sets
            <input
              name="setCount"
              type="number"
              min={minimumSets}
              max="10"
              step="1"
              defaultValue={exercise.sets.length}
              required
              disabled={!!attempt}
            />
          </label>
          <label>
            Target reps
            <input
              name="target"
              type="number"
              min="1"
              max="100"
              step="1"
              defaultValue={exercise.target}
              required
              disabled={!!attempt}
            />
          </label>
          <button className="workout-start" disabled={!!attempt}>
            {attempt ? "Saving exercise…" : "Save exercise"}
          </button>
        </form>
      )}
    </Modal>
  );
}
