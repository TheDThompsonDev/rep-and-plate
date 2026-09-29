import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupUSDA, normalizeUSDA } from "./usda.ts";
import { nutritionForServing } from "../../src/features/products/contracts.ts";

const raw = (changes: Record<string, unknown> = {}) => ({
  fdcId: 123456,
  dataType: "Branded",
  gtinUpc: "012345678905",
  description: "Fixture whole milk",
  brandOwner: "Fixture dairy",
  ingredients: "Milk, vitamin D3.",
  servingSize: 240,
  servingSizeUnit: "ml",
  householdServingFullText: "1 cup",
  modifiedDate: "2026-04-01",
  foodNutrients: [
    { amount: 62.5, nutrient: { id: 1008, unitName: "kcal" } },
    { amount: 3.33, nutrient: { id: 1003, unitName: "g" } },
    { amount: 5, nutrient: { id: 1005, unitName: "g" } },
    { amount: 3.33, nutrient: { id: 1004, unitName: "g" } },
  ],
  ...changes,
});
afterEach(() => vi.restoreAllMocks());

describe("USDA normalization", () => {
  it('keeps sugar on the same basis as macros and distinguishes missing from a reported zero',()=>{
    const source=raw({foodNutrients:[{amount:10,nutrient:{id:2000,unitName:'g'}},{amount:0,nutrient:{id:1235,unitName:'g'}}]});
    expect(normalizeUSDA(source)?.sugars).toEqual({total:10,added:0});
    expect(normalizeUSDA({...source,labelNutrients:{calories:{value:100},sugars:{value:0}}})?.sugars).toEqual({total:0,added:null});
    expect(normalizeUSDA({...source,labelNutrients:{calories:{value:100}}})?.sugars).toEqual({total:null,added:null});
  });
  it("preserves leading zeros, the volume basis, and serving conversion", () => {
    const product = normalizeUSDA(raw(), "2026-04")!;
    expect(product.gtin).toBe("00012345678905");
    expect(product.basis).toBe("100ml");
    expect(product.source.release).toBe("2026-04");
    expect(nutritionForServing(product)?.calories).toBe(150);
    expect(normalizeUSDA(raw())?.version).toBe(product.version);
  });
  it("preserves label values as one serving without filling gaps from 100g values", () => {
    const product = normalizeUSDA(
      raw({
        labelNutrients: {
          calories: { value: 150 },
          protein: { value: 0 },
          carbohydrates: { value: "12" },
        },
      }),
    )!;
    expect(product.basis).toBe("serving");
    expect(product.nutrition).toEqual({
      calories: 150,
      protein: 0,
      carbs: null,
      fat: null,
    });
    expect(nutritionForServing(product)).toBeNull();
  });
  it("handles mass and kJ, rejects incompatible macro units, and never invents density", () => {
    const product = normalizeUSDA(
      raw({
        servingSize: 40,
        servingSizeUnit: "g",
        foodNutrients: [
          { amount: 418.4, nutrient: { id: 1062, unitName: "kJ" } },
          { amount: 3000, nutrient: { id: 1003, unitName: "mg" } },
          { amount: 10, nutrient: { id: 1004, unitName: "IU" } },
        ],
      }),
    )!;
    expect(product.basis).toBe("100g");
    expect(product.nutrition).toEqual({
      calories: 100,
      protein: 3,
      carbs: null,
      fat: null,
    });
    const unknown = normalizeUSDA(raw({ servingSizeUnit: "fl oz" }))!;
    expect(Object.values(unknown.nutrition)).toEqual([null, null, null, null]);
    expect(nutritionForServing(unknown)).toBeNull();
  });
  it("rejects invalid identity, non-branded and discontinued records; versions changes", () => {
    expect(normalizeUSDA(raw({ gtinUpc: "123" }))).toBeNull();
    expect(normalizeUSDA(raw({ discontinuedDate: "2025-12-01" }))).toBeNull();
    expect(normalizeUSDA(raw({ dataType: "Foundation" }))).toBeNull();
    expect(
      normalizeUSDA(raw({ description: "Changed package" }))?.version,
    ).not.toBe(normalizeUSDA(raw())?.version);
  });
});

describe("USDA exact barcode lookup", () => {
  it("does not call the network for missing configuration or an invalid code", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    expect((await lookupUSDA("012345678905", undefined)).status).toBe(
      "unavailable",
    );
    expect((await lookupUSDA("012345678906", "test-key")).status).toBe(
      "invalid",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects keyword candidates and rechecks detail identity", async () => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          foods: [raw({ gtinUpc: "049000006346" }), raw()],
          totalHits: 2,
        }),
      )
      .mockResolvedValueOnce(Response.json([raw({ gtinUpc: "049000006346" })]));
    const result = await lookupUSDA("012345678905", "test-key");
    expect(result.status).toBe("not-found");
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body)).fdcIds).toEqual([
      123456,
    ]);
  });
  it("returns exact matches and exposes duplicate source versions for review", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({ foods: [raw(), raw({ fdcId: 234567 })], totalHits: 2 }),
      )
      .mockResolvedValueOnce(
        Response.json([
          raw(),
          raw({ fdcId: 234567, modifiedDate: "2026-05-01", servingSize: 250 }),
        ]),
      );
    const result = await lookupUSDA("00012345678905", "test-key");
    expect(result.status).toBe("ambiguous");
    expect(result.products).toHaveLength(2);
    expect(result.products[0].serving.amount).toBe(250);
  });
  it("distinguishes quota, upstream errors, malformed responses, and cancellation", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    fetch.mockResolvedValueOnce(
      new Response("secret upstream body", { status: 429 }),
    );
    expect((await lookupUSDA("012345678905", "secret-key")).status).toBe(
      "rate-limited",
    );
    fetch.mockResolvedValueOnce(
      new Response("secret upstream body", { status: 403 }),
    );
    const unavailable = await lookupUSDA("012345678905", "secret-key");
    expect(unavailable.status).toBe("unavailable");
    expect(JSON.stringify(unavailable)).not.toContain("secret");
    fetch.mockResolvedValueOnce(Response.json({ surprise: true }));
    expect((await lookupUSDA("012345678905", "test-key")).status).toBe(
      "unavailable",
    );
    fetch.mockRejectedValueOnce(new DOMException("Stopped", "AbortError"));
    expect(
      (await lookupUSDA("012345678905", "test-key", AbortSignal.abort()))
        .status,
    ).toBe("unavailable");
  });
});
