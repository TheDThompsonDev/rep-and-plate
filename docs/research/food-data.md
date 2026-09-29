# USDA food data: implementation and measured limits

Reviewed September 25, 2026. USDA is the sole external structured food provider implemented here. This investigation supports backlog tickets 02 and 03; the broad coverage acceptance gate is still open.

## Implemented adapter

`server/products/usda.ts` exports `normalizeUSDA(raw, release?)` for both live and bulk records, and `lookupUSDA(barcode, key, signal?)`. The server reads `FOODDATA_GOV_API` (with `USDA_API_KEY` as an alias). The adapter receives the key as an argument; the key never belongs in browser configuration, result objects, logs, catalog records, or source links.

Lookup validates the barcode/checksum, searches USDA Branded Foods, compares canonical GTIN values, and fetches full details only for exact matches. It checks details again to reject a changed or mismatched identifier. It tries the original barcode and equivalent zero-padded lengths where necessary. Search is bounded to 50 candidates per alias, details to 10 records, and the complete request sequence to 15 seconds. Multiple returned versions remain a review choice. A truncated candidate search is not treated as an unambiguous result. No automatic retry loop spends quota.

Responses distinguish invalid identifier, absent exact match, ambiguous versions, provider outage, and rate limiting. Missing server configuration does not prevent imported catalog or manual label workflows. HTTP error bodies and URLs containing the key are never returned. Provider cancellation and timeout produce a recoverable unavailable response.

USDA documents search/details endpoints, a default limit of 1,000 requests per hour per IP, and quota headers. Production throughput must measure these headers and account for other clients using the same allowance. [USDA API guide](https://fdc.nal.usda.gov/api-guide/)

## Nutrition interpretation

USDA branded information originates from participating food companies; it is not a physical verification of the package in a user's hand. Standardized nutrients may use 100 g **or 100 mL**, depending on the supplied unit. Missing nutrient values are not zero. Rounding can produce differences between a package label and standardized data. [Branded Foods documentation](https://fdc.nal.usda.gov/GBFPD_Documentation/)

The adapter keeps a complete basis together:

- Supplied `labelNutrients` becomes a per-serving record; missing fields remain null. It does not silently fill missing label values using a different basis.
- Otherwise `foodNutrients` stays per 100 g or per 100 mL using the declared serving unit. Serving multiplication is deterministic and requires a compatible known amount.
- Macro grams and milligrams are interpreted by their declared units. Energy uses kcal; kJ-only data converts by 4.184. Incompatible units remain unknown.
- Unsupported/absent serving units leave the standardized nutrition unknown; no liquid density is guessed. Recognizable per-serving label values can still be used independently.
- Product snapshots have stable content versions. Source changes create new observations rather than rewriting historical meals.
- Current lookup excludes rows marked discontinued. Missing discontinued information is not proof of current retail availability.

## License, refresh, and imports

FoodData Central data is public domain and published under CC0; USDA requests source attribution. The product UI retains a direct FDC source URL. This applies to the data, not implied rights to retailer images or brand endorsements. [USDA licensing section](https://fdc.nal.usda.gov/api-guide/#bkmk-6)

The official download page currently lists April 2026 Branded Foods JSON at approximately 195 MB compressed and 3.1 GB expanded, and CSV at 428 MB compressed / 2.9 GB expanded. These are publisher estimates, not local import measurements. Select the explicit release identifier when importing. Do not load the archive into a browser bundle. [Official downloads](https://fdc.nal.usda.gov/download-datasets/)

USDA describes monthly branded API updates, with downloadable snapshots generally twice yearly. The observed release table includes a December 2025 release, so refresh code must inspect actual publication metadata rather than assume exact release dates. [Data type comparison](https://fdc.nal.usda.gov/data-documentation/), [Branded update documentation](https://fdc.nal.usda.gov/GBFPD_Documentation/)

Rep & Plate's initial freshness policy should be explicit: use local snapshots for ordinary scans, allow on-demand refresh, and flag the source date. A 30-day live observation TTL is an application policy aligned with the documented monthly cadence, not a promise that manufacturers update each product monthly. Bulk snapshots older than the observation policy can still be offered with their dates when the API is unavailable. Archive release tags belong to source metadata. No recurring job has been scheduled.

## Observed live smoke test

The real server key was tested September 25, 2026 with three manually selected barcode probes. These probes were not randomly sampled and were not compared with physical package labels. The results establish connectivity and exact matching only; **2/3 is not a claim of market coverage or accuracy**.

| Barcode      | Observed result                                | FDC ID  | Complete serving macros | Lookup time |
| ------------ | ---------------------------------------------- | ------- | ----------------------- | ----------- |
| 049000006346 | Coca-Cola Can, 12 fl oz                        | 2743960 | Yes                     | 855 ms      |
| 012000001291 | No exact match                                 | —       | —                       | 550 ms      |
| 016000275263 | Cheerios Original Gluten Free Breakfast Cereal | 2777029 | Yes                     | 787 ms      |

Median end-to-end lookup latency was 787 ms on this machine/network. No raw upstream response or API credential is written to the report. The opt-in report is `.local-checks/usda-benchmark.json` and is ignored by version control. It records source dates, serving bases, missing fields, candidate counts, and timings.

Run `npx tsx scripts/usda-benchmark.ts` for the same three-code probe. For a real coverage study, supply `npx tsx scripts/usda-benchmark.ts path/to/sample.json path/to/report.json`. Input is an array of `{ "barcode": "...", "label": "...", "category": "..." }` records, up to 100 entries. Every run makes live USDA requests and uses quota. Stop on rate limiting.

## Coverage gate still required

Gather an independently collected set of at least 50 actual US packaged products covering retailer/private brands, drinks, cereals, dairy, frozen meals, snacks, supplements, and international products. Keep original strings and an independently checked label comparison. Include misses rather than seeding the entire sample from USDA search (which would bias coverage upward).

Measure exact-code hit rate, complete macro/serving rate, ambiguous versions, label agreement with package dates, manual correction frequency, latency percentiles, and import disk/memory/index costs. Record label mismatches separately from source staleness. User consent and permitted use are needed before storing private captures in any test dataset. No large archive download or full representative benchmark is implied by the three-code smoke test.

## Automated verification

Run `npx vitest run server/products/usda.test.ts`. Fixtures cover equivalent zero padding, unsupported units, 100 mL/100 g serving math, kJ conversion, missing versus zero nutrients, discontinued rows, version changes, exact-detail rejection, source conflicts, configuration errors, cancellation, malformed responses, quota failures, and redaction of upstream errors. Tests do not spend the live key's quota.
