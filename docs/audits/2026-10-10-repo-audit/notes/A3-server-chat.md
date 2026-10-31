# A3-server-chat — findings C3, C4, C5, F4, F5

## Plan (written before editing)

Goal: make the chat pipeline's reply, error class and time budget honest, give the local server a clear answer for account deletion, and register the agents migration with the readiness runner.
Done when: red tests for each finding go green; `npx tsc --noEmit`, `npx vitest run src server`, `npx vitest run scripts/agents` pass.

Approach: repair in place (no new modules).
Context: `docs/context/chat-boundaries.md` (2026-09-30) describes the two reviews at 20 s each "inside the existing request deadline" — the deadline is not actually shared today. Error ledger has no entry for these defects. `docs/context/operations.md` documents `scripts/setup-readiness.ts` as the hash-ledger migration runner; `docs/AGENT_CONNECTIONS.md:116` says the agents migration was applied by hand on 2026-09-30.

Change:
- `server/chat-boundaries.ts` → `withoutRecordProposals` strips card sentences + record warnings and appends an honest line when something was removed (C3); `reviewChatBoundary` accepts a per-stage timeout and preserves provider failure class: 401/403/429 keep `status`, `AI_NOT_CONFIGURED` passes through, per-review timeout becomes `AI_BOUNDARY_TIMEOUT_<STAGE>` (C4, C5).
- `server/ai.ts` → `runAI` takes an optional epoch `deadline`; each stage gets `min(stageBudget, remaining)`; generation reserves the output-review budget; output review fails fast with `AI_BOUNDARY_TIMEOUT_OUTPUT` when too little remains (C5). `checkIntent` gets a timeout parameter.
- `server/http.ts` → builds the deadline from one `CHAT_DEADLINE_MS` (180 s, unchanged), passes it to the runner; public copy for the new stage-named codes; `/api/account/delete` answers 501 with hosted-only copy (F4).
- `src/features/cloud/useAccountSecurity.ts` → 404/501 from the deletion route map to the hosted-only message (same wording as `mobile/src/api.ts:163`) (F4).
- `server/readiness-migrations.ts` → append `20260929_agents.sql` (depends on account + beta objects; idempotent file) (F5). `scripts/setup-readiness.ts` consumes the list automatically; `scripts/verify-readiness.ts` object check gains the agents table/function.

Keep consistent: `server/beta.ts` (not edited; wraps `createApi`, so hosted chat gets the same runner signature), `mobile/src/api.ts` (reads `value.error` and shows it — no change), `src/ai-client.ts` 185 s client timeout stays > 180 s server cap (not edited), `tests/ai-fixtures.ts` runner mocks (fewer params remain compatible).

Test: `server/chat-boundaries.test.ts` (C3 reply/warnings, C4 status preservation + redaction, C5 budget split + stage error), `server/ai.test.ts` (publicError copy, local 501), `server/readiness-migrations.test.ts` (every migration file is applied by some script, ordering, envelope), `src/features/cloud/account-client.test.ts` (deletion transport maps 404/501 to hosted-only copy).
Open: none that changes the solution. Decision taken: F4 returns 501 rather than implementing deletion locally — the local `Config` has no admin secret and a later agent consolidates hosted/local routing.

## Reproduction (red first)

Command: `npx vitest run server/chat-boundaries.test.ts server/ai.test.ts server/readiness-migrations.test.ts src/features/cloud/account-client.test.ts` before any source edit → 16 failed / 50 passed. Failure reasons, each matching its audit row:

