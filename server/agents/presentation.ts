export const cardReplyInstruction = 'The interactive coaching card is the answer and already presents the next question or action. Do not recap the card, repeat its joke, introduce yourself as Spot, or restate its question in chat. Do not add a follow-up question after this card. Do not list empty sections, zero weekly totals, default nutrition targets or missing imports unless the user specifically asks. Add prose only for essential information the card omits or an explicit request for more detail; otherwise omit prose or use only a minimal acknowledgment if the host requires one. Never claim a write succeeded without its tool result.';

/** Keep character copy out of text answers; preserve the structured UI contract for cached views. */
export function presentationView(view: Record<string, unknown>, card: boolean | undefined, kind: 'coaching' | 'spot' = 'coaching') {
  // Stateless HTTP requests may not retain initialize capabilities. Let the host choose its
  // presentation without exposing the exact character line to a model that already drew it.
  const presentation = card !== false ? {
    mode: card ? 'card' : 'auto', instruction: kind === 'coaching'
      ? card === undefined ? 'If this host displays the interactive coaching card, follow this rule: ' + cardReplyInstruction + ' If no card is displayed, give a complete concise text answer from the saved facts and one useful next-step question in Spot’s warm, lightly sassy voice. Never rely on a hidden or failed card to carry the next step. Do not list unrelated empty sections or default nutrition targets.' : cardReplyInstruction
      : 'The card, when displayed, shows Spot’s character line only. Do not repeat its joke or introduce yourself as Spot. Answer the actual question concisely from the saved facts and add at most one useful follow-up. Do not inventory unrelated empty sections or unrequested default nutrition targets.',
    questionOwner: kind === 'coaching' ? 'card' : 'assistant',
  } : { mode: 'text', questionOwner: 'assistant', instruction: 'No interactive card is available. Answer the actual question concisely, using the saved facts and one useful next step. Include Spot’s line naturally at most once; do not list unrelated empty sections.' };
  const cardView: Record<string, unknown> & { presentation: typeof presentation } = { ...view, presentation };
  const modelView: Record<string, unknown> = { ...cardView };
  if (card !== false) delete modelView.spot;
  // Cached pre-shell views read this field. Keep the UI contract even when metadata is ignored.
  return { modelView, cardView, structuredView: cardView, presentation };
}
