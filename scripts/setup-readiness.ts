import "dotenv/config";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import {
  matchingDatabaseUrl,
  migrationBody,
  readinessMigrations,
} from "../server/readiness-migrations.ts";

async function main() {
  const unknown = process.argv.slice(2).filter((value) => value !== "--apply");
  if (unknown.length) throw Error("UNKNOWN_ARGUMENT");
  const apply = process.argv.includes("--apply");
  const migrations = await Promise.all(
    readinessMigrations.map(async (version) => ({
      version,
      ...migrationBody(
        await readFile(
          new URL(`../supabase/migrations/${version}`, import.meta.url),
          "utf8",
        ),
      ),
    })),
  );
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
    if (!apply) {
      const [ledger] =
        await sql`select to_regclass('public.health_schema_migrations') is not null as present`;
      const applied = ledger.present
        ? await sql`select version,sha256 from public.health_schema_migrations where version in ${sql([...readinessMigrations])}`
        : [];
      console.log(
        JSON.stringify(
          {
            mode: "review",
            migrations: migrations.map((item) => ({
              version: item.version,
              sha256: item.sha256,
              state: applied.some(
                (row) =>
                  row.version === item.version && row.sha256 === item.sha256,
              )
                ? "applied"
                : applied.some((row) => row.version === item.version)
                  ? "hash_mismatch"
                  : "pending",
            })),
            note: "No database changes. Use --apply to apply pending migrations atomically.",
          },
          null,
          2,
        ),
      );
      return;
    }
    const completed: string[] = [];
    await sql.begin(async (tx) => {
      await tx`set local statement_timeout='60s'`;
      await tx`set local lock_timeout='10s'`;
      await tx`select pg_advisory_xact_lock(72929000)`;
      await tx`create table if not exists public.health_schema_migrations(version text primary key,sha256 text not null check(length(sha256)=64),applied_at timestamptz not null default now())`;
      await tx`alter table public.health_schema_migrations enable row level security`;
      await tx`revoke all on public.health_schema_migrations from public,anon,authenticated`;
      await tx`grant select on public.health_schema_migrations to service_role`;
      const existing =
        await tx`select version,sha256 from public.health_schema_migrations where version in ${tx([...readinessMigrations])}`;
      const [objects] =
        await tx`select to_regclass('public.health_account_deletions') is not null as account,to_regclass('public.health_generation_events') is not null as operations, exists(select 1 from storage.buckets where id='health-record-media') as sync`;
      for (const [index, item] of migrations.entries()) {
        const recorded = existing.find((row) => row.version === item.version);
        if (recorded) {
          if (recorded.sha256 !== item.sha256)
            throw Error("MIGRATION_HASH_MISMATCH");
          completed.push(`${item.version}: already applied`);
          continue;
        }
        if ([objects.account, objects.operations, objects.sync][index])
          throw Error("UNTRACKED_READINESS_SCHEMA");
        await tx.unsafe(item.body);
        await tx`insert into public.health_schema_migrations(version,sha256) values(${item.version},${item.sha256})`;
        completed.push(`${item.version}: applied`);
      }
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "apply",
          migrations: completed,
          note: "All pending migrations committed atomically. Run scripts/verify-readiness.ts next.",
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end({ timeout: 3 });
  }
}
main().catch((error: unknown) => {
  const known = [
    "DATABASE_CONFIG",
    "DATABASE_PROJECT_MISMATCH",
    "MIGRATION_ENVELOPE",
    "MIGRATION_HASH_MISMATCH",
    "UNTRACKED_READINESS_SCHEMA",
    "UNKNOWN_ARGUMENT",
  ];
  const code =
    error instanceof Error && known.includes(error.message)
      ? error.message
      : "READINESS_SETUP_FAILED";
  console.error(
    JSON.stringify({
      ok: false,
      code,
      note: "No partial migration commit. Review connection, existing schema, and migration hashes. Credentials and raw database errors are never printed.",
    }),
  );
  process.exitCode = 1;
});
