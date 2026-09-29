import { ChevronDown } from "lucide-react";
import { sumProposalComponents, type ProposalComponent } from "./proposals";
import "./proposal-breakdown.css";

export function ProposalBreakdown({
  components,
}: {
  components: ProposalComponent[];
}) {
  const total = sumProposalComponents(components);
  return (
    <details className="meal-proposal-breakdown">
      <summary>
        <span>
          What's in this estimate{" "}
          <small>
            {components.length}{" "}
            {components.length === 1 ? "component" : "components"}
          </small>
        </span>
        <ChevronDown size={17} />
      </summary>
      <p>
        Estimated amounts for the portions shown. These ingredients are not
        linked to pantry purchases.
      </p>
      <ul>
        {components.map((component, index) => (
          <li key={`${index}:${component.name}`}>
            <div>
              <strong>{component.name}</strong>
              <span>{component.portion}</span>
            </div>
            <div className="meal-proposal-component-nutrition">
              <strong>~{component.nutrition.calories} cal</strong>
              <span>
                {component.nutrition.protein}g protein ·{" "}
                {component.nutrition.carbs}g carbs · {component.nutrition.fat}g
                fat
              </span>
            </div>
          </li>
        ))}
      </ul>
      <div className="meal-proposal-component-total">
        <strong>Estimated total</strong>
        <span>
          ~{total.calories} cal · {total.protein}g protein · {total.carbs}g
          carbs · {total.fat}g fat
        </span>
      </div>
    </details>
  );
}
export default ProposalBreakdown;
