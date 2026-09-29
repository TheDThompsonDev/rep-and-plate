import "dotenv/config";
import { randomUUID } from "node:crypto";
import postgres from "postgres";

/**
 * Integration checks against the configured project after applying the migration.
 * All fixture rows and snapshots are rolled back; no Auth HTTP calls or emails.
 * PostgreSQL sequence allocations are nontransactional and leave harmless gaps.
 */
class VerificationFailure extends Error {}
class RollbackVerified extends Error {}
const report: string[] = [];
const userA = randomUUID();
const userB = randomUUID();

function connectionString(): string {
  const connection = process.env.SUPABASE_DB_URL;
  const project = process.env.SUPABASE_URL;
  if (!connection || !project)
    throw new VerificationFailure(
      "Set SUPABASE_DB_URL and SUPABASE_URL before database verification.",
    );
  let database: URL, publicUrl: URL;
  try {
    database = new URL(connection);
    publicUrl = new URL(project);
  } catch {
    throw new VerificationFailure(
      "The configured database or project URL is invalid.",
    );
  }
  const projectMatch = publicUrl.hostname.match(
    /^([a-z0-9-]+)\.supabase\.co$/i,
  );
  if (
    !projectMatch ||
    !["postgres:", "postgresql:"].includes(database.protocol)
  )
    throw new VerificationFailure(
      "A Supabase project URL and PostgreSQL connection URL are required.",
    );
  const reference = projectMatch[1];
  const isDirect = database.hostname === `db.${reference}.supabase.co`;
  const isPooler =
    database.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(database.username) === `postgres.${reference}`;
  if (!isDirect && !isPooler)
    throw new VerificationFailure(
      "The database connection does not match the configured Supabase project.",
    );
  return connection;
}

function check(value: unknown, message: string): asserts value {
  if (!value) throw new VerificationFailure(message);
}

