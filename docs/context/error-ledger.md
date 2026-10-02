# Error ledger

### NUTRITION-SETUP-001 — onboarding omitted calorie-target inputs (2026-10-02)

- Status: resolved in working changes; user acceptance pending. Final configured/native results retained in docs/audits/2026-10-02-onboarding-nutrition/evidence; no commit requested.
- Scout: prior goal setup collects current/target weight and cadence, while manual daily targets exist only in profile. No age/height/activity baseline exists. Extend onboarding with a separate daily-targets step and reuse the profile target fields, weight history, durable saves and AI context. Interpret the follow-up as collecting inputs for useful calorie/macro targets; clarification was offered before proceeding with that stated assumption.
- Challenge: the adult estimator cannot infer missing age, height, activity, equation sex or weight; no calorie targets become active on preview. Existing reviewed targets must survive details-only or skipped setup. No target-weight deadline, automatic updates after weigh-ins, medical validation or physical-device result is claimed. Manual targets and details-only paths remain available.
- RED: new nutrition-setup tests fail because the feature module is absent. Shared implementation passes three checks covering known literal estimates, metric/imperial input, invalid/missing/out-of-scope inputs, unchanged existing targets and validated AI context.
- First native type check failed TS2882: importing a props type from the web renderer also pulled its CSS into native checking. Move the props type to the shared data module; native imports only that module. No lint/type rule changes.
- First focused browser run passed 20/22; the two new target-preview assertions assumed a fresh device already had a durable snapshot. It correctly has none until onboarding completes. Assert the pre-save snapshot is null, then retain exact completed/reloaded target, baseline and measurement assertions.
- Expanded focused web journeys pass 38/38. Initial native journeys pass 6/7; the new reload check assumed the profile tab persists, but native intentionally restarts on Chat. Reopen the profile after reload before checking the unchanged saved data, as existing native tests do. Lint also exposed two new duplicate domain imports; combine them, retaining the nine preexisting warnings.
- Semantic review: optional baseline keeps legacy records readable and account freshness compares every profile field. Completion saves goals/weight/details/reviewed targets together; skip/details-only preserve originals, shared validation rejects missing/out-of-scope estimates, targets remain editable, and AI contract keeps real self-reported context. Preserve the selected calorie approach when reopening the editor instead of re-deriving it from the weight goal. Web mobile screenshots reviewed for labels, field reachability and explicit target confirmation. No open implementation finding; final stable-source checks follow.
- CYC managed startup still hits the existing 20,000-file/128-MiB source-fingerprint bound; configured commands run directly without engine/config changes.

## RECEIPT-JOURNEY-002 — Receipt value, recovery and correction gaps

- Status: working implementation awaiting user acceptance; focused browser and unit evidence retained in the October 1 remediation report. No commit or deployment claimed.
- Reproduction: new Chat receipt-entry and saved-photo recovery browser tests failed against original code (missing entry and missing Read this receipt). The six-persona audit also reproduced used unresolved stock keeping the pantry guide incomplete. A later focused saved-receipt test reproduced a completed but inconclusive read with no recovery button.
- Cause: receipt capture was described as a tracking input; offline photos were generic notes without extraction intent; success exposed storage without outcome actions; guide completion included used stock. Manual edit errors were consumed by the parent, allowing the child editor to close.
- Repair: explicit receipt discovery and isolated example, serialized capture intent and linked review, resumable guest photo/context, scoped dinner/spending actions, availability-based readiness, original-photo comparison and synchronous rejection propagation. Inconclusive rereads use a fresh request identity; successful reads remain idempotent. Optional preferences stay secondary and exhausted groceries invite the next receipt.
- Attempts: initial build found an unused readiness import, resolved by implementing the intended Pantry readiness panel. A new extended walkthrough failed on spending because it closed only receipt review and purchase details, leaving the Pantry dialog open. Observed dialog interception confirmed a test navigation omission; added the real third close without forced clicks. The inconclusive-read test first failed on the missing button, then passed with retained image and new request identity. Two patch-context mismatches applied no edits and were corrected by reading the current file.
- Guards: `src/features/receipts/journey.test.ts`, `tests/receipt-journey.spec.ts`, the receipt-focused onboarding case, and existing receipt/product/shopping/account/planning journeys. Real-user comprehension, representative OCR and physical cameras remain separate checks.
- Tooling: managed CYC startup again hit CYC-ASSETS-001 before creating a run. Protected configuration and engine were unchanged; direct configured verification commands are used.
- Visual recovery: initial screenshot inspection found receipt enlargement could widen the form inside a clipped modal at 320px, despite document overflow passing. Strengthening the script to check the dialog width reproduced the failure. A zero minimum width on the disclosure and constrained internal scroll area fixed it; the strengthened check passed at 320/390/1100px. A first visual script also expected an invented example label; corrected it to the observed wording. PowerShell requires quoted agent-browser refs; the unquoted ref produced a missing-argument error before any UI action.
- Semantic recovery: a focused pending-response test reproduced dinner clearing a second request from the composer while the AI busy guard rejected submission. A common grocery-question handler now retains that draft during processing or access/service setup and submits only when available. Kitchen, Pantry and receipt cards use it. Reviewing `useBrowserRecords` also established that functional edits execute synchronously at the action boundary; latest-state correction failures can therefore propagate to the child editor rather than be silently consumed. Final checks are rerun after these repairs.
- Consumer recovery: the full browser suite exposed two Spot replay tests assuming the food slide immediately followed the introduction. Updated their expected sequence to include the intentionally added receipt-benefit slide while retaining food, movement, failed-art and draft-preservation assertions. An initial broad callback patch matched Nutrition before Kitchen; semantic reread caught it, restored Nutrition's existing local-command path and explicitly targeted Kitchen before final verification.
- Native consumer follow-through: native onboarding/tour tests also assumed the original shared slide order. Their expectations now include the receipt-benefit slide; focused Expo-web onboarding, replay and purchase journeys supplement native type checking and lint. No Expo/React Native API or native screen implementation changed.

## PERSONA-20260930 — Decimal records, capture context and correction identity

