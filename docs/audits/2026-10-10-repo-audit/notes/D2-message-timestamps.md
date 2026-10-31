# D2-message-timestamps

Finding: wave C added the optional ISO `at` stamp to `messageSchema` (src/domain.ts:82, `timestamp()` at :190) and ChatLayer's `dayDividerLabel` (src/ChatLayer.tsx:428) renders a divider only between two stamped neighbours. App.tsx and `applyAIResult` (src/ai-client.ts:156) stamp it; every other message factory omitted it, so pantry, product, receipt, recipe and workout messages (web) and the native user/opener messages never took part in day dividers.

## Plan (written before editing)

Goal: every remaining web and native message constructor stamps `at: timestamp()`; old records without `at` stay valid (schema untouched).
Done when: (1) a red-first Vitest per factory module asserts a parseable ISO `at`; (2) tsc, mobile check, lint, vitest clean; (3) `tests/chat-thread.spec.ts` still passes.
Approach: extend — reuse `timestamp` from `src/domain.ts`; no new helpers.
Context: no ledger entry for message timestamps; `tests/chat-thread.spec.ts:222` already covers "unstamped records get none".

## Reproduction (red first)

Six new `it` blocks, each asserting `message.at` is a string and `new Date(at).toISOString() === at`:
- src/workouts.test.ts "stamps every conversation message…" (recordSet, replyToWorkout reply, replyToWorkout weight prompt)
- src/features/pantry/ledger.test.ts "stamps the pantry meal message…" (mealFromPantry)
- src/features/products/actions.test.ts "stamps the capture message…" (captureProduct grocery + meal)
- src/features/receipts/journey.test.ts "stamps receipt capture messages…" (saveReceiptCapture; upgradeSavedReceiptCaptures fresh record and rewritten source record)
- src/features/recipes/batches.test.ts "stamps batch and portion messages…" (prepareRecipeBatch, logRecipePortion)
- mobile/src/store.test.ts "send stamps the user message…" (HealthProvider.send)

`npx vitest run <six files>` on the unmodified factories: 6 failed / 42 passed, every failure `AssertionError: expected undefined to deeply equal Any<String>` — the `at` field was absent.

## Change and mechanism

`at: timestamp()` added beside each existing `time: clockTime()` (13 stamps, each file imports `timestamp` from domain):
- src/workouts.ts:154, 160 (recordSet user/assistant), :175 (weight-prompt pair), :213, :222 (reply pair). Workout `conversation` extends `messageSchema`, so the field is already valid there.
- src/features/pantry/ledger.ts:156 (mealFromPantry)
- src/features/products/actions.ts:17 (captureProduct)
- src/features/receipts/journey.ts:67 (saveReceiptCapture); :96 `upgradeSavedReceiptCaptures` uses `source ? source.at : timestamp()` — a rewritten photo message keeps its own instant (an old unstamped photo stays unstamped rather than being backdated to today), a fabricated record is stamped now. Mirrors its existing `time: source?.time ?? clockTime()` rule.
- src/features/recipes/batches.ts:120 (prepareRecipeBatch), :211 (logRecipePortion)
- mobile/src/store.tsx:326 (send user message)
- mobile/src/KitchenTools.tsx:1548 (personalized-workout conversation opener)

Behaviour otherwise unchanged: schema still optional, snapshot version unchanged, no reader changed. Line endings preserved (all seven files are LF before and after; `git show HEAD:` vs working tree both 0 CR bytes). Not edited: src/App.tsx, src/ChatLayer.tsx, src/domain.ts, src/ai-client.ts, server/**. `mobile/src/ManualMeal.tsx:152` is a meal `time`, not a message — left alone.

## Consumers checked

- ChatLayer divider (src/ChatLayer.tsx:428): Playwright divider test still passes for stamped and unstamped records.
- `stateSchema.safeParse` on the produced states asserted in the new workouts, pantry and recipes tests (persisted shape still valid).
- Native: store send path exercised in mobile/src/store.test.ts; KitchenTools opener covered only by `npm --prefix mobile run check` and `expo lint` (RN component, no unit harness — see limits).
- Existing tests that compare message objects (`toEqual` on states): full vitest sweep green, so no fixture compares a factory message by exact shape.

## Commands run (final file state)

- `npx vitest run src server mobile/src` → 80 files, 542 tests passed.
- `npx tsc --noEmit` → exit 0 (first run caught a 3-arg `saveReceiptCapture` call in my new test; fixed to pass `""` context, rerun clean).
- `npm --prefix mobile run check` → exit 0.
- `npm --prefix mobile run lint` → exit 0.
- `npm run lint` → exit 1: 20 errors, all `react-hooks/immutability` in `src/App.tsx` (another agent's file, pre-existing, not touched here); `npx eslint <my 13 files>` → 0 errors (3 warnings: ignored-file notices for mobile/src/store.tsx under the root config).
- `npx playwright test tests/chat-thread.spec.ts --workers 2` → 12 passed (desktop + mobile).

## Not checked

- No native browser (Metro) run; KitchenTools opener has no unit test, verified by type check + lint only.
- Full Playwright suite not run (orchestrator owns it).
- Divider rendering for native (`mobile/src/ChatScreen.tsx` has no divider logic); stamping there is forward-compatible only.

## Ledger-ready paragraph

- MESSAGE-TIMESTAMPS-001 — factories outside App.tsx produced chat messages without the ISO `at` instant, so pantry (`mealFromPantry`), product (`captureProduct`), receipt (`saveReceiptCapture`, `upgradeSavedReceiptCaptures`), recipe (`prepareRecipeBatch`, `logRecipePortion`), workout conversation (`recordSet`, `replyToWorkout`) and native (`store.send`, KitchenTools personalized-workout opener) messages never received ChatLayer day dividers, which render only between two stamped neighbours. Red: one Vitest per module asserting a parseable ISO `at` (six failures, `at` undefined). Fix: `at: timestamp()` beside every `time: clockTime()` message literal (13 stamps); the receipt upgrade carries the rewritten source message's own `at` instead of backdating an old photo to today. Schema unchanged (optional field), old records remain valid. Rule for new message constructors: stamp both `time: clockTime()` and `at: timestamp()`; grep `time: clockTime()` across `src/` and `mobile/src/` and exclude meal literals when auditing. Verification: vitest 542 passed; web tsc, mobile check and expo lint clean; root lint's 20 errors are pre-existing `react-hooks/immutability` in src/App.tsx; `tests/chat-thread.spec.ts` 12 passed.
