import { z } from "zod";
import { aiNutritionSchema, type AIResult } from "../src/ai-contract.ts";

const money = z.number().nonnegative().nullable();
export const receiptTruthSchema = z.object({
  store: z.string().optional(),
  currency: z.string().nullable().optional(),
  total: money.optional(),
  purchaseDate: z.string().nullable().optional(),
  items: z
    .array(
      z
        .object({
          receiptText: z.string().min(1),
          aliases: z.array(z.string()).default([]),
          quantity: z.string().optional(),
          total: money.optional(),
          match: z
            .enum(["exact", "generic", "unresolved", "nonfood", "user"])
            .optional(),
          needsReview: z.boolean().optional(),
          serving: z.string().optional(),
          nutrition: aiNutritionSchema.nullable().optional(),
        })
        .refine((item) => !item.nutrition || !!item.serving?.trim(), {
          message: "Nutrition ground truth requires its serving description.",
        }),
    )
    .min(1),
});
export type ReceiptTruth = z.infer<typeof receiptTruthSchema>;
const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function scoreReceipt(
  expected: ReceiptTruth,
  result: AIResult,
  tolerancePercent = 5,
) {
  const actual = result.receipt;
  const used = new Set<number>();
  const fields = { correct: 0, checked: 0 };
  const nutrition = { correct: 0, checked: 0 };
  let matched = 0,
    reviewMisses = 0,
    unsupportedNutrition = 0;
  const equal = (a: unknown, b: unknown) =>
    typeof a === "string" && typeof b === "string"
      ? normalize(a) === normalize(b)
      : a === b;
  const compare = (a: unknown, b: unknown, amount = false, exists = true) => {
    if (a === undefined) return;
    fields.checked++;
    if (!exists) return;
    if (
      amount && typeof a === "number" && typeof b === "number"
        ? Math.abs(a - b) <= 0.011
        : equal(a, b ?? null)
    )
      fields.correct++;
  };
  compare(expected.store, actual?.store, false, !!actual);
  compare(expected.currency, actual?.purchase?.currency, false, !!actual);
  compare(expected.total, actual?.purchase?.total, true, !!actual);
  compare(
    expected.purchaseDate,
    actual?.purchase?.purchaseDate,
    false,
    !!actual,
  );
  for (const line of expected.items) {
    const aliases = [line.receiptText, ...line.aliases].map(normalize);
    const index =
      actual?.items.findIndex(
        (item, index) =>
          !used.has(index) && aliases.includes(normalize(item.receiptText)),
      ) ?? -1;
    const item = index >= 0 ? actual!.items[index] : undefined;
    if (index >= 0) {
      used.add(index);
      matched++;
    }
    compare(line.quantity, item?.quantity, false, !!item);
    compare(line.total, item?.price?.total, true, !!item);
    compare(line.match, item?.match, false, !!item);
    compare(line.needsReview, item?.needsReview, false, !!item);
    compare(line.serving, item?.serving, false, !!item);
    if (line.needsReview && item && !item.needsReview) reviewMisses++;
    if (
      (line.match === "nonfood" || line.nutrition === null) &&
      item?.nutrition
    )
      unsupportedNutrition++;
    if (line.nutrition === null) compare(null, item?.nutrition, false, !!item);
    else if (line.nutrition) {
      for (const key of ["calories", "protein", "carbs", "fat"] as const) {
        nutrition.checked++;
        const truth = line.nutrition[key],
          value = item?.nutrition?.[key];
        if (
          line.serving &&
          item?.serving &&
          normalize(line.serving) === normalize(item.serving) &&
          typeof value === "number" &&
          Math.abs(value - truth) <=
            Math.max(0.1, (truth * tolerancePercent) / 100)
        )
          nutrition.correct++;
      }
    }
  }
  return {
    receiptReturned: !!actual,
    correctPurchaseIntent:
      result.decision === "grocery" && result.meal === null,
    expectedLines: expected.items.length,
    extractedLines: actual?.items.length ?? 0,
    matchedLines: matched,
    missedLines: expected.items.length - matched,
    extraLines: (actual?.items.length ?? 0) - matched,
    fields,
    nutrition,
    reviewMisses,
    unsupportedNutrition,
  };
}
