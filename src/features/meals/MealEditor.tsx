import { useState, type FormEvent } from "react";
import { Check, ChevronRight, Info, ShieldCheck } from "lucide-react";
import { Modal } from "../../components";
import { mealSchema, scaleMealPortion, today, type Meal } from "../../domain";

/** The meal form App.tsx opens for manual entries, saved meals, repeats and
 * unlogged chat estimates. Moved verbatim from App.tsx (audit Q2); the hook in
 * `useMealEditor.ts` decides which of the optional actions apply. */
export default function MealEditor({
  onRepeat,
  onToggleUsual,
  isUsual = false,
  isProposal = false,
  newManual = false,
  repeatDraft = false,
  onPantryLinks,
  meal,
  onClose,
  onSave,
  onDelete,
}: {
  meal: Meal;
  onRepeat?: () => void;
  onToggleUsual?: () => void;
  isUsual?: boolean;
  isProposal?: boolean;
  newManual?: boolean;
  repeatDraft?: boolean;
  onPantryLinks?: () => void;
  onClose: () => void;
  onSave: (meal: Meal) => void;
  onDelete?: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState(() => ({
    calories: newManual ? "" : String(meal.calories),
    protein: newManual ? "" : String(meal.protein),
    carbs: newManual ? "" : String(meal.carbs),
    fat: newManual ? "" : String(meal.fat),
  }));
  const [portion, setPortion] = useState("1");
  const [appliedPortion, setAppliedPortion] = useState(1);
  const [reviewedMeal, setReviewedMeal] = useState(meal);
  const [note, setNote] = useState(meal.note);
  function applyPortion() {
    try {
      const multiplier = Number(portion);
      const scaled = scaleMealPortion(meal, multiplier);
      setReviewedMeal(scaled);
      setValues({
        calories: String(scaled.calories),
        protein: String(scaled.protein),
        carbs: String(scaled.carbs),
        fat: String(scaled.fat),
      });
      setAppliedPortion(multiplier);
      setNote(
        `${multiplier} × the original saved portion. Pantry and prepared portions were not changed.`,
      );
      setError("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Check the portion.");
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (Object.values(values).some((value) => !value.trim())) {
      setError(
        "Enter all four nutrition values. Use 0 only for a known zero; unknown values cannot be saved as zero.",
      );
      return;
    }
    const parsed = mealSchema.safeParse({
      ...reviewedMeal,
      title: String(form.get("title")).trim(),
      category: form.get("category"),
      day: String(form.get("day")),
      calories: Number(form.get("calories")),
      protein: Number(form.get("protein")),
      carbs: Number(form.get("carbs")),
      fat: Number(form.get("fat")),
      note: String(form.get("note")),
      confidence: repeatDraft ? meal.confidence : "confirmed",
    });
    const date = String(form.get("day"));
    if (
      !parsed.success ||
      !parsed.data.title ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      date > today() ||
      new Date(`${date}T12:00:00`).getDate() !== Number(date.slice(-2))
    ) {
      setError("Check the name and nutrition values, then try again.");
      return;
    }
    onSave(parsed.data);
  }
  return (
    <Modal
      title={
        meal.title ? "The details are yours to adjust." : "Add a meal estimate."
      }
      onClose={onClose}
    >
      <form className="edit-form" onSubmit={submit}>
        <div className="estimate-notice">
          <Info size={16} />
          <span>
            {meal.confidence === "estimated"
              ? "This is an estimate. A quick correction is always welcome."
              : "Your own values, saved exactly as entered."}
          </span>
        </div>
        {newManual && (
          <p>
            Enter calories, protein, carbs and fat from a label or your own
            estimate. Use 0 only when you know the value is zero. If you don’t
            know a value, ask Spot for a reviewed estimate instead.
          </p>
        )}
        {repeatDraft && (
          <div className="estimate-notice">
            <div>
              <label>
                Portion multiplier
                <input
                  type="number"
                  min="0.0001"
                  max="100"
                  step="any"
                  value={portion}
                  onChange={(event) => setPortion(event.target.value)}
                />
              </label>
              <button
                className="button secondary"
                type="button"
                onClick={applyPortion}
              >
                Apply portion
              </button>
              <p>
                1 repeats the original portion; 0.5 is half and 2 is double.
                Apply, review the values below, then save. Pantry and prepared
                portions are not changed.
              </p>
              {Number(portion) !== appliedPortion && (
                <p role="status">Apply the portion before saving.</p>
              )}
            </div>
          </div>
        )}
        {isProposal && (
          <p>
            Editing this estimate does not log it. Your original stays unchanged
            if you close this form.
          </p>
        )}
        {onToggleUsual && <button type="button" className="button secondary" aria-pressed={isUsual} onClick={onToggleUsual}>{isUsual ? "Remove from my usuals" : "Make this my usual"}</button>}
        {onRepeat && (
          <button className="button secondary" type="button" onClick={onRepeat}>
            Repeat meal
          </button>
        )}
        <label>
          Meal name
          <input
            name="title"
            required
            maxLength={120}
            defaultValue={meal.title}
            placeholder="What did you have?"
          />
        </label>
        <label>
          Meal date
          <input
            name="day"
            type="date"
            required
            max={today()}
            defaultValue={meal.day}
          />
        </label>
        <label>
          Meal
          <select name="category" defaultValue={meal.category}>
            {["Breakfast", "Lunch", "Dinner", "Snack"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          {(["calories", "protein", "carbs", "fat"] as const).map((key) => (
            <label key={key}>
              {key === "calories"
                ? "Calories"
                : `${key.charAt(0).toUpperCase() + key.slice(1)} (g)`}
              <input
                name={key}
                type="number"
                required
                min="0"
                max="20000"
                step="any"
                value={values[key]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
              />
            </label>
          ))}
        </div>
        <label>
          Notes
          <textarea
            name="note"
            maxLength={1500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
          />
        </label>
        <div className="source-note">
          <ShieldCheck size={13} />
          <span>Source: {meal.source}</span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full-width" type="submit" disabled={repeatDraft && Number(portion) !== appliedPortion}>
          Save changes
          <Check size={18} />
        </button>
        {onPantryLinks && (
          <button
            className="button secondary full-width"
            type="button"
            onClick={onPantryLinks}
          >
            Review pantry ingredients
            <ChevronRight size={17} />
          </button>
        )}
        {onDelete && (
          <div className="delete-area">
            {deleting ? (
              <>
                <span>Remove this meal from your totals?</span>
                <button
                  className="text-button"
                  type="button"
                  onClick={onDelete}
                >
                  Yes, remove
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setDeleting(false)}
                >
                  Keep it
                </button>
              </>
            ) : (
              <button
                className="text-button"
                type="button"
                onClick={() => setDeleting(true)}
              >
                Remove this meal
              </button>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
