import { sumProposalComponents } from "./proposals";
import { detachMealFromPantry } from "../pantry/ledger";
import { clockTime, id, type AppState, type Meal, type ReviewItem } from "../../domain";

const MACROS = ["calories", "protein", "carbs", "fat"] as const;

/** An empty manual entry for `day`; the form shows blank macro fields for it. */
export function manualMealDraft(day: string): Meal {
  return {
    id: id(),
    title: "",
    category: "Lunch",
    day,
    time: clockTime(),
    source: "Manual entry",
    confidence: "confirmed",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    note: "",
  };
}

/** The unlogged estimate behind a chat proposal, as an editable meal keyed by
 * the message id. `null` when the message has no proposal (already logged). */
export function proposalCorrectionDraft(state: AppState, messageId: string, fallbackDay: string): Meal | null {
  const proposal = state.messages.find((m) => m.id === messageId)?.mealProposal;
  if (!proposal) return null;
  const totals = proposal.components ? sumProposalComponents(proposal.components) : proposal;
  return {
    id: messageId,
    title: proposal.title,
    category: proposal.category,
    day: proposal.day ?? fallbackDay,
    time: clockTime(),
    source: "Unlogged estimate — review before logging",
    confidence: "estimated",
    calories: totals.calories,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    note: proposal.note,
  };
}

/** A meal started from a captured review item; saving it resolves the item. */
export function reviewMealDraft(item: ReviewItem, day: string): Meal {
  return {
    id: `review-meal-${item.id}`,
    title: "",
    category: "Lunch",
    time: clockTime(),
    day,
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    source: item.source + ": " + item.question,
    image: item.image,
    confidence: "confirmed",
    note: "Added by you from a captured moment.",
  };
}

/** Write a corrected estimate back onto its proposal without logging it. A
 * macro change invalidates the component breakdown, portion and sources. */
export function applyProposalCorrection(state: AppState, proposalId: string, meal: Meal): AppState {
  return {
    ...state,
    messages: state.messages.map((message) => {
      if (message.id !== proposalId || !message.mealProposal) return message;
      const original = message.mealProposal;
      const totals = original.components ? sumProposalComponents(original.components) : original;
      const changed = MACROS.some((key) => totals[key] !== meal[key]);
      return {
        ...message,
        text: "Review your corrected estimate below. It has not been logged yet.",
        mealProposal: {
          ...original,
          title: meal.title,
          category: meal.category,
          day: meal.day,
          calories: meal.calories,
          protein: meal.protein,
          carbs: meal.carbs,
          fat: meal.fat,
          note: meal.note.slice(0, 1200),
          ...(changed
            ? {
                components: undefined,
                portion: "Your corrected portion",
                sources: [],
              }
            : {}),
        },
      };
    }),
  };
}

/** Save an edited or new meal. Changed macros detach the meal from pantry lots
 * and drop its components; the chat echo and any review item it came from are
 * updated in the same transition. */
export function saveEditedMeal(previous: AppState, meal: Meal): AppState {
  const old = previous.meals.find((m) => m.id === meal.id);
  const changed = old && MACROS.some((k) => old[k] !== meal[k]);
  const s = changed ? detachMealFromPantry(previous, meal.id) : previous;
  const savedMeal = changed ? { ...meal, components: undefined } : meal;
  return {
    ...s,
    meals: old ? s.meals.map((m) => (m.id === meal.id ? savedMeal : m)) : [...s.meals, savedMeal],
    messages: s.messages.map((message) =>
      message.mealId === meal.id && message.role === "assistant"
        ? {
            ...message,
            text: "Your meal was updated. The saved details below reflect your correction.",
          }
        : message,
    ),
    reviews: s.reviews.map((r) =>
      `review-meal-${r.id}` === meal.id ? { ...r, resolved: true, answer: "Meal added by you" } : r,
    ),
  };
}
