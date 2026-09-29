import type { AppState } from "../../domain";
import { logRecipePortion } from "./batches";
import { recipePortionProposalSchema } from "./proposal-contract";

export { recipePortionProposalSchema } from "./proposal-contract";
export type {
  RecipePortionProposal,
  RecipePortionProposalStatus,
} from "./proposal-contract";

/** A suggestion never consumes food until the user explicitly accepts it. */
export function resolveRecipePortionProposal(
  state: AppState,
  messageId: string,
  accept: boolean,
): AppState {
  const message = state.messages.find((entry) => entry.id === messageId);
  if (
    !message?.recipePortionProposal ||
    message.recipePortionProposalStatus !== "pending"
  )
    return state;
  if (!accept) {
    return {
      ...state,
      messages: state.messages.map((entry) =>
        entry.id === messageId
          ? { ...entry, recipePortionProposalStatus: "dismissed" }
          : entry,
      ),
    };
  }
  const proposal = recipePortionProposalSchema.parse(
    message.recipePortionProposal,
  );
  const batch = state.recipeBatches?.find(
    (entry) => entry.id === proposal.batchId,
  );
  if (!batch || batch.undoneAt)
    throw new Error(
      "This prepared batch is no longer available. Review your recipes and leftovers first.",
    );
  const next = logRecipePortion(
    state,
    batch.id,
    proposal.portions,
    proposal.category,
    `chat:${messageId}`,
  );
  return {
    ...next,
    messages: next.messages.map((entry) =>
      entry.id === messageId
        ? { ...entry, recipePortionProposalStatus: "accepted" }
        : entry,
    ),
  };
}
