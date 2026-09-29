import { describe, expect, it } from "vitest";
import {
  initialState,
  demoState,
  interpretText,
  resolveReview,
  stateSchema,
  sumNutrition,
  today,
  upgradeChat,
} from "./domain";

describe("daily records", () => {
  it("starts with a neutral profile while preserving saved profile names", () => {
    expect(initialState().profile.name).toBe("friend");
    const saved = demoState();
    saved.profile.name = "Alex";
    expect(upgradeChat(saved).profile.name).toBe("Alex");
  });
  it("calculates totals from records for the requested local day", () => {
    const state = initialState();
    state.meals = demoState().meals.map((meal, index) => ({
      ...meal,
      id: `personal-${index}`,
      source: "Your logged meal",
      example: false,
    }));
    expect(sumNutrition(state.meals)).toEqual({
      calories: 1970,
      protein: 107,
      carbs: 198,
      fat: 84,
    });
    state.meals.push({ ...state.meals[0], id: "older", day: "2000-01-01" });
    expect(sumNutrition(state.meals).calories).toBe(1970);
    state.meals[0].calories = 500;
    expect(sumNutrition(state.meals).calories).toBe(2080);
  });
  it("resolves review idempotently without adding yesterday’s meal to today", () => {
    const original = demoState();
    const next = resolveReview(original, "review-protein", "Chicken");
    expect(next.reviews[0].resolved).toBe(true);
    expect(next.meals).toHaveLength(5);
    expect(next.meals[4].day).not.toBe(today());
    expect(sumNutrition(next.meals).calories).toBe(0);
    expect(resolveReview(next, "review-protein", "Steak")).toBe(next);
    expect(original.reviews[0].resolved).toBe(false);
  });
  it("does not record calories for fries that were not eaten", () => {
    const state = demoState();
    expect(resolveReview(state, "review-fries", "None").meals).toHaveLength(4);
    expect(
      resolveReview(state, "review-fries", "About half").meals.at(-1)?.calories,
    ).toBe(180);
    expect(resolveReview(state, "review-fries", "unexpected")).toBe(state);
  });
});

describe("bounded demo interpretation", () => {
  it("parses only supported affirmative captures", () => {
    expect(interpretText("Protein shake after the gym")).toEqual({
      kind: "meal",
      key: "shake",
    });
    expect(interpretText("Bench was 185 for 8, 8, 7")).toEqual({
      kind: "workout",
      weight: 185,
      reps: [8, 8, 7],
    });
    expect(interpretText("I did not have a protein shake")).toEqual({
      kind: "unknown",
    });
    expect(interpretText("Two protein shakes and a banana")).toEqual({
      kind: "unknown",
    });
    expect(interpretText("Bench was 9999 for 8, 8, 7")).toEqual({
      kind: "unknown",
    });
    expect(interpretText("Chicken rice and broccoli")).toEqual({
      kind: "meal",
      key: "dinner",
    });
  });
  it("validates snapshots and rejects invalid nutrition", () => {
    expect(stateSchema.safeParse(initialState()).success).toBe(true);
    const state = demoState();
    state.meals[0].calories = -10;
    expect(stateSchema.safeParse(state).success).toBe(false);
  });
});

describe("chat upgrade", () => {
  it("marks the chat migration without replacing old conversations or adding example meals", () => {
    const old = demoState();
    delete old.chatRevision;
    old.meals = old.meals.filter((m) => m.id !== "chat-demo-dinner");
    old.meals[0].calories = 450;
    old.messages = [
      {
        id: "intro",
        role: "assistant",
        text: "Old demo intro",
        time: "12:45 PM",
      },
      { id: "my-capture", role: "user", text: "My own note", time: "7:00 PM" },
    ];
    const next = upgradeChat(old);
    expect(next.messages).toEqual(old.messages);
    expect(next.messages.at(-1)?.text).toBe("My own note");
    expect(next.meals[0].calories).toBe(450);
    expect(next.meals.filter((m) => m.id === "chat-demo-dinner")).toHaveLength(
      0,
    );
    expect(upgradeChat(next)).toBe(next);
  });
});
