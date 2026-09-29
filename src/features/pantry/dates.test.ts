import { describe, expect, it } from "vitest";
import { initialState, stateSchema, type AppState } from "../../domain";
import { getPantryLots } from "./ledger";
import { isCalendarDate } from "./date-contract";
import {
  pantryDateReminder,
  sortPantryByDate,
  updatePantryDates,
} from "./dates";

function fixture(): AppState {
  return {
    ...initialState(),
    groceries: [
      {
        id: "receipt",
        fingerprint: "date-fixture",
        date: "2026-09-25",
        store: "Fixture",
        note: "",
        sources: [],
        items: ["unknown", "soon", "past", "used"].map((id) => ({
          id,
          name: id,
          receiptText: id.toUpperCase(),
          quantity: "1 pack",
          serving: "1 cup",
          servingsPurchased: 4,
          nutrition: { calories: 100, protein: 3, carbs: 20, fat: 1 },
          availability:
            id === "used" ? ("used" as const) : ("available" as const),
          match: "user" as const,
          needsReview: false,
          note: "",
          sources: [],
        })),
      },
    ],
  };
}
const dates = (labelDate: string | null, openedDate: string | null = null) => ({
  labelKind: "best-before" as const,
  labelDate,
  openedDate,
});

describe("user-entered pantry dates", () => {
  it("validates actual calendar days including leap years", () => {
    expect(isCalendarDate("2024-02-29")).toBe(true);
    for (const invalid of [
      "2025-02-29",
      "2026-04-31",
      "2026-13-01",
      "09/25/2026",
      "2026-09-25T00:00:00Z",
    ])
      expect(isCalendarDate(invalid)).toBe(false);
  });
  it("preserves dates across storage validation, clears to unknown, and never mutates stock or intake", () => {
    const before = fixture();
    const next = updatePantryDates(
      before,
      "receipt",
      "soon",
      dates("2026-09-28", "2026-09-24"),
      "2026-09-25",
    );
    expect(stateSchema.parse(next).groceries![0].items[1].pantryDates).toEqual(
      dates("2026-09-28", "2026-09-24"),
    );
    expect(next.meals).toBe(before.meals);
    expect(next.pantryEvents).toBe(before.pantryEvents);
    expect(getPantryLots(next).map((lot) => lot.remaining)).toEqual(
      getPantryLots(before).map((lot) => lot.remaining),
    );
    expect(before.groceries![0].items[1].pantryDates).toBeUndefined();
    const cleared = updatePantryDates(
      next,
      "receipt",
      "soon",
      dates(null),
      "2026-09-25",
    );
    expect(cleared.groceries![0].items[1].pantryDates).toEqual(dates(null));
    expect(cleared.groceries![0].items[1].receiptText).toBe("SOON");
  });
  it("sorts active package dates before unknown dates without inferring an opened-date deadline", () => {
    let state = updatePantryDates(
      fixture(),
      "receipt",
      "soon",
      dates("2026-09-28"),
    );
    state = updatePantryDates(state, "receipt", "past", dates("2026-09-23"));
    state = updatePantryDates(state, "receipt", "used", dates("2026-09-01"));
    state = updatePantryDates(
      state,
      "receipt",
      "unknown",
      dates(null, "2026-01-01"),
    );
    const lots = getPantryLots(state);
    expect(sortPantryByDate(lots).map((lot) => lot.item.id)).toEqual([
      "past",
      "soon",
      "unknown",
      "used",
    ]);
    expect(lots.map((lot) => lot.item.id)).toEqual([
      "unknown",
      "soon",
      "past",
      "used",
    ]);
    expect(pantryDateReminder(lots[0], "2026-09-25")).toBeNull();
    expect(pantryDateReminder(lots[2], "2026-09-25")).toBe(
      "Best before: 2 days ago",
    );
    expect(pantryDateReminder(lots[3], "2026-09-25")).toBeNull();
  });
  it("includes seven days and today, excludes later dates and exhausted lots", () => {
    let state = updatePantryDates(fixture(), "receipt", "soon", {
      ...dates("2026-10-02"),
      labelKind: "use-by",
    });
    expect(pantryDateReminder(getPantryLots(state)[1], "2026-09-25")).toBe(
      "Use by: in 7 days",
    );
    expect(
      pantryDateReminder(getPantryLots(state)[1], "2026-09-24"),
    ).toBeNull();
    expect(pantryDateReminder(getPantryLots(state)[1], "2026-10-02")).toBe(
      "Use by: today",
    );
    state = {
      ...state,
      pantryEvents: [
        {
          id: "used-up",
          lotId: "receipt::soon",
          kind: "consumed",
          servings: -4,
          createdAt: "2026-09-25T12:00:00Z",
          note: "",
          mealId: "meal",
        },
      ],
    };
    expect(
      pantryDateReminder(getPantryLots(state)[1], "2026-09-25"),
    ).toBeNull();
  });
  it("rejects nonexistent dates/items and future opened dates without losing other item corrections", () => {
    const state = fixture();
    expect(() =>
      updatePantryDates(state, "receipt", "soon", dates("2026-02-30")),
    ).toThrow("valid dates");
    expect(() =>
      updatePantryDates(
        state,
        "receipt",
        "soon",
        dates(null, "2026-09-26"),
        "2026-09-25",
      ),
    ).toThrow("future");
    expect(() =>
      updatePantryDates(state, "receipt", "removed", dates(null)),
    ).toThrow("no longer");
    state.groceries![0].items[1].name = "Corrected name";
    const updated = updatePantryDates(
      state,
      "receipt",
      "soon",
      dates("2026-09-29"),
    );
    expect(updated.groceries![0].items[1].name).toBe("Corrected name");
  });
});
