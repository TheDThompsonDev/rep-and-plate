# Agent connections — implementation record

November 12, 2026 update: the MCP coaching response now uses a small Spot illustration and a focused setup/day/review state, with wider reporting disclosed on demand. [Implementation and verification](../audits/2026-11-12-mcp-ux/implementation.md) records source boundaries, synthetic MCP/browser journeys, and pending user acceptance. No live-Claude or deployment proof is claimed. The preceding [UX investigation](../audits/2026-11-12-mcp-ux/README.md) retains original-renderer evidence and a corrected note about proposal resource metadata.

Follow-up: [UI delivery investigation](../audits/2026-11-12-mcp-ux/cache-delivery.md) confirms the original merge reached production and Claude discovered the new tool descriptions while displaying the old template. UI identities are now derived from static HTML, with the former unversioned paths retained as aliases. Existing host caches/rendered cards may still require a connector refresh and fresh conversation; no health data or credentials are reset.

Implemented 2026-09-29 in working files; awaiting user acceptance. Extends the earlier interoperability research with an executable provider-neutral boundary. Live deployment and vendor-specific connection proof are still pending.

## Flow and ownership

`src/features/connections/contracts.ts` defines bounded versioned operations and scopes. `context.ts` projects only approved fields and records reviewed meal application with a durable independent receipt. `useConnections.ts` shares inbox/publish logic across web and native. UI is available in You and the web `/#connections` review link.

`server/agents` contains the scoped service, strict HTTP boundary, local SQLite and hosted Supabase adapters. Opaque credentials are shown once, stored hashed, expire and can be revoked. Request identities are scoped by connection; conflicting reuse rejects, identical retry returns the original proposal. Agents never choose an owner or arbitrary database operation. Hosted agent admission uses independent limits and respects account deletion and beta membership.

The local projection is an explicitly published browser/profile snapshot, not authoritative multi-device state. Its update timestamp may be unknown. Hosted reads project the latest saved account snapshot on each read and report revision/update time; frontend publishing only supplies context/timezone metadata for those reads. No private chat, media, profile name or provider secrets are projected.

Web and native approvals persist the meal and receipt before server acknowledgment. An independent receipt prevents replay after undo. Concurrent state/account changes abort UI application; terminal server/local outcome mismatches stay visible. Shared account sync is a separate existing workflow; acceptance means logged on the reviewing device, not guaranteed synchronized everywhere. Native local pairing gateway remains unsupported for management; hosted native auth is used.

## Verification map

### Claude card delivery (2026-11-12)

The user confirmed the compact Spot card in Claude, then reported duplicated card/prose and reconnect friction. The current follow-up gives the card UI-only character copy and Claude a fresh response policy with saved facts. A stable cached bridge loads two public static renderer pages afresh; routine renderer upgrades reuse the connection. Private APIs, scopes and reviewed writes retain their boundaries. Once-only discovery of the shell and live Claude prose remain distinct from local same-connection browser proof. See [delivery design and checks](../audits/2026-11-12-mcp-ux/conversation-and-upgrades.md); earlier hash-per-template evidence is historical.

- `src/features/connections/context.test.ts`: privacy projection, real completed set loads, duplicate approval, undo/replay, dismissal, expiration and visible terminal conflicts.
- `server/agents/agents.test.ts`: real SQLite durability, hashed credentials, scopes, authorization, owner isolation, CAS races/revocation, replay conflict, expiration, HTTP rejection and separate quota wiring.
- `scripts/agents/client.test.ts`: actual CLI process and official MCP SDK client/server stdio exchange with an HTTP fixture.
- `tests/agent-connections.spec.ts`: desktop/mobile web creation, actual HTTP/SQLite + CLI context, proposal, log, reload, deep link, revocation, acknowledgment loss and device-storage failure. Test servers are isolated and contain synthetic records only.
- `mobile/e2e/agent-connections.spec.ts`: hosted native UI with mocked auth/management; saved meal/receipt before acknowledgment, retry, scopes, revocation and local bridge rejection.
- Ignored `.local-checks/pglite/verify-agents.mjs` executes actual migrations in local PostgreSQL WASM with Supabase platform scaffolding. Does not prove hosted Auth behavior or concurrent transaction scheduling.

CYC run startup hit the previously documented source-fingerprint bound (`CYC-ASSETS-001`); direct unit/build/browser/native checks are used without altering verification configuration. No controller-managed run completion is claimed.

## Review findings incorporated

Independent review found that a 15-second inbox poll would exhaust the shared 500/day app quota. Agent admission now has its own counters; foreground polling backs off when the panel closes. Review also found that a local accepted receipt can meet a terminal server dismissal/revocation; refresh now retains a reconciliation notice instead of claiming it can send an impossible acknowledgment.

Source files changed during an early browser run and Vite restarted, causing a connection reset. Test cleanup also originally closed its isolated server before an inbox refresh finished. Final verification waits for stable source and drains page routes before closing the fixture server.

## Verification results

- Full unit run: 350 tests passed across 56 files, including actual CLI and MCP exchanges.
- Web production build, agent typecheck and API bundle passed. The web bundle retains its existing size warning.
- Dedicated desktop/mobile web connection journeys: eight passed, including terminal outcome conflict visibility.
- Native typecheck/lint passed (existing lint warnings); Android/iOS/web export and three native browser checks passed. No physical-device or live hosted-agent proof is claimed.
- Local PostgreSQL verifier: 18 checks passed against the actual migrations, applied twice, covering permissions, ownership, revision checks, deletion and separate quota limits.
- The first broader browser run passed 225/236 checks while unrelated account-storage files were changing. Rechecking the updated files resolved the saving and help-copy failures. A remaining immediate-refresh test threw before its polling assertion could wait for persistence; allowing the transient null value fixed that test, with both desktop/mobile checks passing. Final full-run evidence is retained in `.local-checks/agent-final-validation.md`; the first run alone does not establish a clean full-app regression run.
- Retained failure analysis: `docs/context/error-ledger.md`, AGENT-CONNECTIONS-001. No deployment, live migration or vendor-specific pairing was performed.
