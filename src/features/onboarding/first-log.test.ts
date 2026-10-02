import { expect, it } from "vitest";
import { initialState } from "../../domain";
import { hasFirstLog } from "./first-log";

it("requires actual intake or movement, rather than setup, a purchase or an example", () => {
  const state = initialState();
  expect(hasFirstLog(state)).toBe(false);
  expect(
    hasFirstLog({
      ...state,
      meals: [
        {
          id: "m",
          day: "2026-10-02",
          time: "12:00",
          title: "Lunch",
          category: "Lunch",
          calories: 500,
          protein: 20,
          carbs: 50,
          fat: 15,
          source: "Sample meal",
          confidence: "confirmed",
          note: "",
        },
      ],
    }),
  ).toBe(false);
  expect(
    hasFirstLog({
      ...state,
      meals: [
        {
          id: "m",
          day: "2026-10-02",
          time: "12:00",
          title: "Lunch",
          category: "Lunch",
          calories: 500,
          protein: 20,
          carbs: 50,
          fat: 15,
          source: "Manual entry",
          confidence: "confirmed",
          note: "",
        },
      ],
    }),
  ).toBe(true);
  expect(
    hasFirstLog({
      ...state,
      activities: [
        { id: "a", day: "2026-10-02", title: "Walk", minutes: 15, note: "" },
      ],
    }),
  ).toBe(true);
});
