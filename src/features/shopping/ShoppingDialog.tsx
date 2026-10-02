import { apiFetch } from "../../api-fetch";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowRight,
  Check,
  ShoppingBasket,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Modal } from "../../components";
import { today, type AppState } from "../../domain";
import type { GroceryReceipt } from "../../ai-contract";
import { defaultPreferences } from "../preferences/contracts";
import { excludedIngredientText } from "../planning/exclusions";
import { formatIngredientAmount } from "../planning/meal-plans";
import { productSearchResultSchema } from "../products/search-contract";
import type { FoodProduct } from "../products/contracts";
import { priceObservationSchema, type PriceObservation } from "./contracts";
import {
  addShoppingItem,
  comparePrices,
  compareProducts,
  formatMoney,
  receiptSpending,
  purchaseReceipts,
  receiptPrice,
  remainingPlanNeeds,
} from "./shopping";
import ReceiptReview from "./ReceiptReview";
import { receiptSourcePhoto } from '../receipts/journey';
import PriceResearch from "./PriceResearch";
import "./shopping.css";

const emptyShopping = (): NonNullable<AppState["shopping"]> => ({
  list: [],
  dismissed: [],
  prices: {},
});
const priorityLabels: Record<string, string> = {
  balanced: "A little of everything",
  budget: "Saving money",
  protein: "More protein",
  calories: "Fewer calories",
  "less-sugar": "Less sugar",
  convenience: "Convenience",
};
type Props = {
  initialTab?: "swaps" | "list" | "spending";
  state: AppState;
  onChange: Dispatch<SetStateAction<AppState>>;
  onClose: () => void;
  onPreferences: () => void;
  onPantry: () => void;
};

