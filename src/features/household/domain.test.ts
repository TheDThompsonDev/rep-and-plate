import { describe, expect, it } from 'vitest';
import { householdMealProposal, householdPortionsSchema, addHouseholdTransfer, portionNutrition, relevantPantryReviews } from './domain';
import type { HouseholdReservation, SharedHouseholdBatch } from './contracts';

const batch: SharedHouseholdBatch = {
  id: '11111111-1111-4111-8111-111111111111',
  householdId: '22222222-2222-4222-8222-222222222222',
  title: 'Chicken and rice', totalPortions: 6, remainingPortions: 4,
  perPortion: { calories: 420, protein: 35, carbs: 44, fat: 12 }, sourceBatchId: null,
};
const reservation: HouseholdReservation = {
  id: '33333333-3333-4333-8333-333333333333', householdId: batch.householdId,
  batchId: batch.id, portions: 0.5, status: 'reserved',
};

describe('shared household meal snapshots', () => {
  it('logs a fractional personal portion without changing the shared preparation snapshot', () => {
    const proposal = householdMealProposal(batch, reservation);
    expect(proposal.nutrition).toEqual({ calories: 210, protein: 17.5, carbs: 22, fat: 6 });
    expect(proposal.householdReservationId).toBe(reservation.id);
    expect(batch.perPortion.calories).toBe(420);
    expect(batch.remainingPortions).toBe(4);
  });
  it('rejects another batch or household and a released reservation', () => {
    expect(() => householdMealProposal(batch, { ...reservation, batchId: 'other' })).toThrow('different shared meal');
    expect(() => householdMealProposal(batch, { ...reservation, householdId: 'other' })).toThrow('different shared meal');
    expect(() => householdMealProposal(batch, { ...reservation, status: 'released' })).toThrow('returned');
  });
  it('can safely reconstruct an already logged proposal for idempotent recovery', () => {
    expect(householdMealProposal(batch, { ...reservation, status: 'logged' }).householdReservationId).toBe(reservation.id);
  });
  it('keeps portion arithmetic finite and rejects unsupported precision', () => {
    for (const value of [0, -1, Infinity, NaN, 1001, 0.00001]) expect(householdPortionsSchema.safeParse(value).success).toBe(false);
    expect(householdPortionsSchema.safeParse(0.125).success).toBe(true);
    expect(portionNutrition({ calories: 12.345, protein: 1, carbs: 2, fat: 3 }, 0.5).calories).toBe(6.17);
  });
  it('recovers a successful publish once without moving personal stock twice', () => {
    const original = { totalPortions: 6, name: 'Dinner' };
    const transferred = addHouseholdTransfer(original, batch.id, 4);
    expect(transferred.householdTransfers).toEqual([{ householdBatchId: batch.id, portions: 4 }]);
    expect(addHouseholdTransfer(transferred, batch.id, 4)).toBe(transferred);
    expect(original).toEqual({ totalPortions: 6, name: 'Dinner' });
    expect(() => addHouseholdTransfer(transferred, batch.id, 3)).toThrow('changed');
    expect(() => addHouseholdTransfer(transferred, 'another', 3)).toThrow('exceeds');
    expect(() => addHouseholdTransfer({ totalPortions: 6, consumptions: [{ portions: 3 }] }, batch.id, 4)).toThrow('exceeds');
    expect(() => addHouseholdTransfer({ totalPortions: 6, undoneAt: '2026-11-08' }, batch.id, 1)).toThrow('undone');
  });
  it('focuses pantry questions on the ingredients needed for the chosen meal', () => {
    expect(relevantPantryReviews([
      { id: 'rice', name: 'Brown rice', uncertain: true },
      { id: 'milk', name: 'Whole milk', uncertain: true },
      { id: 'chicken', name: 'Chicken breast', uncertain: false },
    ], ['Rice', 'Chicken'])).toEqual([{ id: 'rice', name: 'Brown rice', uncertain: true }]);
    expect(relevantPantryReviews([{ id: 'milk', name: 'Milk', uncertain: true }], [])).toEqual([]);
  });
});