async function verify() {
  const sql = postgres(connectionString(), {
    ssl: "require",
    max: 1,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 10,
    onnotice: () => {},
  });
  let verified = false;
  try {
    await sql.begin(async (transaction) => {
      await transaction`set local statement_timeout = '15s'`;
      await transaction`set local lock_timeout = '5s'`;
      const setup =
        await transaction`select to_regclass('public.fuel_snapshots') is not null as table_ready, to_regprocedure('public.fuel_save_snapshot(jsonb,bigint)') is not null as save_ready, to_regprocedure('public.fuel_delete_snapshot(bigint)') is not null as delete_ready`;
      check(
        setup[0]?.table_ready && setup[0]?.save_ready && setup[0]?.delete_ready,
        "Apply the Rep & Plate Supabase migration before running these checks.",
      );

      // Only generated IDs: no email, password, identities, or permanent Auth sign-up.
      await transaction`insert into auth.users(id) values (${userA}::uuid), (${userB}::uuid)`;
      const setUser = async (id: string) => {
        await transaction`reset role`;
        await transaction`set local role authenticated`;
        await transaction`select set_config('request.jwt.claims', ${JSON.stringify({ sub: id, role: "authenticated" })}, true), set_config('request.jwt.claim.sub', ${id}, true)`;
      };
      const expectError = async (
        name: string,
        expectedCode: string,
        operation: (scoped: typeof transaction) => Promise<unknown>,
      ) => {
        let received: unknown;
        try {
          await transaction.savepoint(async (scoped) => {
            await operation(scoped);
          });
        } catch (error) {
          received = error;
        }
        check(
          received &&
            typeof received === "object" &&
            "code" in received &&
            received.code === expectedCode,
          `${name}: expected rejection was not observed.`,
        );
        report.push(name);
      };
      const save = async (state: unknown, revision: number) => {
        const rows =
          await transaction`select public.fuel_save_snapshot(${transaction.json(state as postgres.JSONValue)}, ${revision}::bigint) as result`;
        return rows[0].result as {
          user_id: string;
          revision: number;
          updated_at: string;
        };
      };

      await setUser(userA);
      const firstA = await save({ version: 1, fixture: "A" }, 0);
      check(
        firstA.user_id === userA && firstA.revision > 0,
        "Account A could not create its own snapshot.",
      );
      const readA =
        await transaction`select user_id, state from public.fuel_snapshots where user_id in (${userA}::uuid, ${userB}::uuid)`;
      check(
        readA.length === 1 &&
          readA[0].user_id === userA &&
          readA[0].state.fixture === "A",
        "Account A did not read exactly its own snapshot.",
      );
      report.push("authenticated owner can create and read own snapshot");

      await expectError(
        "owner cannot insert a snapshot for another account",
        "42501",
        (scoped) =>
          scoped`insert into public.fuel_snapshots(user_id,state,revision) values (${userB}::uuid, '{"version":1}'::jsonb, 1)`,
      );
      await expectError(
        "owner cannot reassign a snapshot to another account",
        "42501",
        (scoped) =>
          scoped`update public.fuel_snapshots set user_id = ${userB}::uuid where user_id = ${userA}::uuid`,
      );

      await setUser(userB);
      const beforeB =
        await transaction`select user_id from public.fuel_snapshots where user_id in (${userA}::uuid, ${userB}::uuid)`;
      check(beforeB.length === 0, "Account B could read account A's snapshot.");
      const foreignUpdate =
        await transaction`update public.fuel_snapshots set state = '{"version":1,"fixture":"wrong"}'::jsonb where user_id = ${userA}::uuid returning user_id`;
      const foreignDelete =
        await transaction`delete from public.fuel_snapshots where user_id = ${userA}::uuid returning user_id`;
      check(
        foreignUpdate.length === 0 && foreignDelete.length === 0,
        "Account B could modify account A's snapshot.",
      );
      const firstB = await save({ version: 1, fixture: "B" }, 0);
      check(
        firstB.user_id === userB,
        "Account B's RPC used the wrong account.",
      );
      const readB =
        await transaction`select user_id from public.fuel_snapshots where user_id in (${userA}::uuid, ${userB}::uuid)`;
      check(
        readB.length === 1 && readB[0].user_id === userB,
        "Account B did not read exactly its own snapshot.",
      );
      report.push(
        "second account cannot read, update, or delete another account's data",
      );

      await setUser(userA);
      const isolatedA =
        await transaction`select user_id from public.fuel_snapshots where user_id in (${userA}::uuid, ${userB}::uuid)`;
      check(
        isolatedA.length === 1 && isolatedA[0].user_id === userA,
        "Account A could read account B's snapshot.",
      );
      report.push("first account cannot read the second account's saved data");
      const updatedA = await save(
        { version: 1, fixture: "A updated" },
        firstA.revision,
      );
      check(
        updatedA.revision > firstA.revision,
        "Successful save did not advance the revision.",
      );
      await expectError(
        "stale compare-and-swap save is rejected",
        "40001",
        (scoped) =>
          scoped`select public.fuel_save_snapshot('{"version":1}'::jsonb, ${firstA.revision}::bigint)`,
      );
      await expectError(
        "creating over an existing snapshot is rejected",
        "40001",
        (scoped) =>
          scoped`select public.fuel_save_snapshot('{"version":1}'::jsonb, 0)`,
      );
      await expectError(
        "stale compare-and-swap deletion is rejected",
        "40001",
        (scoped) =>
          scoped`select public.fuel_delete_snapshot(${firstA.revision}::bigint)`,
      );
      const deletedA =
        await transaction`select public.fuel_delete_snapshot(${updatedA.revision}::bigint) as result`;
      check(
        deletedA[0].result.deleted === true,
        "Owner deletion did not complete.",
      );
      const recreatedA = await save({ version: 1, fixture: "A recreated" }, 0);
      check(
        recreatedA.revision > updatedA.revision,
        "Deleting and recreating a snapshot reset its revision.",
      );
      report.push(
        "owner can delete and recreate with a new monotonic revision",
      );
      await expectError(
        "old revision cannot overwrite a recreated snapshot",
        "40001",
        (scoped) =>
          scoped`select public.fuel_save_snapshot('{"version":1}'::jsonb, ${updatedA.revision}::bigint)`,
      );

      await expectError(
        "unsupported snapshot version is rejected",
        "22023",
        (scoped) =>
          scoped`select public.fuel_save_snapshot('{"version":2}'::jsonb, ${recreatedA.revision}::bigint)`,
      );
      await expectError(
        "missing snapshot version is rejected",
        "22023",
        (scoped) =>
          scoped`select public.fuel_save_snapshot('{}'::jsonb, ${recreatedA.revision}::bigint)`,
      );
      await expectError(
        "oversized snapshot is rejected",
        "22023",
        (scoped) =>
          scoped`select public.fuel_save_snapshot(jsonb_build_object('version',1,'fixture',repeat('x',5000000)), ${recreatedA.revision}::bigint)`,
      );

      await transaction`reset role`;
      await transaction`set local role anon`;
      await transaction`select set_config('request.jwt.claims', '{}', true), set_config('request.jwt.claim.sub', '', true)`;
      await expectError(
        "anonymous select is denied",
        "42501",
        (scoped) =>
          scoped`select user_id from public.fuel_snapshots where user_id = ${userA}::uuid`,
      );
      await expectError(
        "anonymous insert is denied",
        "42501",
        (scoped) =>
          scoped`insert into public.fuel_snapshots(user_id,state,revision) values (${userA}::uuid,'{"version":1}'::jsonb,1)`,
      );
      await expectError(
        "anonymous update is denied",
        "42501",
        (scoped) =>
          scoped`update public.fuel_snapshots set revision = revision where user_id = ${userA}::uuid`,
      );
      await expectError(
        "anonymous delete is denied",
        "42501",
        (scoped) =>
          scoped`delete from public.fuel_snapshots where user_id = ${userA}::uuid`,
      );
      await expectError(
        "anonymous save function is denied",
        "42501",
        (scoped) =>
          scoped`select public.fuel_save_snapshot('{"version":1}'::jsonb,0)`,
      );
      await expectError(
        "anonymous delete function is denied",
        "42501",
        (scoped) => scoped`select public.fuel_delete_snapshot(1)`,
      );

      // Throwing deliberately guarantees postgres.js issues ROLLBACK, never COMMIT.
      throw new RollbackVerified();
    });
  } catch (error) {
    if (error instanceof RollbackVerified) verified = true;
    else throw error;
  } finally {
    await sql.end({ timeout: 3 });
  }
  check(verified, "Database checks did not finish.");
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: report.length,
        passed: report,
        fixtureRows: "rolled back",
        accountEmailsSent: 0,
        note: "No persistent account or snapshot rows were created. Revision sequence numbers may have harmless gaps.",
      },
      null,
      2,
    ),
  );
}

verify().catch((error: unknown) => {
  const reason =
    error instanceof VerificationFailure
      ? error.message
      : "Database verification failed; the transaction was rolled back. Check connectivity, migration setup, and database permissions.";
  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]{3,25}$/.test(error.code)
      ? error.code
      : undefined;
  // Never print raw database errors, URLs, SQL, credentials, or connection configuration.
  console.error(
    JSON.stringify({ ok: false, reason, ...(code ? { code } : {}) }),
  );
  process.exitCode = 1;
});