- Status: fixes implemented in working changes; user acceptance and physical-device release checks remain pending. [Remediation evidence](../audits/2026-09-30-remediation/) preserves the checks and original failures.
- Web meal numeric inputs defaulted to integer steps, rejecting name-only corrections to decimal macros. Native inputs parsed every keystroke, turning `18.3` into `183`. Keep editable strings until validated submission and allow decimal steps.
- AI nutrition prose previously survived independent component-total normalization. Generate the displayed summary from canonical totals; manual corrections also replace stale linked prose.
- A live date test showed the provider ignored the selected historical diary day. Persist captureDay with the source message and enforce it for undated captures, retaining actual today separately. A second live check invented a portion despite an explicit unknown amount; hold the proposal for clarification instead.
- Finished-session correction initially risked moving historical completion dates to today. Persist originalFinishedAt while reopened, restore it on finish and clear the marker before the next archive.
- Workout choices must reach every recorder: the legacy Chat buttons and manual interpretation previously bypassed the shared set recorder. Chat now uses the same load guard and recorded-load snapshot as Workouts. Explicitly supplied load/reps remain accepted.
- Root browser checks reproduced decimal-save, activity-day and support failures before repair; shared and native guards retain their own red-to-green evidence. Regression fixtures now choose actual starter loads and confirm partial finish deliberately. Test expectations were updated where autosaved drafts intentionally replace the earlier save-only behavior; original approved plans and inventory still must stay unchanged.

## VERIFY-SWARM-001 — Shared development server lifetime during parallel suites

- Status: tooling setup corrected before integrated verification.
- A focused Playwright run owned the server reused by another suite, then exited and stopped it. The integrated run's connection-refused results do not establish product failures. Separate output folders avoid one runner clearing another's screenshots.
- Root now owns a persistent Vite process. Server-import changes also trigger brief restarts, so the final aggregate suite runs after source freeze. No tests, checks or failure thresholds were removed.
- A later run passed 263/264; a legacy nutrition fixture rendered no meals after direct store injection. Five unchanged focused repetitions passed. The fixture previously awaited route loading only, before asynchronous onboarding hydration/first app persistence necessarily completed. It now waits for Chat readiness, drains queued writes and asserts the seeded meals after reload. Ten desktop/mobile repeats passed. Startup overlap is the suspected cause; no production defect or product fix is claimed from this single failure. Original and repeated results remain in the remediation evidence.

## PERSONA-PLAN-002 — Drafts outlive replacement records and generated stock prose

- Final cross-review found that an open web planner retained its local draft during an automatic account refresh. Its autosave could reinsert the stale plan after the newer copy arrived. A browser regression reproduced the still-open editor; the fix closes record-bound editors and cancels pending capture on automatic/manual restore, reset and owner changes. The updated regression checks the newer plan survives reload and remains in the mocked account copy.
- Native replacement also left temporary recipe values and an in-flight planner generation alive. The failing native boundary journey is retained. Replacement now invalidates draft scope, closes tools, clears temporary values and prevents late planner commits into replacement records.
- Keyword filtering could not guarantee factual stock prose: “Milk covers the whole week” passed through. Generated plan normalization now discards provider notes entirely, leaving calculated stock summaries as the inventory authority. User-authored notes survive ordinary draft validation. The tradeoff is explicit: generated schedules and ingredient quantities do not include generated cooking directions.
- Server-log inspection caught a render loop even after browser assertions passed: legacy revisions appended the optional category field in a different key order than schema-normalized saved plans. Raw JSON equality repeatedly triggered autosave. Compare normalized objects; the new browser regression covers console errors and persistence as well as visible content.
- Evidence: [remediation verification](../audits/2026-09-30-remediation/verification.md), including red/green boundary and stock-prose checks. Hosted accounts and physical phones remain outside this local verification.

## AGENT-CONNECTIONS-001 — Retry, quota and verification boundaries

- Status: repaired in working changes; live hosted pairing remains unverified.
- Review found frequent inbox polling would exhaust the shared app allowance. Agent admission now uses separate counters and foreground-only polling; the PostgreSQL verifier exercises quota boundaries and independence from AI usage.
- Review found a saved local approval can conflict with an already terminal server outcome. Independent durable receipts prevent repeat logging, and Recent outcomes retains the differing result instead of endlessly attempting an impossible acknowledgment.
- The multibyte capacity test initially rebuilt a multi-megabyte JSON document in a loop and timed out during the full parallel unit run. Calculating the fixture size once retains the capacity assertions without quadratic setup work. The subsequent full unit run passed 350 tests.
- An early browser run restarted Vite while shared source changed; fixture cleanup also closed the isolated API before pending refreshes drained. The fixture now drains page routes before closing its server. All eight dedicated desktop/mobile connection journeys pass.
- The first broader browser run passed 225/236 checks; failures involved existing asynchronous record-saving assertions and changed privacy copy during concurrent account-storage work. Rechecking the updated affected files is tracked in the agent implementation record. CYC startup is still limited by CYC-ASSETS-001.
- Rechecking reproduced a test-only immediate-refresh failure: its polling callback threw when the compatibility mirror was temporarily null, ending the assertion before the writer could finish. The callback now permits that transient empty state while still requiring the exact recovered name and journal cleanup.
- A later unit run overlapped the production build and browser suite; three CLI subprocess checks exceeded their five-second limit. Final verification runs the unit suite without those overlapping jobs, retaining the configured timeouts. A transient unused import from concurrent account edits was already removed before the subsequent successful production build.
- The full browser rerun exposed two remaining immediate-read races after saving a repeated plan and checking a shopping item. Their assertions now wait for those exact durable values; checking the writer queue alone can precede React's save effect. Expected records and values are unchanged.
- Removing competing build/browser commands reduced but did not eliminate CLI cold-start timeouts: Vitest's own parallel unit transforms still competed with the process-level tests. `npm test` now runs the complete source/server suite followed by the complete CLI/MCP suite, preserving all assertions and timeouts while separating process-level integration from unit-worker startup.
- The follow-up shopping preferences check read records while the reloaded page still displayed its hydration screen. Its existing visible-restored-household assertion now runs before inspecting saved preferences. This retains both reload and exact-value checks.

## READINESS-001 — Account continuity and interrupted persistence

