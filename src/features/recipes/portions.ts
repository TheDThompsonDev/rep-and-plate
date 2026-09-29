import type { AppState } from "../../domain";
import type { RecipeBatch } from "./contracts";
const quantity = (value: number) => Math.round(value * 10000) / 10000;
export function remainingRecipePortions(batch: RecipeBatch): number {
  if (batch.undoneAt) return 0;
  return quantity(
    batch.totalPortions -
      batch.consumptions
        .filter((entry) => !entry.reversedAt)
        .reduce((sum, entry) => sum + entry.portions, 0),
  );
}

/** Called before deleting a meal; restores cooked portions, never raw ingredients. */
export function restoreRecipePortion(
  state: AppState,
  mealId: string,
): AppState {
  if (
    !(state.recipeBatches || []).some((batch) =>
      batch.consumptions.some(
        (entry) => entry.mealId === mealId && !entry.reversedAt,
      ),
    )
  )
    return state;
  const reversedAt = new Date().toISOString();
  return {
    ...state,
    recipeBatches: (state.recipeBatches || []).map((batch) => ({
      ...batch,
      consumptions: batch.consumptions.map((entry) =>
        entry.mealId === mealId && !entry.reversedAt
          ? { ...entry, reversedAt }
          : entry,
      ),
    })),
    meals: state.meals.map((meal) =>
      meal.id === mealId
        ? { ...meal, recipeBatchId: undefined, recipePortions: undefined }
        : meal,
    ),
  };
}
