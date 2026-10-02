import { firstLogCopy } from "./first-log";
import "./first-log.css";

export function FirstLog({
  focus,
  onMeal,
  onMovement,
  onLater,
}: {
  focus: string;
  onMeal: () => void;
  onMovement: () => void;
  onLater: () => void;
}) {
  const movement = focus === "Movement & workouts";
  return (
    <section className="first-log" aria-label="Your first tracking step">
      <div>
        <p className="eyebrow">YOUR FIRST REAL ENTRY</p>
        <h2>{firstLogCopy.title}</h2>
        <p>{firstLogCopy.detail}</p>
        <small>
          Grocery receipts stock your kitchen. Only food you log counts toward
          your calories.
        </small>
      </div>
      <div className="first-log-actions">
        <button
          className="welcome-primary"
          onClick={movement ? onMovement : onMeal}
        >
          {movement ? "Log my first movement" : "Log my first meal"}
        </button>
        <button
          className="welcome-link"
          onClick={movement ? onMeal : onMovement}
        >
          {movement ? "Log a meal instead" : "Log movement instead"}
        </button>
        <button className="welcome-link" onClick={onLater}>
          I’ll log later
        </button>
      </div>
    </section>
  );
}
