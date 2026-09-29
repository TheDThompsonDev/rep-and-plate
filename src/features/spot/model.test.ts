import { describe, expect, it } from "vitest";
import { initialState, stateSchema, today } from "../../domain";
import { applyAIResult, addProposedMeal } from "../../ai-client";
import {
  hasSpotLog,
  isComeback,
  messageSpot,
  resolveWorkoutCapture,
  spotPose,
  spotWeek,
} from "./model";

const workout = {
  title: "Evening session",
  day: today(),
  note: "Loads as reported.",
  exercises: [
    { name: "Bench Press", weight: 185, reps: [5, 5, 5] },
    { name: "Incline DB", weight: 60, reps: [8, 8, 8] },
  ],
};
function pending() {
  const state = initialState();
  state.messages.push({
    id: "capture",
    role: "user",
    text: "Bench 185 3x5, incline DB 60s 3x8",
    time: "6:00 PM",
  });
  return applyAIResult(state, {
    requestId: "capture",
    reply: "Check the sets.",
    decision: "conversation",
    workout,
    meal: null,
    receipt: null,
    sources: [],
    warnings: [],
  });
}
describe("Spot capture and summaries", () => {
  it("preserves a reviewed historical meal date and saves it once", () => {
    const state = initialState();
    state.messages.push({
      id: "meal",
      role: "assistant",
      text: "Check the date.",
      time: "now",
      mealProposal: {
        title: "Oats",
        day: "2026-09-20",
        category: "Breakfast",
        portion: "One bowl",
        note: "",
        sources: [],
        calories: 300,
        protein: 10,
        carbs: 45,
        fat: 8,
      },
    });
    const saved = addProposedMeal(state, "meal");
    expect(saved.meals[0].day).toBe("2026-09-20");
    expect(addProposedMeal(saved, "meal")).toBe(saved);
  });
  it("stores only a proposal until confirmed; saves once without overwriting the active workout", () => {
    const state = pending();
    state.workout.status = "active";
    expect(state.workout.history).toBeUndefined();
    const saved = resolveWorkoutCapture(state, "answer-capture", true);
    expect(saved.workout.status).toBe("active");
    expect(saved.workout.exercises).toEqual(state.workout.exercises);
    expect(saved.workout.history).toHaveLength(1);
    expect(saved.workout.history![0].exercises[0].sets).toEqual([5, 5, 5]);
    expect(resolveWorkoutCapture(saved, "answer-capture", true)).toBe(saved);
    expect(stateSchema.parse(saved).messages.at(-1)?.workoutCaptureStatus).toBe(
      "accepted",
    );
    expect(spotWeek(saved).volume).toBe(4215);
    expect(spotWeek(saved).completed).toBe(1);
    expect(hasSpotLog(saved)).toBe(true);
  });
  it("declining saves no workout and cannot later accept the stale card", () => {
    const state = resolveWorkoutCapture(pending(), "answer-capture", false);
    expect(state.workout.history).toBeUndefined();
    expect(resolveWorkoutCapture(state, "answer-capture", true)).toBe(state);
  });
  it("survives old snapshots and rejects invalid or future dates on acceptance", () => {
    const state = initialState();
    expect(stateSchema.parse(state).spot).toBeUndefined();
    expect(spotWeek(state).calories).toBeNull();
    expect(spotWeek(state).completed).toBe(0);
    for (const day of ["2026-02-30", "2999-01-01"]) {
      const proposed = pending();
      proposed.messages.at(-1)!.workoutProposal!.day = day;
      expect(() =>
        resolveWorkoutCapture(proposed, "answer-capture", true),
      ).toThrow("date");
    }
  });
  it("detects real inactivity without treating malformed or future clocks as a gap", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    expect(isComeback("2026-09-24T12:00:00Z", now)).toBe(true);
    for (const value of [
      undefined,
      "bad",
      "2026-09-29T12:00:00Z",
      "2026-09-27T12:00:00Z",
    ])
      expect(isComeback(value, now)).toBe(false);
  });
  it("maps workout checks and success to Rep, without deriving emotions from food", () => {
    const message = pending().messages.at(-1)!;
    expect(messageSpot(message)).toEqual({
      side: "rep",
      expression: "confused",
    });
    expect(spotPose(messageSpot(message))).toBe(2);
    expect(
      messageSpot({ ...message, workoutCaptureStatus: "accepted" }),
    ).toEqual({ side: "rep", expression: "happy" });
    expect(
      messageSpot({
        id: "food",
        role: "assistant",
        time: "now",
        text: "pizza",
        mealId: "meal",
      }),
    ).toEqual({ side: "plate", expression: "happy" });
  });
});