- Live REST conflict verification uncovered the original snapshot RPCs using SQLSTATE40001 for permanent revision mismatch. PostgREST repeatedly retried the transaction until the socket closed after60seconds. Additive20260929_snapshot_conflicts changes only those business raises toPT409; clients retain legacy40001 recognition and handlePT409. Hosted stale create/update/delete checks now return promptly without changing the saved copy; 29 readiness and19 snapshot DB checks pass. Original applied migration hashes remain unchanged.
- A Save followed immediately by navigation could precede React's passive persistence effect. Saves now journal at the action boundary; a regression clicks Save and reloads in the same action while the durable writer is deliberately blocked.
- Native account selection could briefly expose the previous owner's in-memory records. An epoch-bound readiness gate now clears access synchronously and rejects edits/uploads until the selected owner's records load; stale asynchronous callbacks cannot publish to the new account.
- The production native export exposed a welcome-back timing regression: visit detection read the gated records before loading completed. It now waits for the saved visit and ready records together before choosing Spot's greeting; the existing six-day-return journey detects this case.
- The audit reproduced hosted mobile bootstrap rejection and unconnected purchased ingredients; focused regressions cover the repaired bearer/bootstrap boundary and reviewed ingredient mapping.
- Automatic restore first treated equivalent objects with different key order as conflicting. Canonical field comparison fixes semantic equality without treating different inventory edits as mergeable.
- Embedded photos exceeded localStorage's small capacity. IndexedDB and separate private cloud media now hold them; a small synchronous journal protects ordinary edits if refresh occurs before a durable write completes. Large-photo, immediate-refresh, interrupted-owner-switch and sign-out-during-download checks exercise actual browser persistence.
- Account cleanup initially enumerated only localStorage and native deletion made a backup of the deleted records. Cleanup now enumerates durable namespaces and staged native generations while preserving other accounts and guests. Account changes and saves share serialization; account archives are the recovery source of truth.
- Existing post-render test fixtures edited only the legacy localStorage mirror. They now install records through the actual durable writer before reload and wait for saved state instead of assuming asynchronous writes already finished.
- Concurrent Playwright runs stopped a shared auto-managed dev server. Final verification uses independently running web/Metro servers so completion of one run cannot stop another's server.
- Hosted database verification initially expected zero rows for prohibited Storage mutation; the deployed policy instead returned permission-denied SQLSTATE42501. Both protect records. The verifier accepts either secure result inside a rolled-back savepoint; all22 database checks passed without weakening policies.
- CYC startup remains blocked by CYC-ASSETS-001; direct checks are used without changing protected settings.

## AI-FALLBACK-001 — Generation failure interrupted the user without automatic recovery

- The user requested a recovery path after the initial Qwen migration deliberately disabled fallback. New failure-injection tests reproduced immediate 429/invalid-output failure, missing refusal classification, and a primary timeout consuming the full time budget.
- Extended the existing provider boundary with one GPT-5 mini backup, identical output validation, separate credentials, and a shared overall deadline. Primary time is bounded to leave room for recovery. Caller cancellation and refusals never start another provider; failed backup results never enter records.
- Live forced primary 503 recovered via actual OpenAI and Jev calls; cache replay did not add calls. Existing frontend failure/retry paths remain authoritative if both services fail.
- A generated deployment snapshot under `.local-checks` was discovered by Vitest's path matching. Removed that specific verified generated snapshot before final checks, without changing test exclusions or touching source/worktrees.
- CYC startup still exceeds its source-fingerprint limit (CYC-ASSETS-001); direct checks used without changing protected settings.

## QWEN-001 — OpenAI compatibility does not guarantee structured output

- QwenCloud documents that Chat Completions search omits source metadata and Responses does not promise `text.format` enforcement. Reusing OpenAI parsing options alone would weaken validation or source attribution. The adapter uses Responses plus explicit schema instructions and local Zod validation, preserving actual search metadata. No failed call falls back to a more expensive provider.
- Verification setup initially assumed the SDK passed a Request to fetch; it actually passed URL/init. The test now constructs a Request from both arguments before inspecting it. The shared request type also explicitly retains the pre-existing OpenAI `max_tool_calls` option while omitting that undocumented setting for Qwen.
- One initial live synthetic label request returned 503; its upstream cause was not captured. A diagnostic repeat succeeded. The failed attempt saved nothing and offered manual entry. This is a recorded reliability limit, not a diagnosed provider defect.
- CYC startup again exceeded its source-fingerprint limit; direct checks were used (CYC-ASSETS-001).

## ONBOARDING-001 — An inline introduction was not a new-user flow

- The user correctly found that the Spot slides appeared inside an already-open app, without a clear account entry flow. Replaced automatic inline onboarding with a dedicated welcome/account/setup gate in both renderers. Existing users can replay the full tour without clearing their records or draft.
- Shared React hooks initially resolved the root web React from Metro, producing invalid hook calls. Native Metro now disables hierarchical package lookup and resolves the native dependency path first. A Metro restart was required.
- Existing browser tests raced the new asynchronous entry check while reading device state. Returning-user fixtures now explicitly seed completion and initial records; raw first-launch tests exercise the complete gate without that fixture. No product guard was weakened.
- Independent auth review found a sign-out/completion race and a native write that was not awaited. Completion now validates the account epoch around asynchronous operations; native profile saving awaits the serial writer. A storage-failure regression verifies the gate stays open, completion is absent, and retry saves the profile.
- CYC startup again exceeded its source fingerprint size limit; direct project checks were used without changing protected verification configuration. See CYC-ASSETS-001.

## SPOT-SCENE-001 — Native scene retained its intrinsic image height

- Status: repaired in working changes.
- Reproduction: the first 320px Expo-web screenshot showed a tall green frame and the artwork below the fold. Image visibility alone did not detect it.
- Cause: percentage width plus maxWidth and aspectRatio did not override the native Image source's intrinsic height in Expo web.
- Fix: explicit matching width and height for hero and compact scene images; contain preserves the full composition. Added square/bounded scene assertions to the native first-use test.
- Native development reload can wait on unrelated resources after the page is ready. Use DOM content loaded plus visible app assertions, as in existing native reload journeys; keep image decoding as an explicit visual check.
- Follow-up: DOM-ready navigation also stalled. A diagnostic showed HTML returned 200 while the bundle response never arrived. Restarting the existing Expo preview on 8081 with a clean Metro cache fixed it: reload 880ms and all three native Spot journeys passed in 7.7s. Do not treat relaxed navigation waits alone as the fix for a stalled bundle server.