function PriceEditor({
  product,
  value,
  onSave,
}: {
  product: FoodProduct;
  value?: PriceObservation;
  onSave: (price: PriceObservation) => void;
}) {
  const [error, setError] = useState("");
  return (
    <details className="shopping-price-editor">
      <summary>Check price for {product.name}</summary>
      <form
        className="edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const parsed = priceObservationSchema.safeParse({
            price: Number(data.get("price")),
            amount: Number(data.get("amount")),
            unit: data.get("unit"),
            currency: data.get("currency"),
            date: data.get("date"),
            store: data.get("store"),
            conditions: data.get("conditions"),
            confirmed: true,
          });
          if (!parsed.success || parsed.data.date > today()) {
            setError(
              "Check the price, package amount, store and observation date.",
            );
            return;
          }
          onSave({
            ...parsed.data,
            ...(value?.sourceUrl &&
            (
              [
                "price",
                "amount",
                "unit",
                "currency",
                "store",
                "conditions",
              ] as const
            ).every((key) => value[key] === parsed.data[key])
              ? { sourceUrl: value.sourceUrl }
              : {}),
          });
          setError("Price saved. Comparisons use the same quantity.");
        }}
      >
        <p>
          Copy a current shelf, receipt or retailer price for this exact
          product. Include membership or sale conditions.
        </p>
        {value?.sourceUrl && (
          <p>
            <a href={value.sourceUrl} target="_blank" rel="noreferrer">
              Open retailer price source
            </a>
            {!value.confirmed && " · Found online, not yet confirmed"}
          </p>
        )}
        <div className="form-grid">
          <label>
            Package price
            <input
              name="price"
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              required
              defaultValue={value?.price ?? ""}
            />
          </label>
          <label>
            Currency
            <select name="currency" defaultValue={value?.currency ?? "USD"}>
              {["USD", "CAD", "GBP", "EUR", "AUD"].map((code) => (
                <option key={code}>{code}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label>
            Amount covered by price
            <input
              name="amount"
              type="number"
              min="0.01"
              step="any"
              max="1000000"
              required
              defaultValue={value?.amount ?? ""}
            />
          </label>
          <label>
            Amount unit
            <select
              name="unit"
              defaultValue={
                value?.unit ?? (product.serving.unit === "ml" ? "ml" : "g")
              }
            >
              <option value="g">grams</option>
              <option value="ml">milliliters</option>
              <option value="each">equivalent items</option>
            </select>
          </label>
        </div>
        <label>
          Store and location
          <input
            name="store"
            required
            maxLength={200}
            defaultValue={value?.store ?? ""}
          />
        </label>
        <label>
          Price checked on
          <input
            type="date"
            name="date"
            max={today()}
            required
            defaultValue={value?.date ?? today()}
          />
        </label>
        <label>
          Sale or membership conditions
          <input
            name="conditions"
            maxLength={300}
            defaultValue={value?.conditions ?? ""}
            placeholder="e.g. loyalty card required; leave blank if none"
          />
        </label>
        <label className="shopping-check">
          <input type="checkbox" required />I checked this exact product,
          package amount and price.
        </label>
        <button className="button secondary">Save checked price</button>
        {error && <p role="status">{error}</p>}
      </form>
    </details>
  );
}

export default function ShoppingDialog({
  initialTab = "swaps",
  state,
  onChange,
  onClose,
  onPreferences,
  onPantry,
}: Props) {
  const [tab, setTab] = useState<"swaps" | "list" | "spending">(initialTab);
  const [review, setReview] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [kept, setKept] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [researched, setResearched] = useState<
    Record<string, PriceObservation>
  >({});
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  const shopping = state.shopping ?? emptyShopping();
  const prefs = state.preferences ?? defaultPreferences();
  const choices = (state.groceries ?? []).flatMap((receipt) =>
    receipt.items
      .filter(
        (item) =>
          item.productSnapshot && !item.needsReview && item.match !== "nonfood",
      )
      .map((item) => ({ receipt, item })),
  );
  const current = choices.find((choice) => choice.item.id === selected);
  const original = current?.item.productSnapshot;
  const receipts = purchaseReceipts(state.groceries ?? []);
  const spending = receiptSpending(receipts);
  const needs = remainingPlanNeeds(state, today());
  const observedPrice = (product: FoodProduct) =>
    shopping.prices[product.id] ?? receiptPrice(receipts, product);
  const displayedPrice = (product: FoodProduct) =>
    researched[product.id] ?? observedPrice(product);
  const savePrice = (product: FoodProduct, value: PriceObservation) => {
    updateShopping((s) => ({
      ...s,
      prices: { ...s.prices, [product.id]: value },
    }));
    setResearched((current) => {
      const next = { ...current };
      delete next[product.id];
      return next;
    });
  };
  const reviewReceipt = receipts.find((receipt) => receipt.id === review);
  const updateShopping = (
    change: (
      current: NonNullable<AppState["shopping"]>,
    ) => NonNullable<AppState["shopping"]>,
  ) => {
    try {
      change(shopping);
      onChange((latest) => ({
        ...latest,
        shopping: change(latest.shopping ?? emptyShopping()),
      }));
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Please check this change.",
      );
    }
  };
  const saveReceipt = (receipt: GroceryReceipt) => {
    onChange((latest) => ({
      ...latest,
      groceries: latest.groceries?.map((old) =>
        old.id === receipt.id
          ? {
              ...old,
              store: receipt.store,
              purchase: receipt.purchase,
              items: old.items.map((item) => ({
                ...item,
                price:
                  receipt.items.find((line) => line.id === item.id)?.price ??
                  item.price,
              })),
            }
          : old,
      ),
    }));
    setReview(null);
  };
  async function search() {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const run = ++generation.current;
    setBusy(true);
    setNotice("");
    setProducts([]);
    setChecked([]);
    setKept([]);
    const timer = setTimeout(() => abort.abort(), 22000);
    try {
      const response = await apiFetch("/api/products/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
        signal: abort.signal,
      });
      if (!response.ok)
        throw new Error(
          "Product search is unavailable. Try again in a moment.",
        );
      const result = productSearchResultSchema.parse(await response.json());
      if (run !== generation.current) return;
      setProducts(result.products);
      setNotice(
        result.status === "candidates"
          ? "Compare the labels and how you would use each product. Store availability and prices still need a check."
          : result.message,
      );
    } catch {
      if (run === generation.current)
        setNotice(
          "Could not finish the search. Your groceries and list are unchanged. Please try again.",
        );
    } finally {
      clearTimeout(timer);
      if (run === generation.current) setBusy(false);
    }
  }
  const alternativeKey = (product: FoodProduct) =>
    `${original?.gtin}:${product.gtin}`;
  const available = products.filter(
    (product) =>
      product.gtin !== original?.gtin &&
      !shopping.dismissed.includes(alternativeKey(product)) &&
      !kept.includes(product.id) &&
      !excludedIngredientText(
        `${product.name} ${product.ingredients}`,
        prefs,
      ) &&
      (prefs.brandFlexibility !== "usual" ||
        product.brand.toLowerCase() === original?.brand.toLowerCase()),
  );
  const score = (product: FoodProduct) => {
    if (!original) return 0;
    const difference = compareProducts(original, product);
    const a = observedPrice(original),
      b = observedPrice(product);
    const saving = a && b ? comparePrices(a, b, today()) : null;
    return prefs.shoppingPriority === "budget" ||
      (!prefs.shoppingPriority && prefs.budget === "economy")
      ? (saving?.percent ?? 0)
      : prefs.shoppingPriority === "protein"
        ? (difference?.protein ?? 0)
        : prefs.shoppingPriority === "less-sugar"
          ? (difference?.sugar ?? 0)
          : prefs.shoppingPriority === "calories"
            ? (difference?.calories ?? 0)
            : 0;
  };
  const unique = new Map<string, FoodProduct>();
  for (const product of available) {
    const prior = unique.get(product.gtin);
    if (
      !prior ||
      (product.source.updatedAt ?? "") > (prior.source.updatedAt ?? "")
    )
      unique.set(product.gtin, product);
  }
  const ranked = [...unique.values()].sort((a, b) => score(b) - score(a));
  if (reviewReceipt)
    return (
      <ReceiptReview
        receipt={reviewReceipt}
        sourceImage={receiptSourcePhoto(state, reviewReceipt.id)}
        onSave={saveReceipt}
        onClose={() => setReview(null)}
      />
    );
  return (
    <Modal title="Shop your way" onClose={onClose} wide>
      <div className="shopping-workspace">
        <div className="shopping-welcome">
          <ShoppingBasket size={27} />
          <div>
            <strong>A little more for your groceries.</strong>
            <p>
              {priorityLabels[prefs.shoppingPriority ?? "balanced"]} · Cooking
              for {prefs.householdSize}
            </p>
          </div>
          <button
            onClick={onPreferences}
            aria-label="Edit shopping preferences"
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>
        <div
          className="shopping-tabs"
          role="tablist"
          aria-label="Shopping tools"
        >
          {(["swaps", "list", "spending"] as const).map((value) => (
            <button
              role="tab"
              aria-selected={tab === value}
              key={value}
              onClick={() => {
                setTab(value);
                setNotice("");
              }}
            >
              {value === "swaps"
                ? "Smart swaps"
                : value === "list"
                  ? "Shopping list"
                  : "Your spending"}
            </button>
          ))}
        </div>
        {tab === "swaps" && (
          <section aria-label="Smart swaps">
            <h3>Your usual, with options.</h3>
            <p>
              Compare products for your goals. Your pantry stays as it is until
              you actually buy something.
            </p>
            {!choices.length ? (
              <div className="shopping-empty">
                <p>
                  First, check a grocery item against its package or scan its
                  barcode. A confirmed product gives us a useful starting point.
                </p>
                <button className="button secondary" onClick={onPantry}>
                  Review pantry products
                </button>
              </div>
            ) : (
              <>
                <label className="shopping-select">
                  What would you like to compare?
                  <select
                    value={selected}
                    onChange={(e) => {
                      generation.current++;
                      controller.current?.abort();
                      setBusy(false);
                      setSelected(e.target.value);
                      setProducts([]);
                      setNotice("");
                      setChecked([]);
                      setQuery(
                        choices
                          .find((choice) => choice.item.id === e.target.value)
                          ?.item.name.slice(0, 160) ?? "",
                      );
                    }}
                  >
                    <option value="">Choose a grocery item</option>
                    {choices.map(({ receipt, item }) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {receipt.store}
                      </option>
                    ))}
                  </select>
                </label>
                {original && (
                  <>
                    <form
                      className="shopping-search"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void search();
                      }}
                    >
                      <label>
                        Alternative product or category
                        <input
                          required
                          minLength={2}
                          maxLength={160}
                          value={query}
                          onChange={(e) => {
                            generation.current++;
                            controller.current?.abort();
                            setBusy(false);
                            setProducts([]);
                            setQuery(e.target.value);
                          }}
                        />
                      </label>
                      <button
                        className="button primary"
                        disabled={busy || query.trim().length < 2}
                      >
                        {busy ? "Looking…" : "Find swaps"}
                      </button>
                    </form>
                    <div className="shopping-original">
                      <small>YOUR CURRENT PRODUCT</small>
                      <strong>{original.name}</strong>
                      <span>
                        {original.brand} · {original.serving.label}
                      </span>
                      <PriceEditor
                        key={`${original.id}:${JSON.stringify(researched[original.id] ?? null)}`}
                        product={original}
                        value={displayedPrice(original)}
                        onSave={(price) => savePrice(original, price)}
                      />
                    </div>
                    {prefs.restrictions.length > 0 && (
                      <p className="shopping-muted">
                        Known conflicts with your exclusions are filtered.
                        Always check the package for allergens and suitability;
                        missing ingredient details cannot establish safety.
                      </p>
                    )}
                    {ranked.map((product) => {
                      const delta = compareProducts(original, product);
                      const a = observedPrice(original),
                        b = observedPrice(product);
                      const price =
                        a && b ? comparePrices(a, b, today()) : null;
                      const key = alternativeKey(product);
                      const added = shopping.list.some(
                        (item) => item.id === `swap:${key}` && !item.checked,
                      );
                      return (
                        <article className="shopping-swap" key={product.id}>
                          <div className="shopping-swap-top">
                            <ArrowRight size={20} />
                            <div>
                              <h4>{product.name}</h4>
                              <p>{product.brand || "Brand unavailable"}</p>
                            </div>
                          </div>
                          <div className="shopping-comparisons">
                            {delta ? (
                              <>
                                {delta.calories !== null && (
                                  <span>
                                    {Math.abs(delta.calories)}{" "}
                                    {delta.calories >= 0 ? "fewer" : "more"} cal
                                  </span>
                                )}
                                {delta.protein !== null && (
                                  <span>
                                    {delta.protein === 0
                                      ? "Same protein"
                                      : `${Math.abs(delta.protein)}g ${delta.protein > 0 ? "more" : "less"} protein`}
                                  </span>
                                )}
                                {delta.sugar !== null ? (
                                  <span>
                                    {Math.abs(delta.sugar)}g{" "}
                                    {delta.sugar >= 0 ? "less" : "more"} total
                                    sugar
                                  </span>
                                ) : (
                                  <span>Sugar not available</span>
                                )}
                                <small>
                                  Compared per 100 {delta.unit}. Total sugar is
                                  not added sugar.
                                </small>
                              </>
                            ) : (
                              <p>
                                Serving units cannot be compared reliably. Check
                                both packages.
                              </p>
                            )}
                          </div>
                          {price ? (
                            <p className="shopping-price-result">
                              {price.percent === 0
                                ? "Same unit price"
                                : `${Math.abs(price.percent)}% ${price.percent > 0 ? "lower" : "higher"} unit price`}{" "}
                              · {a.currency}
                              <small>
                                {a.store} ({a.date}) → {b.store} ({b.date}).{" "}
                                {a.conditions && `Original: ${a.conditions}. `}
                                {b.conditions &&
                                  `Alternative: ${b.conditions}.`}{" "}
                                Based on prices you checked; confirm at
                                checkout.
                              </small>
                            </p>
                          ) : (
                            <p className="shopping-muted">
                              Price savings unknown. Check both prices in the
                              same currency and units within the last seven
                              days.
                            </p>
                          )}
                          {product.source.url?.startsWith(
                            "https://fdc.nal.usda.gov/",
                          ) && (
                            <a
                              href={product.source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              USDA nutrition source
                            </a>
                          )}
                          <details>
                            <summary>Ingredients & label details</summary>
                            <p>
                              {product.ingredients ||
                                "Ingredients unavailable. Check the package."}
                            </p>
                            <p>
                              {product.serving.label} · Data updated{" "}
                              {product.source.updatedAt?.slice(0, 10) ||
                                "date unavailable"}
                            </p>
                          </details>
                          <PriceResearch
                            original={original}
                            alternative={product}
                            stores={[
                              ...new Set([
                                ...(prefs.preferredStores ?? []),
                                ...(current?.receipt.store
                                  ? [current.receipt.store]
                                  : []),
                              ]),
                            ]}
                            currency={prefs.shoppingCurrency}
                            onFound={(values) =>
                              setResearched((current) => ({
                                ...current,
                                ...values,
                              }))
                            }
                          />
                          <PriceEditor
                            key={`${product.id}:${JSON.stringify(researched[product.id] ?? null)}`}
                            product={product}
                            value={displayedPrice(product)}
                            onSave={(value) => savePrice(product, value)}
                          />
                          <label className="shopping-check">
                            <input
                              type="checkbox"
                              checked={checked.includes(product.id)}
                              onChange={(e) =>
                                setChecked((list) =>
                                  e.target.checked
                                    ? [...list, product.id]
                                    : list.filter((id) => id !== product.id),
                                )
                              }
                            />
                            This works for my household. I checked ingredients,
                            dietary needs and how I’ll use it.
                          </label>
                          <div className="shopping-swap-actions">
                            <button
                              className="button primary"
                              disabled={!checked.includes(product.id) || added}
                              onClick={() => {
                                updateShopping((s) => ({
                                  ...s,
                                  list: addShoppingItem(s.list, {
                                    id: `swap:${key}`,
                                    productId: product.id,
                                    name: product.name,
                                    quantity: "Check package size in store",
                                    checked: false,
                                    createdAt: new Date().toISOString(),
                                  }),
                                }));
                                setNotice(
                                  "Added to your shopping list. Your pantry and food log are unchanged.",
                                );
                              }}
                            >
                              {added ? (
                                <>
                                  <Check size={16} />
                                  On your list
                                </>
                              ) : (
                                "Add to shopping list"
                              )}
                            </button>
                            <button
                              className="text-button"
                              onClick={() =>
                                setKept((list) => [...list, product.id])
                              }
                            >
                              Keep my usual
                            </button>
                            <button
                              className="text-button"
                              onClick={() =>
                                updateShopping((s) => ({
                                  ...s,
                                  dismissed: [
                                    ...new Set([...s.dismissed, key]),
                                  ].slice(-1000),
                                }))
                              }
                            >
                              Don’t suggest this again
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {products.length > 0 && !ranked.length && (
                      <p>
                        No other candidates fit your saved choices in these
                        results. Try another description or review your shopping
                        preferences.
                      </p>
                    )}
                  </>
                )}
              </>
            )}
            {shopping.dismissed.length > 0 && (
              <button
                className="text-button"
                onClick={() => updateShopping((s) => ({ ...s, dismissed: [] }))}
              >
                Reset hidden swap suggestions
              </button>
            )}
          </section>
        )}
        {tab === "list" && (
          <section aria-label="Your shopping list">
            <h3>A list that’s yours.</h3>
            {needs.length > 0 && (
              <div className="shopping-original">
                <strong>From your latest meal plan</strong>
                {needs.map((need, index) => (
                  <p key={index}>
                    {need.name} ·{" "}
                    {need.servings === null
                      ? "Check pantry amount"
                      : formatIngredientAmount(
                          need.servings,
                          need.servingLabel,
                        )}
                  </p>
                ))}
                <button
                  className="button secondary"
                  disabled={!needs.some((need) => need.servings !== null)}
                  onClick={() => {
                    updateShopping((current) => ({
                      ...current,
                      list: needs
                        .filter((need) => need.servings !== null)
                        .reduce(
                          (list, need) =>
                            addShoppingItem(list, {
                              id: `plan:${state.mealPlans?.at(-1)?.id}:${need.name}:${need.servingLabel}`.slice(
                                0,
                                300,
                              ),
                              name: need.name,
                              quantity: formatIngredientAmount(
                                need.servings!,
                                need.servingLabel,
                              ).slice(0, 150),
                              checked: false,
                              createdAt: new Date().toISOString(),
                            }),
                          current.list,
                        ),
                    }));
                    setNotice(
                      "Known shopping needs added. Check uncertain pantry amounts before buying more.",
                    );
                  }}
                >
                  Add plan needs to my list
                </button>
              </div>
            )}
            <p>
              Check items off as you shop. Add your receipt afterward to update
              your pantry.
            </p>
            <form
              className="shopping-search"
              onSubmit={(event) => {
                event.preventDefault();
                const item = {
                  id: crypto.randomUUID(),
                  name: name.trim(),
                  quantity: quantity.trim(),
                  checked: false,
                  createdAt: new Date().toISOString(),
                };
                updateShopping((s) => ({
                  ...s,
                  list: addShoppingItem(s.list, item),
                }));
                setName("");
                setQuantity("");
              }}
            >
              <label>
                Item to buy
                <input
                  required
                  maxLength={300}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Amount or note
                <input
                  maxLength={150}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <button className="button primary">Add item</button>
            </form>
            {!shopping.list.length && (
              <p>Your list is ready for your first item or swap.</p>
            )}
            {shopping.list.map((item) => (
              <div className="shopping-list-row" key={item.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) =>
                      updateShopping((s) => ({
                        ...s,
                        list: s.list.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, checked: e.target.checked }
                            : entry,
                        ),
                      }))
                    }
                  />
                  <span>
                    <strong>{item.name}</strong>
                    <small>{item.quantity || "Amount not specified"}</small>
                  </span>
                </label>
                <button
                  aria-label={`Remove ${item.name} from list`}
                  onClick={() =>
                    updateShopping((s) => ({
                      ...s,
                      list: s.list.filter((entry) => entry.id !== item.id),
                    }))
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </section>
        )}
        {tab === "spending" && (
          <section aria-label="Grocery spending">
            <h3>Your grocery trips, together.</h3>
            <p>
              Only reviewed receipts count. This is recorded household spending,
              including nonfood purchases—not a complete account of everything
              you spent.
            </p>
            <div className="shopping-spend-total">
              {Object.entries(spending.totals).length ? (
                Object.entries(spending.totals).map(([currency, total]) => (
                  <strong key={currency}>
                    {formatMoney(total, currency)}{" "}
                    <small>{currency} · all saved receipts</small>
                  </strong>
                ))
              ) : (
                <strong>No reviewed totals yet</strong>
              )}
              <span>
                {spending.covered} reviewed · {spending.unpriced} with missing
                or unchecked totals
              </span>
            </div>
            {Object.entries(spending.stores).map(([store, totals]) => (
              <div className="shopping-store-row" key={store}>
                <strong>{store}</strong>
                <span>
                  {Object.entries(totals)
                    .map(
                      ([currency, total]) =>
                        `${formatMoney(total, currency)} ${currency}`,
                    )
                    .join(" · ")}
                </span>
              </div>
            ))}
            {receipts.map((receipt) => (
              <button
                className="shopping-trip"
                key={receipt.id}
                onClick={() => setReview(receipt.id)}
              >
                <span>
                  <strong>{receipt.store}</strong>
                  <small>
                    {receipt.purchase?.purchaseDate ??
                      "Purchase date needs a check"}{" "}
                    ·{" "}
                    {receipt.purchase?.confirmed
                      ? "Reviewed"
                      : "Review receipt amounts"}
                  </small>
                </span>
                <ArrowRight size={18} />
              </button>
            ))}
            <p className="shopping-muted">
              Your shopping history is private to your saved account or this
              device. No cross-user shopping analytics are collected by this
              feature.
            </p>
          </section>
        )}
        {notice && (
          <p role="status" className="shopping-notice">
            {notice}
          </p>
        )}
      </div>
    </Modal>
  );
}
