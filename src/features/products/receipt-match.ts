import { groceryItemSchema, type GroceryItem } from "../../ai-contract";
import { nutritionForServing, productSchema, type FoodProduct } from "./contracts";

/** A text-search candidate changes a purchase only after the user chooses it. */
export function applyReceiptProduct(item: GroceryItem, value: FoodProduct, servingsPurchased: number | null): GroceryItem {
  const product = productSchema.parse(value);
  if (product.source.provider !== "usda") throw new Error("Choose a USDA product for this match.");
  const nutrition = nutritionForServing(product);
  const serving = product.serving.label.trim() || (product.serving.amount ? `${product.serving.amount} ${product.serving.unit}`.trim() : "");
  return groceryItemSchema.parse({
    ...item,
    name: product.name.slice(0, 200),
    productSnapshot: product,
    serving: serving.slice(0, 150),
    // Never carry a receipt estimate's serving count over to a different product basis.
    servingsPurchased,
    nutrition,
    match: nutrition && serving ? "user" : "unresolved",
    needsReview: !nutrition || !serving,
    sources: product.source.url ? [{title: "USDA FoodData Central", url: product.source.url}] : [],
    note: "USDA product selected by you. Nutrition uses this product's labeled serving. Purchase quantity is separate from food eaten." + (!nutrition ? " Complete per-serving nutrition could not be established; check the package label." : ""),
  });
}
