import { useState } from "react";
import {
  ArrowRight,
  Check,
  CalendarDays,
  PackageCheck,
  RotateCcw,
  ShoppingBasket,
} from "lucide-react";
import { Modal } from "../../components";
import { GroceriesDialog, Sources } from "../../AICards";
import { personalMeals, type AppState, type Meal } from "../../domain";
import {
  adjustPantry,
  deleteMealWithPantry,
  getPantryLots,
  mealFromPantry,
  reconcileMeal,
  undoPantryAdjustment,
  updatePantryItem,
  type PantryLot,
} from "./ledger";
import { scaleNutrition } from "../meals/arithmetic";
import {
  displayCalendarDate,
  localCalendarDay,
  packageDateLabel,
  pantryDateReminder,
  sortPantryByDate,
  updatePantryDates,
} from "./dates";
import type { PantryDates } from "./date-contract";
import "./pantry.css";import ManualIngredient from './ManualIngredient';import {addManualPantryIngredient} from './manual-ingredient';
import { receiptSourcePhoto, receiptReadiness } from '../receipts/journey';

function PantryDateEditor({
  lot,
  onClose,
  onSave,
}: {
  lot: PantryLot;
  onClose: () => void;
  onSave: (dates: PantryDates) => void;
}) {
  const [labelKind, setLabelKind] = useState<PantryDates["labelKind"]>(
    lot.item.pantryDates?.labelKind ?? "best-before",
  );
  const [labelDate, setLabelDate] = useState(
    lot.item.pantryDates?.labelDate ?? "",
  );
  const [openedDate, setOpenedDate] = useState(
    lot.item.pantryDates?.openedDate ?? "",
  );
  const [error, setError] = useState("");
  return (
    <Modal title="Pantry dates" onClose={onClose}>
      <form
        className="edit-form pantry-date-editor"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            onSave({
              labelKind,
              labelDate: labelDate || null,
              openedDate: openedDate || null,
            });
          } catch (caught) {
            setError(
              caught instanceof Error
                ? caught.message
                : "Please check these dates.",
            );
          }
        }}
      >
        <h3>{lot.item.name}</h3>
        <p>
          Copy the date and wording from the package. Leave a date blank when
          you don't know it.
        </p>
        <label>
          Package date wording
          <select
            value={labelKind}
            onChange={(event) =>
              setLabelKind(event.target.value as PantryDates["labelKind"])
            }
          >
            <option value="best-before">Best before</option>
            <option value="use-by">Use by</option>
          </select>
        </label>
        <label>
          Package date
          <input
            type="date"
            min="1900-01-01"
            max="9999-12-31"
            value={labelDate}
            onChange={(event) => setLabelDate(event.target.value)}
          />
        </label>
        <label>
          Opened on
          <input
            type="date"
            min="1900-01-01"
            max={localCalendarDay()}
            value={openedDate}
            onChange={(event) => setOpenedDate(event.target.value)}
          />
        </label>
        <p className="pantry-date-explanation">
          These dates help organize your pantry. Rep & Plate does not determine whether
          food is safe or automatically mark it used.
        </p>
        {error && <p role="alert">{error}</p>}
        <button
          type="button"
          className="button secondary full-width"
          onClick={() => {
            setLabelDate("");
            setOpenedDate("");
            setError("");
          }}
        >
          Clear dates
        </button>
        <button className="button primary full-width">Save dates</button>
        <button
          type="button"
          className="button secondary full-width"
          onClick={onClose}
        >
          Cancel
        </button>
      </form>
    </Modal>
  );
}

