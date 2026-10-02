import type { AppState } from "../../domain";
import { useState } from "react";
import { firstWeekSteps } from "./first-week";
import { receiptReadiness } from "../receipts/journey";
type Action = ReturnType<typeof firstWeekSteps>[number]["action"];
export default function FirstWeek({
  state,
  onAction,
  onTargets,
  onDinner,
}: {
  state: AppState;
  onAction: (action: Action) => void;
  onTargets: () => void;
  onDinner?: () => void;
}) {
  const steps = firstWeekSteps(state),
    done = steps.filter((step) => step.done).length;
  const [expanded, setExpanded] = useState(false);
  const readiness = receiptReadiness(state);
  const coreSteps = steps.filter((step) => step.key !== "preferences");
  const complete = coreSteps.every((step) => step.done);
  const hasReceipt = !!steps.find((s) => s.key === "receipt")?.done;
  const emptyPantry = hasReceipt && readiness.available === 0;
  const next = !hasReceipt
    ? steps.find((s) => s.key === "receipt")!
    : readiness.ready === 0 && !emptyPantry
      ? steps.find((s) => s.key === "pantry")!
      : (coreSteps.find((step) => !step.done && step.key !== "pantry") ??
        steps[steps.length - 1]);
  return (
    <section
      className="kitchen-shopping-invitation"
      aria-label="Your first useful week"
    >
      <small>SPOT’S PLAN FOR YOUR GROCERIES</small>
      <h2>A receipt today. Less “what’s for dinner?” tomorrow.</h2>
      <p>Receipt → check groceries → dinner ideas and missing ingredients.</p>
      {readiness.ready > 0 && onDinner && (
        <>
          <p>
            {readiness.ready} checked {readiness.ready === 1 ? "food" : "foods"}{" "}
            on hand. You can start with these while checking the rest.
          </p>
          <button onClick={onDinner}>Help me choose dinner tonight</button>
        </>
      )}
      {complete && (
        <>
          <p>
            Your first grocery loop is complete. Plan from what’s left, or add
            your next grocery trip to refresh your pantry.
          </p>
          <button onClick={() => onAction("receipt")}>
            Add my next grocery receipt
          </button>
          <button onClick={() => onAction("planner")}>
            Plan with what’s left
          </button>
        </>
      )}
      {emptyPantry && !complete && (
        <>
          <p>
            Your recorded groceries are used up. Add your next trip to start a
            fresh dinner plan.
          </p>
          <button onClick={() => onAction("receipt")}>
            Add my next grocery receipt
          </button>
        </>
      )}
      <p>
        {done} of {steps.length} steps complete. Start with your real groceries
        and build a week that works for you.
      </p>
      <ol>
        {(expanded ? steps : complete || emptyPantry ? [] : [next]).map(
          (step) => (
            <li key={step.key}>
              <strong>
                {step.done ? "✓ " : ""}
                {step.title}
              </strong>
              <p>{step.detail}</p>
              <button onClick={() => onAction(step.action)}>
                {step.done ? "Review" : "Start"}: {step.title}
              </button>
            </li>
          ),
        )}
      </ol>
      <details>
        <summary>Tailor my week and nutrition targets</summary>
        <p>
          Preferences are optional. Daily nutrition targets start as generic
          values; choose your own before using them to assess a plan.
        </p>
        <button onClick={() => onAction("preferences")}>
          Start: Make it your kind of week
        </button>
        <button onClick={onTargets}>Review daily nutrition targets</button>
      </details>
      <button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? "Show my next step" : "See the whole journey"}
      </button>
    </section>
  );
}
