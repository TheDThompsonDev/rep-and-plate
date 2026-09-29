import { createHash } from "node:crypto";
import {
  normalizeGTIN,
  productSchema,
  type FoodProduct,
  type ProductLookup,
} from "../../src/features/products/contracts.ts";

const API = "https://api.nal.usda.gov/fdc/v1";
type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
const text = (value: unknown, max = 300): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const number = (value: unknown): number | null =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 20000
    ? value
    : null;
const blank = () =>
  ({
    calories: null,
    protein: null,
    carbs: null,
    fat: null,
  }) as FoodProduct["nutrition"];
const sourceDate = (value: unknown): string | null => {
  const valueText = text(value);
  if (!valueText) return null;
  const milliseconds = Date.parse(valueText);
  return Number.isFinite(milliseconds)
    ? new Date(milliseconds).toISOString().slice(0, 10)
    : null;
};

/** Shared by live lookup and bulk import. Never infers missing nutrition or density. */
export function normalizeUSDA(
  raw: unknown,
  release?: string,
): FoodProduct | null {
  const food = record(raw);
  const gtin = normalizeGTIN(text(food.gtinUpc, 30));
  const fdcId = food.fdcId;
  const name = text(food.description);
  if (
    !gtin ||
    !name ||
    typeof fdcId !== "number" ||
    !Number.isSafeInteger(fdcId) ||
    fdcId <= 0 ||
    (food.dataType && food.dataType !== "Branded")
  )
    return null;
  // Discontinued observations remain in source archives; do not offer them as current products.
  if (text(food.discontinuedDate)) return null;
  const servingUnit = text(food.servingSizeUnit, 30).toLowerCase();
  const unit = ["g", "gram", "grams", "grm"].includes(servingUnit)
    ? "g"
    : ["ml", "milliliter", "milliliters", "mlt"].includes(servingUnit)
      ? "ml"
      : servingUnit;
  const amount = number(food.servingSize);
  const serving = {
    label:
      text(food.householdServingFullText) ||
      (amount && unit ? `${amount} ${unit}` : "Serving size unavailable"),
    amount: amount && amount > 0 ? amount : null,
    unit,
  };
  const label = record(food.labelNutrients);
  const labelSugars = {total:number(record(label.sugars).value),added:number(record(label.addedSugars).value)};
  let sugars:FoodProduct['sugars']={total:null,added:null};
  const labelValues = {
    calories: number(record(label.calories).value),
    protein: number(record(label.protein).value),
    carbs: number(record(label.carbohydrates).value),
    fat: number(record(label.fat).value),
  };
  let nutrition = blank();
  let basis: FoodProduct["basis"] = unit === "ml" ? "100ml" : "100g";
  if (Object.values(labelValues).some((value) => value !== null)) {
    nutrition = labelValues;
    sugars = labelSugars;
    basis = "serving";
  } else if (unit === "g" || unit === "ml") {
    // FoodNutrients uses USDA's 100-unit basis. Units belong to each nutrient, not the serving.
    let kilojoules: number | null = null;
    for (const rawNutrient of Array.isArray(food.foodNutrients)
      ? food.foodNutrients
      : []) {
      const row = record(rawNutrient);
      const nutrient = record(row.nutrient);
      const id = nutrient.id ?? row.nutrientId;
      const legacyNumber = String(nutrient.number ?? row.nutrientNumber ?? "");
      const value = number(row.amount ?? row.value);
      const nutrientUnit = text(
        nutrient.unitName ?? row.unitName,
        20,
      ).toLowerCase();
      if (value === null) continue;
      const sugarField=id===2000 || id===1063 || legacyNumber==='269' ? 'total' : id===1235 || legacyNumber==='539' ? 'added' : null;
      if(sugarField && nutrientUnit==='g')sugars[sugarField]=value;
      if ((id === 1008 || legacyNumber === "208") && nutrientUnit === "kcal")
        nutrition.calories = value;
      if ((id === 1062 || legacyNumber === "268") && nutrientUnit === "kj")
        kilojoules = value;
      const field =
        id === 1003 || legacyNumber === "203"
          ? "protein"
          : id === 1004 || legacyNumber === "204"
            ? "fat"
            : id === 1005 || legacyNumber === "205"
              ? "carbs"
              : null;
      if (field && nutrientUnit === "g") nutrition[field] = value;
      if (field && nutrientUnit === "mg") nutrition[field] = value / 1000;
    }
    if (nutrition.calories === null && kilojoules !== null)
      nutrition.calories = Math.round((kilojoules / 4.184) * 100) / 100;
  }
  const updatedAt =
    sourceDate(food.modifiedDate) ||
    sourceDate(food.publicationDate) ||
    sourceDate(food.availableDate);
  const identity = {
    gtin,
    name,
    brand: text(food.brandName || food.brandOwner, 200),
    ingredients: text(food.ingredients, 12000),
    serving,
    nutrition,
    sugars,
    basis,
  };
  // A changed value creates a new snapshot; fetching it again does not.
  const version = createHash("sha256")
    .update(JSON.stringify({ ...identity, fdcId, updatedAt }))
    .digest("hex")
    .slice(0, 20);
  const result = productSchema.safeParse({
    id: `usda:${fdcId}`,
    ...identity,
    source: {
      provider: "usda",
      id: String(fdcId),
      url: `https://fdc.nal.usda.gov/food-details/${fdcId}/nutrients`,
      fetchedAt: new Date().toISOString(),
      updatedAt,
      release: release || null,
    },
    verification: "source",
    version,
  });
  return result.success ? result.data : null;
}

