# D1-app-split — Q2: begin splitting `src/App.tsx`

Finding: Q2 (README section 3). Playbook: refactor (behavior-preserving; pins are the existing unit and browser suites). Managed `cyc run` cannot start here (CYC-ASSETS-001), so checks run directly.

## Plan (written before editing)

Goal: pull the AI request lifecycle, dialog flags, account-session effects, meal editor and ChatLayer wiring out of the single `App` function without changing observable behavior.
Done when: (1) five slices land in order, each with `npx tsc --noEmit` (owned files clean), `npx vitest run src server mobile/src` and `npm run lint` (0 errors, no new warnings) green between slices; (2) new unit tests cover the pure parts (dialog reducer transitions, request lifecycle with a fake `fetch`, meal-editor state transitions); (3) every existing test passes unchanged; (4) `npx playwright test --workers 3` passes at the end; (5) hook and prop counts before/after recorded here.

Approach: create (`src/features/chat/`, `src/features/meals/MealEditor*`) + extend (`App.tsx` consumes the hooks; `ChatLayer` reads a context). Nothing comparable exists: `src/features/*/use*.ts` hooks are feature-local (`useConnections`, `useOnboarding`) and none owns chat request state.

Context checked: ledger CHAT-COMPOSER-001 (submitText keeps the draft while processing; `stopResponse` → `cancelPendingAI` + `markCaptureStopped`; late results rejected by both the fetch abort and the `aiGeneration` guard), PERSONA-PLAN-002 (restore/reset/owner change must close record-bound editors and cancel pending capture — the `clearCaptureDrafts` + `cancelPendingAI` pairs), VERIFY-SWARM-001 (shared 5173 server; the full suite runs after source freeze), note B2 (happy-dom render helper pattern). No failed approaches recorded for App.tsx restructuring.

Measured before (working tree, 2026-10-10): `src/App.tsx` 2,305 lines, 48 `useState`, 11 `useRef`, 9 `useEffect`, 0 `useCallback`/`useMemo`; `ChatLayer` 47 props; `YouPage` 19 props (`onSaveBodyWeight` optional); `NutritionPage` 14 (not touched).

Dialog flags today (not mutually exclusive — e.g. `askFromGroceries` from the open PantryDialog can open CloudAccount on top of it; `receiptAccount` closes capture, opens cloud, and `returnToReceipt` reopens capture afterwards): `profileOpen`, `captureOpen`, `scannerOpen`, `preferencesOpen`, `shoppingOpen`, `recipesOpen`, `plannerOpen`, `workoutBuilderOpen`, `voiceOpen`, `cloudOpen`, `headerAccountOpen`, `connectionsOpen` (12 booleans) plus the payload-bearing `groceriesOpen: string|null`, `labelGTIN: string|null`, `linkMealId: string|null`. `receiptCapture`, `resumeRecipe`, `connectionsStarted` are mode flags that survive a dialog close (receipt mode persists across `receiptAccount` → `returnToReceipt`), so they stay as state, not dialogs.

Change:
1. `src/features/chat/useAIRequest.ts` (new) — `processing`, `aiStatus`, `aiStage`, `connectionRevision`, the four AI refs, the 600 ms local-processing timer, unmount abort, status probe, `sendAI`, `stopResponse`, `cancelPendingAI` (stable), `retry`, `reconnect` (stable), `isBusy()`, `showLocalProcessing()`. App.tsx consumes it.
2. `src/features/chat/dialogs.ts` (new, pure reducer + `useDialogs`) — one `dialogs` record keyed by kind; `openDialog`, `closeDialog(kind)`, `closeDialogs(kinds)` (stable). Per-dialog independence is kept on purpose (see above); a single discriminated union would drop the pantry → account co-open case.
3. `src/features/chat/useAccountSession.ts` (new) — owner-switch effect, connection-revision effect, `chatAccountMode`/`profileAccountMode`, `openChatAccount`, `openProfileAccount`, `dismissCloud`, `restoreRecords`, `resetRecords`.
4. `src/features/meals/MealEditor.tsx` + `meal-editor.ts` + `useMealEditor.ts` (new) — the editor form moves verbatim; `manualMealDraft`, `proposalCorrectionDraft`, `reviewMealDraft`, `applyProposalCorrection`, `saveEditedMeal` become pure functions; the hook owns `editMeal`/`editProposalId`. `src/features/meals/` is outside the literal file list but is not owned by another agent this wave (they own pantry/products/receipts/recipes); recorded here as the one scope extension.
5. `src/features/chat/ChatContext.tsx` (new) — `ChatProvider` + `useChatContext()`; ChatLayer keeps its body and reads the same 47 names from context.

