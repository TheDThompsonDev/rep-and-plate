export const ONBOARDING_KEY = "rep-and-plate.onboarding.v1";
export type OnboardingRecord = {
  version: 1;
  mode: "guest" | "account";
  userId?: string;
  focus: string;
  firstLogPending?: boolean;
};
export function parseOnboarding(raw: string | null): OnboardingRecord | null {
  try {
    const value = JSON.parse(raw || "null");
    return value?.version === 1 &&
      ["guest", "account"].includes(value.mode) &&
      typeof value.focus === "string" &&
      (value.mode !== "account" || typeof value.userId === "string")
      ? value
      : null;
  } catch {
    return null;
  }
}
export const defaultFocus = "A little of all three";
export const focusChoices = [
  "Food & meals",
  "Movement & workouts",
  "Groceries & dinner",
  defaultFocus,
];
export function requireOnboardingName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw Error("Enter the name you’d like Spot to call you.");
  if (trimmed.length > 60) throw Error("Keep your name to 60 characters or fewer.");
  return trimmed;
}
export function firstStepForFocus(focus: string) {
  if (focus === "Food & meals") return "Start with one meal. A few words are enough.";
  if (focus === "Movement & workouts") return "Start with a walk or a workout. It doesn’t have to be epic.";
  if (focus === "Groceries & dinner") return "Start with a grocery receipt. Check what you bought, then log portions when you eat them.";
  return "Start with a meal, a workout, or a grocery receipt. You can use all three at your own pace.";
}
export const introduction = [
  {
    scene: "press-conference" as const,
    title: "Hey. I’m Spot.",
    line: "You opened the app. I called a press conference.",
    detail:
      "Part dinner plate. Part weight plate. Your wildly invested sidekick for food, movement, and being a human.",
  },
  {
    scene: "dinner-conspiracy" as const,
    title: "Give your groceries a plan.",
    line: "Your receipt has dinner potential.",
    detail: "Add a grocery receipt, check the products and amounts, then get meal ideas from what you have and see what else you need. Purchases never count as food eaten.",
  },
  {
    scene: "dinner-conspiracy" as const,
    title: "Tell me what you ate.",
    line: "Dinner has become a federal investigation.",
    detail:
      "A photo, a few words, or your voice. I’ll help with the details. You review my estimates before anything is logged.",
  },
  {
    scene: "leg-funeral" as const,
    title: "Tell me what you did.",
    line: "Three squats. A full memorial service.",
    detail:
      "A walk counts. A workout counts. Showing up counts. I supply the dramatic reactions; you set the pace.",
  },
  {
    scene: "recovery-department" as const,
    title: "We do real life here.",
    line: "Rest day? I’ve already cleared my calendar.",
    detail:
      "No food guilt. No punishment for missing a day. Come back whenever you’re ready. I’ll still be a plate.",
  },
];
