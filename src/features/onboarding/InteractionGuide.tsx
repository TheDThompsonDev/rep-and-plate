import { useState } from "react";
import { ArrowRight, Dumbbell, ReceiptText, Utensils } from "lucide-react";
import {
  interactionAccess,
  interactionExamples,
  interactionInstructions,
} from "./interaction-examples";
import "./interaction-guide.css";

export default function InteractionGuide({
  onTry,
  tryLabel = "Try with something from today",
}: {
  onTry: () => void;
  tryLabel?: string;
}) {
  const [selected, setSelected] = useState(0);
  const example = interactionExamples[selected];
  const icons = [Utensils, Dumbbell, ReceiptText];
  return (
    <div className="interaction-guide">
      <p className="interaction-instructions">{interactionInstructions}</p>
      <div className="interaction-options" aria-label="Choose an example">
        {interactionExamples.map((item, index) => {
          const Icon = icons[index];
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`${item.label} example`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
            >
              <Icon size={18} aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
      <section
        className="interaction-preview"
        aria-label="Example preview"
        aria-live="polite"
      >
        <span className="interaction-label">
          EXAMPLE ONLY · NOTHING IS SAVED
        </span>
        <p className="interaction-input">“{example.input}”</p>
        <div className="interaction-result">
          <span className="interaction-label">WHAT YOU GET</span>
          <strong>{example.payoff}</strong>
          {example.preview.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
        <p>{example.detail}</p>
        <small>{example.review}</small>
      </section>
      <button type="button" className="interaction-try" onClick={onTry}>
        {tryLabel}
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      <p className="interaction-access">{interactionAccess}</p>
    </div>
  );
}
