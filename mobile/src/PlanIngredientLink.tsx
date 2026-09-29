import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Field, Row, s } from "./ui";
import type { PantryLot } from "../../src/features/pantry/ledger";
import type { FoodPreferences } from "../../src/features/preferences/contracts";
import type { PlannedMeal } from "../../src/features/planning/contracts";
import {
  linkablePantryLots,
  suggestedLinkedServings,
} from "../../src/features/planning/pantry-links";
import { formatIngredientAmount } from "../../src/features/planning/meal-plans";

export function PlanIngredientLink({
  ingredient,
  lots,
  preferences,
  onLink,
}: {
  ingredient: PlannedMeal["ingredients"][number];
  lots: PantryLot[];
  preferences: FoodPreferences;
  onLink: (lotId: string, amount: number) => void;
}) {
  const [open, setOpen] = useState(false),
    [lotId, setLotId] = useState(""),
    [amount, setAmount] = useState(""),
    [checked, setChecked] = useState(false);
  const candidates = linkablePantryLots(lots, preferences),
    selected = candidates.find((lot) => lot.id === lotId);
  if (!open)
    return (
      <Button
        secondary
        label={`${ingredient.lotId ? "Replace" : "Connect purchased"} ${ingredient.name}`}
        onPress={() => setOpen(true)}
      />
    );
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.h3}>Connect {ingredient.name}</Text>
      <Text style={s.muted}>
        Recipe needs{" "}
        {formatIngredientAmount(ingredient.servings, ingredient.servingLabel)}.
        Choose reviewed pantry stock.
      </Text>
      {candidates.map((lot) => (
        <Row
          key={lot.id}
          title={`${lot.id === lotId ? "✓ " : ""}${lot.item.name}`}
          detail={`${lot.item.serving} · ${lot.remaining} left · ${lot.date}`}
          onPress={() => {
            setLotId(lot.id);
            setAmount(String(suggestedLinkedServings(ingredient, lot) ?? ""));
            setChecked(false);
          }}
        />
      ))}
      {!candidates.length && (
        <Text style={s.muted}>
          Review your purchase and its available quantity in the pantry first.
        </Text>
      )}
      {selected && (
        <>
          <Field
            label="Labeled servings for the whole recipe"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={(value) => {
              setAmount(value);
              setChecked(false);
            }}
          />
          <Text style={s.tiny}>
            One serving = {selected.item.serving}. Different units, raw/cooked
            amounts and density need your own checked conversion.
          </Text>
          <Button
            secondary
            label={`${checked ? "✓ " : ""}I checked the product, preparation state and amount`}
            onPress={() => setChecked(!checked)}
          />
          <Button
            label="Use this ingredient"
            disabled={
              !checked ||
              !Number.isFinite(Number(amount)) ||
              Number(amount) <= 0 ||
              Number(amount) > 1000
            }
            onPress={() => {
              onLink(lotId, Number(amount));
              setOpen(false);
              setChecked(false);
            }}
          />
        </>
      )}
      <Button
        secondary
        label="Cancel connection"
        onPress={() => setOpen(false)}
      />
      <Text style={s.tiny}>
        Updates the draft only. Approve it before logging a portion.
      </Text>
    </View>
  );
}
