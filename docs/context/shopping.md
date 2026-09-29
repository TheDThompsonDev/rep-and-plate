# Receipt-to-pantry shopping

Implemented September 26, 2026. CYC run `9d6064db-c63e-4611-83db-f1fe2d708066`.

## User flow

Upload a grocery receipt in Chat. The existing image/web-search flow identifies the store and item descriptions; it now extracts purchase date, currency, receipt totals and line prices. Review store/date/prices from the receipt details or Kitchen → Swaps, list & spending → Your spending. Unknown amounts stay blank. Only reviewed totals with known currency enter personal spending summaries; currencies are never combined.

Receipt item review offers USDA name candidates and an embedded barcode scanner. A barcode selection returns to quantity review and updates that existing item; it never creates a second purchase. Matching a new product clears the old serving count until confirmed. Nutrition across a purchase still requires supported per-serving values and purchased quantities, and is labelled partial when coverage is incomplete. Capture is bounded to 40 extracted lines, with overflow disclosure; automatic USDA candidate enrichment considers every unresolved extracted line, deduplicates descriptions, limits concurrency to three and has a 30-second deadline. Unfinished lines remain reviewable manually.

Kitchen keeps the approved mint styling and adds shopping preferences, swaps, a persistent list and reviewed spending. Preferences are also editable through You and explicit Chat preference proposals. Household size, restrictions, disliked foods, cooking time, weekly budget/currency, priority, preferred stores and brand flexibility reach Chat and meal planning. Preferences are optional; receipt upload is not gated behind onboarding.

Existing meal plans and recipes calculate nutrients from checked pantry servings. Remaining plan shortfalls can be added to the shopping list; unknown pantry amounts require a check. Checking a list item is shopping progress, not a pantry or calorie mutation. Preparing/logging portions uses the existing inventory ledger.

## Evidence boundaries

- USDA supplies product nutrition, including optional total/added sugar fields kept on the same basis as the macros. Missing sugar never becomes zero. Comparisons normalize to 100 g or 100 mL, refuse incompatible bases, display tradeoffs, and do not infer allergen safety or equivalence. Known preference conflicts are filtered and the user checks suitability before adding an alternative.
- Product alternatives are explicit USDA searches, ranked for the selected numeric priority when supported. Usual-brand preferences and permanent per-product dismissals apply. Duplicate GTIN versions collapse to the newest returned observation. Convenience and balanced preferences do not implicitly rank by lowest calories.
- Reviewed receipts with confirmed total purchased grams/mL can supply historical unit-price evidence. Users can also record shelf or retailer observations, with store, currency, package amount, date and conditions. Savings require both observations to be confirmed, have matching units/currency, and be no more than seven days old. Current shelf availability is never claimed.
- `/api/shopping/prices` researches two exact products with OpenAI web search. Returned leads require matching requested product ID/GTIN and a retrieved HTTPS source. Leads are unconfirmed; the user reviews source pages and offer conditions before saving. Displayed savings are deterministic arithmetic, not model text. Edited amounts do not inherit a citation for the original quoted values. Hidden/location-dependent retailer pricing remains unknown when evidence is absent; there is no universal retailer price or purchase-history API integration.
- Shopping records are optional fields in the existing local state and private Supabase snapshot. No database migration is required. Snapshot validation preserves the new fields. No cross-user shopping analytics or automatic data-sharing pipeline was added; a separate consent/aggregation design is required before offering that capability.

## Verification

`src/features/shopping/shopping.test.ts`, `server/shopping.test.ts`, the preference/USDA/receipt candidate tests, `tests/shopping.spec.ts`, `tests/receipt-products.spec.ts`, and Chat tool journeys cover unknown values, currency separation, quantity normalization, review gates, backups, bounded enrichment, no duplicate barcode purchase, shopping lists, household planning and unchanged intake. Browser providers use deterministic fixtures and isolated storage. Inspect the 320px swap screenshot and mobile list screenshot produced by those journeys.

A live synthetic receipt check identified Kroger, September 25, three lines (milk, oats, dish soap) and total 12.77; ambiguous currency stayed null, nonfood stayed out of nutrition, and USDA candidates were supplied for the two food lines. A live price lookup returned one unconfirmed, source-linked Kroger lead for Quaker 42 oz oats and no supported alternative price. These demonstrate connectivity and one sample, not general OCR/matching accuracy or retailer coverage. Physical camera scanning and a broad real-receipt benchmark remain unverified.
