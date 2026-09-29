import { useEffect, useRef, useState } from "react";
import { Check, Link2, RotateCcw, ShoppingBasket } from "lucide-react";
import type { AppState } from "../../domain";
import { Modal } from "../../components";
import { Sources } from "../../AICards";
import {
  detachMealFromPantry,
  getPantryLots,
  reconcileMeal,
  type PantryLot,
  type PantrySelection,
} from "./ledger";
import {
  pantryLinkBlockReason,
  suggestPantryLinks,
  type PantryLinkSuggestion,
} from "./suggestions";
import "./link-review.css";

type Attempt = {
  id: string;
  kind: "link" | "detach";
  selection: PantrySelection[];
  oldEvents: string[];
};

export default function PantryLinkReview({
  state,
  mealId,
  onChange,
  onClose,
}: {
  state: AppState;
  mealId: string;
  onChange: (updater: (state: AppState) => AppState) => void;
  onClose: () => void;
}) {
  const meal = state.meals.find((entry) => entry.id === mealId);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showOthers, setShowOthers] = useState(false);
  const [undoReview, setUndoReview] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const operation = useRef(crypto.randomUUID());
  const lots = getPantryLots(state);
  const suggestions = meal ? suggestPantryLinks(state, meal) : [];
  const otherLots = lots.filter(
    (lot) =>
      !suggestions.some((suggestion) => suggestion.lot.id === lot.id) &&
      lot.item.availability === "available",
  );
  const events = state.pantryEvents || [];
  const active = events.filter(
    (event) =>
      event.mealId === mealId &&
      event.kind === "consumed" &&
      !events.some((other) => other.reversesId === event.id),
  );

  useEffect(() => {
    setSelected({});
    setError("");
    setNotice("");
    setUndoReview(false);
    setAttempt(null);
    operation.current = crypto.randomUUID();
  }, [mealId]);

  useEffect(() => {
    if (!attempt) return;
    const finished =
      attempt.kind === "link"
        ? events.some(
            (event) =>
              event.id.startsWith(`${attempt.id}:`) && event.mealId === mealId,
          )
        : attempt.oldEvents.every((eventId) =>
            events.some((event) => event.reversesId === eventId),
          );
    if (finished) {
      setAttempt(null);
      setSelected({});
      setUndoReview(false);
      operation.current = crypto.randomUUID();
      setNotice(
        attempt.kind === "link"
          ? "Ingredients linked and pantry quantities updated. Your meal calories have not been added again."
          : "Pantry portions restored. Your logged meal is still here.",
      );
      return;
    }
    // Latest-state validation surfaces a stale lot or edited/deleted meal without throwing during a parent render.
    try {
      if (attempt.kind === "link")
        reconcileMeal(state, mealId, attempt.selection, attempt.id);
      else if (!meal) throw new Error("This meal is no longer available.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The pantry changed. Check the available portions again.",
      );
      setAttempt(null);
      return;
    }
    const timeout = setTimeout(() => {
      setError(
        "The change has not been confirmed. Check the latest pantry quantities and try again.",
      );
      setAttempt(null);
    }, 3000);
    return () => clearTimeout(timeout);
  }, [state, attempt, mealId]);

  const submit = () => {
    if (attempt || !meal) return;
    const selection = Object.entries(selected).map(([lotId, amount]) => ({
      lotId,
      servings: Number(amount),
    }));
    try {
      reconcileMeal(state, mealId, selection, operation.current);
      setError("");
      setNotice("");
      setAttempt({
        id: operation.current,
        kind: "link",
        selection,
        oldEvents: [],
      });
      const operationId = operation.current;
      onChange((latest) => {
        try {
          return reconcileMeal(latest, mealId, selection, operationId);
        } catch {
          return latest;
        }
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Check the ingredient portions.",
      );
    }
  };
  const detach = () => {
    if (attempt || !meal || !active.length) return;
    setAttempt({
      id: operation.current,
      kind: "detach",
      selection: [],
      oldEvents: active.map((event) => event.id),
    });
    setError("");
    setNotice("");
    onChange((latest) => detachMealFromPantry(latest, mealId));
  };
  const renderLot = (lot: PantryLot, suggestion?: PantryLinkSuggestion) => {
    const blocked = pantryLinkBlockReason(lot);
    const picked = selected[lot.id] !== undefined;
    return (
      <section className="pantry-link-lot" key={lot.id}>
        <div className="pantry-link-lot-top">
          <label>
            <input
              type="checkbox"
              disabled={!!blocked || !!attempt || active.length > 0}
              checked={picked}
              onChange={(event) =>
                setSelected((current) => {
                  const next = { ...current };
                  if (event.target.checked) next[lot.id] = "";
                  else delete next[lot.id];
                  return next;
                })
              }
            />
            <span>
              <strong>{lot.item.name}</strong>
              <small>
                {lot.store} · {lot.date}
              </small>
            </span>
          </label>
          <span>
            {lot.remaining === null
              ? "Amount unknown"
              : `${lot.remaining} servings left`}
          </span>
        </div>
        <p>One serving: {lot.item.serving || "Not known yet"}</p>
        {suggestion && (
          <div
            className={`pantry-link-reason ${suggestion.ambiguous ? "ambiguous" : ""}`}
          >
            <strong>
              {suggestion.ambiguous
                ? "Possible match · choose carefully"
                : "Possible match"}
            </strong>
            {suggestion.reasons.map((reason) => (
              <p key={reason}>{reason}</p>
            ))}
          </div>
        )}
        {blocked && <p className="pantry-link-blocked">{blocked}</p>}
        {picked && (
          <label className="pantry-link-amount">
            How many servings did you use?
            <input
              type="number"
              min="0.0001"
              max={lot.remaining ?? undefined}
              step="any"
              required
              inputMode="decimal"
              value={selected[lot.id]}
              placeholder="Enter an amount"
              onChange={(event) =>
                setSelected((current) => ({
                  ...current,
                  [lot.id]: event.target.value,
                }))
              }
              disabled={!!attempt}
            />
            <small>For example, half of the serving shown above is 0.5.</small>
          </label>
        )}
        <Sources sources={lot.item.sources} />
      </section>
    );
  };

  return (
    <Modal title="Did you use your groceries?" onClose={onClose} wide>
      <div className="pantry-link-review">
        {!meal ? (
          <p>
            This meal is no longer in your log. Your pantry has not changed.
          </p>
        ) : (
          <>
            <div className="pantry-link-intro">
              <span>
                <ShoppingBasket size={24} />
              </span>
              <div>
                <h3>{meal.title}</h3>
                <p>
                  {meal.day} · {meal.category} · {meal.calories} logged calories
                </p>
              </div>
            </div>
            <p>
              These are possible purchases you may have used. Pick the actual
              ingredients and enter each amount. Nothing is deducted until you
              confirm.
            </p>
            {error && (
              <p role="alert" className="pantry-link-error">
                {error}
              </p>
            )}
            {notice && (
              <p role="status" className="pantry-link-success">
                {notice}
              </p>
            )}
            {active.length > 0 ? (
              <section className="pantry-link-existing">
                <h3>
                  <Link2 size={18} /> Ingredients already linked
                </h3>
                {active.map((event) => {
                  const component = meal.components?.find(
                    (entry) => entry.lotId === event.lotId,
                  );
                  const lot = lots.find((entry) => entry.id === event.lotId);
                  return (
                    <div key={event.id}>
                      <strong>
                        {component?.name ||
                          lot?.item.name ||
                          "Saved grocery ingredient"}
                      </strong>
                      <p>
                        {-event.servings} servings used ·{" "}
                        {component?.servingLabel ||
                          lot?.item.serving ||
                          "saved portion"}
                      </p>
                    </div>
                  );
                })}
                <p>
                  Your original meal estimate is unchanged. To change the
                  ingredient links, first undo the linked portions.
                </p>
                {undoReview ? (
                  <div className="pantry-link-undo">
                    <p>
                      Restore these portions to your pantry? The meal stays in
                      your food log.
                    </p>
                    <button
                      className="button primary full-width"
                      disabled={!!attempt}
                      onClick={detach}
                    >
                      <RotateCcw size={16} /> Restore pantry portions
                    </button>
                    <button
                      className="pantry-link-text"
                      disabled={!!attempt}
                      onClick={() => setUndoReview(false)}
                    >
                      Keep the links
                    </button>
                  </div>
                ) : (
                  <button
                    className="pantry-link-text"
                    onClick={() => setUndoReview(true)}
                  >
                    <RotateCcw size={16} /> Undo ingredient links
                  </button>
                )}
              </section>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                {!!suggestions.length && (
                  <>
                    <h3>Possible ingredients</h3>
                    {suggestions.map((suggestion) =>
                      renderLot(suggestion.lot, suggestion),
                    )}
                  </>
                )}
                {!suggestions.length && (
                  <p className="pantry-link-empty">
                    No clear name matches. You can choose a purchase below if
                    you know you used it.
                  </p>
                )}
                {!!otherLots.length && (
                  <>
                    <button
                      type="button"
                      className="pantry-link-text"
                      aria-expanded={showOthers}
                      onClick={() => setShowOthers(!showOthers)}
                    >
                      {showOthers
                        ? "Hide other purchases"
                        : "Choose another pantry item"}
                    </button>
                    {showOthers && otherLots.map((lot) => renderLot(lot))}
                  </>
                )}
                {!lots.length && (
                  <p>
                    There are no grocery purchases to link yet. Share a receipt
                    or scan a product in Chat first.
                  </p>
                )}
                {Object.keys(selected).length > 0 && (
                  <div className="pantry-link-confirm">
                    <strong>
                      {Object.keys(selected).length}{" "}
                      {Object.keys(selected).length === 1
                        ? "ingredient selected"
                        : "ingredients selected"}
                    </strong>
                    <p>
                      Confirm the food you actually used for this logged
                      portion. Linking updates the pantry; it does not add
                      calories again.
                    </p>
                    <button
                      className="button primary full-width"
                      disabled={!!attempt}
                    >
                      <Check size={17} />
                      {attempt
                        ? "Updating pantry…"
                        : "Confirm ingredients used"}
                    </button>
                  </div>
                )}
              </form>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
