export const ONBOARDING_KEY = "rep-and-plate.onboarding.v1";
export type OnboardingRecord = {
  version: 1;
  mode: "guest" | "account";
  userId?: string;
  focus: string;
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
export const focusChoices = [
  "Food & meals",
  "Movement & workouts",
  "A little of both",
];
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