- C3 "does not describe a review card": reply was "Here’s my estimate for Eggs: 140 kcal… Review the portions and details on the card before adding it." with `meal: null`. "drops receipt-candidate warnings": warning "Some product matches need a check…" survived with `receipt: null`.
- C4 "preserves a provider 401/403/429": thrown error had `status: undefined` (class lost); "reports a missing provider key": got `AI_BOUNDARY_UNAVAILABLE` instead of `AI_NOT_CONFIGURED`.
- C5 "gives later stages only the time that remains": client timeouts were `[20000, 150000, 20000]` (fixed ceilings, no shared deadline); "names the output review": no error at all (the pipeline would have started the output review with 3 s left); "names the stage when a review itself runs out of time": a `TimeoutError` inside a review became `AI_BOUNDARY_UNAVAILABLE`.
- F4 server: `POST /api/account/delete` on `createApi` → 404 "Not found."; F4 client: `browserAccountDeletion` surfaced "Not found." for 404 and 501.
- F5: `readinessMigrations` lacked `20260929_agents.sql`; additionally `migrationBody` rejects that file today (`MIGRATION_ENVELOPE`) because two `--` header comment lines precede `begin;`.

One of my own assertions was wrong twice (expected a `create` statement in every body; expected no leading comment inside the body) — `20260929_snapshot_conflicts.sql` is a corrective `do $$` block and other bodies start with a comment after `begin;`. Relaxed to "body does not start with begin; and is non-trivial". No source change was made for those two.

## Change and mechanism

