import { SpotCheck } from './features/spot/Spot';
import { lazy, Suspense, useState } from "react";
const Markdown = lazy(() => import("react-markdown"));
const ReceiptProductReview = lazy(() => import("./features/products/ReceiptProductReview"));
const ReceiptReview = lazy(() => import('./features/shopping/ReceiptReview'));
import { applyReceiptProduct } from "./features/products/receipt-match";
import {isPurchaseReceipt} from './features/pantry/receipt-origin';
import ProposalBreakdown from "./features/meals/ProposalBreakdown";
import { sumProposalComponents } from "./features/meals/proposals";
import {
  ArrowRight,
  Check,
  ChevronRight,
  ExternalLink,
  PackageCheck,
  Pencil,
  ShoppingBasket,
  Search,
} from "lucide-react";
import { Modal } from "./components";
import {
  safeUrl,
  type GroceryItem,
  type GroceryReceipt,
  type MealProposal,
} from "./ai-contract";
import "./ai.css";

export function AIText({
  text,
  sources = [],
}: {
  text: string;
  sources?: { url: string; title: string }[];
}) {
  const allowed = new Set(sources.map((s) => s.url));
  return (
    <div className="fuel-ai-text">
      <Suspense fallback={<p>{text}</p>}>
        <Markdown
          allowedElements={[
            "p",
            "strong",
            "em",
            "ul",
            "ol",
            "li",
            "a",
            "br",
            "h2",
            "h3",
            "code",
          ]}
          unwrapDisallowed
          components={{
            a: ({ href, children }) =>
              href && safeUrl(href) && allowed.has(href) ? (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              ),
          }}
        >
          {text}
        </Markdown>
      </Suspense>
    </div>
  );
}
export function Sources({
  sources,
}: {
  sources: { url: string; title: string }[];
}) {
  return sources.length ? (
    <div className="fuel-sources">
      {sources
        .filter((s) => safeUrl(s.url))
        .map((s, i) => (
          <a
            href={s.url}
            key={`${s.url}-${i}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={12} />
            {s.title || new URL(s.url).hostname}
          </a>
        ))}
    </div>
  ) : null;
}
export function GroceryCard({
  receipt,
  onOpen,
}: {
  receipt: GroceryReceipt;
  onOpen: () => void;
}) {
  const review = receipt.items.filter((i) => i.needsReview).length;
  return (
    <button className="fuel-grocery-card" onClick={onOpen}>
      <span className="fuel-grocery-symbol">
        <ShoppingBasket size={27} />
      </span>
      <span>
        <strong>{receipt.store}</strong>
        <span>
          {receipt.items.length} grocery{" "}
          {receipt.items.length === 1 ? "item" : "items"} saved
        </span>
        <small>
          {review
            ? `${review} ${review === 1 ? "match needs" : "matches need"} a check`
            : "Nutrition estimates & sources inside"}
        </small>
        <em>
          <Check size={14} /> Saved to groceries · not today’s intake
        </em>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}
export function ProposedMeal({
  meal,
  onAdd,
  onFix,
}: {
  meal: MealProposal;
  onAdd: () => void;
  onFix?: () => void;
}) {
  const totals = meal.components ? sumProposalComponents(meal.components) : meal;
  return (
    <SpotCheck><section className="fuel-proposed-meal">
      <small>MEAL ESTIMATE · CHECK THE PORTION</small>
      <h3>{meal.title}</h3>
      <p>{meal.portion}</p>
      {meal.day && <p>For {meal.day}</p>}
      <strong>
        ~{totals.calories} cal · {totals.protein}g protein
      </strong>
      <span>
        {totals.carbs}g carbs · {totals.fat}g fat
      </span>
      <p className="fuel-estimate-note">{meal.note}</p>
      {meal.components && <ProposalBreakdown components={meal.components}/>}
      <Sources sources={meal.sources} />
      <button onClick={onAdd}>
        <Check size={17} /> Yep, add to {meal.category}
      </button>
      {onFix && <button className="spot-text-button" onClick={onFix}>Fix it</button>}
    </section></SpotCheck>
  );
}
export function groceryTotals(receipt: GroceryReceipt) {
  const foods = receipt.items.filter((i) => i.match !== "nonfood");
  const known = foods.filter(
    (i) =>
      i.nutrition &&
      i.servingsPurchased &&
      (!i.needsReview || i.match === "user"),
  );
  const total = known.reduce(
    (s, item) => ({
      calories: s.calories + item.nutrition!.calories * item.servingsPurchased!,
      protein: s.protein + item.nutrition!.protein * item.servingsPurchased!,
      carbs: s.carbs + item.nutrition!.carbs * item.servingsPurchased!,
      fat: s.fat + item.nutrition!.fat * item.servingsPurchased!,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return { total, known: known.length, foods: foods.length };
}
export function GroceriesDialog({
  receipts,
  onClose,
  onUpdate,
  onAsk,
  onReceiptUpdate,
  initialReview,
}: {
  receipts: GroceryReceipt[];
  initialReview?: {receiptId:string;itemId:string};
  onClose: () => void;
  onUpdate: (receiptId: string, item: GroceryItem) => void;
  onAsk: (text: string) => void;
  onReceiptUpdate?: (receipt: GroceryReceipt) => void;
}) {
  const [editing, setEditing] = useState<{
    receiptId: string;
    item: GroceryItem;
    draft?:Record<string,string>;
  } | null>(()=>{const receipt=receipts.find(value=>value.id===initialReview?.receiptId);const item=receipt?.items.find(value=>value.id===initialReview?.itemId);return receipt&&item&&!item.productCandidates?.length?{receiptId:receipt.id,item}:null;});
  const [matching, setMatching] = useState<{receiptId: string; item: GroceryItem;draft?:Record<string,string>} | null>(()=>{const receipt=receipts.find(value=>value.id===initialReview?.receiptId);const item=receipt?.items.find(value=>value.id===initialReview?.itemId);return receipt&&item&&item.productCandidates?.length?{receiptId:receipt.id,item}:null;});
  const [reviewing,setReviewing]=useState<GroceryReceipt|null>(null);
  if(reviewing&&onReceiptUpdate)return <Suspense fallback={<Modal title="Review grocery trip" onClose={()=>setReviewing(null)}><p>Opening receipt…</p></Modal>}><ReceiptReview receipt={reviewing} onClose={()=>setReviewing(null)} onSave={receipt=>{onReceiptUpdate(receipt);setReviewing(null);}}/></Suspense>;
  if (matching) return <Suspense fallback={<Modal title="Find this product" onClose={()=>setMatching(null)}><p>Opening product search…</p></Modal>}><ReceiptProductReview item={matching.item} onClose={()=>setMatching(null)} onManual={()=>{setEditing(matching);setMatching(null);}} onApply={(product,servingsPurchased)=>{
    const latest = receipts.find(receipt=>receipt.id===matching.receiptId)?.items.find(item=>item.id===matching.item.id);
    if (!latest) throw new Error("This grocery item is no longer available.");
    onUpdate(matching.receiptId,applyReceiptProduct(latest,product,servingsPurchased));
    setMatching(null);
  }}/></Suspense>;
  if (editing)
    return (
      <Modal title="Check this grocery item" onClose={() => setEditing(null)}>
        <form
          className="edit-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const fields = ["calories", "protein", "carbs", "fat"] as const;
            const hasAll = fields.every(
              (k) => String(form.get(k)).trim() !== "",
            );
            const nutrition = hasAll
              ? {
                  calories: Number(form.get("calories")),
                  protein: Number(form.get("protein")),
                  carbs: Number(form.get("carbs")),
                  fat: Number(form.get("fat")),
                }
              : null;
            const serving = String(form.get("serving")).trim();
            const servings = String(form.get("servings")).trim();
            onUpdate(editing.receiptId, {
              ...editing.item,
              productSnapshot: String(form.get("name")).trim() === editing.item.name && serving === editing.item.serving && JSON.stringify(nutrition) === JSON.stringify(editing.item.nutrition) ? editing.item.productSnapshot : undefined,
              name: String(form.get("name")).trim(),
              quantity: String(form.get("quantity")).trim(),
              serving,
              servingsPurchased: servings ? Number(servings) : null,
              nutrition,
              match: nutrition && serving ? "user" : "unresolved",
              needsReview: !nutrition || !serving,
              note: "Details edited by you. Nutrition is per serving; purchase quantities are separate from food eaten.",
            });
            setEditing(null);
          }}
        >
          <p className="modal-intro">
            Use the package label when you have it. Leave unknown nutrition
            blank.
          </p>
          <button type="button" className="button secondary" onClick={event=>{const form=event.currentTarget.form!;setMatching({...editing,draft:Object.fromEntries([...new FormData(form)].map(([key,value])=>[key,String(value)]))});setEditing(null);}}>{editing.item.productCandidates?.length?'Review suggested products instead':'Find this product instead'}</button>
          <label>
            Product name
            <input
              name="name"
              required
              maxLength={200}
              defaultValue={editing.draft?.name??editing.item.name}
            />
          </label>
          <label>
            Quantity purchased
            <input
              name="quantity"
              maxLength={100}
              defaultValue={editing.draft?.quantity??editing.item.quantity}
            />
          </label>
          <label>
            Serving size
            <input
              name="serving"
              maxLength={150}
              defaultValue={editing.draft?.serving??editing.item.serving}
              placeholder="e.g. 1 cup (240 ml)"
            />
          </label>
          <label>
            Total servings purchased
            <input
              name="servings"
              type="number"
              min="0.01"
              max="10000"
              step="any"
              defaultValue={editing.draft?.servings??editing.item.servingsPurchased ?? ""}
            />
          </label>
          <p className="modal-intro">Packages purchased × servings per package = total servings. For example, 2 tubs × 5 servings = 10. Copy the serving size and nutrition from that same label.</p>
          <div className="form-grid">
            {(["calories", "protein", "carbs", "fat"] as const).map((k) => (
              <label key={k}>
                {k === "calories"
                  ? "Calories per serving"
                  : `${k[0].toUpperCase() + k.slice(1)} per serving (g)`}
                <input
                  type="number"
                  name={k}
                  min="0"
                  max={k === "calories" ? 20000 : k === "carbs" ? 5000 : 2000}
                  step="any"
                  defaultValue={editing.draft?.[k]??editing.item.nutrition?.[k] ?? ""}
                />
              </label>
            ))}
          </div>
          <button className="button primary full-width">
            Save grocery details <Check size={17} />
          </button>
        </form>
      </Modal>
    );
  return (
    <Modal title="Your groceries" onClose={onClose} wide>
      <div className="fuel-pantry">
        <p>
          Groceries and ingredients on hand, with nutrition estimates you can check. These
          groceries are separate from what you’ve eaten.
        </p>
        {!receipts.length && (
          <div className="fuel-pantry-empty">
            <ShoppingBasket size={38} />
            <h3>Start with your next grocery receipt.</h3>
            <p>
              Share a photo in chat. Rep & Plate will read the items and look for
              nutrition sources.
            </p>
          </div>
        )}
        {receipts
          .slice()
          .reverse()
          .map((receipt) => {
            const totals = groceryTotals(receipt);
            return (
              <section className="fuel-receipt" key={receipt.id}>
                <div className="fuel-receipt-heading">
                  <span>
                    <h3>{receipt.store}</h3>
                    <small>
                      {receipt.purchase?.purchaseDate ? `Purchased ${receipt.purchase.purchaseDate}` : `Captured ${receipt.date}`} · {receipt.items.length} items
                      {receipt.purchase?.purchaseDate && <span> · Captured {receipt.date}</span>}
                    </small>
                  </span>
                  <PackageCheck size={27} />
                </div>
                {receipt.note && <p>{receipt.note}</p>}
                {onReceiptUpdate&&isPurchaseReceipt(receipt)&&<button className="button secondary" onClick={()=>setReviewing(receipt)}>Review store, date & prices</button>}
                {totals.known > 0 && (
                  <div className="fuel-cart-total">
                    <strong>
                      {isPurchaseReceipt(receipt)?'Estimated purchase total':'Estimated initially recorded stock'}
                      {totals.known < totals.foods ? " · partial" : ""}
                    </strong>
                    <span>
                      ~{Math.round(totals.total.calories).toLocaleString()} cal
                      · {Math.round(totals.total.protein)}g protein ·{" "}
                      {Math.round(totals.total.carbs)}g carbs ·{" "}
                      {Math.round(totals.total.fat)}g fat
                    </span>
                    <small>
                      Includes {totals.known} of {totals.foods} food items with
                      known serving quantities. Not a daily target.
                    </small>
                  </div>
                )}
                {receipt.items.map((item) => (
                  <details className="fuel-grocery-item" key={item.id}>
                    <summary>
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.quantity || "Quantity not clear"} ·{" "}
                          {item.availability === "used"
                            ? "Marked used"
                            : item.match === "user"
                              ? "Checked by you"
                              : item.match === "exact"
                                ? "Product match"
                                : item.match === "generic"
                                  ? "General estimate"
                                  : item.match === "nonfood"
                                    ? "Nonfood item"
                                    : "Needs details"}
                        </small>
                      </span>
                      <span className={item.needsReview ? "needs-review" : ""}>
                        {item.nutrition
                          ? `~${item.nutrition.calories} cal`
                          : "—"}
                        <small>
                          {item.nutrition ? "per serving" : "not estimated"}
                        </small>
                      </span>
                      <ChevronRight size={17} />
                    </summary>
                    <div className="fuel-grocery-detail">
                      <p>
                        <b>On the receipt:</b> {item.receiptText}
                      </p>
                      <p>
                        <b>Serving:</b> {item.serving || "Not known yet"}
                      </p>
                      {item.nutrition && (
                        <p>
                          {item.nutrition.protein}g protein ·{" "}
                          {item.nutrition.carbs}g carbs · {item.nutrition.fat}g
                          fat
                        </p>
                      )}
                      <p>{item.note}</p>
                      {item.needsReview && (
                        <p className="fuel-match-note">
                          Please check the brand, size, or nutrition label
                          before relying on this match.
                        </p>
                      )}
                      <Sources sources={item.sources} />
                      <div className="fuel-grocery-actions">
                        {item.match !== "nonfood" && <button onClick={()=>setMatching({receiptId:receipt.id,item})}><Search size={14}/>{item.productCandidates?.length ? "Review USDA matches" : "Find USDA product"}</button>}
                        <button
                          onClick={() =>
                            setEditing({ receiptId: receipt.id, item })
                          }
                        >
                          <Pencil size={14} /> Edit details
                        </button>
                        <button
                          onClick={() =>
                            onUpdate(receipt.id, {
                              ...item,
                              availability:
                                item.availability === "available"
                                  ? "used"
                                  : "available",
                            })
                          }
                        >
                          <Check size={14} />
                          {item.availability === "available"
                            ? "Mark used"
                            : "Mark available"}
                        </button>
                      </div>
                    </div>
                  </details>
                ))}
                <Sources sources={receipt.sources} />
              </section>
            );
          })}
        <button
          className="you-dialog-action"
          onClick={() => {
            onClose();
            onAsk(
              receipts.length
                ? "Suggest a dinner using my available groceries. Include approximate portions, and tell me what I would need to buy."
                : "How do I share a grocery receipt?",
            );
          }}
        >
          {receipts.length
            ? "What can I make with these?"
            : "Ask Rep & Plate about receipts"}{" "}
          <ArrowRight size={17} />
        </button>
      </div>
    </Modal>
  );
}
