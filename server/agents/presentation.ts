const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

export const cardReplyInstruction = 'The interactive card is the primary answer. Do not recap the card, repeat its joke, introduce yourself as Spot, or list empty sections, zero weekly totals, default nutrition targets or missing imports unless the user specifically asks. Add only information the user needs that is not shown, or one short follow-up question. If the card fully answers the request, keep any acknowledgment minimal. Never claim a write succeeded without its tool result.';

/** Keep character copy in UI-only metadata; retain coaching facts for reasoning and planning. */
export function presentationView(view: Record<string, unknown>, card: boolean | undefined, kind: 'coaching' | 'spot' = 'coaching') {
  const state = object(view.state), profile = object(state.profile);
  const pending = Array.isArray(state.proposals) && state.proposals.some(value => object(value).status === 'pending');
  // Stateless HTTP requests may not retain initialize capabilities. Let the host choose its
  // presentation without exposing the exact character line to a model that already drew it.
  const presentation = card !== false ? {
    mode: card ? 'card' : 'auto', instruction: kind === 'coaching'
      ? card === undefined ? 'If this host displays the interactive coaching card, follow this rule: ' + cardReplyInstruction + ' If no card is displayed, answer the actual question concisely from the saved facts in Spot’s warm, lightly sassy voice. Do not list unrelated empty sections or default nutrition targets.' : cardReplyInstruction
      : 'The card, when displayed, shows Spot’s character line only. Do not repeat its joke or introduce yourself as Spot. Answer the actual question concisely from the saved facts and add at most one useful follow-up. Do not inventory unrelated empty sections or unrequested default nutrition targets.',
    ...(pending ? { suggestedReply: 'Would you like to apply the change shown, or adjust it?' } : !profile.primaryGoal && view.state ? { suggestedReply: 'What would you most like your training to help you achieve?' } : {}),
  } : { mode: 'text', instruction: 'No interactive card is available. Answer the actual question concisely, using the saved facts and one useful next step. Include Spot’s line naturally at most once; do not list unrelated empty sections.' };
  const cardView: Record<string, unknown> & { presentation: typeof presentation } = { ...view, presentation };
  const modelView: Record<string, unknown> = { ...cardView };
  if (card !== false) delete modelView.spot;
  return { modelView, cardView, presentation };
}