## SPOT-INTRO-001 — Replaying an introduction resumed the previous slide

- Status: repaired in working changes; regression verification recorded in the Spot implementation notes.
- Reproduction: skip at food slide, type a draft, choose Chat menu → Meet Spot. The new browser check expected the opening press conference but the existing step state stayed at food.
- Cause: SpotWelcome stayed mounted as its intro prop changed, retaining its local step.
- Fix: key SpotWelcome by introduction versus ordinary welcome in both platform consumers. This resets presentation only; the parent still owns the draft and saved records.
- Guard: `tests/spot-personality.spec.ts` replays with missing art, verifies the first slide and unchanged draft. No records or preferences are reset.

## CYC-ASSETS-001 — Run startup exceeds source fingerprint size

- Status: tooling limitation observed during Spot app onboarding work.
- CYC run start refused before creating a run: selected source exceeds 20,000 files or 128 MiB after the image packs were added. Verification configuration was not weakened or changed.
- This task uses direct project unit/build/browser checks and native lint/typecheck; no controller-managed run completion is claimed.

## NATIVE-LINT-001 — Expo lint tooling and shared parent imports

- Status: resolved in working changes.
- TypeScript 7 no longer exposes the compiler API expected by Expo ESLint's parser. Preserve TypeScript 7 under the `typescript-compiler` alias for the shared Zod type check, and use TypeScript 6 for tooling.
- Parser resolution from imported parent-directory files failed; configure the import plugin with the mobile parser's absolute resolved path. Installing the parser alone did not fix cached/import resolution.
- Global flat-config ignores must be a separate object; combining ignores with settings caused generated Metro bundles to be linted. Exclude generated dist/android/ios/.expo/test-results globally.
- Guard: mobile ESLint with cache disabled reports zero errors; normal type checking still uses compiler 7.

## RECEIPT-001 — Kitchen receipt button only navigated to Chat

- Status: resolved in working changes, CYC `00214788-79d7-4f9e-ad37-509eab8eda8f`.
- Reproduction: clicking Add a receipt changed the route without opening a capture dialog; the new browser test failed on the missing dialog before the fix.
- Fix: both Kitchen receipt invitations use an explicit capture callback. Camera (rear-facing hint) and library choices stay on Kitchen through preview; only sending or saving navigates to Chat. Receipt context is kept separate from meals, with no demo choices in this flow. Cancel resets the capture intent and leaves the Chat draft and saved records intact.
- Guards: `tests/receipt-capture.spec.ts` covers camera input, picker cancellation, invalid type recovery, same-file retake, preview, mocked AI submission, unchanged intake, draft preservation, and offline review. Physical phone camera behavior still requires a real-device check.

## SHOPPING-001 — Live price research returns an incomplete structured answer

- Status: resolved in working changes, CYC `9d6064db-c63e-4611-83db-f1fe2d708066`.
- Reproduction: the live two-product price research returned `status: incomplete`, `incomplete_details.reason: max_output_tokens` with a 3,500-token ceiling. Browser mocks did not expose it.
- Fix: a 7,000-token response budget and low reasoning effort for GPT-5 models. Preserve bounded request/tool limits and unknown-price fallback. The follow-up live call completed with one source-linked quote and no invented second price.
- Evidence: ignored `.local-checks/prices-live-result.json`; source and normalization guards in `server/shopping.ts` and `server/shopping.test.ts`. Provider-generated prose cannot bypass arithmetic evidence gates; the displayed research status is deterministic.

## NUTRITION-001 — Example calories appear as personal daily intake

- Status: resolved in working changes (not committed), based on `4bd8875`.
- Signature: nonzero `sumNutrition(initialState().meals)` on a fresh account; example meal buttons in the personal diary.
- Root cause: startup seeded example meals dated today; totals filtered only by day. Insights independently used broader source/ID filters, causing inconsistent consumers.
- Reproduction: the fresh-state test returned 1,970 calories instead of zero. After the domain fix, the browser still displayed the sample meal in the diary; the browser exclusion test failed correctly.
- Fix: clean fresh state, non-destructive revision migration, centralized `isExampleMeal`/`personalMeals`, shared totals and consumer filters. New capture examples are explicitly marked. A targeted test also caught legacy local-parser samples identified only in their note; their specific demo-estimate notes are now recognized.
- Attempts: the first browser fixture omitted required `note`, triggering validation fallback and a false zero; fixed the fixture before implementing UI changes. The note-provenance regression failed before its fix and passed afterward. A test literal with an extra `title` field caused a TypeScript excess-property error; using the typed meal variable fixed the test without broadening the production API.
- Guards: `src/day.test.ts`, `tests/nutrition-day.spec.ts`, AI context and insight/review unit tests. Records are preserved byte-equivalent through upgrade; examples are excluded, not deleted.

## NUTRITION-002 — Open Nutrition page keeps yesterday's totals

- Status: resolved in working changes (not committed), based on `4bd8875`.
- Signature: date-sensitive selectors only update after another application render.
- Root cause: local date was read during render without a midnight timer or wake event subscription.
- Fix: `useLocalDay` in App schedules actual next local midnight and refreshes on focus/visibility/pageshow. No stored meal dates change.
- Guards: local-midnight and wake browser journeys; timer cleanup, 23-hour and 25-hour days in `src/day.test.ts`.

## VERIFY-001 — Tests assumed automatic demo state and a single Scan button

- Status: resolved in working changes; full-suite evidence recorded by CYC.
- Cause: removal of seeded records invalidates sample-based fixtures; new direct scan action makes global menu button locators ambiguous.
- Fix approach: use explicit demo fixtures only for sample journeys, explicit personal fixtures for intake tests, and scope menu locators to their dialog. Keep new-user assertions genuinely empty. Do not restore automatic fake intake to satisfy old tests.
- Another test locator used `Calories` where the target form uses `Daily calories`; the 30-second timeout disappeared after matching the actual accessible label. No product change was needed for that failure.

## PANTRY-001 — Excluded example meal can still consume real pantry stock

