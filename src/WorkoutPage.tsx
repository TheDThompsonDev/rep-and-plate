import { SpotAvatar, SpotEmptyState, SpotMoment } from './features/spot/Spot';
import { setLoad, setWorkoutLoad, recordedLoads } from './features/progress/set-loads';
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
import { type AppState, type Exercise, type Page } from "./domain";
import { completedWorkoutContext, lastExerciseEvidence } from "./features/workout-planning/history";
import {
  recordSet,
  replyToWorkout,
  startPlan,
  workoutPhoto,
  workoutPlans,
  adjustWorkoutExercise,
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
function Prescription({ ex }: { ex: Exercise }) {
  return (
    <>
      {ex.weight ? `${ex.weight} lb · ` : "Bodyweight · "}
      {ex.sets.length} × {ex.target}
    </>
  );
}

function recordedDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function previousSession(workout: Workout, name: string) {
  const evidence = lastExerciseEvidence(workout, name);
  return evidence
    ? `Last recorded: ${evidence.setWeights?recordedLoads(evidence):`${evidence.weight ? `${evidence.weight} lb` : "Bodyweight"} · ${evidence.sets.join(", ")} reps`} · ${recordedDate(evidence.finishedAt)}`
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
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  onNavigate: (page: Page) => void;
  onProfile: () => void;
  onVoice: () => void;
  onBuild: () => void;
  onScan: () => void;
}) {
  const workout = state.workout;
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
  const finishedSessions = completedWorkoutContext(workout);
  const recentSets = finishedSessions.reduce((count, item) => count + item.exercises.reduce((sets, exercise) => sets + exercise.sets.length, 0), 0);
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
  useEffect(() => {
    if (scroll.current && messages.length > 0)
      scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages.length]);
  function log(exercise: number, set: number, reps: number) {
    setState((s) => ({
      ...s,
      workout: recordSet(s.workout, exercise, set, reps),
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
      workout: {
        ...s.workout,
        status: "finished",
        finishedAt: new Date().toISOString(),
      },
    }));
  }
  function send() {
    if (!composer.trim()) return;
    setState((s) => ({
      ...s,
      workout: replyToWorkout(s.workout, composer.trim()),
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
      {session && (
        <div className="fuel-banner workout-banner">
          <SpotAvatar side="rep" expression={active ? 'default' : 'tired'} size={48}/>
          <div>
            <strong>Tell Spot what you did.</strong>
            <span>Workout · Talk, type, or tap your sets.</span>
          </div>
        </div>
      )}
      <div className="workout-scroll" ref={scroll}>
        {!session ? (
          <>
            <div className="workout-heading">
              <h1>What should you do today?</h1>
              <p>Your next workout, with room for how you feel today.</p>
              <button className="button secondary" disabled={active} onClick={onBuild}>
                Create a workout for me
              </button>
            </div>
            {active && <section className="workout-resume" aria-label="Your active workout"><div><strong>{title} is still in progress</strong><p>{done} of {total} sets recorded. Continue this session before starting another.</p></div><button onClick={resume}>Resume workout <ArrowRight size={18}/></button></section>}
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
                <p className="workout-target-note">Example targets. Adjust the weights and reps to suit you before logging.</p>
                <button className="workout-start" onClick={active ? resume : start}>
                  {active ? "Continue current workout" : "Start workout"} <ArrowRight size={21} />
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
                      text: `${ex.weight ? `${ex.weight} lb. ` : "Bodyweight. "}${ex.sets.length} sets of ${ex.target} reps. These are sample starting targets. Once you start, tap the exercise details to swap the exercise or adjust its weight, sets, and target reps.`,
                    })
                  }
                >
                  <span className="workout-number">{i + 1}</span>
                  <Photo name={ex.name} />
                  <span className="workout-preview-copy">
                    <strong>{ex.name}</strong>
                    <span>
                      <Prescription ex={ex} />
                    </span>
                    <small>
                      {previousSession(workout, ex.name)}
                    </small>
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
            {latestSession ? <>
              <button className="workout-insight" onClick={()=>setHistory(true)}><span><BarChart3/></span><div><strong>{recentSets} sets across {finishedSessions.length === 1 ? "your latest finished session" : `your latest ${finishedSessions.length} finished sessions`}.</strong><p>Only the sets you recorded are counted.</p></div><ChevronRight size={20}/></button>
              <button className="workout-insight" onClick={()=>setHistory(true)}><span><Dumbbell/></span><div><strong>Last finished: {latestSession.title}</strong><p>{recordedDate(latestSession.finishedAt)} · {latestSession.exercises.length} {latestSession.exercises.length === 1 ? "exercise" : "exercises"} with recorded sets.</p></div><ChevronRight size={20}/></button>
            </> : <SpotEmptyState side="rep" onCapture={()=>onNavigate('Chat')}/>}
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
            {active && <button className="workout-browse" onClick={()=>{setBrowse(true);scroll.current?.scrollTo(0,0);}}>Browse workout options <ChevronRight size={17}/></button>}
            {workout.exercises.map((ex, i) => {
              const next = ex.sets.indexOf(null);
              const shown = !active || current === -1 || i <= current;
              if (!shown) return null;
              return (
                <div className="workout-thread-step" key={i}>
                  <section
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
                          <Prescription ex={ex} />
                        </button>
                        <p>
                          {previousSession({...workout, status: "ready"}, ex.name)}
                        </p>
                      </div>
                      <span className="workout-count">
                        {i + 1} of {workout.exercises.length}
                      </span>
                    </div>
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
                                {setLoad(ex,j) ? `${setLoad(ex,j)} lb` : "Bodyweight"}{" "}
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
                          {active&&<SetWeightInput key={`${ex.name}:${j}:${setLoad(ex,j)}`} name={ex.name} index={j} value={setLoad(ex,j)} onSave={weight=>setState(current=>({...current,workout:setWorkoutLoad(current.workout,i,j,weight)}))}/>}
                          {active && i === current && j === next && (
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
                                    onClick={() => log(i, j, rep)}
                                  >
                                    {rep}
                                  </button>
                                ))}
                              <button
                                className="workout-voice"
                                onClick={onVoice}
                              >
                                <Mic size={20} />
                                <span>Use voice</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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
                      <Prescription ex={workout.exercises[current + 1]} />
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
                onClick={finish}
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
      <FuelTabs
        active="Workouts"
        onScan={onScan}
        onNavigate={onNavigate}
      />
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
                  text: "Choose a starter workout or create one with your preferences. Starter weights and reps are example targets you can adjust. Exercise history and recent training use your recorded, finished sessions. Your sets, corrections, and completed sessions are saved on this device.",
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
            {active && <section><h3>{title} · In progress</h3><p>{done} of {total} sets recorded.</p><button className="workout-start" onClick={()=>{setHistory(false);resume();}}>Resume workout <ArrowRight size={17}/></button></section>}
            {finishedSessions.length > 0 && <p>Your latest {finishedSessions.length} finished {finishedSessions.length === 1 ? "session" : "sessions"}. Unrecorded sets are not included.</p>}
            {finishedSessions.map(item=><section key={`${item.startedAt}:${item.finishedAt}`}><h3>{item.title} · Saved</h3><p>{recordedDate(item.finishedAt)}</p>{item.exercises.map((ex,index)=><p key={`${ex.name}:${index}`}><strong>{ex.name}</strong>: {ex.setWeights?recordedLoads(ex):`${ex.weight ? `${ex.weight} lb` : "Bodyweight"} · ${ex.sets.join(", ")} reps`}</p>)}</section>)}
            {!finishedSessions.length && <p>No finished sessions with recorded sets yet. Finish your workout to start building your history.</p>}
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
    </section>
  );
}

function SetWeightInput({name,index,value,onSave}:{name:string;index:number;value:number;onSave:(weight:number)=>void}) {
  const [input,setInput]=useState(String(value));
  const number=Number(input);
  return <div className="workout-set-load"><label>{name} set {index+1} weight (lb)<input type="number" min="0" max="2000" step="any" value={input} onChange={event=>setInput(event.target.value)}/></label><button type="button" disabled={!input.trim()||!Number.isFinite(number)||number<0||number>2000||number===value} onClick={()=>onSave(number)}>Save set weight</button><small>0 = bodyweight. Record the load you actually used.</small></div>;
}

function ExerciseAdjustmentDialog({
  workout,
  index,
  onSave,
  onClose,
}: {
  workout: Workout;
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
                : Number(data.get("weight")),
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
            Weight (lb)
            <input
              name="weight"
              type="number"
              min="0"
              max="2000"
              step="any"
              defaultValue={exercise.weight}
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