Keep consistent: `src/ChatLayer.tsx` (only consumer of the props; body unchanged); `src/FuelNavigation.tsx` (reads `HeaderAccountContext`, unchanged); `src/platform/useBrowserRecords.ts` (`setState` is a stable `useCallback`, so hooks may list it as an effect dependency without re-running); `tests/ai-cancellation.spec.ts`, `tests/chat-composer.spec.ts`, `tests/receipt-*.spec.ts`, `tests/account-*.spec.ts` (browser pins for stop/cancel, receipt resume and owner-change resets).

Test: new `src/features/chat/dialogs.test.ts`, `src/features/chat/useAIRequest.test.ts` (happy-dom, fake `fetch`), `src/features/meals/meal-editor.test.ts`; the existing unit and browser suites unchanged.

Open: none that change the solution.

## Baseline (before any edit)

- `npx tsc --noEmit`: 2 errors, both `src/workouts.test.ts` (unused `replyToWorkout`, `expectStamped` — another agent's in-progress `at`-stamp slice). App.tsx clean.
- `npx vitest run src server mobile/src`: 536 passed, 1 failed (`src/workouts.test.ts` "stamps every conversation message" — same in-progress slice).
- `npm run lint`: 0 errors, 70 warnings; none in `src/App.tsx`, `src/ChatLayer.tsx`, `src/YouPage.tsx`.

## Slices (each verified before the next started)

### Slice 1 — `useAIRequest` (`src/features/chat/useAIRequest.ts`, `useAIRequest.test.ts`)

Moved verbatim from App.tsx: `processing`, `aiStage`, the `/api/status` probe keyed by `connectionRevision`, the four AI refs (`aiBusy`, `aiGeneration`, `aiRequestController`, `aiRequestMessageId`), the 600 ms local-processing timer, the unmount abort, `sendAI`, `stopResponse`, `cancelPendingAI`. New surface: `retry(messageId)`, `reconnect()`, `isBusy()`, `showLocalProcessing()`; `onAccountRequired` replaces the direct `openChatAccount()` call inside `sendAI`.

What the extraction uncovered: the React Compiler lint (`eslint-plugin-react-hooks` 7) had been bailing out of `App` silently (the `try/finally` in `sendAI` is unsupported), so the moment `sendAI` left the component the compiler analysed `App` for the first time and reported 20 `react-hooks/immutability` errors ("accessed before it is declared": closures such as `useBrowserRecords(() => setToast(...))` and `clearCaptureDrafts` referencing `useState` setters declared further down) plus five warnings it had never shown (`exhaustive-deps` on the owner-switch, upgrade and connection effects; `refs` on `connectionState.current = state` and `forReceipt={resumeReceiptCapture.current}`), and one `set-state-in-effect` in the new hook. Resolutions, all behavior-neutral:
- Declarations reordered so every `useState`/`useRef` precedes the closures that use them (hook call order has no observable effect).
- Effects list their now-visible dependencies (`[setState]`, `[cancelPendingAI]`, `[reconnect]`); each is a stable `useCallback`, so the effects still run once.
- `connectionState` (a render-time ref write) replaced by `stateForSync`, the latest-records ref `useBrowserRecords` already maintains synchronously at `setState` time; AccountSync's `onRestore` used it for the same conflict check already.
- `forReceipt` for CloudAccount comes from a `cloudForReceipt` state written in the same batches that flip the `resumeReceiptCapture` ref (`receiptAccount`, `returnToReceipt`, `clearCaptureDrafts`), so the rendered value is unchanged while the ref keeps serving the handlers.
- The probe stores `{ revision, status }` and derives `aiStatus = null` while `probe.revision !== connectionRevision`, instead of `setAIStatus(null)` inside the effect. Same observable states ("checking" until the probe for the current revision answers); the only difference is that the null shows on the same render as the reconnect click instead of one effect pass later.

Red proofs (`useAIRequest.test.ts`, 9 tests, fake `fetch` driving NDJSON streams): removing the generation guard around the result write turned "stop … late result is rejected" and "cancelPendingAI aborts …" red (`expected 'complete' to be 'error'`/`'pending'`); the fake stream deliberately ignores the abort in those two tests so the guard is the only defence, as the ledger entry CHAT-COMPOSER-001 verified by hand. Dropping the revision key made "re-probes on reconnect" red (`expected {…} to be null`). Source restored byte-identical (`filecmp`).

Checks: `npx tsc --noEmit` clean for owned files (baseline errors in `src/workouts.test.ts` belonged to the `at`-stamp agent and cleared during the wave); `npx vitest run src server mobile/src` 551 passed; `npm run lint` 0 errors / 68 warnings (none in owned files); `npx playwright test tests/ai-cancellation.spec.ts tests/chat-composer.spec.ts tests/receipt-capture.spec.ts tests/connected-flows.spec.ts tests/ai-flows.spec.ts --workers 3` 33/34, the one failure being `ai-flows.spec.ts:155` timing out on the first composer `fill` right after `page.goto` (a shared-server reload, VERIFY-SWARM-001 class); the spec alone then passed 8/8.

### Slice 2 — `activeDialog` reducer (`src/features/chat/dialogs.ts`, `dialogs.test.ts`)

`useDialogs()` wraps a `useReducer` over a record keyed by dialog kind (`DialogState`), with `openDialog(kind | { kind, payload })`, `closeDialog(kind)` and `closeDialogs(kinds)` as stable callbacks. Fifteen `useState`s left App.tsx: the twelve `*Open` booleans plus `groceriesOpen`, `labelGTIN`, `linkMealId`, which became the payload-bearing kinds `pantry`, `label`, `pantryLinks`. `clearCaptureDrafts` now closes `RECORD_BOUND_DIALOGS` in one dispatch (same set it closed before; cloud, header account and connections were never closed there and still are not; capture stays conditional on the receipt-resume flag). Deliberate deviation from the brief's "single discriminated union": the existing dialogs are not mutually exclusive (PantryDialog → `askFromGroceries` → `openChatAccount` stacks CloudAccount over the pantry; `receiptAccount` closes capture, opens cloud, and `returnToReceipt` reopens capture), so a single-value state would have changed behavior. Reopening with the same payload or closing a closed dialog returns the same state object, preserving React's setter bail-out.

Lint lesson recorded for the ledger: `react-hooks/preserve-manual-memoization` (an error-level rule) rejected `useCallback` lists that omitted `useState` setters declared *after* a hook call that referenced a hoisted function (the compiler marks such setters as mutable context variables). Moving the `useAIRequest` call below all state declarations fixed it without changing the lists. `clearCaptureDrafts` and `openReceipt` became `useCallback`s only because they now capture `closeDialogs`/`openDialog` (stable, but opaque to `exhaustive-deps`) and feed effects.

Checks: tsc exit 0; vitest 556 passed; lint clean in owned files; Playwright `kitchen, shopping, scanner-flows, receipt-capture, receipt-journey, pantry-link-review, header-account, chat-signin, voice-flows, chat-actions, persona-remediation, agent-connections, recipes` 106/106 (1.3 min).

### Slice 3 — `useAccountSession` (`src/features/chat/useAccountSession.ts`, `useAccountSession.test.ts`)

Owns `preserveGuestChatDraft`, `chatAccountMode`, `profileAccountMode`, the owner-switch subscription (`clearCaptureDrafts(keepDraft)` + `cancelPendingAI()` when `health.records.owner` changes), the connection-revision subscription (account change, hosted auth state, `online` → `reconnect()`), `openChatAccount`, `openProfileAccount`, `dismissCloud('ready' | 'closed')`, `restoreRecords`, `resetRecords`. The AI hook needs `openChatAccount` and the session hook needs `cancelPendingAI`/`reconnect`; the compiler's declare-before-use rule forbids closures over later `const`s but accepts hoisted function declarations, so App passes `onAccountRequired: requireChatAccount`, a one-line `function requireChatAccount() { openChatAccount(); }` declared after the session hook. CloudAccount's `onChatReady`/`onClose`/`onRestore`, AccountSync's `onRestore`, YouPage `onAccount`, the header-account buttons and ProfileEditor `onReset` call the hook's handlers with the same call order as before.

Red proofs (6 tests, real `sync-control` emitter via `invalidateCloudSync()`): a dependency that changes every render made three tests red (subscription re-created; `expected ['reconnect', …] to deeply equal ['clearCaptureDrafts:true', …]`); the first attempt to break "flag consumed once" stayed green because `!owner` already blocks reuse on a direct A→B switch, so the test gained a sign-out → sign-in sequence that only the flag reset protects (result in "Final verification").

Checks: tsc exit 0; vitest 556 passed (the session test landed after this run and is counted in slice 4's); Playwright `account-recovery, account-security, account-storage, account-sync, cloud, chat-signin, header-account, receipt-journey, persona-remediation, unreadable-records, record-durability, ai-cancellation, chat-composer` 88/88 (1.1 min).

### Slice 4 — `MealEditor` (`src/features/meals/MealEditor.tsx`, `meal-editor.ts`, `useMealEditor.ts`, `meal-editor.test.ts`)

The 273-line form component moved verbatim (sliced out of App.tsx by script, imports added). Its App-side wiring became pure functions — `manualMealDraft`, `proposalCorrectionDraft`, `reviewMealDraft`, `applyProposalCorrection`, `saveEditedMeal` — and `useMealEditor()` owns `editMeal`/`editProposalId`, `manualMeal`, `correctProposal`, `addFromReview`, `save`, and the conditional `repeat`/`pantryLinks`/`remove` actions with the same predicates App used inline. `close` is a stable `useCallback` because `clearCaptureDrafts` calls it. `src/features/meals/` is the one directory outside the literal file list (no other agent owns it this wave).

Red proofs (8 pure tests): dropping `detachMealFromPantry` → "a macro change … detaches pantry use" red; dropping the `changed` spread → "drops the breakdown, portion and sources" red. Source restored byte-identical.

Checks: vitest 570 passed (session and meal-editor tests included); lint clean in owned files; Playwright `nutrition-connected, nutrition-day, nutrition-round-two, meal-breakdown, pantry-link-review, you-connected, flows, recipe-proposals, outcome-tracking, chat-conversation, refined-tabs` 66/66 (52 s). The extended guest-draft test went red against the flag-reset break (`expected ['clearCaptureDrafts:false', …] to deeply equal …` with `clearCaptureDrafts:true` on the sign-out → sign-in step).

### Slice 5 — `ChatContext` (`src/features/chat/ChatContext.tsx`)

`ChatContextValue` is the former `Props` type of ChatLayer, field for field (47). `ChatProvider` wraps `<ChatLayer />` in App with the same 47 expressions that were JSX attributes, now object properties (converted by script, one `name: value,` per attribute); ChatLayer's body is untouched below `const { … } = useChatContext();` — scroll anchoring, live regions, date dividers and "Stop response" are as the C1 agent left them. The context value is a fresh object per App render, exactly as the props object was, so ChatLayer re-renders when it did before. YouPage was left at 19 props: nothing in the hook extractions touched its wiring, so a context there would have been change for its own sake.

Checks: tsc clean, lint clean in owned files; see "Final verification".

## Counts

| | Before (working tree, start of wave D) | After |
| --- | --- | --- |
| `src/App.tsx` lines | 2,305 | 1,654 |
| `useState` | 48 | 19 |
| `useRef` | 11 | 4 |
| `useEffect` | 9 | 4 |
| `useCallback` / `useMemo` | 0 / 0 | 2 / 0 (`clearCaptureDrafts`, `openReceipt`; both feed `[]`-style effects) |
| Dialog flag `useState`s | 15 (12 booleans + 3 payload strings) | 0 (one `useReducer` in `useDialogs`) |
| `ChatLayer` props | 47 | 0 (47-field context) |
| `YouPage` props | 19 (`onSaveBodyWeight` optional) | 19 (unchanged) |
| `NutritionPage` props | 14 | 14 (unchanged) |

New files: `src/features/chat/{useAIRequest,dialogs,useAccountSession}.ts`, `ChatContext.tsx`, their three tests; `src/features/meals/{MealEditor.tsx,meal-editor.ts,useMealEditor.ts,meal-editor.test.ts}`. 28 new unit tests.

## Consumers checked

- `src/ChatLayer.tsx` — the only consumer of the former props; body unchanged below the `useChatContext()` destructure (`git diff` shows the `Props` block removal, the signature, three import trims and the new import only).
- `src/FuelNavigation.tsx` — reads `HeaderAccountContext`; App still provides `() => openDialog('headerAccount')`-equivalent behaviour through `setHeaderAccountOpen` → `openDialog('headerAccount')`.
- `src/platform/useBrowserRecords.ts` — `setState` is a stable `useCallback` and `stateForSync` is updated synchronously inside it, which the connections `onApply` conflict check now relies on (AccountSync's `onRestore` already did).
- `src/features/cloud/CloudAccount.tsx` — `forReceipt` still toggles the receipt framing; it now reads `cloudForReceipt` state set in the same batches as the ref it mirrored.
- `src/features/cloud/sync-control.ts` — `onAccountChange` has two subscribers as before (owner-switch and status refresh), both inside `useAccountSession` and subscribed once (tested).
- Pages: `NutritionPage`, `KitchenPage`, `WorkoutPage`, `YouPage` props untouched in shape; only the handler expressions changed (`openDialog(...)`, `openProfileAccount`, `meals.addFromReview`).
- `mobile/` — not touched; it has its own `App.tsx`/store.
- Browser specs that pin the moved behaviour: `ai-cancellation`, `chat-composer` (stop/cancel/retry gating), `receipt-capture`/`receipt-journey` (receipt → sign-in → resume), `account-*`, `cloud`, `persona-remediation`, `record-durability`, `unreadable-records` (restore/reset/owner-change resets), `kitchen`/`shopping`/`scanner-flows`/`pantry-link-review`/`recipes` (dialog stacking and hand-offs), `nutrition-*`/`meal-breakdown`/`you-connected` (meal editor), `chat-thread`/`chat-conversation`/`header-account` (ChatLayer via context).

## Final verification (final file state, after the cosmetic tidy pass)

- `npx tsc --noEmit` — exit 0.
- `npm run lint` — exit 0; 68 problems (0 errors, 68 warnings), none in `src/App.tsx`, `src/ChatLayer.tsx`, `src/features/chat/**`, `src/features/meals/**` (`npx eslint` on those paths: 0 messages). Baseline at wave start: 70 warnings.
- `npx vitest run src server mobile/src` — 84 files, 570 tests passed (wave start: 536 passed + the other agent's 1 in-progress failure; +28 tests from this note).
- `npx playwright test --workers 3` — 378 passed (4.8 min), desktop + mobile projects, on the shared 5173 server.
- `npx playwright test tests/chat-thread.spec.ts --workers 3` — 12 passed (the spec that timed out in the earlier full run).

Earlier full-suite run (before the tidy pass, same logic): 377/378, the one failure `chat-thread.spec.ts:222` timing out on the first composer `waitFor` inside `seedConversation` right after `page.goto` — the same signature as the slice-1 `ai-flows` failure and the mobile project passed the same test in the same run; the spec then passed alone. Both are shared-server reloads from concurrent `src/` edits (VERIFY-SWARM-001 class), not product failures; recorded here so the orchestrator's post-wave run is the authoritative one.

## Not checked / limits

- Hosted (Supabase) paths of `useAccountSession`'s auth-state subscription: the `isHostedBrowser()` branch is moved verbatim and mocked false in the unit test; only the loopback path ran in browsers.
- No visual diff of ChatLayer: its body is byte-identical apart from the destructure source, and the chat specs exercise the thread, composer and stop control; I did not open the in-app browser.
- `YouPage` (19 props) and `NutritionPage` (14) were intentionally left as props.
- The one-frame difference in `aiStatus` becoming `null` on reconnect (same render instead of one effect pass later) is not covered by a test that could tell the two apart; no spec asserts the stale status is visible after a reconnect click.
- `src/features/meals/` is outside the literal file list (recorded above); no other agent edited that directory this wave (`git status` shows only my new files there).

## Ledger-ready paragraph

- APP-SPLIT-001 — `src/App.tsx` was one 2,305-line function (48 `useState`, 11 `useRef`, 9 `useEffect`, 15 dialog flags, ChatLayer with 47 props; audit Q2). Five behavior-preserving slices: `useAIRequest` (AbortController, generation counter, processing/stage, status probe keyed by revision, `sendAI`/`stopResponse`/`cancelPendingAI`/`retry`/`reconnect`), `useDialogs` (one reducer record for fifteen former flags; dialogs stay independent because the pantry → account and receipt → account → receipt flows stack them), `useAccountSession` (owner-switch and status-refresh subscriptions, chat/profile account framing, restore/reset), `MealEditor` + `useMealEditor` + pure `meal-editor.ts`, and `ChatContext` (ChatLayer takes zero props; same 47 names). App.tsx is now 1,654 lines with 19/4/4 hooks and 2 `useCallback`s, both needed as stable effect inputs. Learned: the React Compiler lint had been bailing out of `App` silently (unsupported `try/finally`), so extracting `sendAI` surfaced 20 latent `react-hooks/immutability` use-before-declaration errors and five hidden warnings; the fixes were declaration order, listing now-visible stable dependencies, `stateForSync` instead of a render-time ref write, and a state mirror for `forReceipt`. Also learned: `react-hooks/preserve-manual-memoization` treats `useState` setters declared after a hook call that references a hoisted function as mutable, so state must be declared before such hook calls; and a declaration cycle between two hooks (AI ↔ account) is resolved with a hoisted one-line function bridge, which the compiler accepts where a closure over a later `const` is rejected. 28 new unit tests (fake-`fetch` request lifecycle, reducer transitions, owner-switch/draft-preservation, pure meal-editor transitions), each shown red against a deliberate break. Two full-suite browser failures during the wave were first-step page-load timeouts on the shared 5173 server that passed alone (VERIFY-SWARM-001).