- Status: resolved in working changes (not committed), based on `4bd8875`.
- Root cause: the chooser excluded sources containing `sample`, while the reconciliation mutation did not check provenance. Legacy demo notes and explicit example flags passed through.
- Reproduction: linking a legacy demo shake consumed one real milk serving, leaving 15 of 16 while the personal total stayed zero. The new rejection regression failed before the fix.
- Fix: shared personal-meal chooser and mutation-level example rejection before events or inventory changes.
- Guards: `src/features/pantry/ledger.test.ts`; 21 pantry tests and type checking passed after the focused fix. Real personal reconciliation remains covered.

## VERIFY-002 — Calendar fixtures cross midnight during UI checks

- Status: resolved in working changes (not committed); focused and full checks required after repair.
- Signature: seeded 700-calorie dinner reports zero for today; September 20 history button disappears in a September 26 fixture.
- Cause: live Date advanced across midnight between seeding and assertions. The rollover fixture also started only ten seconds before midnight with a running fake clock, so a slow build could advance it before its explicit fast-forward.
- Attempts: separating heavy native compilation from browser verification removed contention but a different existing test still crossed real midnight. No product rollover change was appropriate.
- Fix: freeze seeded meal journeys at noon on the fixture day; pause the rollover fixture's clock until its deliberate fast-forward. This preserves the midnight behavior assertions instead of increasing timeouts.
- Follow-up: keeping timers paused after the wake assertion prevented the lazy scanner from mounting. Resume the clock after asserting the new day and before opening that tool; date rollover assertions remain paused and deterministic.
- Guards: `tests/flows.spec.ts` and `tests/nutrition-day.spec.ts`.


## REBRAND-001 — Local verification shell and hosted origin update

- Status: resolved tooling obstacles in working changes.
- PowerShell startup stalled even for an explicit no-profile Get-Location. The same build passed through cmd.exe. CYC now invokes the identical npm run build through cmd.exe with exit propagation; no checks were removed.
- The first rebrand run halted because its protected configuration changed. The user explicitly approved retaining the equivalent runner fix and starting fresh verification; the halted run remains as history.
- The initial wildcard www redirect handled non-root paths but the homepage still returned 200. Added an explicit root redirect ahead of the wildcard and redeployed; verify apex and www independently.
- Vercel CLI 48.5 env update rejected updating the existing sensitive APP_ORIGIN with "You cannot change the key of a Sensitive Environment Variable." Retrying with --sensitive did not resolve it. Recreated only this public origin value using env rm/add; existing deployments are unaffected until redeploy. Provider credentials were not changed.
- Domain attachment initially used the reference's outdated two-argument command. The installed CLI accepts only the domain and uses the linked project; both apex and www were attached successfully that way.

## VERCEL-001 — Deployed API cannot resolve shared module

- Status: resolved in working changes and production deployment.
- Reproduction: deployed public config returned FUNCTION_INVOCATION_FAILED; runtime logs reported ERR_MODULE_NOT_FOUND for src/domain imported by the cloud client.
- Cause: the Vercel TypeScript output preserved extensionless imports across shared modules; local tsx and Vite checks did not expose this Node ESM packaging issue.
- Fix: bundle local TypeScript dependencies with esbuild into .generated/health.mjs and export it from api/health.mjs; external packages remain runtime dependencies.
- Guards: production config 200, unauthenticated status 401, approved synthetic account streamed a real AI response and replayed it; private capture access checks passed. Synthetic account and image removed afterward.

## AUDIT-R2-001 — Display limits and normalized dates blocked real workout history

- Status: resolved in round-two working changes; retained red/green evidence in `docs/audits/2026-09-30-round-2-remediation/`.
- Signature: full history stopped after five web sessions; valid imported ISO dates without milliseconds could display but not reopen. Recent-training counts underreported sessions exceeding eight exercises or ten sets.
- Cause: presentation reused the bounded AI context helper, then compared normalized display dates with raw stored strings.
- Fix: separate full recorded history from bounded AI projection; use timestamp equality for correction. Recent UI counts use full records within the latest five sessions.
- Guards: `src/round-two-workouts.test.ts`, `tests/round-two-workouts.spec.ts` cover thirteen sessions, nine exercises/twelve sets, 112 recent sets and reopening the oldest imported session.

## AUDIT-R2-002 — Confirming an unchanged load left an empty input

- Status: resolved in working changes after independent review and a reproduced browser failure.
- Signature: explicitly confirming bodyweight zero and applying it to remaining sets enabled rep entry but left the remaining load fields blank.
- Cause: the input draft initialized from confirmation state, while its React key only included numeric load and unit.
- Fix: include confirmation state in input identity so newly confirmed unchanged references display correctly.
- Guard: the bodyweight UI regression first failed with expected `0`, actual empty string, then passed on desktop and mobile. Prior actual sets remain protected by shared-operation tests.

## VERIFY-R2-001 — Source edits can invalidate an in-flight browser observation

- One mobile routine check lost its typed load during parallel source editing; the same unchanged check passed after the shared lane froze. HMR is suspected, not proven.
- Preserve the failure and rerun against stable source; do not add retries or change a product assertion to mask it. Coordinate final exports and aggregate suites after source changes stop.

## AUDIT-R2-003 — Provider reconstructed invalid pantry identifiers

- Signature: two controlled live planner calls returned 422 because generated lot IDs were absent from the supplied pantry. Both rejections left meals, stock events, groceries and saved plans unchanged.
- Cause: provider context exposed long composite IDs alongside nested receipt/product identifiers, while output accepted arbitrary reference strings.
- Fix: server-only request-local aliases with an alias-or-null output enum; exact reverse lookup restores original IDs before unchanged stock/date/restriction validation. Unknown references are never inferred from food names. The minimized context retains package dates, prices, ingredient labels and stock uncertainty.
- Guards: six `server/plan-references.test.ts` regressions cover exact mapping, identically named lots, unknown aliases, empty pantry, source immutability and core validation. Final live evidence and remaining limits are in the round-two kitchen report.

## AUDIT-R2-004 — Incomplete optional cooking method rejected a usable schedule

- Signature: a controlled live week failed because one generated method omitted an ingredient, even though the method is optional.
- Fix: omit an incomplete generated method while retaining a valid schedule and complete methods on other meals. The UI explicitly reports no method; review still requires complete references, cooking times and baking temperature. No timing or missing method is fabricated.
- Guards: retained red optional-method test, corrected shared regression and desktop/mobile seven-meal fixture with six methods and one explicit omission. Core inventory, date and restriction failures continue to reject the plan.

