import { clockTime, id, type AppState } from "../../domain";
import type { GroceryReceipt } from "../../ai-contract";
import { getPantryLots } from "../pantry/ledger";

export function receiptPrompt(context = "") {
  return (
    "This is a grocery receipt for items I purchased. Identify the store and items, research their nutrition, and save the grocery list separately from meals I ate. Do not log these purchases as food eaten." +
    (context.trim() ? `\n\nAdditional context: ${context.trim()}` : "")
  );
}

export function receiptReadiness(state: AppState, receiptId?: string) {
  const lots = getPantryLots(state).filter(
    (lot) =>
      (!receiptId || lot.receiptId === receiptId) &&
      lot.item.availability !== "used" &&
      (lot.remaining === null || lot.remaining > 0 || lot.inconsistent),
  );
  const ready = lots.filter(
    (lot) =>
      !lot.item.needsReview &&
      !!lot.item.nutrition &&
      !!lot.item.serving &&
      !/^unknown$/i.test(lot.item.serving.trim()) &&
      lot.remaining !== null &&
      lot.remaining > 0 &&
      !lot.inconsistent,
  );
  return {
    ready: ready.length,
    checks: lots.length - ready.length,
    available: lots.length,
  };
}

export function saveReceiptCapture(
  state: AppState,
  image: string,
  name: string,
  context: string,
): AppState {
  const reviewId = id();
  return {
    ...state,
    reviews: [
      ...state.reviews,
      {
        id: reviewId,
        title: name,
        question:
          "Your grocery receipt photo is saved. Read it when connected to add groceries; nothing has been added to pantry stock or eaten meals.",
        source: `Image · ${clockTime()}`,
        image,
        options: ["Keep as a note"],
        kind: "capture",
        resolved: false,
      },
    ],
    messages: [
      ...state.messages,
      {
        id: id(),
        role: "user",
        text: receiptPrompt(context),
        image,
        time: clockTime(),
        ai: true,
        captureIntent: "receipt",
        captureReviewId: reviewId,
      },
    ],
  };
}

export function upgradeSavedReceiptCaptures(state: AppState): AppState {
  let next = state;
  for (const review of state.reviews.filter(
    (r) =>
      !r.resolved &&
      r.kind === "capture" &&
      r.image &&
      /grocery receipt/i.test(r.question),
  )) {
    if (next.messages.some((m) => m.captureReviewId === review.id)) continue;
    const source = next.messages.find(
      (m) => m.role === "user" && m.image === review.image && !m.ai,
    );
    const capture = {
      id: source?.id ?? id(),
      role: "user" as const,
      text: receiptPrompt(),
      image: review.image,
      time: source?.time ?? clockTime(),
      ai: true,
      captureIntent: "receipt" as const,
      captureReviewId: review.id,
    };
    next = {
      ...next,
      messages: source
        ? next.messages.map((m) => (m.id === source.id ? capture : m))
        : [...next.messages, capture],
    };
  }
  return next;
}

// The image stays on its original capture message. This also works with older receipts.
export function receiptSourcePhoto(state: AppState, receiptId: string) {
  const answer = state.messages.find(
    (message) => message.receiptId === receiptId && message.requestId,
  );
  return answer
    ? state.messages.find((message) => message.id === answer.requestId)?.image
    : undefined;
}

export function dinnerPrompt(receipt: GroceryReceipt) {
  return `Help me choose dinner tonight using the available, checked groceries from my ${receipt.store} receipt (${receipt.id}). Use only known products and amounts for nutrition estimates; ask about anything uncertain. Separate ingredients I need to buy. These are meal ideas, not food I have eaten: do not log a meal or change pantry stock.`;
}
