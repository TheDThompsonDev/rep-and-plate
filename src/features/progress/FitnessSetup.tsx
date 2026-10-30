import { useState } from "react";
import {
  cadenceLabels,
  convertSetupUnit,
  fitnessDraft,
  goalLabels,
  parseFitnessSetup,
  type FitnessGoal,
  type FitnessSetupDraft,
} from "./fitness-goal";
import "./fitness-setup.css";
import type { BodyWeightEntry } from "./body-weight";
import {
  equipmentChoices,
  equipmentLabels,
  experienceLabels,
  trainingDayChoices,
  type Equipment,
  type Experience,
  type TrainingProgram,
} from "./training-program";

export function FitnessSetup({
  goal,
  program,
  weight,
  initialDraft,
  onDraftChange,
  onSave,
  onSkip,
  busy = false,
}: {
  goal?: FitnessGoal;
  /** Existing training week; pre-fills the week fields so re-saving the goal keeps it. */
  program?: TrainingProgram;
  weight?: BodyWeightEntry;
  initialDraft?: FitnessSetupDraft;
  onDraftChange?: (draft: FitnessSetupDraft) => void;
  onSave: (draft: FitnessSetupDraft) => void;
  onSkip?: () => void;
  busy?: boolean;
}) {
  const [draft, setDraft] = useState(() => initialDraft ?? fitnessDraft(goal, program)),
    [error, setError] = useState("");
  const weekChosen = draft.trainingDays.trim() !== "";
  const patch = (value: Partial<FitnessSetupDraft>) => {
    const next = { ...draft, ...value };
    setDraft(next);
    onDraftChange?.(next);
    setError("");
  };
  return (
    <form
      className="fitness-setup"
      onSubmit={(event) => {
        event.preventDefault();
        try {
          parseFitnessSetup(draft, weight);
          onSave(draft);
        } catch (cause) {
          setError((cause as Error).message);
        }
      }}
    >
      <label>
        Your main goal
        <select
          aria-label="Your main goal"
          value={draft.kind}
          onChange={(event) =>
            patch({
              kind: event.target.value as FitnessGoal["kind"],
              targetWeight: "",
            })
          }
          disabled={busy}
        >
          {Object.entries(goalLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="fitness-hint">
        Your goal helps frame your progress. You can change it anytime from your
        profile.
      </p>
      <label>
        Weight unit
        <select
          aria-label="Weight unit"
          value={draft.unit}
          onChange={(event) => {
            const next = convertSetupUnit(draft, event.target.value as FitnessGoal["unit"]);
            setDraft(next);
            onDraftChange?.(next);
            setError("");
          }}
          disabled={busy}
        >
          <option value="lb">lb</option>
          <option value="kg">kg</option>
        </select>
      </label>
      <div className="fitness-weight-fields">
        <label>
          Current weight
          <input
            type="number"
            step="any"
            min="0.1"
            max="2000"
            value={draft.currentWeight}
            onChange={(event) => patch({ currentWeight: event.target.value })}
            disabled={busy}
            placeholder={`Your weight in ${draft.unit}`}
          />
        </label>
        {["lose", "gain"].includes(draft.kind) && (
          <label>
            Target weight
            <input
              type="number"
              step="any"
              min="0.1"
              max="2000"
              value={draft.targetWeight}
              onChange={(event) => patch({ targetWeight: event.target.value })}
              disabled={busy}
              placeholder={`Your target in ${draft.unit}`}
            />
          </label>
        )}
      </div>
      <p className="fitness-hint">
        A current weight becomes today’s first measurement. Don’t know it yet?
        Leave it blank and add it from your profile later.
      </p>
      <label>
        Weight check-in rhythm
        <select
          aria-label="Weight check-in rhythm"
          value={draft.cadence}
          onChange={(event) =>
            patch({ cadence: event.target.value as FitnessGoal["cadence"] })
          }
          disabled={busy}
        >
          {Object.entries(cadenceLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="fitness-week">
        <legend>Your training week (optional)</legend>
        <label>
          Training days per week
          <select
            aria-label="Training days per week"
            value={draft.trainingDays}
            onChange={(event) => patch({ trainingDays: event.target.value })}
            disabled={busy}
          >
            <option value="">{program ? "Keep my current week" : "Not now"}</option>
            {trainingDayChoices.map((days) => (
              <option key={days} value={String(days)}>
                {days} days
              </option>
            ))}
          </select>
        </label>
        {weekChosen && (
          <>
            <div className="fitness-equipment" role="group" aria-label="Available equipment">
              <span>Available equipment</span>
              {equipmentChoices.map((item) => (
                <label className="fitness-checkbox" key={item}>
                  <input
                    type="checkbox"
                    checked={draft.equipment.includes(item)}
                    disabled={busy}
                    onChange={(event) =>
                      patch({
                        equipment: event.target.checked
                          ? [...draft.equipment, item]
                          : draft.equipment.filter((value) => value !== item),
                      })
                    }
                  />
                  {equipmentLabels[item as Equipment]}
                </label>
              ))}
            </div>
            <p className="fitness-hint">
              Bodyweight movements are always included. Leave these unchecked if you train without equipment.
            </p>
            <label>
              Strength training experience
              <select
                aria-label="Strength training experience"
                value={draft.experience}
                onChange={(event) => patch({ experience: event.target.value as Experience | "" })}
                disabled={busy}
              >
                <option value="">Prefer not to say</option>
                {Object.entries(experienceLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <p className="fitness-hint">
              Your week uses the starter plans, matched to your equipment. Rep targets are starting points you
              confirm, and you choose every load yourself; nothing is prescribed or treated as a record.
            </p>
          </>
        )}
      </fieldset>
      <div className="fitness-payoff">
        <strong>A small check-in. A clearer picture.</strong>
        <p>
          Log your weight in your profile. We’ll show changes across dates and
          when your next check-in is due. One measurement can fluctuate; your
          history gives it context.
        </p>
        <small>
          This is an in-app prompt. These details won’t automatically set your
          calorie or macro targets.
        </small>
      </div>
      {error && <p role="alert">{error}</p>}
      <button className="welcome-primary" disabled={busy}>
        Save my starting point
      </button>
      {onSkip && (
        <button
          type="button"
          className="welcome-link"
          onClick={onSkip}
          disabled={busy}
        >
          Set this up later
        </button>
      )}
    </form>
  );
}
