import { afterEach, describe, expect, it, vi } from "vitest";
import {
  demoState,
  initialState,
  makeMeal,
  readState,
  stateSchema,
  STORAGE_KEY,
  sumNutrition,
  upgradeChat,
} from "./domain";
import * as domain from "./domain";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("personal days and example records", () => {
  it("recognizes old local demo estimates without hiding real meals by name", () => {
    const meal = { ...demoState().meals[0], source: 'Text: I had a protein shake', note: 'Demo estimate for one scoop with water. Edit to match your brand and portion.' };
    expect(domain.isExampleMeal(meal)).toBe(true);
    const personal = { ...meal, title: 'Sample platter', source: 'User entry', note: 'My own portions' };
    expect(domain.isExampleMeal(personal)).toBe(false);
  });
  it("starts fresh with zero personal nutrition, no reviews, and a welcome instead of a sample conversation", () => {
    const state = initialState();
    expect(sumNutrition(state.meals)).toEqual({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    expect(state.meals).toEqual([]);
    expect(state.reviews).toEqual([]);
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toMatchObject({ role: "assistant" });
    expect(state.messages[0].mealId).toBeUndefined();
    expect(state.messages[0].text).toMatch(/photo|message|tell/i);
    expect(state.chatRevision).toBe(3);
  });
  it("never counts persisted examples while preserving personal meals across days and migration", () => {
    const state = demoState();
    const current = {
      ...state.meals[0],
      id: "personal-today",
      source: "Your meal",
      day: "2026-09-26",
      calories: 230,
      protein: 11,
      carbs: 30,
      fat: 6,
    };
    const yesterday = {
      ...current,
      id: "personal-yesterday",
      day: "2026-09-25",
      calories: 450,
    };
    const editedExample = {
      ...state.meals[0],
      day: "2026-09-26",
      calories: 777,
      note: "Preserve my edit",
    };
    state.meals = [current, yesterday, editedExample];
    state.messages = [
      {
        id: "intro",
        role: "assistant",
        text: "Keep this prior conversation",
        time: "9:00 AM",
      },
      {
        id: "my-note",
        role: "user",
        text: "My actual meal note",
        time: "9:01 AM",
      },
    ];
    state.chatRevision = 1;
    const before = structuredClone(state);
    const upgraded = upgradeChat(state);
    expect(upgraded.chatRevision).toBe(3);
    expect(upgraded.meals).toEqual(before.meals);
    expect(upgraded.messages).toEqual(before.messages);
    expect(upgraded.reviews).toEqual(before.reviews);
    expect(state).toEqual(before);
    expect(upgradeChat(upgraded)).toBe(upgraded);
    expect(sumNutrition(upgraded.meals, "2026-09-26")).toEqual({
      calories: 230,
      protein: 11,
      carbs: 30,
      fat: 6,
    });
    expect(sumNutrition(upgraded.meals, "2026-09-25").calories).toBe(450);
    const storage = {
      getItem: vi.fn(() => JSON.stringify(state)),
      setItem: vi.fn(),
    };
    vi.stubGlobal("localStorage", storage);
    expect(readState()).toEqual(upgraded);
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(storage.setItem).not.toHaveBeenCalled();
  });
  it("identifies explicit or anchored examples without suppressing personal meal names and IDs", () => {
    const base = {
      ...demoState().meals[0],
      source: "Your meal",
      id: "breakfast",
      title: "Sample toast at Demo Cafe",
    };
    expect(domain.isExampleMeal(base)).toBe(false);
    expect(
      domain.isExampleMeal({ ...base, source: "Food from Sample Market" }),
    ).toBe(false);
    expect(
      domain.isExampleMeal({ ...base, source: "Sample meal · photo estimate" }),
    ).toBe(true);
    expect(
      domain.isExampleMeal({ ...base, source: "Demo estimate · nutrition" }),
    ).toBe(true);
    expect(domain.isExampleMeal({ ...base, example: true })).toBe(true);
    const generated = makeMeal("shake", "Typed locally");
    expect(generated.example).toBe(true);
    expect(
      stateSchema.parse({ ...initialState(), meals: [generated] }).meals[0]
        .example,
    ).toBe(true);
    expect(sumNutrition([generated]).calories).toBe(0);
    expect(domain.personalMeals([base, generated])).toEqual([base]);
    expect(domain.personalMeals([base, generated], "1900-01-01")).toEqual([]);
  });
  it("refreshes at local midnight, reschedules on wake, and removes every timer and event listener", async () => {
    const { subscribeLocalDay } = await import("./useLocalDay");
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 26, 23, 59, 59));
    const windowTarget = new EventTarget();
    const documentTarget = Object.assign(new EventTarget(), {
      visibilityState: "visible",
    });
    vi.stubGlobal("window", windowTarget);
    vi.stubGlobal("document", documentTarget);
    const changed = vi.fn();
    const cleanup = subscribeLocalDay(changed);
    expect(changed).toHaveBeenLastCalledWith("2026-09-26");
    changed.mockClear();
    vi.advanceTimersByTime(999);
    expect(changed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(changed).toHaveBeenLastCalledWith("2026-09-27");
    expect(vi.getTimerCount()).toBe(1);
    vi.setSystemTime(new Date(2026, 8, 29, 8));
    windowTarget.dispatchEvent(new Event("focus"));
    expect(changed).toHaveBeenLastCalledWith("2026-09-29");
    vi.setSystemTime(new Date(2026, 8, 30, 8));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(changed).toHaveBeenLastCalledWith("2026-09-30");
    vi.setSystemTime(new Date(2026, 9, 1, 8));
    windowTarget.dispatchEvent(new Event("pageshow"));
    expect(changed).toHaveBeenLastCalledWith("2026-10-01");
    expect(vi.getTimerCount()).toBe(1);
    cleanup();
    changed.mockClear();
    windowTarget.dispatchEvent(new Event("focus"));
    windowTarget.dispatchEvent(new Event("pageshow"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(86400000);
    expect(changed).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("schedules the next local midnight correctly across daylight-saving changes", async () => {
    const { millisecondsUntilNextLocalDay } = await import("./useLocalDay");
    vi.stubEnv("TZ", "America/New_York");
    expect(millisecondsUntilNextLocalDay(new Date(2026, 2, 8, 0))).toBe(
      23 * 60 * 60 * 1000,
    );
    expect(millisecondsUntilNextLocalDay(new Date(2026, 10, 1, 0))).toBe(
      25 * 60 * 60 * 1000,
    );
    expect(
      millisecondsUntilNextLocalDay(new Date(2026, 8, 26, 23, 59, 59)),
    ).toBe(1000);
  });
});
