import { describe, it, expect } from "vitest";
import { normalizeResearchedPrices, researchedPricesSchema } from "./shopping";
import { normalizeUSDA } from "./products/usda";

const product = normalizeUSDA({
  fdcId: 1,
  dataType: "Branded",
  gtinUpc: "012345678905",
  description: "Beans",
  servingSize: 40,
  servingSizeUnit: "g",
  labelNutrients: { calories: { value: 100 } },
})!;
const input = {
  original: product,
  alternative: { ...product, id: "usda:2", gtin: "00098765432105" },
  stores: ["Store"],
};
const quote = {
  productId: product.id,
  gtin: product.gtin,
  price: 2,
  amount: 400,
  unit: "g" as const,
  currency: "USD",
  store: "Store",
  conditions: "Member price",
  sourceUrl: "https://www.kroger.com/p/beans/012345678905",
};
describe("researched shopping prices", () => {
  it("requires a retrieved source and exact product identity; research never confirms a price", () => {
    const response = { quotes: [quote], note: "Check membership conditions." };
    expect(
      normalizeResearchedPrices(response, input, new Map(), "2026-09-26")
        .quotes,
    ).toEqual({});
    const sources = new Map([
      [quote.sourceUrl, { url: quote.sourceUrl, title: "Store" }],
    ]);
    expect(
      normalizeResearchedPrices(response, input, sources, "2026-09-26").quotes[
        product.id
      ],
    ).toMatchObject({
      price: 2,
      amount: 400,
      confirmed: false,
      date: "2026-09-26",
      conditions: "Member price",
    });
    expect(
      normalizeResearchedPrices(
        { ...response, quotes: [{ ...quote, gtin: "wrong" }] },
        input,
        sources,
        "2026-09-26",
      ).quotes,
    ).toEqual({});
    expect(
      normalizeResearchedPrices(
        { ...response, quotes: [{ ...quote, currency: "??" }] },
        input,
        sources,
        "2026-09-26",
      ).quotes,
    ).toEqual({});
  });
  it("rejects impossible price evidence and limits research to the two requested products", () => {
    expect(
      researchedPricesSchema.safeParse({
        quotes: [{ ...quote, amount: 0 }],
        note: "",
      }).success,
    ).toBe(false);
    expect(
      researchedPricesSchema.safeParse({
        quotes: [quote, quote, quote],
        note: "",
      }).success,
    ).toBe(false);
  });
});
