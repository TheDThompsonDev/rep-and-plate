import { describe, it, expect } from "vitest";
import { demoState, initialState } from "../../domain";
import { weeklyReview } from "./weekly-review";

describe("weekly personal review", () => {
  it("does not claim activity from seeded meals or undated workout examples", () => {
    const review = weeklyReview(demoState(), "2026-09-25");
    expect(review.meals).toEqual([]);
    expect(review.workouts).toEqual([]);
    expect(review.loggedDays).toBe(0);
    expect(review.insights[0].title).toBe("Your next meal starts the picture.");
  });
  it("uses exactly seven local dates and counts only days with personal meal records", () => {
    const state = initialState();
    const template = { ...demoState().meals[0], example: false };
    state.meals.push(
      {
        ...template,
        id: "actual-1",
        source: "Your label",
        day: "2026-09-19",
        calories: 400,
        protein: 20,
      },
      {
        ...template,
        id: "actual-2",
        source: "Your label",
        day: "2026-09-25",
        calories: 600,
        protein: 40,
      },
      { ...template, id: "old", source: "Your label", day: "2026-09-18" },
      { ...template, id: "future", source: "Your label", day: "2026-09-26" },
      {
        ...template,
        id: "custom-sample",
        source: "Demo meal",
        day: "2026-09-23",
      },
    );
    const review = weeklyReview(state, "2026-09-25");
    expect(review.start).toBe("2026-09-19");
    expect(review.meals.map((meal) => meal.id)).toEqual([
      "actual-1",
      "actual-2",
    ]);
    expect(review.loggedDays).toBe(2);
    expect(review.insights[0].description).toContain(
      "500 calories per logged day",
    );
  });
  it("requires a valid session date and recorded sets, and deduplicates the active session", () => {
    const state = initialState();
    const exercises = [
      { ...state.workout.exercises[0], sets: [8, null, null] },
    ];
    const actual = {
      title: "Upper Body",
      startedAt: "2026-09-25T12:00:00",
      finishedAt: null,
      exercises,
    };
    state.workout = {
      ...state.workout,
      ...actual,
      status: "active",
      history: [
        actual,
        { ...actual, title: "Unstarted", startedAt: null },
        { ...actual, title: "Invalid", startedAt: "bad date" },
        { ...actual, title: "Old", startedAt: "2026-09-18T12:00:00" },
        {
          ...actual,
          title: "No sets",
          exercises: [{ ...exercises[0], sets: [null, null] }],
        },
        { ...actual, title: "Sample session" },
      ],
    };
    expect(weeklyReview(state, "2026-09-25").workouts).toEqual([
      {
        title: "Upper Body",
        startedAt: actual.startedAt,
        day: "2026-09-25",
        finished: false,
        sets: 1,
      },
    ]);
  });
});
