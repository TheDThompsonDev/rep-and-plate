# MCP readiness review — 2026-11-14

Scope: everything merged for the MCP coach from `08abede` (Nov 10) to `f30c9ec` (Nov 12, PRs #2–#18), judged against the north star: an assistant-only user (runs on Coros/Strava, lifts on Buff, macros in MacroFactor) gets a complete loop without opening the app, has a reason to come back, and hears Spot.

## Verdict

Good position. The core loop, the review/approval contract, imports and the card are sound and verified. The one data-honesty bug (item 1) is fixed on branch `fix/snapshot-days-unknown-not-zero` (not yet deployed); making setup easier is next. Neither blocks a small pilot with technical users.

## What was checked

| Check | Result |
| --- | --- |
| `npm test` (src, server, scripts/agents) | 772 passed (748 + 24), 0 failed |
| `tsc --noEmit`, `npm run agents:check` | Both pass |
| `eslint` on server/agents, scripts/agents, coaching, spot | 0 errors, 1 warning (`_hash` unused, service.ts:43) |
| `playwright test tests/mcp-cards.spec.ts tests/coaching.spec.ts` | 32 passed |
| Live connector: `capabilities`, `get_coaching_day` (read-only) | Both answered from production; card mode, `nextSteps`, corrected freshness wording, all 9 operations granted |
| Restored card HTML (`tests/fixtures/mcp/coaching-b34d29c.html`) | Keeps the UX audit fixes: summary first, review before "More of your plan", correct freshness copy, host theme applied |

These ran on the working tree of `security/beta-storage-and-deps`, which also holds uncommitted dependency bumps (MCP SDK 2.2 → 2.4, vitest 5.1, happy-dom 21) and the beta write-gate migration. Results therefore also cover those bumps.

## What is solid

- One tool registry serves stdio and stateless HTTP (`server/agents/mcp-server.ts`), with auth, account-active check and quota (5,000/day, 120/min) on every request.
- Writes are proposals until an explicit literal confirmation (`APPLY_REVIEWED_CHANGE`, `SAVE_REPORTED_RECORDS`); compare-and-set revisions stop two conversations clobbering each other; undo is guarded.
- `import_records` keeps other-app records apart from the plan, outcomes and food diary, dedupes on `source + externalId`, and reports `droppedOldest`.
- `nextSteps` gives a reason to check in (pending decision, missing goal, unreported session matched to an imported activity, stale source apps, key expiring).
- Five prompts (`morning_check_in`, `weekly_review`, `log_what_i_did`, `sync_my_apps`, `plan_my_week`) give one-tap habits.

## Improvements, in priority order

1. **High — stale snapshot reported as zero days. Fixed on branch `fix/snapshot-days-unknown-not-zero`, same day.** `server/agents/hosted.ts` rebuilt the 7-day context window around *today* from the last saved app snapshot. `buildAgentContext` (`src/features/connections/context.ts`) then emitted `meals: 0` and zero totals for every day after that snapshot. Live: snapshot saved 2026-11-11, yet 11-12, 11-13 and 11-14 came back as `meals: 0, calories: 0`.
   - The fix: the new `snapshotContext` helper in `hosted.ts` passes the snapshot's local save day as `recordedThrough`. `buildAgentContext` leaves out later days and adds `nutrition.recordedThrough` (optional in `agentContextSchema`).
   - `contextNotes` in `mcp-server.ts` now tells the assistant those days are unknown, not zero. Spot's "zero meals logged" line no longer fires when no day is recorded.
   - The card HTML and the browser publish path are unchanged.
   - Tests: `context.test.ts`, `hosted.test.ts` (including the live Nov 11 → Nov 14 case and the timezone boundary) and `spot-in-results.test.ts`.
   - Not yet deployed.
2. **High for stickiness — setup still needs a key and an `x-api-key` header.** `docs/CONNECT_BUTTON_PLAN.md` (OAuth via Supabase Auth) is plan-only. This is the main barrier for a non-technical assistant-only user.
3. **Medium — presentation guidance is spread over five places and disagrees.** `spotToolNote` (633 chars × 8 tool descriptions ≈ 5 KB), `spotCoachVoice` (1,138, server instructions), `spotNote.voice` (592, every result), `cardReplyInstruction` (911, every result), plus prompt text. `spotNote.voice` says to work Spot's line into a text reply; card mode says never repeat it, and the live structured result still carries `spot.says` to the model. Two different exports are named `spotVoice` (`assistant.ts`, `personality.ts`). Consolidate into one source without changing the card or Spot's lines.
4. **Low — the requested no-goal podcast line states facts.** "you haven't logged any meals, any workouts" fires on *no goal and no sessions*, even when meals or imports exist. Your call whether to keep it as written.
5. **Process — card churn.** Nine card PRs on Nov 12 cycled redesign → restore. `docs/context/agent-connections.md` now stacks four "supersedes" paragraphs. Freeze the card, and fold the history into one current description.

## Not verified

Live rendering inside claude.ai, reply quality from real assistants, and any real assistant-only user. Production rendering of the card was not observed in this review.
