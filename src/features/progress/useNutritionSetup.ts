import { useState } from "react";
import {
  convertHeight,
  estimateTargets,
  nutritionDraft,
  parseBaseline,
  type DailyTargets,
  type NutritionBaseline,
  type NutritionSetupDraft,
  type NutritionSetupResult,
} from "./nutrition-setup";
import type { NutritionSession } from "../onboarding/draft";

export const targetKeys = ["calories", "protein", "carbs", "fat"] as const;
export function useNutritionSetup({
  baseline,
  kind,
  initialDraft,
  initialSession,
  existingTargets,
  weight,
  onSave,
  onDraftChange,
  onSessionChange,
}: {
  baseline?: NutritionBaseline;
  kind?: string;
  initialDraft?: NutritionSetupDraft;
  existingTargets?: DailyTargets;
  weight?: { value: number; unit: "lb" | "kg" };
  onSave: (result: NutritionSetupResult) => void;
  onDraftChange?: (draft: NutritionSetupDraft) => void;
  initialSession?: NutritionSession;
  onSessionChange?: (session: NutritionSession) => void;
}) {
  const [draft, setDraft] = useState(
    () => initialDraft ?? nutritionDraft(baseline, kind),
  );
  const [session, setSession] = useState<NutritionSession>(
    () =>
      initialSession ?? {
        review: null,
        targets: { calories: "", protein: "", carbs: "", fat: "" },
      },
  );
  const { review, targets } = session;
  const [error, setError] = useState("");
  const attempt = (action: () => void) => {
    try {
      action();
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "These details could not be saved.",
      );
    }
  };
  const update = (next: NutritionSetupDraft) => {
    setDraft(next);
    onDraftChange?.(next);
    setError("");
  };
  const updateSession = (next: NutritionSession) => {
    setSession(next);
    onSessionChange?.(next);
    setError("");
  };
  return {
    draft,
    review,
    targets,
    error,
    patch: (input: Partial<NutritionSetupDraft>) =>
      update({ ...draft, ...input }),
    unit: (value: NutritionSetupDraft["heightUnit"]) =>
      update(convertHeight(draft, value)),
    estimate: () =>
      attempt(() => {
        const estimated = estimateTargets(draft, weight);
        onDraftChange?.(draft);
        updateSession({
          targets: {
            calories: String(estimated.calories),
            protein: String(estimated.protein),
            carbs: String(estimated.carbs),
            fat: String(estimated.fat),
          },
          review: "estimate",
        });
      }),
    manual: () =>
      attempt(() => {
        parseBaseline(draft);
        onDraftChange?.(draft);
        updateSession({
          targets: {
            calories: existingTargets ? String(existingTargets.calories) : "",
            protein: existingTargets ? String(existingTargets.protein) : "",
            carbs: existingTargets ? String(existingTargets.carbs) : "",
            fat: existingTargets ? String(existingTargets.fat) : "",
          },
          review: "manual",
        });
      }),
    changeTarget: (key: keyof DailyTargets, value: string) =>
      updateSession({ review, targets: { ...targets, [key]: value } }),
    back: () => updateSession({ ...session, review: null }),
    detailsOnly: () =>
      attempt(() => onSave({ baseline: parseBaseline(draft) })),
    save: () =>
      attempt(() => {
        if (
          targetKeys.some(
            (key) =>
              !targets[key].trim() ||
              !Number.isFinite(Number(targets[key])) ||
              Number(targets[key]) < 1 ||
              Number(targets[key]) >
                (key === "calories" ? 10000 : key === "carbs" ? 2000 : 1000),
          )
        )
          throw Error(
            "Enter valid positive daily calories and grams for each nutrient.",
          );
        onSave({
          baseline: parseBaseline(draft),
          targets: {
            calories: Number(targets.calories),
            protein: Number(targets.protein),
            carbs: Number(targets.carbs),
            fat: Number(targets.fat),
          },
        });
      }),
  };
}
