import type { AppState } from "../../domain";
import type { PantryLot } from "./ledger";
import {
  isCalendarDate,
  pantryDatesSchema,
  type PantryDates,
} from "./date-contract";

export function localCalendarDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

const dayNumber = (value: string) =>
  Date.parse(`${value}T00:00:00Z`) / 86400000;
export const packageDateLabel = (kind: PantryDates["labelKind"]) =>
  kind === "use-by" ? "Use by" : "Best before";
export function displayCalendarDate(value: string): string {
  if (!isCalendarDate(value)) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function hasPantryStock(lot: PantryLot): boolean {
  return lot.item.availability !== "used" && lot.remaining !== 0;
}

export function pantryDateReminder(
  lot: PantryLot,
  today = localCalendarDay(),
): string | null {
  const date = lot.item.pantryDates?.labelDate;
  if (
    !hasPantryStock(lot) ||
    !date ||
    !isCalendarDate(date) ||
    !isCalendarDate(today)
  )
    return null;
  const days = dayNumber(date) - dayNumber(today);
  if (days > 7) return null;
  const label = packageDateLabel(lot.item.pantryDates!.labelKind);
  return `${label}: ${days < 0 ? `${Math.abs(days)} ${days === -1 ? "day" : "days"} ago` : days === 0 ? "today" : `in ${days} ${days === 1 ? "day" : "days"}`}`;
}

/** Unknown dates stay unknown; dates never change stock, meal totals, or availability. */
export function sortPantryByDate(lots: PantryLot[]): PantryLot[] {
  return [...lots].sort((a, b) => {
    const stockDifference =
      Number(hasPantryStock(b)) - Number(hasPantryStock(a));
    if (stockDifference) return stockDifference;
    const aDate = a.item.pantryDates?.labelDate;
    const bDate = b.item.pantryDates?.labelDate;
    return (
      (aDate && isCalendarDate(aDate) ? dayNumber(aDate) : Infinity) -
        (bDate && isCalendarDate(bDate) ? dayNumber(bDate) : Infinity) || 0
    );
  });
}

export function updatePantryDates(
  state: AppState,
  receiptId: string,
  itemId: string,
  input: PantryDates,
  today = localCalendarDay(),
): AppState {
  const result = pantryDatesSchema.safeParse(input);
  if (!result.success)
    throw new Error("Enter valid dates, or leave them blank if unknown.");
  if (result.data.openedDate && result.data.openedDate > today)
    throw new Error("The opened date cannot be in the future.");
  const receipt = state.groceries?.find((entry) => entry.id === receiptId);
  if (!receipt?.items.some((item) => item.id === itemId))
    throw new Error("This pantry item is no longer available.");
  return {
    ...state,
    groceries: state.groceries!.map((entry) =>
      entry.id !== receiptId
        ? entry
        : {
            ...entry,
            items: entry.items.map((item) =>
              item.id !== itemId ? item : { ...item, pantryDates: result.data },
            ),
          },
    ),
  };
}
