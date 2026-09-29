import "dotenv/config";
import postgres from "postgres";
import { matchingDatabaseUrl } from "../server/readiness-migrations.ts";

async function main() {
  const args = process.argv.slice(2);
  if (
    args.length &&
    (args.length !== 2 || args[0] !== "--days" || !/^\d{1,2}$/.test(args[1]))
  )
    throw Error("ARGUMENTS");
  const days = args.length ? Number(args[1]) : 7;
  if (!Number.isInteger(days) || days < 1 || days > 90)
    throw Error("ARGUMENTS");
  const sql = postgres(
    matchingDatabaseUrl(process.env.SUPABASE_DB_URL, process.env.SUPABASE_URL),
    {
      ssl: "require",
      max: 1,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 10,
      onnotice: () => {},
    },
  );
  try {
    const report = await sql.begin(async (tx) => {
      await tx`set transaction isolation level repeatable read, read only`;
      await tx`set local statement_timeout='15s'`;
      const [summary] = await tx`select count(*)::int as attempts,
        count(distinct user_id)::int as active_users,
        count(distinct (user_id,request_id))::int as requests,
        count(*) filter(where token_cost_usd is null)::int as unpriced_attempts,
        coalesce(sum(token_cost_usd),0)::float8 as known_token_cost_usd
        from public.health_generation_events where created_at>=now()-make_interval(days=>${days})`;
      const providers =
        await tx`select provider,model,count(*)::int as attempts,
        count(*) filter(where outcome='success')::int as success,
        count(*) filter(where outcome='error')::int as errors,
        count(*) filter(where outcome='timeout')::int as timeouts,
        count(*) filter(where outcome='cancelled')::int as cancelled,
        count(*) filter(where fallback)::int as fallback_attempts,
        percentile_cont(0.5) within group(order by duration_ms) as latency_p50_ms,
        percentile_cont(0.95) within group(order by duration_ms) as latency_p95_ms,
        sum(input_tokens)::float8 as input_tokens,sum(cached_input_tokens)::float8 as cached_input_tokens,
        sum(output_tokens)::float8 as output_tokens,sum(input_audio_tokens)::float8 as input_audio_tokens,
        sum(audio_seconds)::float8 as audio_seconds,
        coalesce(sum(token_cost_usd),0)::float8 as known_token_cost_usd,
        count(*) filter(where token_cost_usd is null)::int as unpriced_attempts,
        count(*) filter(where input_tokens is null or output_tokens is null)::int as incomplete_token_usage_attempts
        from public.health_generation_events where created_at>=now()-make_interval(days=>${days})
        group by provider,model order by provider,model`;
      return {
        days,
        generatedAt: new Date().toISOString(),
        summary: {
          ...summary,
          known_token_cost_usd_per_active_user: summary.active_users
            ? summary.known_token_cost_usd / summary.active_users
            : null,
          token_cost_complete:
            summary.attempts > 0 && summary.unpriced_attempts === 0,
        },
        providers: providers.map((row) => ({
          ...row,
          success_rate: row.success / row.attempts,
          failed_attempts: row.errors + row.timeouts,
          failed_rate: (row.errors + row.timeouts) / row.attempts,
          timeout_rate: row.timeouts / row.attempts,
          cancelled_rate: row.cancelled / row.attempts,
          fallback_rate: row.fallback_attempts / row.attempts,
        })),
        limitations: [
          "Rates describe provider attempts, not final user-request outcomes; a failed primary may be recovered by a successful backup.",
          "Known token costs exclude every unpriced attempt. Per-user cost is incomplete when unpriced_attempts is nonzero.",
          "Token cost is not a total invoice: search fees, hosting, storage and other provider fees are excluded. Telemetry delivery is best effort.",
          "Active users are distinct accounts with recorded AI attempts in this window, not all app users. No account identifiers or content are returned.",
        ],
      };
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end({ timeout: 3 });
  }
}
main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      ok: false,
      reason:
        error instanceof Error && error.message === "ARGUMENTS"
          ? "Use --days with an integer from 1 to 90, or omit it for seven days."
          : "Operations report unavailable. Check matching project credentials, migrations and database connectivity. No raw database errors are printed.",
    }),
  );
  process.exitCode = 1;
});