## CHAT-HELP-001 — Unavailable connected chat treated questions as captures

- Status: implementation verified locally; deployment verification retained in `.local-checks/chat-help-*`; user acceptance pending.
- Reproduction: `What should I say?` entered the unavailable-provider fallback, created a capture review and returned prototype estimate copy. Four new mobile browser checks failed against the original code (chat-help-red.log).
- Repair: provider-independent help replies; unsupported fallback messages remain conversation messages without review/nutrition/workout mutations. Visible account/retry/examples actions explain unavailable chat. Status refreshes after account changes and network return; stale requests are aborted/ignored and non-OK status cannot enable AI.
- Consumers: web Chat, persisted conversation, legacy review notes, pending sample portions, nutrition/workout shortcuts, account connection lifecycle. Existing notes remain available; the legacy-note test now seeds an existing record instead of requiring the defective auto-capture behavior.
- Guards: `tests/flows.spec.ts` covers exact input, refresh persistence, connected help without AI requests, pending sample preservation, unsupported questions, reconnection, account-change refresh and rejected status. Full suites and hosted guest journey retained separately.
- Tooling limit: CYC managed-run startup hit its existing 128 MiB/20,000-file source fingerprint limit, as previously recorded for provider work. Configuration was unchanged; direct project verification commands were used. No managed-run completion claimed.

## CHAT-SCOPE-001 — General conversation needed explicit scope and clinical boundaries

- Status: implementation and live synthetic provider checks passed; deployment verification is retained in `.local-checks/chat-boundaries-*`; user acceptance pending.
- Scope: general nutrition/training/recovery/wellness/app questions are conversation, not consumed food. Grocery budgeting and cooking stock are in scope; investing is not. Personal diagnosis, tests, medication changes and treatment plans receive a clinician handoff; current emergencies/crises receive urgent support guidance. Roleplay, professional claims and repeated pressure do not change scope.
- Mechanism: tool-free structured input review before generation, authoritative scope in the generation prompt, and a separate review of the normalized complete output before streaming a result. Rejected requests use fixed replies and null record/action fields. A review outage fails closed with a retryable error. No unchecked draft is streamed. Successful ordinary questions cannot propose records without both checks authorizing current capture evidence.
- Cache: request hashes include the policy version so old unreviewed hosted results cannot replay under the new policy. Prior IDs receive a mismatch and can be sent as new messages; already stored user records are not deleted.
- Reproduction: 13 new checks failed on the original pipeline; one existing capture expectation already passed. Final checks cover scope redirects, clinical/urgent/crisis replies, output enforcement, unavailable/invalid review, cancellation, image/history forwarding, HTTP no-result-on-failure and legacy-cache rejection.
- Failed live attempt: input review allowed `I walked for 20 minutes today`, but output review incorrectly returned clarify for an accurately dated, normalized activity review card. The exact provider trace showed a valid card and a before-saving instruction. Reviewer lacked app date context and explicit semantics distinguishing a proposed review card from an already-saved claim. Supplying both resolved the reproduced rejection; the final full live journey retained the 20-minute proposal. The earlier failure is preserved, not erased.
- Test-harness repair: the HTTP regression initially timed out because its generation mock omitted generationAvailable; fixed the mock export. Product timeouts/criteria were not weakened.
- Limits: model-based semantic checks reduce scope drift but do not constitute clinical validation or proof against every jailbreak. Existing guest/offline flow provides local help/manual tracking, not general AI answers. No permission bypass or new clinical capability was added.

## CHAT-SIGNIN-001 — Guest chat misreported sign-in as a connection failure

- Status: implemented; verification and deployment evidence retained in `.local-checks/chat-signin-*`; user acceptance pending.
- Cause: `requireBrowserOwner` threw an undifferentiated error for guests; App converted every error into unavailable chat. Sending a guest message then added a misleading unavailable assistant reply.
- Repair: typed sign-in/setup errors, explicit guest banner and Create account/Sign in forms. Text, Tell Spot, camera, attachment and voice entry points open the existing account modal. Guests keep their unsent draft; no message or tracking record is created by the prompt. Genuine outages and disabled beta access retain distinct states.
- Account continuity: explicit record confirmation is still required. Only an intentional ownerless-to-owned chat upgrade preserves the composer; switching between existing owners continues to clear drafts. Confirming records writes the account onboarding marker so refresh does not replay onboarding. No beta admission or server authorization policy changed; the modal discloses the private beta requirement.
- Review: auth events refresh status; stale checks are aborted/ignored; drafts are never automatically submitted after sign-in. Existing account tools retain their original form. New chat entry hides unrelated backup tools.
- Test recovery: the hosted-origin fixture initially used insecure HTTP, which lacks browser crypto support; changed the fixture to HTTPS. An in-flight proxy response at teardown was fixed with awaited route cleanup. The pre-existing 401 assertion expected the old generic outage; it now checks the required sign-in state while still ensuring rejected status cannot enable AI.
- Tooling: CYC managed startup remains blocked by its existing source fingerprint size limit. Direct configured checks are used without claiming a managed-run completion.


### SPOT-GUIDE-001 — tracking-first interaction onboarding (2026-10-01)
- User requested the agreed post-Meet Spot interaction guide, with calorie tracking and fitness central. Existing welcome led with groceries; first Next went to grocery personality copy, without input/payoff previews.
- Regression `tests/interaction-guide.spec.ts` failed on the missing guide heading before implementation (desktop, 8.2 s).
- Added shared static teaching data and separate web/native renderers; examples have no capture/persistence callbacks. Guide uses existing account/setup handoff; returning help preserves composer drafts.
- First native check caught an invalid manualMeal tool identifier and a guide transition accidentally placed in Button.label. Corrected to the existing ManualMeal sheet and onPress transition before runtime verification.
- CYC managed run start again failed at existing CYC-ASSETS-001 fingerprint size bound. Direct configured checks used; no protected engine/config edits and no managed completion claim.
- Native runtime first pass: new preview → manual meal → save → refresh journey and six other journeys passed; one replay test still expected grocery artwork immediately after first Next. Updated it to expect the new guide, then use More about Spot for the retained optional tour.
- Focused web checks passed 20/20 across desktop/phone; final direct unit, build, full browser, native type/lint and affected native journey checks retained in docs/audits/2026-10-01-interaction-guide/evidence. Candidate implementation is not a claim of user acceptance or conversion/retention lift.

