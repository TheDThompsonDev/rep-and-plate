import "dotenv/config";
import postgres from "postgres";
import { readFile } from "node:fs/promises";

// This is a local setup command. Database credentials never enter the app runtime.
const raw = process.env.SUPABASE_DB_URL;
if (!raw || !process.env.SUPABASE_URL) {
  console.error(
    "Set SUPABASE_DB_URL and SUPABASE_URL in the local .env first.",
  );
  process.exit(1);
}
let connection: URL;
try {
  connection = new URL(raw);
  const project = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
  const matches =
    connection.hostname === `db.${project}.supabase.co` ||
    (connection.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(connection.username).endsWith(`.${project}`));
  if (!matches || !["postgres:", "postgresql:"].includes(connection.protocol))
    throw new Error();
} catch {
  console.error(
    "Check that the database connection string belongs to the configured Supabase project.",
  );
  process.exit(1);
}
const sql = postgres(raw, {
  ssl: "require",
  max: 1,
  connect_timeout: 15,
  idle_timeout: 5,
  prepare: false,
  onnotice: () => {},
});
try {
  const migration = await readFile(
    new URL("../supabase/migrations/20260925_fuel.sql", import.meta.url),
    "utf8",
  );
  await sql.unsafe(migration);
  await sql.unsafe(await readFile(new URL('../supabase/migrations/20260928_beta.sql', import.meta.url), 'utf8'));
  const checks =
    await sql`select relrowsecurity as enabled, relforcerowsecurity as forced from pg_class where oid = 'public.fuel_snapshots'::regclass`;
  const policies =
    await sql`select count(*)::int as count from pg_policies where schemaname='public' and tablename='fuel_snapshots'`;
  if (!checks[0]?.enabled || !checks[0]?.forced || policies[0]?.count !== 4)
    throw new Error("POLICY_CHECK");
  console.log(
    "Rep & Plate storage created. Row-level security and four ownership policies are enabled. Run the ownership checks before using cloud backups.",
  );
} catch (error) {
  const code = (error as { code?: string }).code;
  const explanations: Record<string, string> = {
    ENOTFOUND:
      "Database host could not be reached. If using a direct connection on an IPv4 network, copy the Session pooler URL from Connect.",
    ENETUNREACH:
      "Database network is unreachable. Use the Session pooler URL from Supabase Connect on IPv4 networks.",
    CONNECT_TIMEOUT:
      "Database connection timed out. Check the connection method and network access.",
    "28P01":
      "Supabase rejected database authentication (28P01). Verify the connection details; after a password reset, the shared pooler can temporarily reject correct credentials. Avoid repeated password resets.",
    "42501":
      "This database connection does not have permission to create Rep & Plate storage.",
  };
  console.error(
    explanations[code ?? ""] ??
      "Database setup did not complete. Check the connection and migration; credentials and raw database errors are not printed.",
  );
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 3 });
}
