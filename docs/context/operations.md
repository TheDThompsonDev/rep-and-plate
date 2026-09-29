# Production operations

Implemented September 29, 2026. Apply `supabase/migrations/20260929_operations.sql` before enabling the new release. This is technical operations guidance, not a legal privacy policy.

Use `npx tsx scripts/setup-readiness.ts` to review the exact account/operations/sync migration hashes, then `npx tsx scripts/setup-readiness.ts --apply` to apply pending migrations in one transaction. The setup checks database/project identity, serializes migration runs and writes a server-only hash ledger. Identical reruns are skipped. Changed hashes or pre-existing untracked readiness objects stop the run for review rather than silently adopting or partially modifying them. No raw database errors or connection secrets are printed. Run the transactional readiness verifier after setup; keep migration files unchanged once applied and use a new version for future changes.

`20260929_snapshot_conflicts.sql` is an additive correction registered after those initial migrations. Stale snapshot create/update/delete attempts now raise `PT409`, which returns an HTTP409 business conflict, rather than `40001`, which PostgREST14 can repeatedly retry. The migration checks for exactly one known conflict raise per existing function and replaces only that statement, preserving validations, ownership rules, function attributes and permissions. The readiness verifier checks stale operations leave the latest records/revision intact. This follows [Supabase's documented PostgREST retry issue](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b). Already-running retry loops may need separate, precisely identified backend cleanup; the migration does not terminate sessions or restart the database.

The correction was applied through the guarded runner on September 29 (SHA256 `ba7dd1be6741a87370381e981bf33b463a3d07771c526341d21ae76a7ae24aa1`). The expanded readiness verifier passed all 29 hosted-database checks, and `scripts/verify-supabase.ts` passed its 19 snapshot ownership, validation, stale-write and anonymous-access checks using PT409. All fixtures rolled back. HTTP-level conflict response timing must be checked through the deployed app/REST API separately; a direct database verifier does not establish HTTP behavior.

## Monitoring and cost

Authenticated hosted AI routes run inside `withGenerationTelemetry`. Each actual Qwen/OpenAI generation, Jev intent check and OpenAI voice transcription attempt writes a row to the server-only `health_generation_events` table, with account/request UUIDs, operation, model/provider, primary/backup, duration, outcome, bounded error category and token usage when returned. Voice usage may include input audio tokens or duration. A cached replay creates no new AI-call event. Concurrent requests use separate async contexts. Neither prompts, replies, transcripts, audio, images, file paths nor raw exception messages are recorded here. Schema/transport failures and Jev responses sometimes have no available usage; null means unknown, not zero.

Writes occur in the request lifecycle with a one-second database timeout and 1.2-second outer bound, after provider work. A telemetry failure never changes the user result; it emits only `generation_telemetry_unavailable`. This is best-effort operational telemetry, not a provider invoice. A process killed before flushing can lose its events. Calls lacking full provider usage remain visibly unpriced; search-tool fees, hosting and storage are not included in token costs. Provider billing remains the authoritative total.

`AI_TOKEN_RATES_JSON` optionally maps exact `provider:model` keys to `input`, `cachedInput`, `output` USD per million tokens, plus `inputAudio` for the transcription model. Voice text and audio input are priced separately; its token cost remains unknown unless the audio rate and full token breakdown are supplied. Duration-only responses remain visible but unpriced. Set rates only after checking the account's actual current regional/provider price. No price is hard-coded. Missing/invalid rates or incomplete token accounting produce null `token_cost_usd`. Rates are applied when an event is written; changing rates does not reprice historical rows. Example SHAPE only (replace placeholders with verified numbers):

```text
{"qwen:qwen3.5-flash":{"input":INPUT_RATE,"cachedInput":CACHE_RATE,"output":OUTPUT_RATE}}
```

For a read-only aggregate report without exposing account identifiers, run `npx tsx scripts/operations-report.ts --days 7` (one through 90 days; default seven). It returns provider/model outcomes and rates, p50/p95 latency, token/audio usage, priced USD, unpriced-attempt counts, distinct active AI users and known token cost per active user. Any unpriced attempts make that per-user cost incomplete. Provider-attempt failure is distinct from a failed user request because a backup may recover. The command uses a read-only transaction and the same strict database/project identity check as setup.

Server-admin dashboard queries for deeper investigation:

```sql
select date_trunc('day',created_at) as day,provider,model,
  count(*) as attempts,
  count(*) filter(where fallback) as fallback_attempts,
  count(*) filter(where outcome <> 'success') as failed_attempts,
  percentile_cont(0.95) within group(order by duration_ms) as p95_ms,
  sum(input_tokens) as input_tokens,sum(output_tokens) as output_tokens,
  sum(token_cost_usd) as known_token_cost_usd,
  count(*) filter(where token_cost_usd is null) as unpriced_attempts
from public.health_generation_events
where created_at > now()-interval '7 days'
group by 1,2,3 order by 1 desc;

-- Cost per active generation user. Inspect unpriced_attempts before interpreting.
select user_id,count(distinct request_id) as requests,
  sum(token_cost_usd) as known_token_cost_usd,
  count(*) filter(where token_cost_usd is null) as unpriced_attempts
from public.health_generation_events
where created_at > now()-interval '30 days'
group by user_id;
```

The existing atomic user/global request caps remain in force. Request caps are not monetary caps. Set provider-side spending limits and alerts in each paid provider account before expanding traffic. No automatic alert destination or spend limit is invented by this change. Monitor Vercel errors, `generation_telemetry_unavailable`, `maintenance_failed`, daily cleanup presence, failed-attempt rate and p95 latency. Establish alert thresholds from real beta traffic, and use synthetic fixtures without health content for outage probes.

## Scheduled cleanup

`vercel.json` calls `GET /api/maintenance` at 08:00 UTC daily. Set a random `CRON_SECRET` of at least 32 characters in the production server environment; Vercel supplies it as the bearer token. This endpoint is before the browser preview gate but authenticates the cron secret independently. A normal user token or absent/short secret gets 401, without any maintenance mutation. Do not expose the secret in a browser variable, query string or logs.

The service-role-only candidate RPC selects UUID-owned files in **health-captures** older than 24 hours. The server rechecks name and age and deletes through the Storage API (never deleting storage metadata directly), at most five batches of 500. Fresh captures and **health-record-media** persistent attachments are excluded. Repeated runs are safe; failed removal remains eligible next run. `moreCaptures:true` means backlog may remain and requires another authorized invocation or cadence adjustment. Removal from failed/interrupted uploads can therefore take 24–48 hours or longer after a failed/backlogged run.

`health_prune_operations` deletes expired replay records, leases older than five minutes, quota rows older than two UTC days and generation events older than 90 days. Counts only are logged in `maintenance_complete`. RLS plus revoked anon/authenticated permissions prevents client reads/writes or cleanup invocation. Account deletion cascades generation metadata through its auth-user foreign key. The cleanup is temporary-upload retention, not deletion of users' saved health records or persistent synced photos.

Before declaring production readiness: verify migration grants using anonymous/authenticated roles; verify cron returns401 without its secret and200 with it; check only an old synthetic capture is removed; check a fresh synthetic capture and persistent media remain; inspect a synthetic generation's metadata row; ensure the daily run appears in logs. Deployment and database verification are separate from unit tests.

`npx tsx scripts/verify-readiness.ts` loads existing server environment configuration and verifies the configured database belongs to the same Supabase project. It creates synthetic account/media metadata within one transaction, checks owner-only media access, immutable media, anonymous/authenticated denials, temporary capture candidate selection, deletion-marker write rejection and account-to-telemetry cascade, then intentionally rolls back every fixture. It does not upload real files, send emails, invoke global cleanup or mutate real users. Errors print only sanitized verification labels. Run after applying all three readiness migrations. Actual Storage API removal and scheduled invocation still need the isolated live smoke checks above.

September 29 verification: all 22 database checks passed against the configured hosted project after migration application, including the 500 MB media-account limit. All synthetic fixture rows were rolled back; no real files, emails or customer mutations. Supabase may deny prohibited Storage mutations with SQLSTATE42501 instead of returning zero rows; the verifier accepts either secure result within a savepoint. This does not substitute for physical-device testing or a real receipt-quality corpus.

## Support and data handling

Set server `SUPPORT_URL` to the real HTTPS support form/helpdesk. Public configuration may expose only a validated HTTPS URL without embedded credentials. The web and mobile Help & your data components show an honest invitation-contact fallback when unset. Diagnostics are explicit download/share actions, containing app/version/platform/time and at most five validated request UUIDs. No email, message text, health record, photo, bearer token or raw error is included. The user chooses whether and where to send that file.

The data-handling screen names processing providers and distinguishes device records, account records, temporary captures and metadata retention. It does not claim regulatory certification or replace an operator-approved legal policy. Actual email delivery, support staffing, provider spend alerts and real-device testing still require operational verification.
