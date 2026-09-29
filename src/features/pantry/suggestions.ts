import type { AppState, Meal } from "../../domain";
import { getPantryLots, type PantryLot } from "./ledger";

const generic = new Set([
  "a",
  "an",
  "and",
  "the",
  "with",
  "in",
  "on",
  "of",
  "to",
  "for",
  "from",
  "my",
  "your",
  "this",
  "that",
  "was",
  "is",
  "at",
  "it",
  "by",
  "meal",
  "food",
  "dinner",
  "lunch",
  "breakfast",
  "snack",
  "serving",
  "portion",
  "cup",
  "cups",
  "gram",
  "grams",
  "ml",
  "oz",
  "tbsp",
  "tsp",
  "cal",
  "calorie",
  "protein",
  "carb",
  "fat",
  "estimate",
  "estimated",
  "confirmed",
  "saved",
  "added",
  "source",
  "review",
  "label",
  "package",
  "quantity",
  "nutrition",
  "ingredient",
  "ingredients",
  "original",
  "organic",
  "fresh",
  "natural",
  "large",
  "small",
  "regular",
  "plain",
  "brand",
  "extra",
  "made",
  "used",
  "you",
]);
const singular = (word: string) =>
  word === "oats"
    ? "oat"
    : word.endsWith("ies") && word.length > 4
      ? `${word.slice(0, -3)}y`
      : word.endsWith("s") && word.length > 4 && !word.endsWith("ss")
        ? word.slice(0, -1)
        : word;
function words(value: string): Set<string> {
  return new Set(
    (
      value
        .normalize("NFKD")
        .toLowerCase()
        .match(/[a-z]+/g) || []
    )
      .map(singular)
      .filter((word) => word.length > 2 && !generic.has(word)),
  );
}
function positiveDescription(value: string): string {
  // No attempt to infer ingredients from negated or uncertain phrases.
  return value
    .split(/[,.!?;]/)
    .filter(
      (phrase) =>
        !/\b(?:no|not|without|excluding|skip|maybe|possibly|uncertain|unknown)\b|confidence|\b\w+-free\b/i.test(
          phrase,
        ),
    )
    .join(" ");
}

export function pantryLinkBlockReason(lot: PantryLot): string | null {
  if (lot.inconsistent)
    return "The purchase quantity changed after some was used. Check the remaining amount first.";
  if (lot.item.availability === "used" || lot.remaining === 0)
    return "This purchase has no available servings. Check the pantry if that is incorrect.";
  if (lot.remaining === null)
    return "The number of servings available is unknown. Check the purchase quantity in your pantry first.";
  if (!lot.item.serving.trim())
    return "The serving size needs a check in your pantry first.";
  if (lot.item.needsReview || !lot.item.nutrition)
    return "Check this item's nutrition and serving size in your pantry first.";
  return null;
}

export type PantryLinkSuggestion = {
  lot: PantryLot;
  score: number;
  matchedWords: string[];
  reasons: string[];
  ambiguous: boolean;
  blockedReason: string | null;
};

/** Suggestions are possible name matches, never evidence that an ingredient was used. */
export function suggestPantryLinks(
  state: AppState,
  meal: Meal,
): PantryLinkSuggestion[] {
  const title = words(positiveDescription(meal.title));
  const components = words(
    (meal.components || [])
      .map((item) => positiveDescription(item.name))
      .join(" "),
  );
  const note = words(positiveDescription(meal.note));
  const suggestions: PantryLinkSuggestion[] = [];
  for (const lot of getPantryLots(state)) {
    const tokens = words(lot.item.name);
    const componentMatches = [...tokens].filter((word) => components.has(word));
    const titleMatches = [...tokens].filter((word) => title.has(word));
    const noteMatches = [...tokens].filter((word) => note.has(word));
    if (
      !componentMatches.length &&
      !titleMatches.length &&
      noteMatches.length < 2
    )
      continue;
    const matchedWords = [
      ...new Set([...componentMatches, ...titleMatches, ...noteMatches]),
    ].sort();
    const score =
      componentMatches.length * 4 +
      titleMatches.length * 3 +
      noteMatches.length;
    const reasons = [
      `Shares ${matchedWords.map((word) => `“${word}”`).join(", ")} with ${componentMatches.length ? "a saved meal component" : titleMatches.length ? "the meal name" : "the meal description"}.`,
    ];
    suggestions.push({
      lot,
      score,
      matchedWords,
      reasons,
      ambiguous: false,
      blockedReason: pantryLinkBlockReason(lot),
    });
  }
  for (const suggestion of suggestions) {
    suggestion.ambiguous = suggestions.some(
      (other) =>
        other.lot.id !== suggestion.lot.id &&
        other.matchedWords.some((word) =>
          suggestion.matchedWords.includes(word),
        ),
    );
    if (suggestion.ambiguous)
      suggestion.reasons.push(
        "More than one purchase shares this name. Check the product and purchase date.",
      );
    suggestion.reasons.push("Only you can confirm whether this was used.");
  }
  return suggestions.sort(
    (a, b) =>
      b.score - a.score ||
      a.lot.item.name.localeCompare(b.lot.item.name) ||
      a.lot.id.localeCompare(b.lot.id),
  );
}