class USDAError extends Error {
  constructor(readonly status: number) {
    super("USDA request failed");
  }
}

async function request(
  path: string,
  body: unknown,
  key: string,
  signal: AbortSignal,
): Promise<unknown> {
  const url = new URL(`${API}${path}`);
  url.searchParams.set("api_key", key);
  // The URL and upstream error body may contain credentials: neither is logged or returned.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) throw new USDAError(response.status);
  return response.json();
}

export async function lookupUSDA(
  barcode: string,
  key: string | undefined,
  signal?: AbortSignal,
): Promise<ProductLookup> {
  const gtin = normalizeGTIN(barcode);
  if (!gtin)
    return {
      status: "invalid",
      products: [],
      message: "Enter a valid UPC, EAN, or GTIN barcode.",
    };
  if (!key?.trim())
    return {
      status: "unavailable",
      products: [],
      message:
        "USDA lookup is not configured. You can add the nutrition label instead.",
    };
  const timeout = AbortSignal.timeout(15000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    // Leading-zero aliases are equivalent identities, but USDA search indexes the original string.
    const aliases = [
      ...new Set([
        barcode.trim().replace(/[ -]/g, ""),
        gtin,
        ...[12, 13, 8]
          .filter((length) => /^0*$/.test(gtin.slice(0, 14 - length)))
          .map((length) => gtin.slice(-length)),
      ]),
    ];
    const candidates = new Map<number, RecordValue>();
    let truncated = false;
    for (const query of aliases) {
      const search = record(
        await request(
          "/foods/search",
          {
            query,
            dataType: ["Branded"],
            pageSize: 50,
            pageNumber: 1,
            sortBy: "fdcId",
            sortOrder: "desc",
          },
          key.trim(),
          requestSignal,
        ),
      );
      if (!Array.isArray(search.foods)) throw new USDAError(502);
      for (const raw of search.foods) {
        const row = record(raw);
        if (
          normalizeGTIN(text(row.gtinUpc, 30)) === gtin &&
          typeof row.fdcId === "number" &&
          Number.isSafeInteger(row.fdcId)
        )
          candidates.set(row.fdcId, row);
      }
      if (candidates.size) {
        truncated =
          typeof search.totalHits === "number" && search.totalHits > 50;
        break;
      }
    }
    if (!candidates.size)
      return {
        status: "not-found",
        products: [],
        message:
          "No exact barcode match was found in USDA. Add a label photo to continue.",
      };
    const ids = [...candidates.keys()].slice(0, 10);
    const details = await request(
      "/foods",
      { fdcIds: ids, format: "full" },
      key.trim(),
      requestSignal,
    );
    if (!Array.isArray(details)) throw new USDAError(502);
    const products = details
      .map((raw) => normalizeUSDA(raw))
      .filter(
        (product): product is FoodProduct =>
          product !== null && product.gtin === gtin,
      );
    if (!products.length)
      return {
        status: "not-found",
        products: [],
        message:
          "USDA had no current usable product for this exact barcode. Check the package label.",
      };
    products.sort((a, b) =>
      (b.source.updatedAt || "").localeCompare(a.source.updatedAt || ""),
    );
    const ambiguous =
      products.length > 1 || truncated || candidates.size > ids.length;
    return {
      status: ambiguous ? "ambiguous" : "found",
      products,
      message: ambiguous
        ? "USDA has multiple versions or matches. Compare the brand, serving size, and nutrition with your package."
        : "Matched this exact barcode in USDA FoodData Central. Check the serving size against your package.",
    };
  } catch (error) {
    if (error instanceof USDAError && error.status === 429)
      return {
        status: "rate-limited",
        products: [],
        message:
          "USDA's request limit was reached. Try again later or add a label photo.",
      };
    return {
      status: "unavailable",
      products: [],
      message: requestSignal.aborted
        ? "USDA lookup was interrupted or took too long. Try again or add a label photo."
        : "USDA is unavailable right now. Try again or add a label photo.",
    };
  }
}
