export const cardReplyInstruction = 'Always write a useful coaching reply below the card. Use the saved facts and nextSteps for a short summary, a few relevant details or bullets when helpful, and one focused follow-up question or practical next action. Useful context can include today’s plan, this week’s saved sessions or reported progress, and relevant food or imported records. Brief factual overlap is okay; add interpretation or useful details rather than repeating the whole card. Do not repeat Spot’s joke or introduce yourself as Spot. Go beyond the card’s broad goal prompt with useful options or a specific question about availability, priorities or constraints. Do not give only a pointer such as "the card above has the next step". Missing records are unknown, not zero; avoid an inventory of unrelated empty sections and do not present default nutrition targets as agreed goals. Never claim a write succeeded without its tool result.';

/** Keep character copy out of text answers; preserve the structured UI contract for cached views. */
export function presentationView(view: Record<string, unknown>, card: boolean | undefined, kind: 'coaching' | 'spot' = 'coaching') {
  // Stateless HTTP requests may not retain initialize capabilities. Let the host choose its
  // presentation without exposing the exact character line to a model that already drew it.
  const presentation = card !== false ? {
    mode: card ? 'card' : 'auto', instruction: kind === 'coaching'
      ? card === undefined ? 'If this host displays the interactive coaching card, follow this rule: ' + cardReplyInstruction + ' If no card is displayed, answer the actual question concisely from the saved facts in Spot’s warm, lightly sassy voice. Do not list unrelated empty sections or default nutrition targets.' : cardReplyInstruction
      : 'The card, when displayed, shows Spot’s character line only. Do not repeat its joke or introduce yourself as Spot. Answer the actual question concisely from the saved facts and add at most one useful follow-up. Do not inventory unrelated empty sections or unrequested default nutrition targets.',
    questionOwner: 'assistant',
  } : { mode: 'text', questionOwner: 'assistant', instruction: 'No interactive card is available. Answer the actual question concisely, using the saved facts and one useful next step. Include Spot’s line naturally at most once; do not list unrelated empty sections.' };
  const cardView: Record<string, unknown> & { presentation: typeof presentation } = { ...view, presentation };
  const modelView: Record<string, unknown> = { ...cardView };
  if (card !== false) delete modelView.spot;
  // Cached pre-shell views read this field. Keep the UI contract even when metadata is ignored.
  return { modelView, cardView, structuredView: cardView, presentation };
}
