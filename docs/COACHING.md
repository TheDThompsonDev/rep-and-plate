# Daily coaching across MCP, web and native

This release implements one complete daily loop: read today's agreed plan,
propose a change, review and approve it, record what actually happened, then
resume the same plan in a fresh conversation. It does not require an AI provider
call to persist a plan, approve a change, or record feedback.

## Where to find it

- Web: **Chat → Coaching plan**, or **You → Your coaching plan**.
- Native: **Chat → Coaching plan**, or **You → Your coaching plan**.
- External assistant: the `get_coaching_day`, `propose_coaching_change`,
  `resolve_coaching_change`, `undo_coaching_change` and `import_records` MCP
  tools, plus ready-made prompts for the daily and weekly habit.

Start by confirming a primary goal, ordered priorities and practical constraints.
Add dated running, strength, recovery or other sessions. Every modification is
staged as a proposal with a current/proposed comparison. Approval changes the
agreed plan; dismissal leaves it unchanged.

Feedback records completed or explicitly skipped sessions, actual minutes,
optional effort and a note. Missing feedback is unknown. Planned minutes never
become actual minutes automatically. A reviewed correction updates the same
outcome instead of duplicating the session. Food intake and the existing workout
ledger remain separate from coaching outcomes.

Memories are details the user explicitly chooses to retain. Removing a memory
removes it from active planning context. Historical values remain in the account
audit record for review and undo; this is not an erasure request. Account deletion
uses the existing account-deletion flow.

## One home for your other apps

Someone who runs with Coros or Strava, lifts with Buff and tracks macros in
MacroFactor can ask an assistant that reaches those apps to bring the records
into Rep & Plate. `import_records` saves:

- **Activities:** source, the source's own identifier, day, optional start
  time, sport, title, minutes, and whatever the source reported of distance,
  elevation gain, average pace, average/maximum heart rate, effort and lifted
  sets (with an explicit kg or lb unit).
- **Nutrition days:** source, day, and whichever of calories, protein, carbs,
  fat and fibre the source reported, with an optional "whole day logged" flag.

These are records with a named source. They are kept apart from the agreed
plan, from reported session outcomes and from the Rep & Plate food diary. An
import never changes the plan revision, never stales a pending proposal, never
marks a session done and never logs food. Saving the same source record again
updates it instead of duplicating it, so a repeated sync is safe. The assistant
must show a summary and send `confirmation: SAVE_REPORTED_RECORDS` after the
user agrees; `remove` takes a record back. Unknown fields are left out, never
estimated. A record cannot be dated more than one day ahead.

Rep & Plate does not call Strava, Coros, Buff or MacroFactor itself. The
assistant relays what its own connections to those apps return, so the result
is only as complete as the assistant's access. Energy burned and body weight
are not stored.

The newest 400 activities and 180 nutrition days are retained. When a save
would exceed that, the oldest records are released and the result reports how
many (`droppedOldest`). The web panel lists them under **From your other apps**
with a remove control; the native **Week** view shows the current window.

## Next steps, prompts and Spot's voice

Every coaching result starts with `nextSteps`: up to four facts worth raising
now, in priority order. A change waiting for a decision comes first, then a
missing goal, a recent session with no reported outcome, today's session or an
empty week ahead, and finally an app whose records stop more than two days ago.
When an imported activity falls on the day of an unreported planned session,
the step says so and tells the assistant to ask whether it was that session. It
is a question, never an outcome.

Hosts that list MCP prompts offer these as one-tap commands:

| Prompt | Purpose | Needs |
| --- | --- | --- |
| `morning_check_in` | Today's session, anything unreported, one next step | coaching read |
| `weekly_review` | Planned versus reported versus other apps, one adjustment | coaching read |
| `log_what_i_did` | Attach a run or lift to the plan through a reviewed outcome | coaching write |
| `sync_my_apps` | Read recent records from reachable apps, confirm, import | coaching write |
| `plan_my_week` | Draft seven days as one reviewed proposal | coaching write |

A prompt only starts the conversation. It never grants approval; every change
still needs the user's explicit yes.

The server instructions carry Spot's voice (`spotCoachVoice` in
`src/features/spot/personality.ts`): useful answer first, at most one deadpan
aside when the moment is light, no guilt or streak talk, no jokes about bodies,
food or missed days, and none at all during errors or sensitive conversations.
It is offered as the product's voice; the user's preferred tone wins, and a
host may ignore server instructions altogether.

Nothing here reaches out to the user. Reminders and scheduled check-ins depend
on the assistant host; push notifications are not part of this slice.

## Connect an external coach

1. Open **You → Connections / Agent connections** and create a separately named
   connection. **Use daily coaching permissions** selects the relevant readable
   health context and explicit coaching read/write permissions. Review the choices.
   Existing tokens do not gain these permissions automatically.
2. Configure a reachable, deployed HTTPS address:
   `https://YOUR_APP_ORIGIN/api/agents/mcp`.
3. In a host supporting fixed request headers, set `Authorization` to
   `Bearer YOUR_CONNECTION_TOKEN` using that host's secure connector settings.
   Never paste the credential into conversation text. OAuth authorization-server
   discovery and directory distribution are not implemented by this release.
4. Enable the connector in the conversation and ask, for example:
   “Read my Rep & Plate coaching day. Explain the agreed plan and anything
   missing before suggesting changes.”

