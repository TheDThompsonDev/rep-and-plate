import { describe, expect, it } from "vitest";
import { matchingDatabaseUrl, migrationBody } from "./readiness-migrations";

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
