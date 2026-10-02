import { z } from "zod";
import type { AppState } from "../../domain.ts";
import { saveBodyWeight, type BodyWeightEntry } from "./body-weight.ts";

export const goalLabels = {
  lose: "Lose weight",
  gain: "Gain weight",
  maintain: "Maintain weight",
  strength: "Build strength",
  habits: "Build healthier habits",
} as const;
export const cadenceLabels = {
  weekly: "Weekly",
  daily: "Daily",
  none: "When I choose",
} as const;
export const fitnessGoalSchema = z.object({
  kind: z.enum(["lose", "gain", "maintain", "strength", "habits"]),
  unit: z.enum(["lb", "kg"]),
  targetWeight: z.number().finite().positive().max(2000).optional(),
  cadence: z.enum(["weekly", "daily", "none"]),
});
export type FitnessGoal = z.infer<typeof fitnessGoalSchema>;
export type FitnessSetupDraft = {
  kind: FitnessGoal["kind"];
  unit: FitnessGoal["unit"];
  cadence: FitnessGoal["cadence"];
  currentWeight: string;
  targetWeight: string;
};
export const emptyFitnessSetup: FitnessSetupDraft = {
  kind: "habits",
  unit: "lb",
  cadence: "weekly",
  currentWeight: "",
  targetWeight: "",
};
export function fitnessDraft(goal?: FitnessGoal): FitnessSetupDraft {
  return goal
    ? {
        ...goal,
        currentWeight: "",
        targetWeight:
          goal.targetWeight === undefined ? "" : String(goal.targetWeight),
      }
    : { ...emptyFitnessSetup };
}
export function parseFitnessSetup(
  draft: FitnessSetupDraft,
  knownWeight?: BodyWeightEntry,
) {
  const currentWeight = draft.currentWeight.trim()
    ? Number(draft.currentWeight)
    : undefined;
  const targetWeight =
    ["lose", "gain"].includes(draft.kind) && draft.targetWeight.trim()
      ? Number(draft.targetWeight)
      : undefined;
  for (const value of [currentWeight, targetWeight])
    if (
      value !== undefined &&
      (!Number.isFinite(value) || value <= 0 || value > 2000)
    )
      throw Error("Enter a weight greater than 0 and no more than 2,000.");
  const comparison =
    currentWeight ??
    (knownWeight
      ? knownWeight.value *
        (knownWeight.unit === draft.unit
          ? 1
          : draft.unit === "kg"
            ? 0.45359237
            : 1 / 0.45359237)
      : undefined);
  if (targetWeight !== undefined && comparison === undefined)
    throw Error(
      "Add your current weight before choosing a target, or leave the target for later.",
    );
  if (targetWeight !== undefined && comparison !== undefined) {
    if (draft.kind === "lose" && targetWeight >= comparison)
      throw Error(
        "For weight loss, choose a target below your current weight.",
      );
    if (draft.kind === "gain" && targetWeight <= comparison)
      throw Error(
        "For weight gain, choose a target above your current weight.",
      );
  }
  const goal = fitnessGoalSchema.parse({
    kind: draft.kind,
    unit: draft.unit,
    cadence: draft.cadence,
    ...(targetWeight === undefined ? {} : { targetWeight }),
  });
  return { goal, currentWeight };
}
export function applyFitnessSetup(
  state: AppState,
  draft: FitnessSetupDraft,
  day: string,
  entryId: string,
): AppState {
  const latest = state.bodyWeights
    ?.filter((entry) => entry.day <= day)
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .at(-1);
  const { goal, currentWeight } = parseFitnessSetup(draft, latest);
  return {
    ...state,
    profile: { ...state.profile, fitnessGoal: goal },
    ...(currentWeight === undefined
      ? {}
      : {
          bodyWeights: saveBodyWeight(
            state.bodyWeights ?? [],
            { id: entryId, day, value: currentWeight, unit: goal.unit },
            day,
          ),
        }),
  };
}
export function convertSetupUnit(
  draft: FitnessSetupDraft,
  unit: FitnessGoal["unit"],
): FitnessSetupDraft {
  if (unit === draft.unit) return draft;
  const convert = (raw: string) =>
    raw.trim() && Number.isFinite(Number(raw))
      ? String(
          Math.round(
            Number(raw) * (unit === "kg" ? 0.45359237 : 1 / 0.45359237) * 100,
          ) / 100,
        )
      : raw;
  return {
    ...draft,
    unit,
    currentWeight: convert(draft.currentWeight),
    targetWeight: convert(draft.targetWeight),
  };
}
export function weightCheckIn(
  entries: BodyWeightEntry[],
  goal: FitnessGoal | undefined,
  day: string,
) {
  if (!goal || goal.cadence === "none")
    return {
      due: false,
      nextDay: null,
      text: "Log a weight whenever it helps you.",
    };
  const latest = entries
    .filter((entry) => entry.day <= day)
    .sort((a, b) => a.day.localeCompare(b.day))
    .at(-1);
  if (!latest)
    return {
      due: true,
      nextDay: day,
      text: "Add your first weight to start tracking your progress.",
    };
  const next = new Date(`${latest.day}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + (goal.cadence === "weekly" ? 7 : 1));
  const nextDay = next.toISOString().slice(0, 10),
    due = day >= nextDay;
  return {
    due,
    nextDay,
    text: due
      ? "Your next weight check-in is ready."
      : `Next weight check-in: ${nextDay}.`,
  };
}