- Expanded web workout assertions initially assumed an empty history array; initial/legacy records omit history until the first saved workout. Corrected pre-save checks to compare with the untouched initial history, still requiring exactly one saved workout after confirmation. Guide → manual meal → persisted real entry checks passed on both web viewports.


### ONBOARDING-THREE-001 — combined choice still said both (2026-10-01)
- User screenshot reproduced a selected A little of both alongside Food & meals, Movement & workouts and Groceries & dinner. Combined ready guidance also omitted receipts.
- Expanded existing record-preservation journey failed before repair: missing A little of all three default (6.1 s).
- Renamed the combined choice to A little of all three. Shared default and first-step copy now keep web/native aligned and cover a meal, workout or receipt; receipt-specific guidance focuses on purchases followed by later portion logging.
- Existing saved focus strings remain readable without rewriting records. Auth, completion and routing are unchanged.
- CYC managed startup again hit CYC-ASSETS-001; direct configured checks used. Final evidence retained in docs/audits/2026-10-01-onboarding-three/evidence. User acceptance pending.
- Consumer review found the Chat account-upgrade fallback still saved the old combined string when no onboarding record existed. It now uses the shared default; existing saved values remain unchanged. Final web verification is repeated after this consumer correction.
- Expanded native assertion initially expected aria-checked, but the current Expo-web renderer omits that attribute for the existing accessibilityState radio implementation. Verify visible label plus the actual saved default focus after completing setup; no production accessibility API changes made for this copy correction.
- Broad browser verification: 313 passed, one existing Connections setup timed out waiting for its button before storage failure was injected. Three isolated repetitions of that exact test passed in 5.2 s without application changes. Resource/startup contention is suspected, not proven; repeat the full browser suite without overlapping builds/native startup, preserving original assertions/timeouts.

### ONBOARDING-NAME-001 — combined choice order and optional name (2026-10-01)

- Status: resolved in working changes. Focused web 28/28, shared sync 8/8 and Expo-web onboarding/account restoration 5/5 passed; final configured checks are retained in docs/audits/2026-10-01-onboarding-required-name/evidence. User acceptance pending; no commit requested.
- Reproduction: new setup browser regression failed before repair (6.4 s): combined option appeared before Groceries & dinner. Web/native name fields also allowed blank completion.
- Repair: shared choice array puts the combined option last. Shared prepare and finish validate a trimmed, nonblank name before owner binding/profile writes. Web required input and both continue buttons reject empty/whitespace names; saved profile receives normalized name. Existing completed records are not migrated.
- First focused run: new desktop/phone regression passed; 8 account-fixture journeys timed out because they attempted empty-name continuation. Add explicit names to setup fixtures without weakening account/archive assertions.
- Second focused run: 24 passed/4 failed. Defaulting fixture name to Alex caused returning-account/photo restore checks to conflict. Consumer tracing exposed a real consequence of mandatory names: isFreshDevice considers every nondefault profile name local history, even when it matches the account. Added a focused regression; RED 7 passed/1 failed with conflict instead of saved.
- Extend the fresh-device predicate only when setup name exactly matches the remote name; all other profile fields/tracking records still must match fresh defaults. Different names remain conflicting. Preservation fixtures provide their own existing name, retaining zero-upload and restored-name assertions; native account restoration fixture also supplies its existing name.
- CYC run startup refused at the existing CYC-ASSETS-001 fingerprint bound. Direct configured checks used; no managed completion claimed.
- Guards: tests/onboarding.spec.ts rejects bypassed form submit, empty/whitespace names, verifies order, trimmed name and reload; mobile/e2e/onboarding.spec.ts covers order, empty/whitespace names and saved trimmed name.
- Semantic review: both shared hook entry points reject before side effects, callers persist only normalized names, and existing auth-epoch/account ownership guards remain. The sync exception cannot discard a competing name, changed targets/body data, tracking activity or a new edit during download. No global profile migration/schema change was needed.

### FITNESS-SETUP-001 — onboarding omitted goals and the weight tracking loop (2026-10-01)

- Status: resolved in working changes; user acceptance pending. Final configured and native outcomes retained in docs/audits/2026-10-01-fitness-onboarding/evidence; no commit requested.
- Scout: bodyWeights and weight editing already exist on web/native but onboarding only collected name/focus. Profile icon reaches You, whose account row opens a second cloud/backups surface. Reuse weight records and account flows, add explicit sign-in/sign-out actions at the top of You and a focused goals step.
- First feature pin: fitness-goal.test.ts failed because the new shared fitness-goal module does not exist yet (0 tests collected). Implement atomic goal/starting measurement save, contradictory-target rejection, duplicate-date preservation and calendar check-in calculations.
- Challenge: collecting body data must not invent calorie targets or classify arbitrary existing profile changes as fresh. Starting measurements must not overwrite existing same-day records; retries use one stable entry ID. Skipping goals must preserve existing profiles and archives. Quick sign-out must reuse account session behavior and keep local records. These are acceptance checks, not hypothetical approval requirements.
- Managed CYC run start hit existing CYC-ASSETS-001; use configured commands directly without altering engine/config or claiming managed completion.
- Web feature pin failed on the missing goals heading (6.4 s). First renderer pass reached the new heading but timed out finding an exact select label; wrapping option text contaminated its accessible name. Give selects explicit accessible labels, preserving the visible labels. Source changed during that initial partial build; final checks will use stable source.
- Goals/weight/account-entry journey then passed desktop and phone. Expanded AI-context unit pin initially supplied a non-UUID request ID and was rejected by the existing contract; fix the synthetic ID, not production validation. Existing onboarding tests now explicitly choose Set this up later, retaining their unchanged record/restore assertions.
- Expanded focused web run: 31/32 passed; an immediate post-reload record read saw target 78 while the failure snapshot already showed restored target 77. Three desktop repetitions produced five passes/one identical failure. The helper queried IndexedDB before onboarding hydration had replayed the synchronous save journal. Wait for the actual restored target on screen before asserting durable records; retain the exact persistence assertions and app save-at-action boundary.
- Native profile sign-in also needs the account onboarding marker after explicit record confirmation, as web already does. Add the same marker with identity guards, so reload does not restart setup or discard the goal flow.
- Initial Expo-web verification: 4/6 passed; the new quick actions create a second Sign in/Sign out match behind the existing Cloud sheet in the web renderer. Scope the sheet actions using the established native fixture convention; do not remove either real action or weaken saved-record checks.
- Native lint rejected setting the measurement unit synchronously in an effect (one new error, nine existing warnings). Replace the effect with a component key tied to the chosen goal unit on both renderers, so a deliberate goal-unit change initializes the form coherently without cascading state updates. No lint rule or assertion was relaxed.
- New web journeys passed 6/6; four shared goal/context checks pass. Unit suite 425/425, build/native types and lint pass (nine preexisting warnings). Expanded native run passed six journeys and failed only the account-security fixture's duplicate Sign in lookup; target its open Cloud sheet action with the same established selection convention, preserving deletion-failure and archive checks. Initial failed log retained separately before final stable-source rerun.
- Final semantic review: optional schema preserves legacy data; goal and starting weight save together, stable retry IDs prevent duplicate records, existing same-day records cannot be overwritten, and edits without a new weight preserve history. Source units reach both measurement forms and validated AI context. Check-ins are in-app only, and neither target weights nor defaults configure macro targets. Direct auth actions retain ownership/session guards and local records. React effects ignore stale session reads and unsubscribe; heavy web account provider remains deferred. No open implementation finding.
- First full web suite passed 312/322; ten failures were strict selectors matching quick profile actions behind the open account dialog. Scope the shared sign-in fixture and cloud signup action to the named account dialog. All upload, deletion, conflict and record-preservation assertions remain intact. Retain the failed run separately; rerun the affected journeys and full suite on final source.

