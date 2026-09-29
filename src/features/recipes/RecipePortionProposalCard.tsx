import { Check, ChefHat } from "lucide-react";
import { scaleNutrition } from "../meals/arithmetic";
import type { RecipeBatch } from "./contracts";
import { remainingRecipePortions } from "./portions";
import type {
  RecipePortionProposal,
  RecipePortionProposalStatus,
} from "./proposal-contract";
import "./portion-proposal.css";

export default function RecipePortionProposalCard({
  proposal,
  batch,
  status,
  onAccept,
  onDismiss,
}: {
  proposal: RecipePortionProposal;
  batch?: RecipeBatch;
  status: RecipePortionProposalStatus;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const matchingBatch = batch?.id === proposal.batchId ? batch : undefined;
  const portions = Math.round(proposal.portions * 10000) / 10000;
  const remaining = matchingBatch ? remainingRecipePortions(matchingBatch) : 0;
  const unavailable =
    !matchingBatch || matchingBatch.undoneAt
      ? "This prepared batch is no longer available. Open Recipes & leftovers to review it."
      : !Number.isFinite(portions) || portions < 0.0001
        ? "The portion amount needs a check. Tell Rep & Plate how much of the batch you ate."
        : portions > remaining
          ? `Only ${remaining} portions remain. Tell Rep & Plate the amount you actually ate before logging.`
          : null;
  const nutrition =
    matchingBatch &&
    portions > 0 &&
    portions / matchingBatch.totalPortions <= 10000
      ? scaleNutrition(
          matchingBatch.nutrition,
          portions / matchingBatch.totalPortions,
        )
      : null;
  return (
    <section
      className="recipe-portion-proposal"
      aria-label="Review prepared meal portion"
    >
      <div className="recipe-proposal-heading">
        <span>
          <ChefHat size={21} />
        </span>
        <div>
          <small>FROM YOUR PREPARED BATCH</small>
          <h3>{matchingBatch?.name || "Prepared meal"}</h3>
        </div>
      </div>
      <p className="recipe-proposal-amount">
        {portions} {portions === 1 ? "portion" : "portions"} ·{" "}
        {proposal.category}
      </p>
      {nutrition && (
        <div className="recipe-proposal-nutrition">
          <strong>
            ~{nutrition.calories} cal · {nutrition.protein}g protein
          </strong>
          <span>
            {nutrition.carbs}g carbs · {nutrition.fat}g fat
          </span>
        </div>
      )}
      <p className="recipe-proposal-evidence">{proposal.evidence}</p>
      {status === "pending" ? (
        <>
          {unavailable ? (
            <p className="recipe-proposal-unavailable">{unavailable}</p>
          ) : (
            <p>
              Log this amount as eaten? Your batch will have{" "}
              {Math.round((remaining - portions) * 10000) / 10000} portions
              left.
            </p>
          )}
          <div className="recipe-proposal-actions">
            <button
              className="recipe-proposal-accept"
              onClick={onAccept}
              disabled={!!unavailable}
            >
              <Check size={16} />
              Log portion
            </button>
            <button className="recipe-proposal-dismiss" onClick={onDismiss}>
              Not now
            </button>
          </div>
        </>
      ) : (
        <p className="recipe-proposal-result">
          <Check size={15} />
          {status === "accepted" ? "Portion logged" : "Not logged"}
        </p>
      )}
    </section>
  );
}
