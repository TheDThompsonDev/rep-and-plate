import type { GroceryReceipt } from "../../ai-contract";
import type { PantryLot } from "../pantry/ledger";
import type { MealPlan } from "./contracts";
import { formatMoney } from "../shopping/shopping";
import {isPurchaseReceipt} from '../pantry/receipt-origin';

/** A quantity-based historical estimate, not a quote or a promise of checkout savings. */
export function estimatePlanBasket(
  plan: MealPlan,
  lots: PantryLot[],
  receipts: GroceryReceipt[],
  day: string,
) {
  const amounts = new Map<
    string,
    { lotId: string | null; servings: number; name: string }
  >();
  for (const entry of plan.days)
    for (const meal of entry.meals)
      for (const ingredient of meal.ingredients) {
        const key =
          ingredient.lotId ??
          `missing:${ingredient.name.toLowerCase()}:${ingredient.servingLabel.toLowerCase()}`;
        const previous = amounts.get(key);
        if (previous) previous.servings += ingredient.servings;
        else
          amounts.set(key, {
            lotId: ingredient.lotId,
            servings: ingredient.servings,
            name: ingredient.name,
          });
      }
  const totals: Record<string, number> = {};
  let covered = 0,
    priced = 0;
  const unknown: string[] = [];
  for (const amount of amounts.values()) {
    const lot = lots.find((item) => item.id === amount.lotId);
    if (
      !lot ||
      lot.inconsistent ||
      lot.remaining === null ||
      lot.item.needsReview
    ) {
      unknown.push(amount.name);
      continue;
    }
    const needed = Math.max(
      0,
      amount.servings -
        (lot.item.availability === "available" ? lot.remaining : 0),
    );
    if (!needed) {
      covered++;
      continue;
    }
    const receipt = receipts.find((item) => item.id === lot.receiptId&&isPurchaseReceipt(item)),
      purchase = receipt?.purchase;
    const price = lot.item.price?.total,
      quantity = lot.item.servingsPurchased;
    const age = purchase?.purchaseDate
      ? (Date.parse(day) - Date.parse(purchase.purchaseDate)) / 86400000
      : NaN;
    if (
      !purchase?.confirmed ||
      !purchase.currency ||
      !Number.isFinite(age) ||
      age < 0 ||
      age > 30 ||
      price == null ||
      !Number.isFinite(price) ||
      price < 0 ||
      !quantity ||
      quantity <= 0
    ) {
      unknown.push(amount.name);
      continue;
    }
    // Same reviewed purchase, same labeled servings. No inferred package sizes or density conversions.
    totals[purchase.currency] =
      (totals[purchase.currency] ?? 0) + (needed * price) / quantity;
    priced++;
  }
  for (const currency of Object.keys(totals))
    totals[currency] = Math.round(totals[currency] * 100) / 100;
  return {
    totals,
    covered,
    priced,
    unknown,
    total: amounts.size,
    complete: unknown.length === 0,
  };
}
export function basketSummary(
  result: ReturnType<typeof estimatePlanBasket>,
  budget?: number | null,
  currency?: string | null,
) {
  const prices = Object.entries(result.totals)
    .map(([code, total]) => formatMoney(total, code))
    .join(" + ");
  const amount = prices
    ? `${prices} estimated for the priced quantities still needed.`
    : "No priced additional quantities yet.";
  const coverage = `${result.covered} of ${result.total} ingredients covered by pantry stock; ${result.priced} additional ingredients priced; ${result.unknown.length} need a price or quantity check.`;
  const singleCurrency =
    Object.keys(result.totals).length <= 1 &&
    (!Object.keys(result.totals).length ||
      Object.hasOwn(result.totals, currency ?? ""));
  const known = currency ? (result.totals[currency] ?? 0) : 0;
  const budgetText =
    budget && currency
      ? singleCurrency && result.complete
        ? ` Compared with your ${formatMoney(budget, currency)} weekly budget: ${known > budget ? "the estimated additional quantities exceed it" : "these additional quantities fit"}. This excludes other shopping and package rounding.`
        : ` Your ${formatMoney(budget, currency)} budget cannot be assessed until prices and quantities in that currency are complete.`
      : "";
  return {
    amount,
    coverage,
    budgetText,
    note: "Based on reviewed receipt prices from the last 30 days. Shelf prices, full packages, tax and other groceries can change the checkout total.",
  };
}