export function PantryDialog({
  state,
  onChange,
  onClose,
  onAsk,
  receiptId,
}: {
  state: AppState;
  onChange: (update: (state: AppState) => AppState) => void;
  onClose: () => void;
  onAsk: (text: string) => void;
  receiptId?: string;
}) {
  const [details, setDetails] = useState(false);  const [addingIngredient,setAddingIngredient]=useState(false);
  const [reviewItem,setReviewItem]=useState<{receiptId:string;itemId:string}|undefined>();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [title, setTitle] = useState("");
  const [existingMealId, setExistingMealId] = useState("");
  const [category, setCategory] = useState<Meal["category"]>("Snack");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adjusting, setAdjusting] = useState<PantryLot | null>(null);
  const [dating, setDating] = useState<PantryLot | null>(null);
  const [dateOrder, setDateOrder] = useState(true);
  const [operationId, setOperationId] = useState(() => crypto.randomUUID());
  const purchaseLots = getPantryLots(state).filter(
    (lot) => !receiptId || lot.receiptId === receiptId,
  );
  const reviewQueue=purchaseLots.filter(lot=>lot.item.availability!=='used'&&(lot.item.needsReview||!lot.item.nutrition||!lot.item.serving||lot.remaining===null||lot.inconsistent)).sort((a,b)=>Number(!!b.item.needsReview||!b.item.nutrition)-Number(!!a.item.needsReview||!a.item.nutrition));
  const lots = dateOrder ? sortPantryByDate(purchaseLots) : purchaseLots;
  const dateReminders = sortPantryByDate(purchaseLots).filter((lot) =>
    pantryDateReminder(lot),
  );
  const selections = Object.entries(selected).map(([lotId, amount]) => ({
    lotId,
    servings: Number(amount),
  }));
  const selectedLots = lots.filter((lot) => selected[lot.id] !== undefined);
  const consumedMeals = state.meals.filter((meal) =>
    (state.pantryEvents || []).some(
      (event) =>
        event.kind === "consumed" &&
        event.mealId === meal.id &&
        !(state.pantryEvents || []).some(
          (other) => other.reversesId === event.id,
        ),
    ),
  );
  const adjustments = (state.pantryEvents || []).filter(
    (event) =>
      ["adjusted", "discarded"].includes(event.kind) &&
      lots.some((lot) => lot.id === event.lotId) &&
      !(state.pantryEvents || []).some(
        (other) => other.reversesId === event.id,
      ),
  );
  const change = (update: (value: AppState) => AppState) => {
    try {
      // Validate against visible state first; the same validation runs on the latest state on update.
      update(state);
      onChange((latest) => {
        try {
          return update(latest);
        } catch {
          return latest;
        }
      });
      setError("");
      return true;
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "That change needs a check.",
      );
      return false;
    }
  };
  if(addingIngredient)return <ManualIngredient onClose={()=>setAddingIngredient(false)} onAdd={input=>{const id=crypto.randomUUID();if(change(latest=>addManualPantryIngredient(latest,input,id))){setAddingIngredient(false);setNotice('Ingredient added to your pantry. Return to your recipe when you are ready. No meal logged.');}}}/>;  if (dating)
    return (
      <PantryDateEditor
        lot={dating}
        onClose={() => setDating(null)}
        onSave={(dates) => {
          updatePantryDates(state, dating.receiptId, dating.item.id, dates);
          onChange((latest) =>
            updatePantryDates(latest, dating.receiptId, dating.item.id, dates),
          );
          setDating(null);
          setNotice(
            "Dates saved. Your pantry amounts and food log have not changed.",
          );
        }}
      />
    );
  if (details)
    return (
      <GroceriesDialog
        onAdjustRemaining={(purchaseId, itemId) => { const lot = purchaseLots.find(l => l.receiptId === purchaseId && l.item.id === itemId); if (lot) { setDetails(false); setReviewItem(undefined); setAdjusting(lot); setOperationId(crypto.randomUUID()); } }}
        sourcePhotos={Object.fromEntries((state.groceries ?? []).map(receipt => [receipt.id, receiptSourcePhoto(state, receipt.id)]))}
        initialReview={reviewItem}
        onReceiptUpdate={receipt=>onChange(latest=>({...latest,groceries:latest.groceries?.map(old=>old.id===receipt.id?{...old,store:receipt.store,purchase:receipt.purchase,items:old.items.map(item=>({...item,price:receipt.items.find(line=>line.id===item.id)?.price??item.price}))}:old)}))}
        receipts={(state.groceries || []).filter(
          (receipt) => !receiptId || receipt.id === receiptId,
        )}
        onClose={() => {setDetails(false);setReviewItem(undefined);}}
        onAsk={(text) => {
          onClose();
          onAsk(text);
        }}
        onUpdate={(id, item) => {
            updatePantryItem(state, id, item);
            onChange((latest) => updatePantryItem(latest, id, item));
        }}
      />
    );
  if (adjusting)
    return (
      <Modal title="How much is left?" onClose={() => setAdjusting(null)}>
        <form
          className="edit-form"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            if (
              change((latest) =>
                adjustPantry(
                  latest,
                  adjusting.id,
                  Number(data.get("remaining")),
                  operationId,
                  data.get("reason") === "discarded" ? "discarded" : "adjusted",
                ),
              )
            ) {
              setAdjusting(null);
              setOperationId(crypto.randomUUID());
              setNotice(
                "Remaining amount updated. Your food log has not changed.",
              );
            }
          }}
        >
          <p>
            {adjusting.item.name} · one serving is{" "}
            {adjusting.item.serving || "not yet known"}.
          </p>
          <label>
            Servings remaining
            <input
              name="remaining"
              type="number"
              min="0"
              max="10000"
              step="any"
              required
              defaultValue={adjusting.remaining ?? ""}
            />
          </label>
          <label>
            What changed?
            <select name="reason">
              <option value="adjusted">I checked what is left</option>
              <option value="discarded">I discarded some</option>
            </select>
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="button primary full-width">
            Save remaining amount
          </button>
        </form>
      </Modal>
    );
  return (
    <Modal title="Your pantry" onClose={onClose} wide>
      <div className="fuel-pantry connected-pantry">
        <p>
          What you bought, what is left, and what you used. Nothing counts as
          eaten until you confirm it.
        </p>
        {lots.length > 0 && <section className="receipt-result-actions" aria-label="Put groceries to use"><p>{receiptReadiness(state, receiptId).ready} checked foods on hand. Start with these; unclear products and amounts still need review.</p><button className="button primary" disabled={receiptReadiness(state, receiptId).ready === 0} onClick={() => { onClose(); onAsk('Help me choose dinner tonight using my available, checked groceries. Ask about unknown products and quantities and list ingredients I need to buy. Do not log a meal or change stock.'); }}>Help me choose dinner tonight</button><button className="button secondary" onClick={() => setDetails(true)}>Check purchase details</button></section>}
        {error && (
          <p role="alert" className="pantry-feedback error">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="pantry-feedback">
            {notice}
          </p>
        )}
        <button className="button secondary full-width" onClick={()=>setAddingIngredient(true)}>Add ingredient manually</button>        {!lots.length && (
          <div className="fuel-pantry-empty">
            <ShoppingBasket size={36} />
            <h3>Your next grocery trip starts here.</h3>
            <p>Scan a product or share a receipt in Chat.</p>
          </div>
        )}
        {reviewQueue.length>0&&<section className="pantry-date-reminders" aria-label="Pantry review queue"><h3>{reviewQueue.length} food {reviewQueue.length===1?'item needs':'items need'} a check</h3><p>Start with product and nutrition details, then quantities. Nonfood receipt lines do not block your pantry.</p><ol>{reviewQueue.slice(0,3).map(lot=><li key={lot.id}><strong>{lot.item.name}</strong><span>{lot.item.needsReview||!lot.item.nutrition?'Confirm product and nutrition':'Confirm servings purchased'}</span><button className="button secondary" onClick={()=>{setReviewItem({receiptId:lot.receiptId,itemId:lot.item.id});setDetails(true);}}>Review {lot.item.name}</button></li>)}</ol>{reviewQueue.length>3&&<p>{reviewQueue.length-3} more after these.</p>}<p>Total servings = packages purchased × servings per package. For example, 2 tubs × 5 servings = 10 servings. Use the package label; leave an unknown amount blank.</p></section>}
        {dateReminders.length > 0 && (
          <section
            className="pantry-date-reminders"
            aria-label="Package date reminders"
          >
            <div>
              <CalendarDays size={21} />
              <h3>Use soon · dates to check</h3>
            </div>
            <p>
              Package dates you entered that are past or within the next 7 days.
            </p>
            <ul>
              {dateReminders.map((lot) => (
                <li key={lot.id}>
                  <strong>{lot.item.name}</strong>
                  <span>{pantryDateReminder(lot)}</span>
                </li>
              ))}
            </ul>
            <small>Dates are reminders, not a food safety assessment.</small>
          </section>
        )}
        {lots.length > 0 && (
          <label className="pantry-date-order">
            Show items by
            <select
              value={dateOrder ? "date" : "purchase"}
              onChange={(event) => setDateOrder(event.target.value === "date")}
            >
              <option value="date">Use soon: package date</option>
              <option value="purchase">Purchase order</option>
            </select>
          </label>
        )}
        {lots.map((lot) => {
          const ready =
            lot.remaining !== null &&
            lot.remaining > 0 &&
            !lot.inconsistent &&
            !lot.item.needsReview &&
            !!lot.item.nutrition &&
            lot.item.availability !== "used";
          return (
            <section key={lot.id} className="pantry-lot">
              <div className="pantry-lot-heading">
                <PackageCheck size={23} />
                <div>
                  <h3>{lot.item.name}</h3>
                  <small>
                    {lot.store} · {state.groceries?.find(receipt=>receipt.id===lot.receiptId)?.purchase?.purchaseDate?"Purchased":"Captured"} {lot.date}
                  </small>
                </div>
              </div>
              <div className="pantry-balance">
                <strong>
                  {lot.item.availability === "used"
                    ? "Marked used"
                    : lot.remaining === null
                      ? "Quantity needs a check"
                      : `${lot.remaining} servings left`}
                </strong>
                <span>
                  {lot.purchased === null
                    ? lot.item.quantity
                    : `${lot.purchased} servings purchased`}
                </span>
              </div>
              <p>1 serving: {lot.item.serving || "Not known yet"}</p>
              <div className="pantry-dates">
                <CalendarDays size={17} />
                <div>
                  <span>
                    {lot.item.pantryDates?.labelDate
                      ? `${packageDateLabel(lot.item.pantryDates.labelKind)}: ${displayCalendarDate(lot.item.pantryDates.labelDate)}`
                      : "Package date not recorded"}
                  </span>
                  <span>
                    {lot.item.pantryDates?.openedDate
                      ? `Opened: ${displayCalendarDate(lot.item.pantryDates.openedDate)}`
                      : "Opened date not recorded"}
                  </span>
                </div>
                <button
                  onClick={() => setDating(lot)}
                  aria-label={`Edit dates for ${lot.item.name}`}
                >
                  Edit dates
                </button>
              </div>
              {lot.item.nutrition && (
                <p className="pantry-macros">
                  ~{lot.item.nutrition.calories} cal ·{" "}
                  {lot.item.nutrition.protein}g protein per serving
                </p>
              )}
              {lot.item.needsReview && (
                <small>
                  Check the serving size and nutrition before logging.
                </small>
              )}
              {lot.inconsistent && (
                <p role="alert">
                  This purchase changed after some was used. Check the remaining
                  amount.
                </p>
              )}
              <div className="pantry-lot-actions">
                <label className={ready ? "" : "disabled"}>
                  <input
                    type="checkbox"
                    aria-label={`Use ${lot.item.name}`}
                    disabled={!ready}
                    checked={selected[lot.id] !== undefined}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = { ...current };
                        if (event.target.checked)
                          next[lot.id] = String(
                            Math.min(1, lot.remaining ?? 1),
                          );
                        else delete next[lot.id];
                        return next;
                      })
                    }
                  />{" "}
                  Use in a meal
                </label>
                {lot.remaining !== null && lot.item.availability !== "used" && (
                  <button
                    onClick={() => {
                      setError("");
                      setAdjusting(lot);
                    }}
                  >
                    Update amount
                  </button>
                )}
              </div>
              {selected[lot.id] !== undefined && (
                <label className="pantry-portion">
                  Servings used
                  <input
                    type="number"
                    min="0.01"
                    max={lot.remaining ?? undefined}
                    step="any"
                    value={selected[lot.id]}
                    onChange={(event) =>
                      setSelected((current) => ({
                        ...current,
                        [lot.id]: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
              <Sources sources={lot.item.sources} />
            </section>
          );
        })}
        {selections.length > 0 && (
          <form
            className="pantry-confirm edit-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                change((latest) =>
                  existingMealId
                    ? reconcileMeal(
                        latest,
                        existingMealId,
                        selections,
                        operationId,
                      )
                    : mealFromPantry(
                        latest,
                        selections,
                        operationId,
                        category,
                        title,
                      ),
                )
              ) {
                setSelected({});
                setTitle("");
                setExistingMealId("");
                setOperationId(crypto.randomUUID());
                setNotice(
                  existingMealId
                    ? "Ingredients linked to your meal. Pantry portions updated; calories were not added again."
                    : "Meal added. The selected portions were deducted from your pantry.",
                );
              }
            }}
          >
            <h3>Log what you used</h3>
            <p>
              Confirm these portions were eaten. Drinks, milk, syrups, oil, and
              sauces can be ingredients too.
            </p>
            <label>
              Where should these ingredients go?
              <select
                value={existingMealId}
                onChange={(event) => setExistingMealId(event.target.value)}
              >
                <option value="">Log a new meal</option>
                {personalMeals(state.meals)
                  .filter(
                    (meal) =>
                      !consumedMeals.some((entry) => entry.id === meal.id),
                  )
                  .slice(-30)
                  .reverse()
                  .map((meal) => (
                    <option key={meal.id} value={meal.id}>
                      Already logged: {meal.title} · {meal.day}
                    </option>
                  ))}
              </select>
            </label>
            {!existingMealId && (
              <>
                <label>
                  Meal name
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={200}
                    placeholder={selectedLots
                      .map((lot) => lot.item.name)
                      .join(" + ")}
                  />
                </label>
                <label>
                  Add to
                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as Meal["category"])
                    }
                  >
                    {(["Breakfast", "Lunch", "Dinner", "Snack"] as const).map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </label>
              </>
            )}
            <p>
              {selectedLots
                .map((lot) => {
                  const servings = Number(selected[lot.id]);
                  return Number.isFinite(servings) &&
                    servings > 0 &&
                    servings <= 10000 &&
                    lot.item.nutrition
                    ? scaleNutrition(lot.item.nutrition, servings).calories
                    : 0;
                })
                .reduce((sum, value) => sum + value, 0)
                .toFixed(0)}{" "}
              estimated calories · {selections.length} ingredients
            </p>
            {existingMealId && (
              <p>
                This updates your pantry only. The original meal's calorie
                estimate stays unchanged.
              </p>
            )}
            <button className="button primary full-width">
              <Check size={17} />{" "}
              {existingMealId
                ? "Confirm ingredients & update pantry"
                : "Confirm meal & update pantry"}
            </button>
          </form>
        )}
        {consumedMeals.length > 0 && (
          <section className="pantry-history">
            <h3>Recently used</h3>
            {consumedMeals
              .slice(-10)
              .reverse()
              .map((meal) => (
                <div key={meal.id}>
                  <span>
                    <strong>{meal.title}</strong>
                    <small>
                      {meal.day} · {meal.category}
                    </small>
                  </span>
                  <button
                    onClick={() => {
                      if (
                        change((latest) =>
                          deleteMealWithPantry(latest, meal.id),
                        )
                      )
                        setNotice(
                          "Meal removed and its ingredient portions restored.",
                        );
                    }}
                    aria-label={`Undo ${meal.title}`}
                  >
                    <RotateCcw size={15} /> Undo meal
                  </button>
                </div>
              ))}
          </section>
        )}
        {adjustments.length > 0 && (
          <section className="pantry-history">
            <h3>Quantity changes</h3>
            {adjustments
              .slice(-10)
              .reverse()
              .map((event) => (
                <div key={event.id}>
                  <span>
                    <strong>
                      {lots.find((lot) => lot.id === event.lotId)?.item.name}
                    </strong>
                    <small>
                      {event.kind === "discarded" ? "Discarded" : "Adjusted"} ·{" "}
                      {event.servings > 0 ? "+" : ""}
                      {event.servings} servings
                    </small>
                  </span>
                  <button
                    onClick={() => {
                      if (
                        change((latest) =>
                          undoPantryAdjustment(latest, event.id),
                        )
                      )
                        setNotice("Quantity change undone.");
                    }}
                  >
                    <RotateCcw size={15} /> Undo change
                  </button>
                </div>
              ))}
          </section>
        )}
        <button
          className="you-dialog-action"
          onClick={() => {
            onClose();
            onAsk(
              "Suggest a dinner using the groceries I still have. Respect known remaining servings; ask about unknown quantities. Include milk, drinks, oils, and sauces in the estimate.",
            );
          }}
        >
          What can I make with these? <ArrowRight size={17} />
        </button>
      </div>
    </Modal>
  );
}
export default PantryDialog;
