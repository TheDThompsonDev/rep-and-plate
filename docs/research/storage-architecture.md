# Private accounts and storage proposal — ticket 22

Checked 2026-09-25. **Proposed architecture; no hosted account, service, or public deployment has been created.** Local app behavior and server-only credentials remain in place while core food workflows are implemented.

## Recommendation

Keep the reusable USDA catalog in server-side SQLite for local development. Move the shared catalog tables to managed PostgreSQL for the hosted service; do not serve a SQLite file from ephemeral serverless storage. Use **Supabase Auth + PostgreSQL + private object storage** for a first shared beta, with Rep & Plate's Node API mediating AI/product operations. A same-origin HTTPS Node service and static frontend is the proposed deployment shape; choose its hosting account and region with the owner before provisioning.

Supabase supports authorization through [Postgres row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [storage access policies](https://supabase.com/docs/guides/storage/security/access-control). Enable RLS and least-privilege grants on every user-data table; define owner checks for reads and writes. Service-role credentials bypass RLS and remain server-only. Private media requires storage policies too; database ownership checks alone are insufficient.

The [published Pro starting price](https://supabase.com/pricing) is $25/month on the check date, with usage allowances and overages. Budget additionally for Node hosting, email delivery, AI calls/search, catalog storage, backups, and egress. This is a starting platform cost, not an all-inclusive Rep & Plate estimate. Recheck pricing before purchase; no paid service is being provisioned by this proposal.

## Proposed data separation

| Domain | Ownership and retention |
| --- | --- |
| USDA products, versions, release/import manifests | Shared permitted catalog; no user photos, pantry quantities, preferences, or corrections |
| Meals/components, purchases/lots, pantry events, plans, workouts, preferences | Required owner UUID and immutable record ID; versioned updates and reversible events |
| User-confirmed label corrections | Private owner + barcode + version; never silently publish into USDA/shared catalog |
| Capture media | Private object path keyed by owner/capture UUID; short-lived access URLs; explicit retained/deleted state |
| Provider tokens | Server-side encrypted secret store; no localStorage or user-readable database rows |
| AI jobs/action ledger | Owner + stable action UUID unique; states queued/running/proposed/confirmed/failed; no raw keys in logs |

Create unique constraints for owner + action ID, source transaction/line IDs when available, and pantry event identities. A catalog update must not alter historical meal snapshots. A meal edit replaces or reverses its linked pantry events in the same database transaction. Optimistic record versions reject stale concurrent writes and return a reviewable conflict rather than silently overwriting another device.

## Implementation sequence and acceptance

1. **22A local migration fixture and repository boundary.** Preserve current local data verbatim in an export before import. Build a typed repository interface for meals, lots/events, preferences, plans, and media references; migrate old missing quantities to unknown. Acceptance: old fixtures retain meals/edits; dry-run import reports counts without writing.
2. **22B hosted schema and authentication.** Once the owner supplies project/region/hosting configuration, add migration SQL, owner RLS, authenticated API middleware, private buckets and per-user budgets. The browser must not choose an arbitrary owner or access service-role tokens. Acceptance: two test users cannot read, update, delete, subscribe to, or download one another's rows/media; signed-out requests fail.
3. **22C explicit local import and sync.** Present a migration preview, create recoverable backup, map IDs deterministically, and commit records plus import ledger transactionally. Resume after network interruption without duplicates. Maintain pending local edits until acknowledged; represent deletion with tombstones during synchronization. Acceptance: two-device conflicting edits are surfaced; logout clears private cached session data; import repeat changes nothing.
4. **22D lifecycle.** Export all owned records and media references; delete owned rows, objects, tokens, and job caches. Explain any backup expiry window separately from immediate active-system deletion. Test revocation/reconnect and backup restoration. The shared USDA catalog remains independent of an account deletion.

Ticket 22 is not accepted until these tests run against an authenticated environment. The current loopback prototype is not evidence of multi-user isolation. This proposal resolves the architecture direction sufficiently to implement locally testable contracts while leaving account, region, budget, and deployment decisions explicit.
