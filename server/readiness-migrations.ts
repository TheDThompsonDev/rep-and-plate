import { createHash } from "node:crypto";

export const readinessMigrations = [
  "20260929_account.sql",
  "20260929_operations.sql",
  "20260929_sync.sql",
  "20260929_snapshot_conflicts.sql",
] as const;
export function migrationBody(source: string) {
  const normalized = source.replace(/\r\n/g, "\n").trim();
  if (!/^begin;\s/i.test(normalized) || !/\scommit;$/i.test(normalized))
    throw Error("MIGRATION_ENVELOPE");
  // Strip only the file-level envelope. Function BEGIN/END blocks remain intact.
  const body = normalized
    .replace(/^begin;\s*/i, "")
    .replace(/\s*commit;$/i, "");
  return {
    body,
    sha256: createHash("sha256").update(normalized).digest("hex"),
  };
}
export function matchingDatabaseUrl(
  raw: string | undefined,
  project: string | undefined,
) {
  if (!raw || !project) throw Error("DATABASE_CONFIG");
  let database: URL, publicUrl: URL;
  try {
    database = new URL(raw);
    publicUrl = new URL(project);
  } catch {
    throw Error("DATABASE_CONFIG");
  }
  const reference = publicUrl.hostname.match(
    /^([a-z0-9-]+)\.supabase\.co$/i,
  )?.[1];
  if (
    !reference ||
    publicUrl.protocol !== "https:" ||
    publicUrl.username ||
    publicUrl.password ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !(
      (database.hostname === `db.${reference}.supabase.co` &&
        decodeURIComponent(database.username) === "postgres") ||
      (database.hostname.endsWith(".pooler.supabase.com") &&
        decodeURIComponent(database.username) === `postgres.${reference}`)
    )
  )
    throw Error("DATABASE_PROJECT_MISMATCH");
  return raw;
}
