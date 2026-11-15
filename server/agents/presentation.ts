import { presentationInstruction } from '../../src/features/spot/guidance.ts';

/** Keep character copy out of text answers; preserve the structured UI contract for cached views. */
export function presentationView(view: Record<string, unknown>, card: boolean | undefined, kind: 'coaching' | 'spot' = 'coaching') {
  // Stateless HTTP requests may not retain initialize capabilities. Let the host choose its
  // presentation without exposing the exact character line to a model that already drew it.
  const presentation = { mode: card === false ? 'text' : card ? 'card' : 'auto', instruction: presentationInstruction(kind, card), questionOwner: 'assistant' };
  const cardView: Record<string, unknown> & { presentation: typeof presentation } = { ...view, presentation };
  const modelView: Record<string, unknown> = { ...cardView };
  if (card !== false) delete modelView.spot;
  // Cached pre-shell views read this field. Keep the UI contract even when metadata is ignored.
  return { modelView, cardView, structuredView: cardView, presentation };
}
