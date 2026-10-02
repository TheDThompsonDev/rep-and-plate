import { useEffect, useRef } from "react";
import {
  activityLabels,
  adjustmentLabels,
  sexLabels,
  type NutritionSetupDraft,
  type NutritionSetupProps,
} from "./nutrition-setup";
import { targetKeys, useNutritionSetup } from "./useNutritionSetup";
import "./fitness-setup.css";

export function NutritionSetup(props: NutritionSetupProps) {
  const form = useNutritionSetup(props),
    { draft, review, targets, error } = form;
  const busy = props.busy ?? false;
  const root = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (review)
      root.current
        ?.querySelector<HTMLInputElement>('input[name="calories"]')
        ?.focus();
  }, [review]);
  useEffect(() => {
    if (!error) return;
    const field = error.includes("age in")
      ? "age"
      : error.includes("height between")
        ? "height"
        : error.includes("activity level")
          ? "activity"
          : error.includes("standard adult")
            ? "adultEstimate"
            : error.includes("Choose the sex")
              ? "sex"
              : null;
    const invalidTarget = error.includes("positive daily")
      ? Array.from(
          root.current?.querySelectorAll<HTMLInputElement>("input[name]") ?? [],
        ).find(
          (input) =>
            !input.value.trim() ||
            !Number.isFinite(Number(input.value)) ||
            Number(input.value) < 1 ||
            Number(input.value) > Number(input.max),
        )
      : null;
    (
      invalidTarget ??
      (field
        ? root.current?.querySelector<HTMLElement>(`[name="${field}"]`)
        : null) ??
      root.current?.querySelector<HTMLElement>('[role="alert"]')
    )?.focus();
  }, [error]);
  return (
    <form
      ref={root}
      className="fitness-setup"
      onSubmit={(event) => {
        event.preventDefault();
        if (review) form.save();
        else form.estimate();
      }}
    >
      {review ? (
        <>
          <div className="fitness-payoff">
            <strong>
              {review === "estimate"
                ? "Your estimated starting targets"
                : "Your own daily targets"}
            </strong>
            <p>
              {review === "estimate"
                ? `Based on your age, height, ${props.weight?.value} ${props.weight?.unit}, activity and chosen calorie approach. Edit any value before using it.`
                : "Enter targets you already follow. They become your daily comparison only when you save."}
            </p>
            {review === "estimate" && (
              <small>
                Calories use Mifflin–St Jeor with a broad activity estimate.
                Macros start at 20% protein, 50% carbs and 30% fat. This is a
                starting estimate, not a prediction of when you’ll reach your
                goal.
              </small>
            )}
          </div>
          <div className="fitness-weight-fields">
            {targetKeys.map((key) => (
              <label key={key}>
                Daily {key}
                {key === "calories" ? "" : " (g)"}
                <input
                  name={key}
                  aria-describedby={error ? "nutrition-setup-error" : undefined}
                  autoComplete="off"
                  inputMode="decimal"
                  type="number"
                  min="1"
                  max={
                    key === "calories" ? 10000 : key === "carbs" ? 2000 : 1000
                  }
                  step="any"
                  required
                  value={targets[key]}
                  disabled={busy}
                  onChange={(event) =>
                    form.changeTarget(key, event.target.value)
                  }
                />
              </label>
            ))}
          </div>
          <button className="welcome-primary" disabled={busy}>
            Use these daily targets
          </button>
          <button
            type="button"
            className="welcome-link"
            onClick={form.back}
            disabled={busy}
          >
            Edit my details
          </button>
        </>
      ) : (
        <>
          <p className="fitness-hint">
            These details help turn your food log into a useful daily starting
            point. Your weight comes from the previous step or your latest
            measurement.
          </p>
          <label>
            Age (years)
            <input
              name="age"
              autoComplete="off"
              inputMode="numeric"
              aria-describedby={error ? "nutrition-setup-error" : undefined}
              type="number"
              min="1"
              max="120"
              step="1"
              value={draft.age}
              disabled={busy}
              onChange={(event) => form.patch({ age: event.target.value })}
            />
          </label>
          <div className="fitness-weight-fields">
            <label>
              Height
              <input
                name="height"
                autoComplete="off"
                inputMode="decimal"
                aria-describedby={error ? "nutrition-setup-error" : undefined}
                type="number"
                step="any"
                value={draft.height}
                disabled={busy}
                onChange={(event) => form.patch({ height: event.target.value })}
              />
            </label>
            <label>
              Height unit
              <select
                name="heightUnit"
                aria-describedby={error ? "nutrition-setup-error" : undefined}
                aria-label="Height unit"
                value={draft.heightUnit}
                disabled={busy}
                onChange={(event) =>
                  form.unit(
                    event.target.value as NutritionSetupDraft["heightUnit"],
                  )
                }
              >
                <option value="cm">cm</option>
                <option value="in">inches</option>
              </select>
            </label>
          </div>
          <label>
            Usual activity
            <select
              name="activity"
              aria-describedby={error ? "nutrition-setup-error" : undefined}
              aria-label="Usual activity"
              value={draft.activity}
              disabled={busy}
              onChange={(event) =>
                form.patch({
                  activity: event.target
                    .value as NutritionSetupDraft["activity"],
                })
              }
            >
              <option value="">Choose your usual day</option>
              {Object.entries(activityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sex used for the estimate
            <select
              name="sex"
              aria-describedby={error ? "nutrition-setup-error" : undefined}
              aria-label="Sex used for the estimate"
              value={draft.sex}
              disabled={busy}
              onChange={(event) =>
                form.patch({
                  sex: event.target.value as NutritionSetupDraft["sex"],
                })
              }
            >
              {Object.entries(sexLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <p className="fitness-hint">
            The equation uses a male or female coefficient. You can leave this
            unselected and use your own targets or save details only.
          </p>
          <label>
            Calorie approach
            <select
              name="adjustment"
              aria-describedby={error ? "nutrition-setup-error" : undefined}
              aria-label="Calorie approach"
              value={draft.adjustment}
              disabled={busy}
              onChange={(event) =>
                form.patch({
                  adjustment: event.target
                    .value as NutritionSetupDraft["adjustment"],
                })
              }
            >
              {Object.entries(adjustmentLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="fitness-checkbox">
            <input
              name="adultEstimate"
              aria-describedby={error ? "nutrition-setup-error" : undefined}
              type="checkbox"
              checked={draft.eligible}
              disabled={busy}
              onChange={(event) =>
                form.patch({ eligible: event.target.checked })
              }
            />
            <span>The standard adult estimate applies to me</span>
          </label>
          <p className="fitness-hint">
            For adults 18 or older who aren’t pregnant or breastfeeding.
            Otherwise, save your details without an estimate or enter targets
            you already follow.
          </p>
          <button className="welcome-primary" disabled={busy}>
            Estimate my targets
          </button>
        </>
      )}
      {error && (
        <p id="nutrition-setup-error" role="alert" tabIndex={-1}>
          {error}
        </p>
      )}
      {props.onSkip ? (
        <details className="fitness-alternatives">
          <summary>Other ways to set targets</summary>
          {!review && (
            <button
              type="button"
              className="welcome-link"
              onClick={form.manual}
              disabled={busy}
            >
              Use my own targets
            </button>
          )}
          <button
            type="button"
            className="welcome-link"
            onClick={form.detailsOnly}
            disabled={busy}
          >
            Save details without targets
          </button>
        </details>
      ) : (
        <>
          {!review && (
            <button
              type="button"
              className="welcome-link"
              onClick={form.manual}
              disabled={busy}
            >
              Use my own targets
            </button>
          )}
          <button
            type="button"
            className="welcome-link"
            onClick={form.detailsOnly}
            disabled={busy}
          >
            Save details without targets
          </button>
        </>
      )}
      {props.onSkip && (
        <button
          type="button"
          className="welcome-link"
          onClick={props.onSkip}
          disabled={busy}
        >
          Skip targets for now
        </button>
      )}
    </form>
  );
}
