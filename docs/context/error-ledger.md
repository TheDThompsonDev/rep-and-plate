# Error ledger

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
