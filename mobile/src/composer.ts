import { PROCESSING_DRAFT_NOTICE, retainComposerDraft } from "../../src/ai-client";

/**
 * Text submitted while Spot is still replying is held in the composer rather
 * than dropped: a transcript or preset joins any draft already there (web's
 * `retainComposerDraft` rule) and the shared notice says why nothing was sent.
 * Pure so the store's busy path can be checked without react-native.
 */
export function holdWhileReplying(
  draft: string,
  incoming: string,
): { draft: string; notice: string } {
  return {
    draft: retainComposerDraft(draft, incoming),
    notice: PROCESSING_DRAFT_NOTICE,
  };
}
