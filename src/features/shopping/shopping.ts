import type { GroceryReceipt } from "../../ai-contract";
import type { FoodProduct } from "../products/contracts";
import type { AppState } from "../../domain";
import { getPantryLots } from "../pantry/ledger";
import {purchaseReceipts} from '../pantry/receipt-origin';
export {purchaseReceipts} from '../pantry/receipt-origin';
import { planShoppingList, type ShoppingNeed } from "../planning/meal-plans";
import {
  priceObservationSchema,
  shoppingItemSchema,
  type PriceObservation,
  type ShoppingItem,
} from "./contracts";

export function receiptSpending(receipts: GroceryReceipt[]) {
  const purchases=purchaseReceipts(receipts);
  const totals: Record<string, number> = Object.create(null);
  const stores: Record<string, Record<string, number>> = Object.create(null);
  let unpriced = 0;
  for (const receipt of purchases) {
    const p = receipt.purchase;
    if (!p?.confirmed || p.total === null || !p.currency) {
      unpriced++;
      continue;
    }
    totals[p.currency] =
      Math.round(((totals[p.currency] ?? 0) + p.total) * 100) / 100;
    const store = receipt.store.trim() || "Store not identified";
    stores[store] ??= Object.create(null);
    stores[store][p.currency] =
      Math.round(((stores[store][p.currency] ?? 0) + p.total) * 100) / 100;
  }
  return { totals, stores, unpriced, covered: purchases.length - unpriced };
}

/** Checked receipts can supply price evidence only when the whole purchased amount is known. */
export function receiptPrice(
  receipts: GroceryReceipt[],
  product: FoodProduct,
): PriceObservation | undefined {
  const observations = purchaseReceipts(receipts).flatMap((receipt) => {
    const purchase = receipt.purchase;
    if (!purchase?.confirmed || !purchase.currency || !purchase.purchaseDate)
      return [];
    return receipt.items.flatMap((item) => {
      const snapshot = item.productSnapshot;
      if (
        !snapshot ||
        snapshot.gtin !== product.gtin ||
        item.needsReview ||
        !item.servingsPurchased ||
        !snapshot.serving.amount ||
        item.price?.total == null ||
        !["g", "ml"].includes(snapshot.serving.unit)
      )
        return [];
      const parsed = priceObservationSchema.safeParse({
        price: item.price.total,
        amount: item.servingsPurchased * snapshot.serving.amount,
        unit: snapshot.serving.unit,
        currency: purchase.currency,
        date: purchase.purchaseDate,
        store: receipt.store,
        conditions:
          "Historical receipt price; current shelf price and discount eligibility may differ.",
        confirmed: true,
      });
      return parsed.success ? [parsed.data] : [];
    });
  });
  return observations.sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function remainingPlanNeeds(
  state: AppState,
  day: string,
): ShoppingNeed[] {
  const plan = state.mealPlans?.at(-1);
  if (!plan) return [];
  const remaining = {
    ...plan,
    days: plan.days
      .filter((entry) => entry.date >= day)
      .map((entry) => ({
        ...entry,
        meals: entry.meals.filter(
          (meal) =>
            !state.meals.some(
              (saved) => saved.id === `pantry-meal:plan:${plan.id}:${meal.id}`,
            ),
        ),
      })),
  };
  return planShoppingList(remaining, getPantryLots(state));
}

function standardized(product: FoodProduct) {
  const unit = product.serving.unit.toLowerCase();
  if (!["g", "ml"].includes(unit) || product.verification === "estimated")
    return null;
  if (
    (product.basis === "100g" && unit !== "g") ||
    (product.basis === "100ml" && unit !== "ml")
  )
    return null;
  const amount = product.basis === "serving" ? product.serving.amount : 100;
  if (!amount || amount <= 0) return null;
  const scale = (value: number | null | undefined) =>
    value == null ? null : (value / amount) * 100;
  return {
    unit,
    calories: scale(product.nutrition.calories),
    protein: scale(product.nutrition.protein),
    sugar: scale(product.sugars?.total),
  };
}
/** Numeric differences only. Category, taste, price and dietary suitability are not inferred. */
export function compareProducts(
  original: FoodProduct,
  alternative: FoodProduct,
) {
  const a = standardized(original),
    b = standardized(alternative);
  if (!a || !b || a.unit !== b.unit) return null;
  const difference = (x: number | null, y: number | null) =>
    x === null || y === null ? null : Math.round((x - y) * 100) / 100;
  return {
    unit: a.unit,
    calories: difference(a.calories, b.calories),
    sugar: difference(a.sugar, b.sugar),
    protein: difference(b.protein, a.protein),
  };
}
export function comparePrices(
  a: PriceObservation,
  b: PriceObservation,
  day: string,
) {
  if (
    !priceObservationSchema.safeParse(a).success ||
    !priceObservationSchema.safeParse(b).success
  )
    return null;
  const fresh = (date: string) => {
    const age = (Date.parse(day) - Date.parse(date)) / 86400000;
    return age >= 0 && age <= 7;
  };
  if (
    !a.confirmed ||
    !b.confirmed ||
    a.currency !== b.currency ||
    a.unit !== b.unit ||
    !fresh(a.date) ||
    !fresh(b.date) ||
    a.price <= 0
  )
    return null;
  const first = a.price / a.amount,
    second = b.price / b.amount;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
  return {
    percent: Math.round(((first - second) / first) * 100),
    per100: Math.round((first - second) * 10000) / 100,
    currency: a.currency,
    unit: a.unit,
  };
}
export function addShoppingItem(list: ShoppingItem[], value: ShoppingItem) {
  const item = shoppingItemSchema.parse(value);
  if (list.some((entry) => entry.id === item.id && !entry.checked)) return list;
  if (list.length >= 300)
    throw new Error("Your list is full. Remove a few completed items first.");
  return [...list.filter((entry) => entry.id !== item.id), item];
}
export function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}
