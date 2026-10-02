import type { AppState } from "../../domain";
import { getPantryLots } from "../pantry/ledger";
import { purchaseReceipts } from "../pantry/receipt-origin";
import { planShoppingList } from "./meal-plans";
import { unloggedPlan } from "./pantry-links";
import { receiptReadiness } from '../receipts/journey';

export function firstWeekSteps(state: AppState) {
  const lots = getPantryLots(state),
    plan = state.mealPlans?.at(-1);
  const readiness = receiptReadiness(state);
  const reviewed = readiness.ready > 0 && readiness.checks === 0;
  const needs = plan
    ? planShoppingList(
        unloggedPlan(
          plan,
          state.meals.map((meal) => meal.id),
        ),
        lots,
      )
    : [];
  return [
    {
      key: "preferences",
      title: "Make it your kind of week",
      detail: "Set household size, food restrictions, cooking time and budget.",
      done: !!state.preferences,
      action: "preferences",
    },
    {
      key: "receipt",
      title: "Give your groceries a job",
      detail: "Add a receipt to include purchase details. Manually entered pantry food already counts as stock.",
      done: purchaseReceipts(state.groceries ?? []).length > 0,
      action: "receipt",
    },
    {
      key: "pantry",
      title: "Check what came home",
      detail: "Confirm uncertain products and quantities before planning.",
      done: reviewed,
      action: "pantry",
    },
    {
      key: "plan",
      title: "Approve a week you want to eat",
      detail:
        "Review recipes, portions, nutrition coverage and estimated costs.",
      done: plan?.status === "approved",
      action: "planner",
    },
    {
      key: "shopping",
      title: "Close the grocery loop",
      detail:
        "Shop for missing ingredients, add the purchase, then connect it inside your plan.",
      done: !!plan && plan.status === "approved" && needs.length === 0,
      action: "shopping",
    },
    {
      key: "cook",
      title: "Cook it. Enjoy it. Tell Spot.",
      detail:
        "Review any cooking method and package guidance, then log a portion after eating. Your pantry updates once.",
      done:
        !!plan &&
        state.meals.some((meal) =>
          meal.id.startsWith(`pantry-meal:plan:${plan.id}:`),
        ),
      action: "planner",
    },
  ] as const;
}
