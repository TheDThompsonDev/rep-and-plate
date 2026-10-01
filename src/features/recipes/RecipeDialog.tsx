import { useEffect, useState } from "react";
import { ChefHat, Plus, RotateCcw, Utensils } from "lucide-react";
import { Modal } from "../../components";
import type { AppState, Meal } from "../../domain";
import { getPantryLots, deleteMealWithPantry } from "../pantry/ledger";
import { pantryLinkBlockReason } from "../pantry/suggestions";
import { scaleNutrition } from "../meals/arithmetic";
import {
  logRecipePortion,
  prepareRecipeBatch,
  undoRecipePreparation,
} from "./batches";
import { remainingRecipePortions } from "./portions";
import type { RecipeBatch } from "./contracts";
import "./recipes.css";

type Change = (state: AppState) => AppState;
type Attempt = {
  apply: Change;
  done: (state: AppState) => boolean;
  success: string;
};
type Run = (apply: Change, done: Attempt["done"], success: string) => void;
export type RecipeDraft = {preparing:boolean;name:string;yieldAmount:string;selected:Record<string,string>};

export default function RecipeDialog({
  state,
  onChange,
  onClose,
  draft,
  onDraftChange,
  onOpenPantry,
}: {
  state: AppState;
  onChange: (updater: Change) => void;
  onClose: () => void;
  draft?: RecipeDraft;
  onDraftChange?: (draft:RecipeDraft) => void;
  onOpenPantry?: () => void;
}) {
  const [preparing, setPreparing] = useState(draft?.preparing??false);
  const [name, setName] = useState(draft?.name??"");
  const [yieldAmount, setYieldAmount] = useState(draft?.yieldAmount??"");
  const [selected, setSelected] = useState<Record<string, string>>(draft?.selected??{});
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lots = getPantryLots(state);
  const batches = (state.recipeBatches || []).filter(
    (batch) => !batch.undoneAt,
  );
  useEffect(()=>{
    const next={preparing,name,yieldAmount,selected};
    if(onDraftChange&&JSON.stringify(next)!==JSON.stringify(draft))onDraftChange(next);
  },[preparing,name,yieldAmount,selected,draft,onDraftChange]);

  useEffect(() => {
    if (!attempt) return;
    if (attempt.done(state)) {
      setNotice(attempt.success);
      setAttempt(null);
      setPreparing(false);
      setSelected({});
      setName("");
      setYieldAmount("");
      return;
    }
    try {
      attempt.apply(state);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Your records changed. Review the amounts and try again.",
      );
      setAttempt(null);
      return;
    }
    const timer = setTimeout(() => {
      setError(
        "The change has not been confirmed. Review your latest records before trying again.",
      );
      setAttempt(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [state, attempt]);

  const run: Run = (apply, done, success) => {
    if (attempt) return;
    try {
      apply(state);
      setError("");
      setNotice("");
      setAttempt({ apply, done, success });
      onChange((latest) => {
        try {
          return apply(latest);
        } catch {
          return latest;
        }
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Check the quantities and try again.",
      );
    }
  };
  const prepare = () => {
    const input = {
      id: crypto.randomUUID(),
      name,
      totalPortions: Number(yieldAmount),
      ingredients: Object.entries(selected).map(([lotId, amount]) => ({
        lotId,
        servings: Number(amount),
      })),
    };
    run(
      (latest) => prepareRecipeBatch(latest, input),
      (latest) =>
        !!latest.recipeBatches?.some((batch) => batch.id === input.id),
      "Batch prepared. Ingredients moved out of your pantry; no calories logged yet.",
    );
  };

  return (
    <Modal title="Recipes & leftovers" onClose={onClose} wide>
      <div className="recipe-dialog">
        <div className="recipe-intro">
          <span>
            <ChefHat size={25} />
          </span>
          <div>
            <h3>Cook once. Log each portion.</h3>
            <p>
              Save what you actually prepared, then track a serving whenever you
              eat it.
            </p>
          </div>
        </div>
        {error && (
          <p className="recipe-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="recipe-notice" role="status">
            {notice}
          </p>
        )}
        <div className="recipe-heading">
          <h3>Your prepared batches</h3>
          <button
            className="recipe-text"
            disabled={!!attempt}
            onClick={() => setPreparing(!preparing)}
          >
            <Plus size={17} />
            {preparing ? "Cancel new batch" : "Prepare a batch"}
          </button>
        </div>
        {preparing && (
          <form
            className="recipe-prepare"
            onSubmit={(event) => {
              event.preventDefault();
              prepare();
            }}
          >
            <h3>What did you make?</h3>
            <label>
              Batch name
              <input
                value={name}
                maxLength={200}
                required
                placeholder="For example, overnight oats"
                onChange={(event) => setName(event.target.value)}
                disabled={!!attempt}
              />
            </label>
            <label>
              How many portions did the whole batch make?
              <input
                type="number"
                inputMode="decimal"
                min="0.0001"
                max="1000"
                step="any"
                value={yieldAmount}
                required
                placeholder="Enter your actual yield"
                onChange={(event) => setYieldAmount(event.target.value)}
                disabled={!!attempt}
              />
            </label>
            <p>
              Choose the ingredients you used. Enter amounts in each product’s
              serving size; the finished batch can have a different portion
              size.
            </p>
            {(!lots.length || lots.some(lot=>pantryLinkBlockReason(lot))) && (
              <section className="recipe-review" aria-label="Set up recipe ingredients">
                <h4>First, confirm the ingredients you have</h4>
                <ol><li>Add a product or receipt to your pantry.</li><li>Check its nutrition and total labeled servings. Two packages with five servings each means ten servings.</li><li>Return here and choose only the servings you actually cooked.</li></ol>
                <p>{onDraftChange?'Your batch name, yield and selections stay here while you review ingredients.':'Keep this form open while checking your ingredient labels.'} Preparing transfers pantry stock once; logging portions does not deduct it again.</p>
                {onOpenPantry&&<button type="button" className="button secondary" onClick={onOpenPantry}>Set up ingredients in pantry</button>}
              </section>
            )}
            {lots.map((lot) => {
              const blocked = pantryLinkBlockReason(lot);
              const picked = selected[lot.id] !== undefined;
              return (
                <section className="recipe-ingredient" key={lot.id}>
                  <label className="recipe-check">
                    <input
                      type="checkbox"
                      disabled={!!blocked || !!attempt}
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
                  <p>
                    {lot.remaining === null
                      ? "Quantity unknown"
                      : `${lot.remaining} servings left`}{" "}
                    · One serving: {lot.item.serving || "not known"}
                  </p>
                  {blocked && (
                    <small className="recipe-blocked">{blocked}</small>
                  )}
                  {picked && (
                    <label>
                      Servings of {lot.item.name} used
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.0001"
                        max={lot.remaining ?? undefined}
                        step="any"
                        required
                        value={selected[lot.id]}
                        placeholder="Enter amount used"
                        disabled={!!attempt}
                        onChange={(event) =>
                          setSelected((current) => ({
                            ...current,
                            [lot.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                  )}
                </section>
              );
            })}
            <div className="recipe-review">
              <strong>Confirm the batch you already prepared</strong>
              <p>
                This transfers the selected ingredients out of your pantry once.
                It does not log anything as eaten.
              </p>
              <button
                className="button primary full-width"
                disabled={!!attempt || !Object.keys(selected).length}
              >
                Confirm prepared batch
              </button>
            </div>
          </form>
        )}
        {!batches.length && !preparing && (
          <div className="recipe-empty">
            <Utensils size={28} />
            <h3>Your next meal can start here.</h3>
            <p>
              Save a batch you’ve cooked to keep track of the portions left.
              Nothing is deducted until you confirm.
            </p>
          </div>
        )}
        {batches
          .slice()
          .reverse()
          .map((batch) => (
            <BatchCard
              key={batch.id}
              batch={batch}
              state={state}
              pending={!!attempt}
              run={run}
            />
          ))}
      </div>
    </Modal>
  );
}

function BatchCard({
  batch,
  state,
  pending,
  run,
}: {
  batch: RecipeBatch;
  state: AppState;
  pending: boolean;
  run: Run;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<Meal["category"]>("Lunch");
  const [reviewUndo, setReviewUndo] = useState(false);
  const [undoMeal, setUndoMeal] = useState<string | null>(null);
  const remaining = remainingRecipePortions(batch);
  const perPortion = scaleNutrition(batch.nutrition, 1 / batch.totalPortions);
  const active = batch.consumptions.filter((entry) => !entry.reversedAt);
  useEffect(() => {
    setAmount("");
    setUndoMeal(null);
  }, [batch.consumptions]);
  const log = () => {
    const operationId = crypto.randomUUID();
    run(
      (latest) =>
        logRecipePortion(
          latest,
          batch.id,
          Number(amount),
          category,
          operationId,
        ),
      (latest) =>
        !!latest.recipeBatches?.some((entry) =>
          entry.consumptions.some(
            (consumption) => consumption.id === operationId,
          ),
        ),
      "Portion logged. Your prepared batch updated; pantry ingredients were not deducted again.",
    );
  };
  return (
    <section className="recipe-batch" aria-label={batch.name}>
      <div className="recipe-heading">
        <div>
          <h3>{batch.name}</h3>
          <p>Prepared {new Date(batch.createdAt).toLocaleDateString()}</p>
        </div>
        <span className="recipe-badge">
          {remaining} / {batch.totalPortions} portions left
        </span>
      </div>
      <p className="recipe-macros">
        ~{perPortion.calories} cal · {perPortion.protein}g protein{" "}
        <small>per portion</small>
      </p>
      <details>
        <summary>Saved ingredients & nutrition</summary>
        <p>
          Amounts and nutrition are saved at preparation. Later product edits do
          not rewrite this batch.
        </p>
        {batch.ingredients.map((ingredient) => (
          <div className="recipe-snapshot" key={ingredient.id}>
            <strong>{ingredient.name}</strong>
            <p>
              {ingredient.servings} servings · {ingredient.servingLabel}
            </p>
            <p>
              {ingredient.nutrition.calories} cal ·{" "}
              {ingredient.nutrition.protein}g protein ·{" "}
              {ingredient.nutrition.carbs}g carbs · {ingredient.nutrition.fat}g
              fat
            </p>
            {ingredient.sourceUrls
              .filter((url) => /^https?:\/\//i.test(url))
              .map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  Ingredient source
                </a>
              ))}
          </div>
        ))}
      </details>
      {remaining > 0 && (
        <form
          className="recipe-portion"
          onSubmit={(event) => {
            event.preventDefault();
            log();
          }}
        >
          <label>
            How many portions did you eat?
            <input
              type="number"
              inputMode="decimal"
              min="0.0001"
              max={remaining}
              step="any"
              required
              placeholder="Enter amount eaten"
              value={amount}
              disabled={pending}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          <label>
            Add to
            <select
              value={category}
              disabled={pending}
              onChange={(event) =>
                setCategory(event.target.value as Meal["category"])
              }
            >
              {["Breakfast", "Lunch", "Dinner", "Snack"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <button className="button primary full-width" disabled={pending}>
            Log eaten portion
          </button>
        </form>
      )}
      {!!active.length && (
        <div className="recipe-history">
          <h4>Logged portions</h4>
          {active.map((entry) => (
            <div key={entry.id}>
              <p>
                {entry.portions} {entry.portions === 1 ? "portion" : "portions"}{" "}
                ·{" "}
                {state.meals.find((meal) => meal.id === entry.mealId)
                  ?.category || "Saved meal"}
              </p>
              {undoMeal === entry.mealId ? (
                <div className="recipe-review">
                  <p>
                    Remove this meal from your food log and return{" "}
                    {entry.portions} portions to this batch?
                  </p>
                  <button
                    className="recipe-text"
                    disabled={pending}
                    onClick={() =>
                      run(
                        (latest) => deleteMealWithPantry(latest, entry.mealId),
                        (latest) =>
                          !!latest.recipeBatches
                            ?.find((item) => item.id === batch.id)
                            ?.consumptions.find((item) => item.id === entry.id)
                            ?.reversedAt,
                        "Food-log entry removed and prepared portions restored.",
                      )
                    }
                  >
                    Confirm remove logged portion
                  </button>
                  <button
                    className="recipe-text"
                    onClick={() => setUndoMeal(null)}
                  >
                    Keep logged portion
                  </button>
                </div>
              ) : (
                <button
                  className="recipe-text"
                  disabled={pending}
                  onClick={() => setUndoMeal(entry.mealId)}
                >
                  Undo logged portion
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {!active.length &&
        (reviewUndo ? (
          <div className="recipe-review">
            <p>
              Undo preparation and return the original ingredient quantities to
              your pantry? Only use this to correct a batch you did not actually
              prepare.
            </p>
            <button
              className="recipe-text"
              disabled={pending}
              onClick={() =>
                run(
                  (latest) => undoRecipePreparation(latest, batch.id),
                  (latest) =>
                    !!latest.recipeBatches?.find(
                      (entry) => entry.id === batch.id,
                    )?.undoneAt,
                  "Preparation undone. Original ingredient quantities restored.",
                )
              }
            >
              Confirm undo preparation
            </button>
            <button
              className="recipe-text"
              disabled={pending}
              onClick={() => setReviewUndo(false)}
            >
              Keep prepared batch
            </button>
          </div>
        ) : (
          <button
            className="recipe-text"
            disabled={pending}
            onClick={() => setReviewUndo(true)}
          >
            <RotateCcw size={15} />
            Undo preparation
          </button>
        ))}
    </section>
  );
}
