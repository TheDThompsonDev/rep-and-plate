# A5-type-safety — Q8, Q9, Q12

Findings: Q8 (non-null arithmetic in receipt totals), Q9 (`any` in three-way merge), Q12 (hand cast of `body.capture`). Also reviewed the other non-null assertions listed under Q8.

## Plan (scout)

Goal: remove the three unsafe typings without changing merge, receipt or hosted-capture behavior.
Done when: a NaN receipt total is reproduced then fixed; `merge` has no `any` and existing sync tests pass unchanged; `captureSchema` is shared and `beta.ts` parses with it; tsc, vitest (src/server/agents) and mobile check pass for the owned files.
Approach: extend `src/features/products/quantities.ts` (already owns quantity arithmetic) with a pure, filtered sum; repair `sync.ts` typing in place; create `captureSchema` beside `aiRequestSchema` in `src/ai-contract.ts`.
Context: no ledger entry covers these paths (searched grocery/merge/capture/NaN). `docs/context/beta-hosting.md:18` describes the capture ownership check and stays accurate. `tests/ai-flows.spec.ts:58` asserts the current "Estimated purchase total · partial" copy with `toContainText`, so that copy stays.
Live NaN path: `src/AICards.tsx:244-247` builds nutrition with bare `Number(...)` from the edit form; a non-numeric field yields `{calories: NaN, ...}`, which passes the truthy `i.nutrition` filter and poisons all four totals.
Keep consistent: web receipt card (`src/AICards.tsx:359`), `tests/ai-flows.spec.ts:58`; `mobile/src/api.ts:120` and `src/api-fetch.ts:25` produce the capture shape via `uploadCapture`; `server/http.ts` and `server/ai.ts` import the contract (additive export only); `server/generation.test.ts:78` asserts `request_id`.

## Reproduction (red first)

- Q8: `src/features/products/quantities.test.ts:12` builds a receipt with one valid item, one edited item whose `calories` is `Number('abc')`, one legacy item missing three nutrition fields, and one with `servingsPurchased: null`, then calls the real `groceryTotals` from `src/AICards.tsx`. Against the old code it failed with `expected { calories: NaN, protein: NaN, carbs: NaN, fat: NaN } to deeply equal { calories: 2400, protein: 128, carbs: 192, fat: 128 }` — every total was NaN, not just the bad item's.
- Q12: `server/beta.test.ts:225` sends five malformed captures (non-string path, non-UUID file name, `kind: "video"`, missing kind, bare string) with a UUID account. Against the old code the `kind: "video"` case failed with `expected 503 to be 400`: the old handler read storage before checking `kind`, so the stub's throw surfaced as a 503. The old test harness authenticated as `"user-a"`, which can never match the hex-only path pattern, so no prior test reached `readCapture`; the two new tests use a UUID `owner` and also prove the happy path reads storage exactly once (`server/beta.test.ts:254`).
- Q9: not a runtime defect. The added `src/features/cloud/sync.test.ts:56` (nested object conflict → null, array conflict on a non-stock key → null, unrelated nested edits still merge) passed before and after, confirming merge semantics are unchanged; the eight existing sync tests are untouched and pass.

## Change and mechanism

