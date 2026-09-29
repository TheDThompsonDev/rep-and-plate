# Error ledger

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