- `server/chat-boundaries.ts:65-115` `withoutRecordProposals` — when any proposal is actually removed, sentences that point at a card (`\bcard\b`, "before adding/saving it") are cut at sentence/line boundaries, warnings about USDA candidates / product matches / "captured details" are dropped, and "Nothing was saved or proposed from this message." is appended. An ordinary conversational reply with nothing to remove is untouched (existing test "supports an ordinary health question" still asserts `reply === draft.reply`).
- `server/chat-boundaries.ts:117-133,194` `boundaryFailure` — the review's catch now classifies: `AI_NOT_CONFIGURED` passes through; a numeric provider `status` of 401/403/429 is copied onto a fresh `Error("AI_BOUNDARY_UNAVAILABLE")` (message text is never copied, so the `publicError` status branches fire and no provider text leaks); a `TimeoutError` becomes `AI_BOUNDARY_TIMEOUT_INPUT|OUTPUT`; everything else stays `AI_BOUNDARY_UNAVAILABLE`.
- `server/ai.ts:375-384` `CHAT_DEADLINE_MS = 180000` and `STAGE_BUDGET_MS`; `runAI` takes an optional epoch `deadline` (default now + 180 s) and gives every stage `min(ceiling, remaining)`. Generation reserves the 20 s output review (`remaining − review`), JEV and USDA are bounded to `remaining − 5 s`, and the output review fails fast with `AI_BOUNDARY_TIMEOUT_OUTPUT` when fewer than 5 s remain instead of starting a doomed call. `checkIntent` gained a `timeout` parameter.
- `server/http.ts:7,43-49,153-155,234-235,254` — one `CHAT_DEADLINE_MS` drives both the abort timer and the deadline passed to the runner (cap unchanged at 180 s; `src/ai-client.ts` 185 s untouched); public copy for the two stage-named codes; `/api/account/delete` answers 501 with hosted-only copy before the generic 404.
- `src/features/cloud/useAccountSecurity.ts:94-124` — 404 or 501 from the deletion route throws `HOSTED_ACCOUNT_MANAGEMENT` ("…Use your hosted account connection to manage your account."), the sentence native already uses in `mobile/src/api.ts:163`. `AccountSecurity.tsx` already renders `actions.error` in a `role="alert"`, so no UI edit was needed.
- `server/readiness-migrations.ts:3-21` — `20260929_agents.sql` appended (position 5; the runner's positional guard for the first three and the applied hashes of the first four are untouched); `migrationBody` skips leading `--` comment lines before checking the `begin;…commit;` envelope while hashing the whole file. The agents file is idempotent (`if not exists` / `create or replace`), so re-applying through the ledger on the hosted project that received it by hand on 2026-09-30 is safe and records its hash.
- `scripts/verify-readiness.ts:62-66` (outside my listed scope; smallest edit) — the presence check now also requires `health_agent_admit(uuid)`. `scripts/setup-supabase.ts` and `scripts/verify-supabase.ts` were deliberately left alone: the agents SQL calls `health_account_active` and `health_beta_members`, so it belongs after the account migration in the readiness ledger, not in the base fuel/beta bootstrap.

## Consumers checked

- `server/beta.ts` (not edited): wraps `createApi`, so hosted chat gets the same deadline; `/api/account/delete` is still intercepted there before reaching the local 501.
- `mobile/src/api.ts` `accountRequest`: reads `value.error` on non-OK, so a hosted 501 would show the server copy; the native hosted-only guard is unchanged.
- `tests/ai-fixtures.ts` / `server/ai.test.ts` runner mocks: `runner` gained an optional fifth argument; mocks with fewer parameters still type-check.
- `scripts/setup-readiness.ts`: consumes `readinessMigrations` by iteration; verified the `index < 3` guard is positional and the appended entry does not shift it.
- `tests/account-security.spec.ts` (web): mocks 401 and 200 — paths I did not change; passed on desktop + mobile.

## Commands run

| Command | Result |
| --- | --- |
| `npx vitest run server/chat-boundaries.test.ts server/ai.test.ts server/readiness-migrations.test.ts src/features/cloud/account-client.test.ts` (before fix) | 16 failed / 50 passed (red for the stated reasons) |
| same (after fix) | 4 files, 66 passed |
| `npx tsc --noEmit` (after my edits, before another agent's Q1 test landed) | passed |
| `npx tsc --noEmit` (final) | 26 errors, all in untracked `src/platform/browser-records.test.ts` (another agent's Q1 work; none in my files) |
| `npx vitest run src server` | 69 files passed, 2 failed: `src/domain.test.ts`, `src/platform/browser-records.test.ts` (10 tests, Q1 snapshot/corrupt-blob work, no import of my modules) |
| `npx vitest run scripts/agents` | 1 file, 8 passed |
| `npx playwright test tests/account-security.spec.ts --workers 2` | 2 passed (desktop, mobile) |

## Not checked

- No live provider call: 401/429 classification is proven with an error object carrying `status`, the same shape the OpenAI SDK `APIError` subclasses expose. No live Qwen/OpenAI run.
- Nothing was run against a database. `setup-readiness.ts --apply` re-applying the agents file on the hosted project is reasoned from idempotent SQL, not executed.
- The web 404/501 deletion copy is covered by unit tests only; no browser spec drives that path (tests/ is outside my scope).
- `mobile/e2e` not run (Metro).

## Ledger-ready paragraph

CHAT-PIPELINE-002 — Stripped proposals, masked provider errors and overlapping stage budgets (2026-10-10, audit C3/C4/C5/F4/F5). `withoutRecordProposals` nulled meal/receipt but left "Review the portions on the card" and USDA/product-match warnings in place; it now removes card sentences and record-only warnings and appends "Nothing was saved or proposed from this message." `reviewChatBoundary` folded every failure into `AI_BOUNDARY_UNAVAILABLE`, making the 401/403/429 branches of `publicError` unreachable for chat; it now preserves numeric provider status (never the text), passes `AI_NOT_CONFIGURED` through, and names a timed-out review `AI_BOUNDARY_TIMEOUT_INPUT|OUTPUT`. Stage ceilings (20+150+12+20 s) exceeded the 180 s abort; `runAI` now takes the HTTP layer's deadline, each stage gets `min(ceiling, remaining)`, generation reserves the output review, and the output review fails by name when under 5 s remain. The local server answered `/api/account/delete` with 404; it returns 501 with hosted-only copy and the web client maps 404/501 to the native wording. `20260929_agents.sql` was applied by no script and would have failed the envelope check because of header comments; it is now the fifth readiness migration and `migrationBody` tolerates leading `--` lines. Follow-ups for doc owners: `docs/context/operations.md:61` says "all three readiness migrations" (now five); `docs/context/chat-boundaries.md` can now truthfully say the reviews share the request deadline.
