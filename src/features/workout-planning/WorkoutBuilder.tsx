import { apiFetch } from "../../api-fetch";
import { useEffect, useRef, useState } from "react";
import { Modal } from "../../components";
import type { AppState } from "../../domain";
import { workoutProposalSchema, type WorkoutProposal } from "./contracts";
import { completedWorkoutContext, lastExerciseEvidence } from "./history";
import "../scanner/scanner.css";
import "./workout-builder.css";

export default function WorkoutBuilder({
  state,
  onClose,
  onStart,
}: {
  state: AppState;
  onClose: () => void;
  onStart: (plan: WorkoutProposal) => void;
}) {
  const [goal, setGoal] = useState(
    (state.preferences?.workoutPreferences ?? "").slice(0, 1500),
  );
  const [equipment, setEquipment] = useState(
    state.preferences?.equipment.join(", ").slice(0, 300) || "Bodyweight",
  );
  const [minutes, setMinutes] = useState(30);
  const [plan, setPlan] = useState<WorkoutProposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const history = completedWorkoutContext(state.workout);
  const changeExercise = (
    index: number,
    patch: Partial<WorkoutProposal["exercises"][number]>,
  ) =>
    setPlan((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((exercise, i) =>
              i === index ? { ...exercise, ...patch } : exercise,
            ),
          }
        : current,
    );
  const validPlan =
    plan &&
    workoutProposalSchema.safeParse(plan).success &&
    plan.exercises.every((exercise) => exercise.name.trim().length > 0);
  return (
    <Modal title="A workout for you" onClose={onClose}>
      <div className="scanner-content">
        <p>
          Tell Rep & Plate your goal, experience, and any movements you need to avoid.
          Review the proposal before starting.
        </p>
        <p className="workout-history-context">
          {history.length
            ? `Using ${history.length} completed ${history.length === 1 ? "session" : "sessions"} with recorded sets. Previous weights are context, not a suggested increase.`
            : "No completed sessions with recorded sets yet. Sample targets are not treated as your history."}
        </p>
        <form
          className="edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            request.current?.abort();
            const controller = new AbortController();
            request.current = controller;
            setBusy(true);
            setError("");
            setPlan(null);
            try {
              const response = await apiFetch("/api/plans/workout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goal, equipment, minutes, history }),
                signal: AbortSignal.any([
                  controller.signal,
                  AbortSignal.timeout(120000),
                ]),
              });
              const result = await response.json();
              if (!response.ok)
                throw new Error(
                  typeof result.error === "string"
                    ? result.error
                    : "Couldn't make a plan.",
                );
              const parsed = workoutProposalSchema.safeParse(result);
              if (!parsed.success)
                throw new Error(
                  "The proposal was incomplete. Please try again.",
                );
              if (!controller.signal.aborted) setPlan(parsed.data);
            } catch (caught) {
              if (!controller.signal.aborted)
                setError(
                  caught instanceof Error ? caught.message : "Please retry.",
                );
            } finally {
              if (!controller.signal.aborted) setBusy(false);
            }
          }}
        >
          <label>
            What are you working toward?
            <textarea
              required
              maxLength={1500}
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="Build strength, beginner, avoid jumping…"
            />
          </label>
          <label>
            Available equipment
            <input
              required
              value={equipment}
              maxLength={300}
              onChange={(event) => setEquipment(event.target.value)}
            />
          </label>
          <label>
            Time in minutes
            <input
              type="number"
              min={5}
              max={120}
              required
              value={minutes}
              onChange={(event) => setMinutes(Number(event.target.value))}
            />
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Building your proposal…" : "Create workout"}
          </button>
        </form>
        {error && <p role="alert">{error}</p>}
        {plan && (
          <section className="fuel-proposed-meal workout-proposal">
            <h3>
              {plan.title} · ~{plan.minutes} min
            </h3>
            <p>{plan.reason}</p>
            {plan.exercises.map((exercise, index) => {
              const previous = lastExerciseEvidence(
                state.workout,
                exercise.name,
              );
              return (
                <fieldset className="workout-proposal-exercise" key={index}>
                  <legend>Exercise {index + 1}</legend>
                  <label>
                    Exercise or substitute
                    <input
                      aria-label={`Exercise ${index + 1}`}
                      maxLength={100}
                      value={exercise.name}
                      onChange={(event) =>
                        changeExercise(index, { name: event.target.value })
                      }
                    />
                  </label>
                  <div className="workout-proposal-dose">
                    <label>
                      Sets
                      <input
                        aria-label={`Sets for exercise ${index + 1}`}
                        type="number"
                        min={1}
                        max={5}
                        value={exercise.sets}
                        onChange={(event) =>
                          changeExercise(index, {
                            sets: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      Reps per set
                      <input
                        aria-label={`Reps for exercise ${index + 1}`}
                        type="number"
                        min={1}
                        max={30}
                        value={exercise.reps}
                        onChange={(event) =>
                          changeExercise(index, {
                            reps: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                  <p>{exercise.note}</p>
                  <div className="workout-previous-evidence">
                    {previous ? (
                      <>
                        <strong>
                          Last recorded ·{" "}
                          {new Date(previous.finishedAt).toLocaleDateString()}
                        </strong>
                        <span>
                          {previous.weight
                            ? `${previous.weight} lb`
                            : "Bodyweight / no added load"}{" "}
                          · {previous.sets.length} recorded{" "}
                          {previous.sets.length === 1 ? "set" : "sets"}:{" "}
                          {previous.sets.join(", ")} reps
                        </span>
                        <small>
                          {previous.sessionTitle}. No automatic load increase.
                        </small>
                      </>
                    ) : (
                      <span>
                        No completed history for this exact exercise name.
                      </span>
                    )}
                  </div>
                </fieldset>
              );
            })}
            <p>
              Choose a comfortable weight in the session. Changing an exercise
              does not transfer another exercise's history. This proposal does
              not assume recovery or wearable data.
            </p>
            <button
              className="button primary"
              disabled={state.workout.status === "active" || !validPlan}
              onClick={() => {
                if (validPlan)
                  onStart({
                    ...plan,
                    exercises: plan.exercises.map((exercise) => ({
                      ...exercise,
                      name: exercise.name.trim(),
                    })),
                  });
              }}
            >
              Use this workout
            </button>
            {state.workout.status === "active" && (
              <p>Finish your current workout before starting another.</p>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
