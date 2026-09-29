import type { Nutrition } from "../../domain";
import type { MealComponent } from "./contracts";

export function scaleNutrition(
  nutrition: Nutrition,
  servings: number,
): Nutrition {
  if (!Number.isFinite(servings) || servings <= 0 || servings > 10000)
    throw new Error("Choose a positive serving quantity.");
  return Object.fromEntries(
    Object.entries(nutrition).map(([key, value]) => [
      key,
      Math.round(value * servings * 100) / 100,
    ]),
  ) as Nutrition;
}

/** The same math applies to milk, syrups, cooking oil, and solid ingredients. */
export function componentNutrition(components: MealComponent[]): Nutrition {
  const total = components.reduce(
    (sum, component) => ({
      calories: sum.calories + component.nutrition.calories,
      protein: sum.protein + component.nutrition.protein,
      carbs: sum.carbs + component.nutrition.carbs,
      fat: sum.fat + component.nutrition.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return Object.fromEntries(
    Object.entries(total).map(([key, value]) => [
      key,
      Math.round(value * 100) / 100,
    ]),
  ) as Nutrition;
}
