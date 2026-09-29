import { describe, expect, it } from "vitest";
import { initialState, stateSchema, type AppState } from "../../domain";
import { deleteMealWithPantry, getPantryLots } from "../pantry/ledger";
import {
  logRecipePortion,
  prepareRecipeBatch,
  undoRecipePreparation,
} from "./batches";
import { remainingRecipePortions } from "./portions";
import {
  recipePortionProposalSchema,
  resolveRecipePortionProposal,
} from "./proposals";

function fixture(): AppState {
  const base: AppState = {
    ...initialState(),
    meals: [],
    messages: [],
    recipeBatches: [],
    pantryEvents: [],
    groceries: [
      {
        id: "shop",
        fingerprint: "fixture",
        store: "Fixture market",
        date: "2026-09-25",
        note: "",
        sources: [],
        items: [
          {
            id: "oats",
            receiptText: "OATS",
            name: "Rolled oats",
            quantity: "1 bag",
            serving: "1/2 cup (40 g)",
            servingsPurchased: 10,
            nutrition: { calories: 150, protein: 5, carbs: 27, fat: 3 },
            match: "user",
            note: "",
            sources: [],
            needsReview: false,
            availability: "available",
          },
        ],
      },
    ],
  };
  const prepared = prepareRecipeBatch(base, {
    id: "batch",
    name: "Prepared oats",
    totalPortions: 4,
    ingredients: [{ lotId: "shop::oats", servings: 4 }],
  });
  return {
    ...prepared,
    messages: [
      ...prepared.messages,
      {
        id: "proposal",
        role: "assistant",
        text: "Check this portion.",
        time: "8:30 AM",
        recipePortionProposal: {
          batchId: "batch",
          portions: 1.5,
          category: "Breakfast",
          evidence: "I ate one and a half portions of the oats I prepared.",
        },
        recipePortionProposalStatus: "pending",
      },
    ],
  };
}

