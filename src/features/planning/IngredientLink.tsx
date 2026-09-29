import { useState } from "react";
import type { PantryLot } from "../pantry/ledger";
import type { FoodPreferences } from "../preferences/contracts";
import type { PlannedMeal } from "./contracts";
import { formatIngredientAmount } from "./meal-plans";
import { linkablePantryLots, suggestedLinkedServings } from "./pantry-links";

export default function IngredientLink({
  ingredient,
  lots,
  preferences,
  onLink,
}: {
  ingredient: PlannedMeal["ingredients"][number];
  lots: PantryLot[];
  preferences: FoodPreferences;
  onLink: (lotId: string, servings: number) => void;
}) {
  const [open, setOpen] = useState(false),
    [lotId, setLotId] = useState(""),
    [amount, setAmount] = useState(""),
    [checked, setChecked] = useState(false);
  const candidates = linkablePantryLots(lots, preferences),
    selected = candidates.find((lot) => lot.id === lotId);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)}>
        {ingredient.lotId
          ? "Replace pantry ingredient"
          : "Connect purchased ingredient"}
      </button>
    );
  return (
    <fieldset className="fuel-ingredient-link">
      <legend>Connect {ingredient.name} to your pantry</legend>
      <p>
        Recipe needs{" "}
        {formatIngredientAmount(ingredient.servings, ingredient.servingLabel)}.
        Check the actual product and whether it is raw or cooked.
      </p>
      <label>
        Purchased ingredient
        <select
          aria-label="Purchased ingredient"
          value={lotId}
          onChange={(event) => {
            const lot = candidates.find(
              (item) => item.id === event.target.value,
            );
            setLotId(event.target.value);
            setAmount(
              lot ? String(suggestedLinkedServings(ingredient, lot) ?? "") : "",
            );
            setChecked(false);
          }}
        >
          <option value="">Choose reviewed pantry stock</option>
          {candidates.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.item.name} · {lot.item.serving} · {lot.remaining} left ·{" "}
              {lot.date}
            </option>
          ))}
        </select>
      </label>
      {!candidates.length && (
        <p>
          Review your new purchase and remaining quantity in the pantry first.
        </p>
      )}
      {selected && (
        <>
          <label>
            Labeled servings for the whole recipe
            <input
              type="number"
              min="0.0001"
              max="1000"
              step="any"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setChecked(false);
              }}
            />
          </label>
          <p>
            One serving = {selected.item.serving}. Different units or
            preparation states need your own checked conversion.
          </p>
          <label>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            I checked the product, preparation state and amount.
          </label>
          <button
            type="button"
            disabled={
              !checked ||
              !Number.isFinite(Number(amount)) ||
              Number(amount) <= 0 ||
              Number(amount) > 1000
            }
            onClick={() => {
              onLink(lotId, Number(amount));
              setOpen(false);
              setChecked(false);
            }}
          >
            Use this ingredient
          </button>
        </>
      )}
      <button type="button" onClick={() => setOpen(false)}>
        Cancel connection
      </button>
      <small>
        This updates the draft only. Approve it before logging a portion.
      </small>
    </fieldset>
  );
}