- `src/features/products/quantities.ts:7-25`: `NutritionPerServing`, a `hasCountableNutrition` type guard (all four per-serving values and `servingsPurchased` must be finite, servings > 0) and `sumPurchasedNutrition`, which filters with the guard and reduces without assertions, returning `{total, counted}`.
- `src/AICards.tsx:176-181`: `groceryTotals` keeps the food and review filters and delegates to `sumPurchasedNutrition`; the four `!` assertions are gone. The existing "Includes N of M food items" line at :375 now reports the countable set, so partial totals are labelled with the real count. Behavior difference: negative `servingsPurchased` (impossible via the schema's `positive()`) no longer counts.
- `src/features/cloud/sync.ts:11-38`: `JsonValue` (recursive, allows `undefined` object values because optional fields exist in memory), a structural `isJsonValue` guard, `isRecord`, a module-level `unique symbol` conflict marker, and `merge(b:unknown,l:unknown,r:unknown):Merged`. Winners are narrowed through the guard; the only new path is a non-JSON leaf becoming a conflict, which still yields `null` exactly as `stateSchema.safeParse` would have. No `any` remains in `src/`.
- `src/ai-contract.ts:168-176`: `capturePathPattern`, `captureSchema` (`path` matches `<hex-id>/<hex-id>.<ext>`, `kind` is `image | audio`) and `CaptureReference`, matching what `src/platform/capture-upload.ts:47` produces.
- `server/beta.ts:3,129-136`: `captureSchema.safeParse(body.capture)`; a parse failure returns the existing fixed 400 `"The capture could not be read."` (same convention as `server/http.ts:168`); the ownership check against `user + "/"` and its message are unchanged. Only the parsing lines moved; routing and body handling are untouched for the later consolidation.
- `server/operations.ts:29,50`: the AsyncLocalStorage context type now carries `requestId: string`, which `withGenerationTelemetry` always assigns, so the `!` is dropped with no runtime change.

### Other non-null assertions reviewed (not edited; files owned by other agents)

- `src/App.tsx:618` `...previousMessage!` — safe: `reread` is only true when `previousMessage?.captureIntent === 'receipt'`. One-line fix: `const message = reread && previousMessage ? { ...previousMessage, ... } : ...`.
- `src/App.tsx:963` and `:2397` `repeatMeal(...).meals.at(-1)!` — safe: `repeatMeal` (`src/domain.ts:347-354`) either throws or appends exactly one meal, and both call sites first confirm the id exists. One-line fix: have `repeatMeal` return `{state, meal}` or read `meals[meals.length - 1]` after a length check; no runtime change needed.
- `src/ChatLayer.tsx:512` `onAction(message.suggestedAction!)` inside `{message.suggestedAction && ...}` — safe; one-line fix: `const action = message.suggestedAction;` before the JSX and `onClick={() => onAction(action)}`.
- `server/http.ts:250` `completed.keys().next().value!` — safe: guarded by `completed.size >= 100`. Not edited (file out of scope).

## Commands run

- `npx vitest run src/features/products/quantities.test.ts src/features/cloud/sync.test.ts server/beta.test.ts` → red: 2 failed (Q8 NaN totals; Q12 positive case, harness `"user-a"` issue), then after the UUID owner and only the test patch applied: `rejects a malformed or wrongly typed capture` failed `expected 503 to be 400` against old `beta.ts`; after the production patch: 3 files, 19 tests passed.
- `npx vitest run src server` → `Test Files 2 failed | 69 passed (71)`, `Tests 10 failed | 455 passed (465)`. All 10 failures are in `src/domain.test.ts` and `src/platform/browser-records.test.ts` (another agent's red-first Q1 tests referencing `parseStoredState`, `STATE_VERSION`, `readStoredState`, which do not exist yet). An earlier run also showed `server/readiness-migrations.test.ts` failing from another agent's in-flight edit; it passed on the final run.
- `npx vitest run scripts/agents` → 1 file, 8 tests passed.
- `npx tsc --noEmit` → 29 errors, all in `src/domain.test.ts` and `src/platform/browser-records.test.ts` (same Q1 work). None reference the files changed here. An earlier run showed one error at `server/ai.ts:475` from another agent's in-progress edit; it was gone on the final run.
- `npm --prefix mobile run check` → exit 0 (mobile imports `src/ai-contract.ts`).
- `npx playwright test tests/ai-flows.spec.ts --workers 2` → 8 passed (desktop + mobile), including the receipt card "Estimated purchase total · partial" assertion, against the shared dev server.

## Not checked

- `mobile/e2e` native specs (Metro not assigned). `npm --prefix mobile run lint` not run (no `mobile/` files edited).
- A browser journey that types a non-numeric value into the receipt edit form; the defect is reproduced at the `groceryTotals` boundary in Vitest, and the card copy is covered by `tests/ai-flows.spec.ts`.
- Live hosted capture upload against Supabase storage; the ownership and shape checks are covered by `server/beta.test.ts` only.

## Ledger-ready paragraph

TYPE-SAFETY-20261010 — Receipt totals, merge typing and capture parsing. Receipt card totals multiplied `item.nutrition!.x * item.servingsPurchased!` after a truthiness filter; an item edited with a non-numeric field (the edit form stores `Number(field)` unvalidated) or a legacy item missing nutrition fields turned every receipt total into NaN. Reproduced in `src/features/products/quantities.test.ts` against `groceryTotals`; fixed by `sumPurchasedNutrition` in `src/features/products/quantities.ts`, which only counts items whose per-serving values and purchased servings are finite and reports the counted number so the card's "Includes N of M food items" line is accurate. The three-way account merge in `src/features/cloud/sync.ts` is now typed with a recursive `JsonValue`, `unknown` inputs and a module-level `unique symbol` conflict marker; semantics are unchanged (existing tests untouched, nested object/array conflict case added). Hosted capture references are parsed with the shared `captureSchema` in `src/ai-contract.ts` from `server/beta.ts`, rejecting malformed shapes and wrong kinds with a fixed 400 before storage is read; previously a bad `kind` read storage first. `server/operations.ts` carries `requestId: string` in its telemetry context instead of asserting it. Remaining `!` sites in `src/App.tsx:618,963,2397`, `src/ChatLayer.tsx:512` and `server/http.ts:250` were reviewed and are guarded at runtime; one-line narrowings are listed above for their owners.
