import { useState } from "react";
import { id, today } from "../../domain";
import {
  bodyWeightTrend,
  saveBodyWeight,
  type BodyWeightEntry,
} from "./body-weight";
import "./progress.css";
export function BodyWeightHistory({
  entries = [],
  onSave,
}: {
  entries?: BodyWeightEntry[];
  onSave: (entry: BodyWeightEntry) => void;
}) {
  const [unit, setUnit] = useState<"lb" | "kg">("lb"),
    [day, setDay] = useState(today()),
    [value, setValue] = useState(""),
    [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState("");
  const trend = bodyWeightTrend(entries, unit, today());
  return (
    <section className="body-weight-history" aria-label="Body weight history">
      <h2>Your weight, over time</h2>
      <p>
        Optional measurements from you. These do not change your food targets or
        suggest a goal.
      </p>
      <p>
        {trend.change === null
          ? "Add measurements on two dates to see the change."
          : `${trend.change > 0 ? "+" : ""}${trend.change} ${unit} between ${trend.points[0].day} and ${trend.points.at(-1)!.day}. Individual measurements can fluctuate.`}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const entry = {
              id: editing ?? id(),
              day,
              value: Number(value),
              unit,
            };
            saveBodyWeight(entries, entry, today());
            onSave(entry);
            setValue("");
            setEditing(null);
            setError("");
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Check the measurement.",
            );
          }
        }}
      >
        <label>
          Measurement date
          <input
            type="date"
            value={day}
            max={today()}
            required
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
        <label>
          Body weight
          <input
            type="number"
            min="0.1"
            max="2000"
            step="any"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <label>
          Weight unit
          <select
            value={unit}
            onChange={(event) => setUnit(event.target.value as "lb" | "kg")}
          >
            <option value="lb">lb</option>
            <option value="kg">kg</option>
          </select>
        </label>
        <button>{editing ? "Update measurement" : "Save measurement"}</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setValue("");
            }}
          >
            Cancel measurement edit
          </button>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      <ol>
        {entries
          .slice()
          .sort((a, b) => b.day.localeCompare(a.day))
          .slice(0, 30)
          .map((entry) => (
            <li key={entry.id}>
              <span>
                {entry.day} · {entry.value} {entry.unit}
              </span>
              <button
                type="button"
                aria-label={`Edit weight for ${entry.day}`}
                onClick={() => {
                  setEditing(entry.id);
                  setDay(entry.day);
                  setUnit(entry.unit);
                  setValue(String(entry.value));
                  setError("");
                }}
              >
                Edit
              </button>
            </li>
          ))}
      </ol>
      {!entries.length && <p>No measurements recorded yet.</p>}
    </section>
  );
}