### ONBOARDING-POLISH-001 — resumable setup and first tracking action (working; awaiting acceptance)
- New shared draft pin failed because the draft module did not exist (Vitest missing import). Implement bounded strict schemas, separate guest/account keys, and pending target review without applying health records. This is the expected red-first feature result.
- Challenge: drafts must not contain credentials/record-confirmation, cross account identities, override completed setup, or auto-log examples. Serialize async writes before completion cleanup; require the existing ownership verification for saves. Reuse real manual logging forms for payoff.
- Managed CYC startup remains blocked by the existing source fingerprint asset limit; direct configured checks will be retained. Do not alter engine/config or claim a managed completion.
- First-log pin failed on the missing new module. Real personal meals, manually saved activities and completed recorded workout sets qualify; setup/receipt/sample data do not. Reuse existing manual forms rather than generating sample records.
- Focused draft/first-log/nutrition tests passed 7/7; native types passed. Web types found missing required note fields in two synthetic meal fixtures. Add the required fixture fields; preserve production meal validation.
- Expanded web checks exposed an auth consumer regression: resetting entered on the first null-to-account session removed the open in-app account panel during guest sign-in. Preserve the existing entered-session transition for first sign-in; still reset draft fields and first-log state on identity change, and reset the full flow on account-to-account changes/sign-out. Re-establish account-security checks.
- The expanded web run was started before the Save changes fixture edit actually reached disk (PowerShell/Python invocation exited 1 with no output). Apply the edit directly and confirm the source. Its first auth failures ran the original reset code; the final stable-source rerun must cover both. Place the web first-log card inside the existing chat scroll surface so the fixed profile/header and composer stay reachable.
- Expanded stable-source web run passed 14/16. The new account-resume fixtures searched for the native checkbox's short exact label; web exposes the full visible confirmation copy. Match the actual web prefix without dropping confirmation or credential-exclusion assertions.
- Semantic review identified account-deletion cleanup as a new draft-key consumer. Remove only the confirmed deleted account's draft, preserving other identities. Account ownership is project URL plus user UUID, not the bare UUID: resume past confirmation only after the existing verifier validates that bound identity. Add real account reload/sign-out/sign-in and deletion regression coverage.
- Account resume now retains 180 lb after both refresh and later sign-in. Its final fixture read found no health snapshot at all (the stronger intended result), instead of an empty snapshot object. Assert null explicitly: the draft must not create a starting measurement before final completion.
- Focused account resume/corrupt-draft/scoped deletion journeys passed 6/6. Earlier native checks passed 9/9 through Expo web. Source review resolved all scoped findings: owner verification, cleanup consumers, epoch checks after async draft operations, target review invalidation after changed goals, and the fixed Chat header/scroll surface. Final source verification follows; user acceptance and human/physical-device usability remain separate.
- First final pass: 432 unit tests, build/native types/lint and 10 native Expo-web journeys passed. The full web suite reproduced a desktop missing-art layout regression: intrinsic 1024px image dimensions let the grid's automatic minimum squeeze the heading column to a few pixels. Preserve reserved dimensions with responsive height and explicit zero-minimum grid tracks; retain the existing missing-art tour/record-preservation assertions. Re-establish final verification after the CSS repair.
- The first full suite finished 335/336 passing; the only failure was the proven missing-art desktop layout above. Retained as browser-first-failure.log. A focused adverse-storage pin reproduced a second first-prompt marker write after unrelated navigation (expected 1, observed 2). The completion callback was recreated every render, retriggering its effect after a rejected write. Stabilize action callbacks; keep the real saved activity intact and prove no automatic navigation-triggered retry.
- The initial corrective multi-file patch matched outdated formatting and was rejected atomically. No source was changed by that attempt; re-read the current callback and apply the scoped patch with exact context.
- Recovery passed 10/10 desktop/mobile journeys: missing-art tour retains records and the Chat draft; rejected first-prompt marker writes attempt once through unrelated navigation while the actual activity remains saved. Responsive grid/image sizing and stable action callbacks resolve both findings. Final suite is rerun on this source; implementation remains awaiting user acceptance.
- An optional diff check mistakenly overrode the repository's CRLF normalization and classified existing Windows line endings across the dirty tree as trailing whitespace. No repository configuration or source was changed by that diagnostic invocation. Re-run with the repository's normal settings; preserve existing files/line endings rather than normalizing unrelated work.
