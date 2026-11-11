import { trackMealTransition } from "../life-context/tracking";
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { repeatMeal, today, type AppState, type Meal, type ReviewItem } from "../../domain";
import { deleteMealWithPantry } from "../pantry/ledger";
import {
  applyProposalCorrection,
  manualMealDraft,
  proposalCorrectionDraft,
  reviewMealDraft,
  saveEditedMeal,
} from "./meal-editor";

type Options = {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
  notify: (message: string) => void;
  /** Nutrition day a chat capture is being logged for, when the user picked one. */
  captureDay: string | null;
  /** Open the pantry-ingredient review for a saved meal. */
  onPantryLinks: (mealId: string) => void;
};

/** What the meal editor dialog is open for: an existing meal, a manual entry,
 * a review-item meal, or the unlogged estimate behind a chat proposal
 * (`proposalId`, in which case saving corrects the proposal instead of logging). */
export function useMealEditor({ state, setState, notify, captureDay, onPantryLinks }: Options) {
  const [editMeal, setEditMeal] = useState<Meal | null>(null);
  const [editProposalId, setEditProposalId] = useState<string | null>(null);
  /** Stable: `clearCaptureDrafts` closes the editor on owner change, restore and reset. */
  const close = useCallback(() => {
    setEditMeal(null);
    setEditProposalId(null);
  }, []);
  function manualMeal(day: string) {
    setEditProposalId(null);
    setEditMeal(manualMealDraft(day));
  }
  function correctProposal(messageId: string) {
    const draft = proposalCorrectionDraft(state, messageId, captureDay ?? today());
    if (!draft) return;
    setEditProposalId(messageId);
    setEditMeal(draft);
  }
  function addFromReview(item: ReviewItem) {
    setEditMeal(reviewMealDraft(item, today()));
  }
  function save(meal: Meal) {
    if (editProposalId) {
      setState((s) => applyProposalCorrection(s, editProposalId, meal));
      setEditMeal(null);
      setEditProposalId(null);
      notify("Estimate updated. Review and confirm it before logging.");
      return;
    }
    const actionId = crypto.randomUUID();
    setState((previous) => trackMealTransition(previous, saveEditedMeal(previous, meal), actionId, "web"));
    setEditMeal(null);
    notify("Meal updated. Your day is up to date.");
  }

  const saved = editMeal !== null && state.meals.some((m) => m.id === editMeal.id);
  const isProposal = !!editProposalId;
  return {
    editMeal,
    /** Open the editor for a meal that already exists in the day (pages pass this directly). */
    setEditMeal,
    isProposal,
    newManual: !isProposal && !saved && editMeal?.source === "Manual entry",
    repeatDraft: !saved && editMeal?.source === "Repeated saved meal",
    manualMeal,
    correctProposal,
    addFromReview,
    close,
    save,
    repeat:
      editMeal && !isProposal && saved
        ? () => setEditMeal(repeatMeal(state, editMeal.id).meals.at(-1)!)
        : undefined,
    pantryLinks:
      editMeal && !editMeal.recipeBatchId && saved && (state.groceries?.length ?? 0) > 0
        ? () => {
            onPantryLinks(editMeal.id);
            setEditMeal(null);
          }
        : undefined,
    remove:
      editMeal && saved
        ? () => {
            setState((s) => deleteMealWithPantry(s, editMeal.id));
            setEditMeal(null);
            notify("Meal removed from your day.");
          }
        : undefined,
  };
}
