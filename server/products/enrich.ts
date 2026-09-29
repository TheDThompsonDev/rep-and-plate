import { aiNutritionSchema, type AIResult } from "../../src/ai-contract.ts";
import {
  normalizeGTIN,
  nutritionForServing,
  type ProductLookup,
} from "../../src/features/products/contracts.ts";
import { createProductResolver } from "./resolver.ts";

type Resolver = {
  lookup: (barcode: string, signal?: AbortSignal) => Promise<ProductLookup>;
  close: () => void;
};

/** A receipt SKU, phone number, or order number is not evidence of a GTIN. */
export function explicitReceiptBarcodes(text: string): string[] {
  const matches = text.matchAll(
    /\b(?:UPC(?:-A)?|EAN(?:-13|-8)?|GTIN(?:-14|-13|-12|-8)?|barcode)\s*[:#-]?\s*(\d{8}|\d{12,14})(?!\d)\b/gi,
  );
  return [
    ...new Set(
      [...matches]
        .map((match) => normalizeGTIN(match[1]))
        .filter((code): code is string => code !== null),
    ),
  ];
}

export async function enrichReceipt(
  result: AIResult,
  key?: string,
  signal?: AbortSignal,
  makeResolver: (key?: string) => Resolver = (apiKey) =>
    createProductResolver({ key: apiKey }),
): Promise<AIResult> {
  if (!result.receipt || result.decision !== "grocery") return result;
  const candidates = result.receipt.items.map((item) =>
    item.match === "nonfood"
      ? []
      : explicitReceiptBarcodes(`${item.receiptText}\n${item.name}`),
  );
  if (!candidates.some((codes) => codes.length)) return result;
  const budget = AbortSignal.timeout(20000);
  const requestSignal = signal ? AbortSignal.any([signal, budget]) : budget;
  const resolved = new Map<string, ProductLookup>();
  const notes: string[] = [];
  let resolver: Resolver | undefined;
  try {
    resolver = makeResolver(key);
    for (const codes of candidates) {
      if (codes.length !== 1) continue;
      const code = codes[0];
      if (resolved.has(code)) continue;
      if (resolved.size >= 5 || requestSignal.aborted) {
        notes.push(
          "Some printed barcodes still need a lookup. Scan those packages to finish checking them.",
        );
        break;
      }
      const lookup = await resolver.lookup(code, requestSignal);
      resolved.set(code, lookup);
      if (lookup.status === "rate-limited") {
        notes.push(
          "USDA reached its request limit. Remaining product matches still need a check.",
        );
        break;
      }
    }
  } catch {
    notes.push(
      "Some USDA product matches could not be checked. Existing receipt estimates still need review.",
    );
  } finally {
    resolver?.close();
  }

  const receipt = result.receipt;
  const items = receipt.items.map((item, index) => {
    const codes = candidates[index];
    if (!codes.length) return item;
    if (codes.length > 1)
      return {
        ...item,
        needsReview: true,
        note: `${item.note} Multiple printed product identifiers need a package check.`.slice(
          0,
          1200,
        ),
      };
    const lookup = resolved.get(codes[0]);
    const product =
      lookup?.status === "found" && lookup.products.length === 1
        ? lookup.products[0]
        : null;
    if (
      !product ||
      product.gtin !== codes[0] ||
      product.source.provider !== "usda"
    ) {
      return {
        ...item,
        needsReview: true,
        note: `${item.note} The printed barcode did not produce one confirmed USDA product match. Check the package.`.slice(
          0,
          1200,
        ),
      };
    }
    const scaled = nutritionForServing(product);
    const nutrition = aiNutritionSchema.safeParse(scaled);
    if (!nutrition.success)
      return {
        ...item,
        needsReview: true,
        note: `${item.note} USDA matched the barcode but the serving nutrition is incomplete. Check the package label.`.slice(
          0,
          1200,
        ),
      };
    const sameServing =
      item.serving.trim().toLowerCase() ===
      product.serving.label.trim().toLowerCase();
    const sources = product.source.url
      ? [
          { title: "USDA FoodData Central", url: product.source.url },
          ...item.sources.filter((source) => source.url !== product.source.url),
        ].slice(0, 6)
      : item.sources;
    return {
      ...item,
      name: product.name.slice(0, 200),
      serving: product.serving.label.slice(0, 150),
      nutrition: nutrition.data,
      productSnapshot: product,
      match: "exact" as const,
      needsReview: !sameServing || item.needsReview,
      servingsPurchased: sameServing ? item.servingsPurchased : null,
      sources,
      note: `Exact printed barcode matched USDA FoodData Central (${product.source.id}). Compare the package and serving size.${sameServing ? "" : " Confirm the number of purchased servings for this serving size; purchase quantity text is unchanged."}`,
    };
  });
  const sources = [
    ...new Map(
      [...receipt.sources, ...items.flatMap((item) => item.sources)].map(
        (source) => [source.url, source],
      ),
    ).values(),
  ].slice(0, 30);
  return {
    ...result,
    receipt: { ...receipt, items, sources },
    warnings: [...new Set([...result.warnings, ...notes])].slice(0, 10),
  };
}
