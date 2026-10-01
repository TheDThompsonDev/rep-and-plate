import type { PantryLot } from "../pantry/ledger";
import type { FoodPreferences } from "../preferences/contracts";
import { mealPlanSchema, type MealPlan, type PlannedMeal } from "./contracts";
import { excludedIngredient } from "./meal-plans";

type Ingredient = PlannedMeal["ingredients"][number];
const normalized = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

/** Only unambiguous physical units are converted. Cups, cooked/raw yield and density need review. */
function physicalAmount(label: string) {
  const match = label
    .trim()
    .toLowerCase()
    .match(/^(?:(\d+(?:\.\d+)?)\s*)?(g|kg|mg|ml|l|oz|lb)$/);
  if (!match) return null;
  const units: Record<string, { basis: string; scale: number }> = {
    g: { basis: "mass", scale: 1 },
    kg: { basis: "mass", scale: 1000 },
    mg: { basis: "mass", scale: 0.001 },
    oz: { basis: "mass", scale: 28.349523125 },
    lb: { basis: "mass", scale: 453.59237 },
    ml: { basis: "volume", scale: 1 },
    l: { basis: "volume", scale: 1000 },
  };
  const unit = units[match[2]],
    amount = Number(match[1] ?? 1) * unit.scale;
  return amount > 0 ? { basis: unit.basis, amount } : null;
}
export function suggestedLinkedServings(
  ingredient: Ingredient,
  lot: PantryLot,
): number | null {
  if (normalized(ingredient.servingLabel) === normalized(lot.item.serving))
    return ingredient.servings;
  const from = physicalAmount(ingredient.servingLabel),
    to = physicalAmount(lot.item.serving);
  if (!from || !to || from.basis !== to.basis) return null;
  return (
    Math.round(((ingredient.servings * from.amount) / to.amount) * 10000) /
    10000
  );
}
export function linkablePantryLots(
  lots: PantryLot[],
  preferences: FoodPreferences,
) {
  return lots.filter(
    (lot) =>
      lot.item.availability === "available" &&
      !lot.inconsistent &&
      !lot.item.needsReview &&
      lot.remaining !== null &&
      lot.remaining > 0 &&
      !excludedIngredient(
        `${lot.item.name} ${lot.item.productSnapshot?.ingredients ?? ""}`,
        preferences,
      ),
  );
}

/** Rebinding changes only the reviewed plan ingredient, never stock, intake or logged meal identities. */
export function linkPlannedIngredient(
  plan: MealPlan,
  mealId: string,
  index: number,
  lotId: string,
  servings: number,
  context: {
    lots: PantryLot[];
    preferences: FoodPreferences;
    loggedMealIds: string[];
    confirmed: boolean;
  },
): MealPlan {
  if (!context.confirmed)
    throw new Error(
      "Confirm the product, preparation state and labeled serving amount first.",
    );
  if (context.loggedMealIds.includes(`pantry-meal:plan:${plan.id}:${mealId}`))
    throw new Error(
      "This meal is already logged. Its ingredient history cannot be replaced.",
    );
  const meal = plan.days
    .flatMap((day) => day.meals)
    .find((item) => item.id === mealId);
  if (!meal || !Number.isInteger(index) || !meal.ingredients[index])
    throw new Error("Choose an ingredient in this plan.");
  const lot = linkablePantryLots(context.lots, context.preferences).find(
    (item) => item.id === lotId,
  );
  if (!lot)
    throw new Error(
      "Review this pantry product and its available quantity first.",
    );
  if (!Number.isFinite(servings) || servings <= 0 || servings > 1000)
    throw new Error("Enter the labeled servings needed for the whole recipe.");
  return mealPlanSchema.parse({
    ...plan,
    status: "draft",
    days: plan.days.map((day) => ({
      ...day,
      meals: day.meals.map((item) =>
        item.id === mealId
          ? {
              ...item,
              ...(item.cookingMethod?{cookingMethod:{...item.cookingMethod,reviewed:false}}:{}),
              ingredients: item.ingredients.map((ingredient, i) =>
                i === index
                  ? {
                      lotId: lot.id,
                      name: lot.item.name,
                      servingLabel: lot.item.serving,
                      servings,
                    }
                  : ingredient,
              ),
            }
          : item,
      ),
    })),
  });
}

/** Exclude logged meals from future stock and basket requirements without changing the stored plan. */
export function unloggedPlan(plan: MealPlan, loggedMealIds: string[]) {
  const logged = new Set(loggedMealIds);
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      meals: day.meals.filter(
        (meal) => !logged.has(`pantry-meal:plan:${plan.id}:${meal.id}`),
      ),
    })),
  };
}