describe("reviewed prepared-batch proposals", () => {
  it("leaves a pending suggestion read-only until explicit approval", () => {
    const state = fixture();
    expect(state.meals).toEqual([]);
    expect(remainingRecipePortions(state.recipeBatches![0])).toBe(4);
    expect(getPantryLots(state)[0].remaining).toBe(6);
    const accepted = resolveRecipePortionProposal(state, "proposal", true);
    expect(accepted.meals).toHaveLength(1);
    expect(accepted.meals[0]).toMatchObject({
      id: "recipe-meal:chat:proposal",
      calories: 225,
      protein: 7.5,
      carbs: 40.5,
      fat: 4.5,
      category: "Breakfast",
      recipeBatchId: "batch",
      recipePortions: 1.5,
    });
    expect(remainingRecipePortions(accepted.recipeBatches![0])).toBe(2.5);
    expect(accepted.pantryEvents).toBe(state.pantryEvents);
    expect(
      accepted.messages.find((message) => message.id === "proposal")
        ?.recipePortionProposalStatus,
    ).toBe("accepted");
    expect(state.meals).toEqual([]);
  });
  it("dismisses without changing meals, ingredients, or prepared portions", () => {
    const state = fixture();
    const dismissed = resolveRecipePortionProposal(state, "proposal", false);
    expect(dismissed.meals).toBe(state.meals);
    expect(dismissed.pantryEvents).toBe(state.pantryEvents);
    expect(dismissed.recipeBatches).toBe(state.recipeBatches);
    expect(
      dismissed.messages.find((message) => message.id === "proposal")
        ?.recipePortionProposalStatus,
    ).toBe("dismissed");
    expect(resolveRecipePortionProposal(dismissed, "proposal", true)).toBe(
      dismissed,
    );
  });
  it("cannot consume twice after repeated acceptance or refresh", () => {
    const accepted = resolveRecipePortionProposal(fixture(), "proposal", true);
    expect(resolveRecipePortionProposal(accepted, "proposal", true)).toBe(
      accepted,
    );
    expect(resolveRecipePortionProposal(accepted, "proposal", false)).toBe(
      accepted,
    );
    const reloaded = stateSchema.parse(JSON.parse(JSON.stringify(accepted)));
    expect(resolveRecipePortionProposal(reloaded, "proposal", true)).toBe(
      reloaded,
    );
    expect(reloaded.meals).toHaveLength(1);
    expect(reloaded.recipeBatches![0].consumptions).toHaveLength(1);
  });
  it("uses a stable operation even when a pending status was retried after logging", () => {
    const logged = logRecipePortion(
      fixture(),
      "batch",
      1.5,
      "Breakfast",
      "chat:proposal",
    );
    const resolved = resolveRecipePortionProposal(logged, "proposal", true);
    expect(resolved.meals).toHaveLength(1);
    expect(resolved.recipeBatches![0].consumptions).toHaveLength(1);
    expect(remainingRecipePortions(resolved.recipeBatches![0])).toBe(2.5);
  });
  it("checks the latest amount left and keeps an insufficient-stock proposal pending", () => {
    const usedElsewhere = logRecipePortion(
      fixture(),
      "batch",
      3,
      "Lunch",
      "other",
    );
    const before = JSON.stringify(usedElsewhere);
    expect(() =>
      resolveRecipePortionProposal(usedElsewhere, "proposal", true),
    ).toThrow(/1 portions left/);
    expect(JSON.stringify(usedElsewhere)).toBe(before);
    expect(
      usedElsewhere.messages.find((message) => message.id === "proposal")
        ?.recipePortionProposalStatus,
    ).toBe("pending");
  });
  it("rejects a missing or undone batch but still allows dismissal", () => {
    const missing = { ...fixture(), recipeBatches: [] };
    expect(() =>
      resolveRecipePortionProposal(missing, "proposal", true),
    ).toThrow(/no longer available/);
    expect(
      resolveRecipePortionProposal(missing, "proposal", false).meals,
    ).toEqual([]);
    const undone = undoRecipePreparation(fixture(), "batch");
    expect(() =>
      resolveRecipePortionProposal(undone, "proposal", true),
    ).toThrow(/no longer available/);
  });
  it("restoring a previously accepted portion does not permit the old proposal to log again", () => {
    const accepted = resolveRecipePortionProposal(fixture(), "proposal", true);
    const removed = deleteMealWithPantry(accepted, accepted.meals[0].id);
    expect(remainingRecipePortions(removed.recipeBatches![0])).toBe(4);
    expect(resolveRecipePortionProposal(removed, "proposal", true)).toBe(
      removed,
    );
    const pendingAgain = {
      ...removed,
      messages: removed.messages.map((message) =>
        message.id === "proposal"
          ? { ...message, recipePortionProposalStatus: "pending" as const }
          : message,
      ),
    };
    expect(
      resolveRecipePortionProposal(pendingAgain, "proposal", true).meals,
    ).toEqual([]);
  });
  it("ignores unknown messages and proposals without an explicit pending status", () => {
    const state = fixture();
    expect(resolveRecipePortionProposal(state, "missing", true)).toBe(state);
    const noStatus = {
      ...state,
      messages: state.messages.map((message) => ({
        ...message,
        recipePortionProposalStatus: undefined,
      })),
    };
    expect(resolveRecipePortionProposal(noStatus, "proposal", true)).toBe(
      noStatus,
    );
  });
  it("validates batch identity, evidence, quantities, and category", () => {
    const proposal = fixture().messages.at(-1)!.recipePortionProposal!;
    expect(recipePortionProposalSchema.safeParse(proposal).success).toBe(true);
    for (const invalid of [
      { batchId: " " },
      { evidence: " " },
      { evidence: "x".repeat(501) },
      { portions: 0 },
      { portions: -1 },
      { portions: Infinity },
      { portions: 1001 },
      { category: "Second breakfast" },
    ]) {
      expect(
        recipePortionProposalSchema.safeParse({ ...proposal, ...invalid })
          .success,
      ).toBe(false);
    }
  });
});
