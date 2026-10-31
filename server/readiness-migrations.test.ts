import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import {
  matchingDatabaseUrl,
  migrationBody,
  readinessMigrations,
} from "./readiness-migrations";

describe("readiness migration boundaries", () => {
  it("only removes outer transaction directives and hashes consistently across line endings", () => {
    const sql =
      "begin;\ncreate function example() returns void as $$ begin perform 1; end $$ language plpgsql;\ncommit;\n";
    const parsed = migrationBody(sql);
    expect(parsed.body).toContain("$$ begin perform 1; end $$");
    expect(parsed.body.startsWith("create function")).toBe(true);
    expect(parsed.body).not.toMatch(/commit;$/i);
    expect(migrationBody(sql.replaceAll("\n", "\r\n")).sha256).toBe(
      parsed.sha256,
    );
    expect(() => migrationBody("create table example(id int);")).toThrow(
      "MIGRATION_ENVELOPE",
    );
  });
  it("requires the exact database project and administrator identity", () => {
    const publicUrl = "https://example.supabase.co";
    expect(
      matchingDatabaseUrl(
        "postgres://postgres:secret@db.example.supabase.co:5432/postgres",
        publicUrl,
      ),
    ).toContain("db.example");
    expect(
      matchingDatabaseUrl(
        "postgres://postgres.example:secret@aws-0.pooler.supabase.com:6543/postgres",
        publicUrl,
      ),
    ).toContain("pooler");
    for (const url of [
      "postgres://postgres:secret@db.other.supabase.co/postgres",
      "postgres://postgres.other:secret@aws-0.pooler.supabase.com/postgres",
      "postgres://anon:secret@db.example.supabase.co/postgres",
      "https://db.example.supabase.co",
      "postgres://postgres:secret@db.example.supabase.co.evil.test/postgres",
    ])
      expect(() => matchingDatabaseUrl(url, publicUrl)).toThrow();
  });
});

describe("migration coverage", () => {
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  const files = readdirSync(migrations)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const bootstrap = readFileSync(
    new URL("../scripts/setup-supabase.ts", import.meta.url),
    "utf8",
  );
  const direct = files.filter((name) => bootstrap.includes(`migrations/${name}`));
  const readiness: readonly string[] = readinessMigrations;
  it("applies every migration file through exactly one setup path", () => {
    expect(new Set([...direct, ...readiness])).toEqual(new Set(files));
    expect(direct.filter((name) => readiness.includes(name))).toEqual([]);
    expect(new Set(readiness).size).toBe(readiness.length);
  });
  it("keeps the agents migration after the account migration it depends on, without moving the initial three", () => {
    expect(readiness.slice(0, 3)).toEqual([
      "20260929_account.sql",
      "20260929_operations.sql",
      "20260929_sync.sql",
    ]);
    expect(readiness.indexOf("20260929_agents.sql")).toBeGreaterThan(
      readiness.indexOf("20260929_account.sql"),
    );
  });
  it("accepts every readiness file's transaction envelope, including leading comments", () => {
    for (const version of readiness) {
      const source = readFileSync(new URL(version, migrations), "utf8");
      const parsed = migrationBody(source);
      expect(parsed.body.toLowerCase().startsWith("begin;")).toBe(false);
      expect(parsed.body.length).toBeGreaterThan(100);
    }
    expect(
      migrationBody("-- note\n-- more\nbegin;\ncreate table t(id int);\ncommit;\n").body,
    ).toContain("create table t");
  });
});
