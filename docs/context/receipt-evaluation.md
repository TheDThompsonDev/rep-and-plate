# Measuring receipt quality

The evaluation harness is ready; **no representative real-receipt corpus has been supplied or evaluated**. Unit fixtures validate scoring mechanics only. Passing them is not evidence of OCR, product matching or nutrition accuracy in the target market.

## Dataset and annotations

Keep consented/redacted receipt images, ground truth and saved predictions in an ignored local directory such as `.local-checks/receipt-eval/`. Use case IDs without personal information. Annotate every printed purchased line, including duplicates and nonfood items. Include the original printed abbreviation as `receiptText`; explicitly permitted OCR equivalents can go in `aliases`. Do not annotate guessed brands, serving counts or nutrition as facts. Provide nutrition only from an independently checked label/source for the exact same serving, and include that serving text.

A JSON manifest has this shape; the values below illustrate annotation format and are **not a measured real receipt**:

```json
{
  "name": "my-consented-corpus",
  "nutritionTolerancePercent": 5,
  "cases": [{
    "id": "receipt-001",
    "image": "receipt-001.jpg",
    "predictionFile": "receipt-001.prediction.json",
    "expected": {
      "store": "Example store",
      "currency": "USD",
      "total": 4.50,
      "purchaseDate": "2026-09-01",
      "items": [{
        "receiptText": "OATS",
        "aliases": [],
        "quantity": "1 package",
        "total": 4.50,
        "match": "unresolved",
        "needsReview": true,
        "nutrition": null
      }]
    }
  }]
}
```

Only annotated optional fields are scored. Null is an explicit unknown, distinct from zero. A missing receipt/line cannot earn a correct unknown-field score. Nutrition ground truth requires `serving`; differing serving descriptions count as nonmatching nutrition until a human resolves whether they are equivalent. Duplicate printed lines are matched once each. The corpus should represent the stores, languages, abbreviated lines, poor lighting, long receipts, mixed currencies and nonfood items users actually submit; document how it was selected alongside the private annotations.

## Run offline or explicitly authorize live calls

Default offline mode reads each `predictionFile` as the app's validated `AIResult` shape. It makes no provider calls:

```text
npx tsx scripts/evaluate-receipts.ts --manifest .local-checks/receipt-eval/manifest.json --report .local-checks/receipt-eval/report-offline.json
```

Live mode sends each supplied image through the existing server `runAI` and receipt-enrichment path, including configured Qwen fallback, Jev checks and available USDA enrichment. It requires **both** flags to authorize paid provider use; run sequentially with at most 200 cases per manifest:

```text
npx tsx scripts/evaluate-receipts.ts --manifest .local-checks/receipt-eval/manifest.json --report .local-checks/receipt-eval/report-live.json --live --allow-paid
```

The normal server environment supplies credentials; no key belongs in the manifest. The harness does not connect to user accounts or write app records. It uses empty saved context and a fixed generic goal context solely to keep receipt requests comparable. It does not persist raw live predictions by default. Reports must use a new filename: existing files are not overwritten. Live evaluation is direct provider traffic, so production per-user API quotas do not govern it; choose a bounded corpus and monitor the provider dashboard.

## Interpret the result

The report contains case IDs and numerical scores, never receipt images/text or raw provider errors. It measures receipt returned, purchase intent, line recall/precision, annotated quantities/prices/date/currency/serving fields, annotated nutrition, missed review flags, unexpected nutrition on explicitly unknown/nonfood lines, failed cases and elapsed time. Failed cases stay in the recall denominator; annotated-field accuracy is explicitly limited to successfully scored cases. Unannotated nutrition reports `null` accuracy, never 100%.

Do not treat a high mean as a release decision by itself. Inspect each failure, especially invented nutrition, purchases interpreted as consumed meals, dropped lines and confidently wrong product matches. Repeat the same fixed corpus after parser/model changes, and keep a separate held-out corpus for a less biased estimate. Neither this harness nor a receipt's text establishes medical suitability, recipe quality or whether a weekly grocery budget is attainable.

Pending evidence: collect a representative real corpus, independently annotate it, run the harness, manually inspect disagreements and set product acceptance thresholds based on the observed failure categories. That work cannot be honestly replaced with synthetic fixtures.
