import { describe, expect, it, vi } from "vitest";
import { explicitReceiptBarcodes, enrichReceipt } from "./enrich.ts";
import { resultFixture } from "../../tests/ai-fixtures.ts";
import { normalizeUSDA } from "./usda.ts";
import type { ProductLookup } from "../../src/features/products/contracts.ts";

function productResult(): ProductLookup {
  return {
    status: "found",
    message: "Matched",
    products: [
      normalizeUSDA({
        fdcId: 123456,
        dataType: "Branded",
        gtinUpc: "012345678905",
        description: "Fixture milk",
        servingSize: 240,
        servingSizeUnit: "ml",
        householdServingFullText: "1 cup",
        labelNutrients: {
          calories: { value: 150 },
          protein: { value: 8 },
          carbohydrates: { value: 12 },
          fat: { value: 8 },
        },
      })!,
    ],
  };
}

describe("receipt USDA enrichment", () => {
  it("only accepts explicitly labeled identifiers with a valid checksum", () => {
    expect(
      explicitReceiptBarcodes("SKU 012345678905 Order 049000006346"),
    ).toEqual([]);
    expect(explicitReceiptBarcodes("UPC: 012345678906")).toEqual([]);
    expect(
      explicitReceiptBarcodes("Milk UPC: 012345678905 barcode 00012345678905"),
    ).toEqual(["00012345678905"]);
    expect(explicitReceiptBarcodes("UPC: 01234567890599")).toEqual([]);
  });
  it("does not even open the catalog for ordinary receipt lines", async () => {
    const result = resultFixture("receipt");
    const factory = vi.fn();
    expect(await enrichReceipt(result, undefined, undefined, factory)).toBe(
      result,
    );
    expect(factory).not.toHaveBeenCalled();
  });
  it("enriches an exact code, keeps receipt text, and clears quantities when serving basis changes", async () => {
    const result = resultFixture("receipt");
    result.receipt!.items[0].receiptText = "MILK UPC: 012345678905";
    result.receipt!.items[0].serving = "8 fl oz (estimated)";
    const lookup = vi.fn().mockResolvedValue(productResult());
    const close = vi.fn();
    const next = await enrichReceipt(result, "secret", undefined, () => ({
      lookup,
      close,
    }));
    expect(next.receipt!.items[0]).toMatchObject({
      receiptText: "MILK UPC: 012345678905",
      name: "Fixture milk",
      servingsPurchased: null,
      needsReview: true,
      match: "exact",
      nutrition: { calories: 150 },
    });
    expect(next.receipt!.items[0].quantity).toBe(
      result.receipt!.items[0].quantity,
    );
    expect(next.meal).toBeNull();
    expect(close).toHaveBeenCalledOnce();
    expect(next.receipt!.items[0].sources[0].url).toContain("123456");
  });
  it("preserves compatible purchase counts, reuses duplicate lookups, and holds conflicting identifiers", async () => {
    const result = resultFixture("receipt");
    result.receipt!.items = [0, 1].map((index) => ({
      ...result.receipt!.items[0],
      id: String(index),
      receiptText: "MILK UPC: 012345678905",
      serving: "1 cup",
      servingsPurchased: 8,
      needsReview: false,
    }));
    result.receipt!.items.push({
      ...result.receipt!.items[0],
      id: "conflict",
      receiptText: "UPC: 012345678905 EAN: 049000006346",
    });
    const lookup = vi.fn().mockResolvedValue(productResult());
    const next = await enrichReceipt(result, undefined, undefined, () => ({
      lookup,
      close() {},
    }));
    expect(lookup).toHaveBeenCalledOnce();
    expect(next.receipt!.items[0].servingsPurchased).toBe(8);
    expect(next.receipt!.items[0].needsReview).toBe(false);
    expect(next.receipt!.items[2].needsReview).toBe(true);
  });
  it("retains web estimates with review when USDA fails or returns ambiguity", async () => {
    const result = resultFixture("receipt");
    result.receipt!.items[0].receiptText = "MILK UPC 012345678905";
    const close = vi.fn();
    const next = await enrichReceipt(result, undefined, undefined, () => ({
      lookup: vi.fn().mockRejectedValue(new Error("private upstream error")),
      close,
    }));
    expect(next.receipt!.items[0].nutrition).toEqual(
      result.receipt!.items[0].nutrition,
    );
    expect(next.receipt!.items[0].needsReview).toBe(true);
    expect(JSON.stringify(next)).not.toContain("private upstream");
    expect(close).toHaveBeenCalledOnce();
    const ambiguous = await enrichReceipt(result, undefined, undefined, () => ({
      lookup: async () => ({ ...productResult(), status: "ambiguous" }),
      close() {},
    }));
    expect(ambiguous.receipt!.items[0].nutrition).toEqual(
      result.receipt!.items[0].nutrition,
    );
    expect(ambiguous.receipt!.items[0].needsReview).toBe(true);
  });
  it("bounds requests to five unique codes and skips nonfood lines", async () => {
    const result = resultFixture("receipt");
    const base = result.receipt!.items[0];
    const barcode = (index: number) => {
      const stem = String(12345678000 + index);
      const sum = [...stem]
        .reverse()
        .reduce(
          (total, digit, position) =>
            total + Number(digit) * (position % 2 === 0 ? 3 : 1),
          0,
        );
      return `${stem}${(10 - (sum % 10)) % 10}`;
    };
    result.receipt!.items = Array.from({ length: 7 }, (_, index) => ({
      ...base,
      id: String(index),
      receiptText: `UPC: ${barcode(index)}`,
    }));
    result.receipt!.items.unshift({
      ...base,
      id: "soap",
      match: "nonfood",
      receiptText: "UPC: 012345678905",
    });
    const lookup = vi
      .fn()
      .mockResolvedValue({
        status: "not-found",
        products: [],
        message: "No match",
      });
    const next = await enrichReceipt(result, undefined, undefined, () => ({
      lookup,
      close() {},
    }));
    expect(lookup).toHaveBeenCalledTimes(5);
    expect(next.receipt!.items[0]).toEqual(result.receipt!.items[0]);
    expect(
      next.warnings.some((warning) => warning.includes("still need a lookup")),
    ).toBe(true);
  });
});
