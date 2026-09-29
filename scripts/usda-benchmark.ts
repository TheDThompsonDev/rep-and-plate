import "dotenv/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { lookupUSDA } from "../server/products/usda.ts";
import { nutritionForServing } from "../src/features/products/contracts.ts";

// Supply a consented, independently collected >=50-product sample for a coverage study.
// Default codes are a small connectivity probe, not a representative coverage claim.
const samplePath = process.argv[2];
const output = resolve(process.argv[3] || ".local-checks/usda-benchmark.json");
const samples: { barcode: string; label?: string; category?: string }[] =
  samplePath
    ? JSON.parse(await readFile(resolve(samplePath), "utf8"))
    : [
        { barcode: "049000006346", label: "Soft drink probe" },
        { barcode: "012000001291", label: "Soft drink probe" },
        { barcode: "016000275263", label: "Cereal probe" },
      ];
if (
  !Array.isArray(samples) ||
  samples.length > 100 ||
  !samples.every((item) => typeof item.barcode === "string")
)
  throw new Error(
    "Provide an array of at most 100 {barcode,label,category} records.",
  );
const key = process.env.FOODDATA_GOV_API || process.env.USDA_API_KEY;
if (!key)
  throw new Error(
    "Set FOODDATA_GOV_API in the server .env file before running a live benchmark.",
  );
const results = [];
for (const sample of samples) {
  const started = performance.now();
  const result = await lookupUSDA(sample.barcode, key);
  results.push({
    ...sample,
    status: result.status,
    latencyMs: Math.round(performance.now() - started),
    candidates: result.products.map((product) => ({
      name: product.name,
      brand: product.brand,
      id: product.id,
      source: product.source,
      serving: product.serving,
      basis: product.basis,
      nutrition: product.nutrition,
      completeServing: nutritionForServing(product) !== null,
    })),
  });
  console.log(`${results.length}/${samples.length}: ${result.status}`);
  if (result.status === "rate-limited") break;
}
const report = {
  measuredAt: new Date().toISOString(),
  methodology: samplePath
    ? "User-supplied sample; assess representativeness and manually verify labels before claiming coverage."
    : "Three-code connectivity probe. Not representative; no physical labels verified. Do not interpret as market coverage.",
  requested: samples.length,
  tested: results.length,
  exactCandidateHits: results.filter((r) => r.candidates.length > 0).length,
  singleMatches: results.filter((r) => r.status === "found").length,
  completeServingHits: results.filter((r) =>
    r.candidates.some((p) => p.completeServing),
  ).length,
  medianLatencyMs:
    [...results].sort((a, b) => a.latencyMs - b.latencyMs)[
      Math.floor(results.length / 2)
    ]?.latencyMs ?? null,
  results,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    tested: report.tested,
    exactCandidateHits: report.exactCandidateHits,
    completeServingHits: report.completeServingHits,
    medianLatencyMs: report.medianLatencyMs,
    report: output,
  }),
);