The existing stdio adapter (`npm --silent run agents:mcp`) exposes the same tools.
It uses `REP_PLATE_URL` and `REP_PLATE_TOKEN` as documented in
[Agent connections](AGENT_CONNECTIONS.md). A cloud-hosted assistant cannot reach
a localhost URL; use a deployed endpoint for that host.

The remote endpoint is stateless MCP HTTP. Authentication, active-account checks
and the independent agent allowance apply on every HTTP request. A revoked or
expired credential cannot keep using an earlier initialization. No long-lived
MCP session or scheduled conversation is assumed.

## A useful daily interaction

1. **Read:** the coach retrieves today's date, agreed priorities, active memories,
   today/upcoming sessions, reported outcomes, pending proposals, recent decision
   summaries, permitted health evidence, missing context and freshness metadata.
2. **Decide:** the user can ask to shorten or move a session, change a week, report
   an outcome, or retain a planning preference.
3. **Review:** the coach creates one proposal using the current plan revision and
   a stable UUID request ID. It shows the affected current/proposed details.
4. **Confirm:** explicit user approval permits `resolve_coaching_change` with
   `status: accepted` and `confirmation: APPLY_REVIEWED_CHANGE`. Merely asking for
   a proposal never grants that confirmation. The assistant host controls its
   own tool approvals; a server cannot verify a human thought beyond its granted
   write scope and the explicit confirmation contract.
5. **Continue:** an application refresh or a new MCP conversation retrieves the
   same server record, including the accepted reason and outcome.

Supporting MCP Apps hosts can render a compact branded day/review/feedback view
inside the conversation. Other hosts receive complete text and structured
results with the same reviewed tools. The component uses only negotiated host
tool access, renders data as text, declares restrictive CSP and cleans up pending
requests on teardown. Actual rendering must be exercised in each supported host;
a simulated host is not proof of every Claude/Codex version's behavior.

Daily MCP results omit durable replay receipts, archived before/after snapshots,
old terminal command bodies and historical reasons that could restate removed
memories. Current active facts, a small set of relevant sessions/outcomes and
changed-field proposal previews supply the working context. The full audit
record remains available to the authenticated app.

## Persistence and conflicts

Coaching state lives in the account's `health_agent_documents.document.coaching`,
or the local agent SQLite document in development. It is not copied into device
health snapshots. Existing snapshot publication cannot overwrite coaching.
The existing agent JSON document schema accepts the additive field; no new SQL
migration is required for coaching itself.

All writes use the existing compare-and-set store. Accepted changes advance the
plan revision. Two conversations cannot silently apply changes based on the
same older revision. A stale proposal must be dismissed and prepared again from
the current plan. Retries preserve request identity; an unknown response is not
an instruction to create a second change.

Only the latest agreed change can be undone, with an exact revision guard. Undo
is recorded and idempotent. Pending proposals survive recent-history compaction.
Recent audit/proposal views are bounded and compact replay receipts prevent old
requests being applied again. Current limits are 90 sessions, 180 outcomes,
60 active memories, 400 imported activities, 180 imported nutrition days, 40 pending/recent proposals, 20 recent audit snapshots and
2,000 compact receipts, subject to the existing account document byte limit.
The service returns an explicit capacity error instead of discarding current
history. Long-term archival beyond those bounds is a separate extension.

Health evidence has separate freshness from the agreed coaching plan. The local
app publishes its currently loaded permitted evidence; hosted readers use the
latest synchronized account snapshot. An unavailable source is absent/stale,
not replaced with zero totals or older browser data. Activity context contains
recorded dates, titles, durations and notes; it does not invent distance, pace,
heart rate, readiness or calorie-burn allowances.

## Delivery and verification

This source change is not a production deployment. Web/native builds must be
shipped before users can access it. Native coaching uses the existing hosted
account connection; the local mobile pairing bridge is not an agent-management
backend.

The implemented scope is persistent, reviewed coaching and its three entry
surfaces. Direct COROS/Strava/MacroFactor/Buff API ingestion (records arrive only when an
assistant relays them through `import_records`), wearable plan
delivery, push reminders, autonomous scheduled coaching, automatic target
adjustment, race forecasting and medical readiness scoring are not part of this
slice. The existing built-in Spot capture flow remains separate from the new
MCP coaching tools; the plan is visible and editable in the app's coaching panel.

Verification covers domain invariants, account isolation, authorization, service
persistence, HTTP limits, actual SDK client/server exchanges over remote MCP,
stdio regressions, host UI negotiation/approval/teardown, browser daily journeys
and web/native type/lint checks. Browser account operations use the real service
against an isolated in-memory store. They do not establish production Supabase,
live assistant behavior or physical-device behavior.

Local verification on 2026-11-08: 679 domain/server/native unit cases and 16
CLI/MCP integration cases pass. The 46 selected desktop/mobile-browser cases
cover the eight new coaching cases plus account sync, onboarding, capture,
familiar meals and weekly review. A fixture hydration race was fixed before the
two familiar-meal cases were rerun successfully. Web/native TypeScript and lint
checks pass; lint retains pre-existing warnings. Web production and hosted API
bundles build successfully. CLI subprocess tests used a 20-second test budget
on Windows; normal API request limits were not changed.

For the first design-partner pilot, measure useful answer time, repeated
explanation, failed/duplicated writes, accepted plan changes, corrections and
voluntary return the following week. A successful tool call alone is not proof
that the coaching experience was valuable.
