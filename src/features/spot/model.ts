import type { AppState, Message } from "../../domain";
import { personalMeals, today } from "../../domain";
import { weeklyReview } from "../reviews/weekly-review";
import { workoutCaptureSchema } from "./contracts";

export type SpotSide = "plate" | "rep";
export type SpotExpression =
  "default" | "deadpan" | "welcome" | "confused" | "happy" | "proud" | "tired";
export type SpotState = { side: SpotSide; expression: SpotExpression };
export function spotPose({ side, expression }: SpotState) {
  if (side === "rep")
    return expression === "proud" || expression === "tired" ? 5 : 2;
  return expression === "welcome"
    ? 1
    : expression === "confused"
      ? 3
      : expression === "happy" || expression === "proud"
        ? 4
        : 0;
}
export function messageSpot(message?: Message): SpotState {
  return {
    side:
      message?.workoutProposal ||
      message?.workoutCaptureStatus ||
      message?.kind === "workout" ||
      message?.suggestedAction === "workout"
        ? "rep"
        : "plate",
    expression:
      message?.mealId || message?.workoutCaptureStatus === "accepted"
        ? "happy"
        : message?.spotCheck ||
            message?.mealProposal ||
            message?.workoutProposal
          ? "confused"
          : "default",
  };
}
export const spotIntro = [
  {
    title: "Hey. I’m Spot.",
    detail:
      "Your food and workout sidekick. Part dinner plate. Part weight plate. Entirely too invested.",
    scene: "press-conference",
    punchline: "You opened the app. I called a press conference.",
    side: "plate",
    expression: "welcome",
  },
  {
    title: "Tell me what you ate.",
    detail:
      "Photo, text or barcode. I’ll help with the details. You check them before anything is logged.",
    scene: "dinner-conspiracy",
    punchline: "Dinner has become a federal investigation.",
    side: "plate",
    expression: "default",
  },
  {
    title: "Tell me what you did.",
    detail:
      "Send your sets and reps. We’ll check the workout together. I handle the dramatic reenactment.",
    scene: "leg-funeral",
    punchline: "Three squats. A full memorial service.",
    side: "rep",
    expression: "default",
  },
  {
    title: "You don’t have to be perfect.",
    detail:
      "Start wherever you are. Log one thing, take a rest day, come back when you’re ready.",
    scene: "recovery-department",
    punchline: "Your pace. My unnecessarily large personality.",
    side: "plate",
    expression: "deadpan",
  },
] as const;
export function hasSpotLog(state: AppState) {
  return (
    personalMeals(state.meals).length > 0 ||
    (state.workout.history ?? []).some((w) => !!w.finishedAt) ||
    state.workout.status === "finished"
  );
}
export function isComeback(lastVisit: string | undefined, now = new Date()) {
  if (!lastVisit) return false;
  const previous = new Date(lastVisit).getTime();
  return Number.isFinite(previous) && now.getTime() - previous >= 3 * 86400000;
}
export function resolveWorkoutCapture(
  state: AppState,
  messageId: string,
  accept: boolean,
): AppState {
  const message = state.messages.find((m) => m.id === messageId);
  if (!message?.workoutProposal || message.workoutCaptureStatus !== "pending")
    return state;
  const p = workoutCaptureSchema.parse(message.workoutProposal);
  const date = new Date(`${p.day}T12:00:00`);
  if (
    accept &&
    (!Number.isFinite(date.getTime()) ||
      p.day > today() ||
      date.getDate() !== Number(p.day.slice(-2)))
  )
    throw new Error("Check the workout date before saving.");
  // Distinct source captures on the same day must not collide in history deduplication.
  let stamp = date.getTime();
  const occupied = new Set(
    (state.workout.history ?? []).map((w) => w.startedAt),
  );
  while (occupied.has(new Date(stamp).toISOString())) stamp += 1000;
  const at = accept ? new Date(stamp).toISOString() : "";
  return {
    ...state,
    workout: accept
      ? {
          ...state.workout,
          history: [
            ...(state.workout.history ?? []),
            {
              title: p.title,
              startedAt: at,
              finishedAt: at,
              exercises: p.exercises.map((e) => ({
                name: e.name,
                weight: e.weight,
                target: e.reps[0],
                previous: [],
                sets: e.reps,
              })),
            },
          ],
        }
      : state.workout,
    messages: state.messages.map((m) =>
      m.id === messageId
        ? {
            ...m,
            workoutCaptureStatus: accept
              ? ("accepted" as const)
              : ("dismissed" as const),
          }
        : m,
    ),
  };
}
export function spotWeek(state: AppState, end = today()) {
  const week = weeklyReview(state, end);
  const sum = week.meals.reduce(
    (s, m) => ({
      calories: s.calories + m.calories,
      protein: s.protein + m.protein,
    }),
    { calories: 0, protein: 0 },
  );
  const completed = week.workouts.filter((w) => w.finished);
  const keys = new Set(completed.map((w) => `${w.startedAt}:${w.title}`));
  const sessions = [
    ...(state.workout.history ?? []),
    { ...state.workout, title: state.workout.title ?? "Workout" },
  ];
  let volume = 0;
  for (const w of sessions) {
    const key = `${w.startedAt}:${w.title}`;
    if (!keys.delete(key)) continue;
    volume += w.exercises.reduce(
      (sum, e) =>
        sum + e.weight * e.sets.reduce<number>((n, r) => n + (r ?? 0), 0),
      0,
    );
  }
  return {
    ...week,
    completed: completed.length,
    volume,
    calories: week.loggedDays
      ? Math.round(sum.calories / week.loggedDays)
      : null,
    protein: week.loggedDays ? Math.round(sum.protein / week.loggedDays) : null,
  };
}
