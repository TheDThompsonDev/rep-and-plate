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
  Moon,
} from "lucide-react";
import { FuelHeader, FuelTabs } from "./FuelNavigation";
import { FuelLeaf } from "./ChatLayer";
import { Modal } from "./components";
import { type AppState, type Exercise, type Page } from "./domain";
import {
  recordSet,
  replyToWorkout,
  startPlan,
  workoutPhoto,
  workoutPlans,
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

export default function WorkoutPage({
  state,
  setState,
  onNavigate,
  onProfile,
  onVoice,
}: {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  onNavigate: (page: Page) => void;
  onProfile: () => void;
  onVoice: () => void;
}) {
  const workout = state.workout;
  const [selected, setSelected] = useState(workout.planId ?? "upper");
  const [browse, setBrowse] = useState(false);
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState<{ title: string; text: string } | null>(
    null,
  );
  const [history, setHistory] = useState(false);
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
          <FuelLeaf />
          <div>
            <strong>Don’t log your workout. Tell us what happened.</strong>
            <span>Just talk, type, or tap. We’ll track the details.</span>
          </div>
        </div>
      )}
      <div className="workout-scroll" ref={scroll}>
        {!session ? (
          <>
            <div className="workout-heading">
              <h1>What should you do today?</h1>
              <p>Your next workout, with room for how you feel today.</p>
            </div>
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
                <span>Today’s workout</span>
                <h2>
                  {plan.title} · ~{plan.minutes} min
                </h2>
                <p>{plan.description}</p>
                <button className="workout-start" onClick={start}>
                  Start workout <ArrowRight size={21} />
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
                      text: `${ex.weight ? `${ex.weight} lb. ` : "Bodyweight. "}${ex.sets.length} sets of ${ex.target} reps. These are sample starting targets. Once you start, tap the exercise details to adjust the weight and target reps to suit you.`,
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
                      {ex.previous.length
                        ? `Last time: ${ex.previous.join(", ")} reps`
                        : "A fresh start. Find your rhythm."}
                    </small>
                    {i === 0 && selected === "upper" && (
                      <em>
                        <Dumbbell size={16} /> Try to get all 3 sets of 8 today.
                      </em>
                    )}
                  </span>
                  <ChevronRight size={20} />
                </button>
              ))}
            </div>
            <div className="workout-section-title">
              <h2>What we’re learning</h2>
              <button
                onClick={() =>
                  setDetail({
                    title: "Learning from your workouts",
                    text: "These are sample insights showing how Fuel could connect training, recovery, and progress. Your sessions are saved on this device. Personalized analysis is not connected yet.",
                  })
                }
              >
                See all <ChevronRight size={17} />
              </button>
            </div>
            <button
              className="workout-insight"
              onClick={() =>
                setDetail({
                  title: "Your strength, over time",
                  text: "Sample insight: bench press increased from 170 lb to 185 lb over seven weeks. This illustrates a future progress insight, not an analysis of your saved workouts.",
                })
              }
            >
              <span>
                <BarChart3 />
              </span>
              <div>
                <strong>Your bench has increased 15 lb in 7 weeks.</strong>
                <p>You’re getting stronger. Keep it up.</p>
              </div>
              <ChevronRight size={20} />
            </button>
            <button
              className="workout-insight"
              onClick={() =>
                setDetail({
                  title: "Recovery and your routine",
                  text: "This is an example of a recovery insight. Sleep tracking and personalized recovery recommendations are not connected in this prototype.",
                })
              }
            >
              <span>
                <Moon />
              </span>
              <div>
                <strong>A little recovery goes a long way.</strong>
                <p>Make space for rest between your sessions.</p>
              </div>
              <ChevronRight size={20} />
            </button>
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
            {workout.exercises.map((ex, i) => {
              const next = ex.sets.indexOf(null);
              const shown = !active || current === -1 || i <= current;
              if (!shown) return null;
              return (
                <div className="workout-thread-step" key={ex.name}>
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
                          disabled={!active || ex.sets.some((r) => r !== null)}
                          onClick={() =>
                            setDetail({
                              title: `Adjust ${ex.name}`,
                              text: String(i),
                            })
                          }
                        >
                          <Prescription ex={ex} />
                        </button>
                        <p>
                          {ex.previous.length
                            ? `Last time: ${ex.previous.join(", ")} reps`
                            : "Your first recorded session"}
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
                                {ex.weight ? `${ex.weight} lb` : "Bodyweight"}{" "}
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
                          {active && i === current && j === next && (
                            <div className="workout-reps">
                              {[-2, -1, 0, 1]
                                .map((delta) => Math.max(1, ex.target + delta))
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
                            <FuelLeaf />
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
                      <FuelLeaf />
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
                    ? "A little stronger. One session at a time."
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
        onNavigate={onNavigate}
        onProfile={onProfile}
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
                  text: "Choose from sample workout plans and track sets in a conversation. Plan suggestions and past-performance insights use example data. Your logged sets, corrections, and completed sessions are saved on this device.",
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
            {[
              ...(workout.history ?? []),
              ...(workout.startedAt
                ? [
                    {
                      title,
                      exercises: workout.exercises,
                      startedAt: workout.startedAt,
                      finishedAt: workout.finishedAt,
                    },
                  ]
                : []),
            ]
              .reverse()
              .map((item, i) => (
                <section key={i}>
                  <h3>
                    {item.title} · {item.finishedAt ? "Saved" : "In progress"}
                  </h3>
                  <p>
                    {item.startedAt &&
                      new Date(item.startedAt).toLocaleDateString()}
                  </p>
                  {item.exercises.map((ex) => (
                    <p key={ex.name}>
                      {ex.name}: {ex.sets.map((r) => r ?? "—").join(", ")} reps
                    </p>
                  ))}
                </section>
              ))}
            {!workout.startedAt && !workout.history?.length && (
              <p>Your sessions will appear here after you start a workout.</p>
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
      {detail && (
        <Modal title={detail.title} onClose={() => setDetail(null)}>
          {detail.title.startsWith("Adjust ") ? (
            <form
              className="workout-edit"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                setState((s) => ({
                  ...s,
                  workout: {
                    ...s.workout,
                    exercises: s.workout.exercises.map((ex, i) =>
                      i === Number(detail.text)
                        ? {
                            ...ex,
                            weight: Number(data.get("weight")),
                            target: Number(data.get("target")),
                          }
                        : ex,
                    ),
                  },
                }));
                setDetail(null);
              }}
            >
              <label>
                Weight (lb)
                <input
                  name="weight"
                  type="number"
                  min="0"
                  max="2000"
                  step="0.5"
                  defaultValue={workout.exercises[Number(detail.text)].weight}
                  required
                />
              </label>
              <label>
                Target reps
                <input
                  name="target"
                  type="number"
                  min="1"
                  max="100"
                  defaultValue={workout.exercises[Number(detail.text)].target}
                  required
                />
              </label>
              <button className="workout-start">Save exercise</button>
            </form>
          ) : (
            <p className="workout-detail">{detail.text}</p>
          )}
        </Modal>
      )}
    </section>
  );
}
