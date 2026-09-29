import "dotenv/config";
import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { aiResultSchema, aiRequestSchema } from "../src/ai-contract.ts";
import {
  receiptTruthSchema,
  scoreReceipt,
} from "../server/receipt-evaluation.ts";

const manifestSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  nutritionTolerancePercent: z.number().min(0).max(100).default(5),
  cases: z
    .array(
      z.object({
        id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
        image: z.string().optional(),
        predictionFile: z.string().optional(),
        expected: receiptTruthSchema,
      }),
    )
    .min(1)
    .max(200),
});
async function main() {
  const args = process.argv.slice(2);
  const value = (name: string) => args[args.indexOf(name) + 1];
  if (!args.includes("--manifest") || !args.includes("--report"))
    throw Error("Provide --manifest and --report paths.");
  const live = args.includes("--live");
  if (live && !args.includes("--allow-paid"))
    throw Error(
      "Live evaluation sends receipt images to configured providers and costs money. Add --allow-paid to authorize.",
    );
  const manifestPath = resolve(value("--manifest"));
  const reportPath = resolve(value("--report"));
  try {
    await access(reportPath);
    throw Error("REPORT_EXISTS");
  } catch (error) {
    if ((error as { code?: string }).code !== "ENOENT") throw error;
  }
  const manifest = manifestSchema.parse(
    JSON.parse(await readFile(manifestPath, "utf8")),
  );
  if (
    new Set(manifest.cases.map((item) => item.id)).size !==
    manifest.cases.length
  )
    throw Error("Case IDs must be unique.");
  const base = dirname(manifestPath);
  const rows: {
    id: string;
    status: "scored" | "failed";
    elapsedMs: number;
    score?: ReturnType<typeof scoreReceipt>;
  }[] = [];
  for (const item of manifest.cases) {
    const started = Date.now();
    try {
      let result;
      if (live) {
        if (!item.image) throw Error("Image required.");
        const path = resolve(base, item.image),
          bytes = await readFile(path);
        const mime = (
          {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
          } as Record<string, string>
        )[extname(path).toLowerCase()];
        if (!mime || bytes.length > 3_300_000)
          throw Error("Unsupported image.");
        const { runAI } = await import("../server/ai.ts");
        const { readConfig } = await import("../server/http.ts");
        const { enrichReceipt } = await import("../server/products/enrich.ts");
        const config = readConfig(process.env),
          signal = AbortSignal.timeout(180000);
        const request = aiRequestSchema.parse({
          requestId: randomUUID(),
          text: "These are groceries I bought. Read this receipt.",
          image: `data:${mime};base64,${bytes.toString("base64")}`,
          day: new Date().toISOString().slice(0, 10),
          history: [],
          context: {
            goals: { calories: 2000, protein: 100, carbs: 250, fat: 70 },
            totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            meals: [],
            groceries: [],
            workout: "No active workout",
          },
        });
        result = aiResultSchema.parse(
          await enrichReceipt(
            await runAI(request, config, () => {}, signal),
            config.usdaKey,
            signal,
          ),
        );
      } else {
        if (!item.predictionFile)
          throw Error("Offline evaluation needs a predictionFile per case.");
        result = aiResultSchema.parse(
          JSON.parse(
            await readFile(resolve(base, item.predictionFile), "utf8"),
          ),
        );
      }
      rows.push({
        id: item.id,
        status: "scored",
        elapsedMs: Date.now() - started,
        score: scoreReceipt(
          item.expected,
          result,
          manifest.nutritionTolerancePercent,
        ),
      });
    } catch {
      rows.push({
        id: item.id,
        status: "failed",
        elapsedMs: Date.now() - started,
      });
    }
  }
  const scored = rows.flatMap((row) => (row.score ? [row.score] : []));
  const sum = (get: (score: ReturnType<typeof scoreReceipt>) => number) =>
    scored.reduce((total, score) => total + get(score), 0);
  const checked = sum((score) => score.fields.checked),
    nutritionChecked = sum((score) => score.nutrition.checked);
  const expectedLines = manifest.cases.reduce(
    (total, item) => total + item.expected.items.length,
    0,
  );
  const extracted = sum((score) => score.extractedLines),
    matched = sum((score) => score.matchedLines);
  const report = {
    corpus: manifest.name,
    createdAt: new Date().toISOString(),
    mode: live ? "live_paid" : "offline_saved_predictions",
    totalCases: rows.length,
    failedCases: rows.filter((row) => row.status === "failed").length,
    lineRecall: expectedLines ? matched / expectedLines : null,
    linePrecision: extracted ? matched / extracted : null,
    annotatedFieldAccuracyOnScoredCases: checked
      ? sum((score) => score.fields.correct) / checked
      : null,
    annotatedNutritionAccuracyOnScoredCases: nutritionChecked
      ? sum((score) => score.nutrition.correct) / nutritionChecked
      : null,
    nutritionTolerancePercent: manifest.nutritionTolerancePercent,
    annotatedFieldsChecked: checked,
    nutritionFieldsChecked: nutritionChecked,
    missedReviewFlags: sum((score) => score.reviewMisses),
    unsupportedNutrition: sum((score) => score.unsupportedNutrition),
    limitations: [
      "Results apply only to this supplied corpus and annotations; no target-market accuracy claim is inferred.",
      "Line matching uses normalized receipt text or explicit aliases; human review is still needed for unmatched lines.",
      "Nutrition comparisons require ground truth for the same stated serving; this harness does not establish nutrition truth.",
      "Failed cases remain in recall denominator; field accuracy explicitly covers scored cases only.",
      "This report contains case IDs and metrics, not images, extracted receipt text or provider error details.",
    ],
    cases: rows,
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2), {
    encoding: "utf8",
    flag: "wx",
  });
  console.log(
    JSON.stringify({
      ok: report.failedCases === 0,
      cases: rows.length,
      failedCases: report.failedCases,
      mode: report.mode,
      reportWritten: true,
    }),
  );
  if (report.failedCases) process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Receipt evaluation could not run. Check manifest/schema, unique output path and --live --allow-paid flags. No receipt content, credentials or raw errors are printed.",
  );
  process.exitCode = 1;
});
