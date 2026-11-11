import { z } from 'zod';
import {
  householdNutritionSchema,
  type HouseholdMealProposal,
  type HouseholdNutrition,
  type HouseholdReservation,
  type SharedHouseholdBatch,
} from './contracts';

export const householdPortionsSchema = z.number().finite().positive().max(1000)
  .refine(value => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.000001,
    'Use at most four decimal places for portions.');

export function portionNutrition(perPortion: HouseholdNutrition, portions: number): HouseholdNutrition {
  householdNutritionSchema.parse(perPortion);
  householdPortionsSchema.parse(portions);
  const amount = (value: number) => Math.round(value * portions * 100) / 100;
  return {
    calories: amount(perPortion.calories), protein: amount(perPortion.protein),
    carbs: amount(perPortion.carbs), fat: amount(perPortion.fat),
  };
}

export function householdMealProposal(
  batch: SharedHouseholdBatch,
  reservation: HouseholdReservation,
): HouseholdMealProposal {
  if (reservation.batchId !== batch.id || reservation.householdId !== batch.householdId)
    throw Error('This portion belongs to a different shared meal.');
  if (reservation.status === 'released') throw Error('This portion has been returned to the household.');
  return {
    title: batch.title, portions: reservation.portions,
    nutrition: portionNutrition(batch.perPortion, reservation.portions),
    householdReservationId: reservation.id, householdBatchId: batch.id,
  };
}

/** Idempotent local transfer bookkeeping: a successful publish can be recovered after refresh. */
export function addHouseholdTransfer<T extends {
  totalPortions: number;
  householdTransfers?: { householdBatchId: string; portions: number }[];
  consumptions?: { portions: number; reversedAt?: string }[];
  undoneAt?: string;
}>(batch: T, householdBatchId: string, portions: number): T & {
  householdTransfers?: { householdBatchId: string; portions: number }[];
} {
  householdPortionsSchema.parse(portions);
  const transfers = batch.householdTransfers ?? [];
  const previous = transfers.find(transfer => transfer.householdBatchId === householdBatchId);
  if (previous) {
    if (previous.portions !== portions) throw Error('The shared quantity has changed. Refresh before continuing.');
    return batch;
  }
  if (batch.undoneAt) throw Error('This preparation has already been undone.');
  const consumed = (batch.consumptions ?? []).filter(item => !item.reversedAt).reduce((sum, item) => sum + item.portions, 0);
  if (consumed + transfers.reduce((sum, item) => sum + item.portions, 0) + portions > batch.totalPortions + 0.00001)
    throw Error('The shared quantity exceeds the available prepared portions.');
  return { ...batch, householdTransfers: [...transfers, { householdBatchId, portions }] };
}

export type PantryReviewCandidate = { id: string; name: string; uncertain: boolean };
/** Unrelated uncertain products can wait while the user resolves ingredients needed now. */
export function relevantPantryReviews(items: PantryReviewCandidate[], ingredientNames: string[]) {
  const words = (name: string) => name.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const needed = new Set(ingredientNames.flatMap(words).filter(word => word.length > 2));
  return items.filter(item => item.uncertain && words(item.name).some(word => needed.has(word)));
}
