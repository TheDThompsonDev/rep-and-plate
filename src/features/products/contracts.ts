import { z } from "zod";

const nutrient = z.number().finite().min(0).max(20000).nullable();
export const productSchema = z.object({
  sugars: z.object({ total: nutrient, added: nutrient }).optional(),
  id: z.string().min(1),
  gtin: z.string().regex(/^\d{14}$/),
  name: z.string().min(1).max(300),
  brand: z.string().max(200),
  ingredients: z.string().max(12000),
  serving: z.object({ label: z.string().max(300), amount: z.number().positive().nullable(), unit: z.string().max(30) }),
  nutrition: z.object({ calories: nutrient, protein: nutrient, carbs: nutrient, fat: nutrient }),
  basis: z.enum(["serving", "100g", "100ml"]),
  source: z.object({
    provider: z.enum(["usda", "label"]), id: z.string(), url: z.string().url().nullable(),
    fetchedAt: z.string(), updatedAt: z.string().nullable(), release: z.string().nullable(),
  }),
  verification: z.enum(["source", "user-confirmed", "estimated"]),
  version: z.string(),
});
export type FoodProduct = z.infer<typeof productSchema>;
export const productLookupSchema = z.object({
  status: z.enum(["found", "not-found", "ambiguous", "unavailable", "rate-limited", "invalid"]),
  products: z.array(productSchema).max(20), message: z.string(), cached: z.boolean().optional(),
});
export type ProductLookup = z.infer<typeof productLookupSchema>;

/** GTIN-8/12/13/14 only. UPC-E must be expanded by the decoder, never guessed. */
export function normalizeGTIN(input: string): string | null {
  const code = input.trim().replace(/[ -]/g, "");
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length)) return null;
  let total = 0;
  for (let i = code.length - 2, n = 0; i >= 0; i--, n++) total += Number(code[i]) * (n % 2 === 0 ? 3 : 1);
  if ((10 - total % 10) % 10 !== Number(code.at(-1))) return null;
  return code.padStart(14, "0");
}

export function nutritionForServing(product: FoodProduct) {
  const { calories, protein, carbs, fat } = product.nutrition;
  if ([calories, protein, carbs, fat].some((v) => v === null)) return null;
  let factor = 1;
  if (product.basis !== "serving") {
    const unit = product.serving.unit.toLowerCase();
    if (!product.serving.amount || (product.basis === "100g" ? !["g", "gram", "grams"].includes(unit) : !["ml", "milliliter", "milliliters"].includes(unit))) return null;
    factor = product.serving.amount / 100;
  }
  const round = (n: number) => Math.round(n * factor * 100) / 100;
  return { calories: round(calories!), protein: round(protein!), carbs: round(carbs!), fat: round(fat!) };
}
