import type { AppState } from "../../domain";
import { useState } from "react";
import { firstWeekSteps } from "./first-week";
type Action = ReturnType<typeof firstWeekSteps>[number]["action"];
export default function FirstWeek({
  state,
  onAction,
  onTargets,
}: {
  state: AppState;
  onAction: (action: Action) => void;
  onTargets: () => void;
}) {
  const steps = firstWeekSteps(state),
    done = steps.filter((step) => step.done).length;
  const [expanded, setExpanded] = useState(false);
  const next = steps.find((step) => !step.done) ?? steps[steps.length - 1];
  return (
    <section
      className="kitchen-shopping-invitation"
      aria-label="Your first useful week"
    >
      <small>SPOT’S PLAN FOR YOUR GROCERIES</small>
      <h2>A receipt today. Less “what’s for dinner?” tomorrow.</h2>
      <p>Daily nutrition targets start as generic values. Set your own before using them to assess a meal plan.</p><button onClick={onTargets}>Review daily nutrition targets</button>
      <p>
        {done} of {steps.length} steps complete. Start with your real groceries
        and build a week that works for you.
      </p>
      <ol>
        {(expanded ? steps : [next]).map((step) => (
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
        ))}
      </ol>
      <button aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
        {expanded ? "Show my next step" : "See the whole journey"}
      </button>
    </section>
  );
}
