# Readiness repairs — September 29, 2026

This implementation follows [the product audit](PRODUCT_AUDIT_2026-09-29.md). It improves the existing private beta; it does not open AI access to unapproved users or establish a public-launch readiness claim.

| Audit gap | Implemented behavior |
| --- | --- |
| Hosted native bootstrap | Public account configuration and verified bearer requests pass the browser invitation gate. Protected API routes still require a valid account and applicable beta admission. |
| Account continuity | Both apps save linked account records automatically, restore a fresh device, expose offline/conflict status, and use revision checks. Conflicting inventory edits require review. Separate local archives prevent account mixing. |
| Photo/history capacity | Saved photos use immutable private storage instead of embedded cloud snapshot bytes. Browser histories use IndexedDB with a small-record refresh journal. Native records and archives use serialized staged writes. |
| Account lifecycle | Email-code recovery, verified password changes, and typed/password-verified account deletion. Deletion blocks new writes, removes private media and server data, and purges this device's matching account namespaces. Other accounts and unlinked guest records are preserved. |
| Purchase-to-plan connection | Users explicitly map planned ingredients to reviewed pantry lots with compatible quantities. Logged meals remain historical facts; purchasing groceries does not add intake. |
| First useful week | Kitchen guides preferences, daily targets, receipt review, planning, missing groceries, and logging. Priced/unknown quantities are visible; partial data never becomes a promised checkout total. |
| Outcome tracking | Optional dated body weight, unit-aware history, per-set workout loads, and accurate completed-workout history. Generic starting nutrition targets are identified as such. |
| Operations | Private provider/model latency, outcome, token and fallback metadata; daily authenticated temporary-upload/cache cleanup; protected retention and quota checks; privacy/help surfaces and safe diagnostics; receipt evaluation tooling. |

## Verification and release boundaries

The three original readiness migrations and an additive snapshot-conflict correction were applied atomically to the configured Supabase project with a hash ledger. All 29 hosted readiness checks and 19 snapshot checks passed in rolled-back transactions: ownership isolation, immutable media, quota, cleanup selection, restricted operator functions, deletion gates, metadata cascade, and stale create/update/delete preserving the saved copy. No real user records or files were changed by these verifiers.

Live REST verification exposed the hosted database retrying ordinary revision conflicts because the original functions raised SQLSTATE `40001`. The additive correction changes only those business conflicts to `PT409`, retaining guards and permissions; both clients recognize the conflict. This follows the [documented Supabase retry issue](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). Live stale create/update/delete checks subsequently completed in approximately one second in total and preserved the latest saved revision.

Regression coverage includes automatic save/new-device restore, large photos beyond the localStorage mirror quota, immediate refresh before durable write completion, interrupted account switching, sign-out during download, rejected and successful deletion, recovery, shopping/pantry reconciliation, and outcome entry/edit/reload. Browser and Expo-web fixtures do not substitute for real phones or mailboxes.

The isolated repair release passed 324 unit tests, its production web build, and web/native type checks. The 240-case shared-checkout browser run passed 235 cases; the remaining five passed focused rechecks after durable-storage assertion fixes (three cases) and a clean download retry (two unchanged Spot gallery cases). Eight of those 240 cases belong to separate agent-connection work. All 22 additional focused receipt/product/purchase/outcome cases passed on both viewport sizes. Native lint completed with zero errors and nine existing warnings; production exports succeeded for iOS, Android and web.

Live API checks verified cookie-free account configuration, rejection of forged sessions, authenticated cleanup access without running global cleanup, private photo upload/restore, revision conflict preservation, a Qwen3.5-Flash chat response and Qwen/Jev token metadata. An incorrect deletion password preserved the synthetic records; verified self-deletion removed that test account, private photo, snapshot and telemetry. Dollar cost remained explicitly unknown because contracted rates are not configured. The live390px website also passed onboarding, first-week preferences, save/reload and page-error checks.

All 16 native application journeys passed against the production Expo-web export, including recovery, deletion, account restore, signup/sign-out, failed setup saving, purchased ingredients, body-weight/set-load edits, and Spot's return greeting. This avoids the stalled Metro development response and verifies the bundled application; signed-device testing remains outstanding.

Run `npm test`, `npm run build`, `npm run mobile:check`, `npm --prefix mobile run lint`, the web Playwright suite, and the mobile Playwright configuration for integration checks. Use `scripts/verify-readiness.ts` for rolled-back database verification; use the [receipt evaluation guide](context/receipt-evaluation.md) for representative quality measurements.

The CYC recorder still fails its source-fingerprint size limit (CYC-ASSETS-001). Direct project checks are retained; no controller-managed completion is claimed. Separate agent-connection work and pre-existing Spot presentation edits are outside this repair release.

## Remaining external release gates

- **Recovery email configuration and delivery:** the Supabase Magic Link template must expose `{{ .Token }}`. Verify a real signup/confirmation and password recovery email on both platforms. Server credentials available to this task do not manage hosted Auth email templates.
- **Support contact:** set `SUPPORT_URL` to the owner's real HTTPS support destination. The preview explains contacting the inviter until one is supplied; it does not invent a help desk.
- **Native distribution:** install signed iOS/Android builds on real phones and verify camera, microphone, keyboard, background/resume, expired-session, and interrupted storage behavior. Expo-web passing is not a physical-device release test.
- **Representative quality and cost:** provide permissioned real receipts and reviewed ground truth for evaluation. Fill `AI_TOKEN_RATES_JSON` with the actual contracted provider/model rates before interpreting dollar totals. Missing prices are recorded as unknown; raw token usage remains available. Configure provider-account spending alerts/caps in the billing consoles and measure a real pilot.
- **Public launch:** beta membership is still intentional. Public admission, paid tiers, guaranteed weekly savings, and adaptive multi-week exercise programming require separate product decisions and evidence.

Browser eviction, downloaded exports, and other offline devices remain outside a server account deletion's reach. Users should export important records and confirm account-saving status before changing devices.
