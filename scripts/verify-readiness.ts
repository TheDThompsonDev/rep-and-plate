import "dotenv/config";
import { randomUUID, createHash } from "node:crypto";
import postgres from "postgres";

/** All objects are synthetic metadata within ONE rolled-back transaction. No
 * real Storage files, user mutations, emails, or global cleanup invocation. */
class VerificationFailure extends Error {}
class VerifiedRollback extends Error {}
class QuotaVerifiedRollback extends Error {}
const report: string[] = [];
function check(value: unknown, label: string): asserts value {
  if (!value) throw new VerificationFailure(label);
  report.push(label);
}
function connectionString() {
  const raw = process.env.SUPABASE_DB_URL;
  if (!raw || !process.env.SUPABASE_URL)
    throw new VerificationFailure(
      "Configure SUPABASE_DB_URL and SUPABASE_URL.",
    );
  let database: URL, project: URL;
  try {
    database = new URL(raw);
    project = new URL(process.env.SUPABASE_URL);
  } catch {
    throw new VerificationFailure("Invalid database configuration.");
  }
  const match = project.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  if (
    !match ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !(
      database.hostname === `db.${match[1]}.supabase.co` ||
      (database.hostname.endsWith(".pooler.supabase.com") &&
        decodeURIComponent(database.username) === `postgres.${match[1]}`)
    )
  )
    throw new VerificationFailure(
      "Database must match the configured Supabase project.",
    );
  return raw;
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
    await sql.begin(async (tx) => {
      await tx`set local statement_timeout='15s'`;
      await tx`set local lock_timeout='5s'`;
      const [setup] =
        await tx`select to_regclass('public.health_generation_events') is not null as events,
        to_regprocedure('public.health_begin_account_deletion(uuid)') is not null as deletion,
        to_regprocedure('public.health_expired_capture_candidates()') is not null as cleanup,
        exists(select 1 from storage.buckets where id='health-record-media' and not public) as media`;
      check(
        setup.events && setup.deletion && setup.cleanup && setup.media,
        "Readiness migrations are present and media is private",
      );
      const a = randomUUID(),
        b = randomUUID(),
        request = randomUUID();
      const sha = createHash("sha256").update(request).digest("hex");
      const oldName = `${a}/${randomUUID()}.jpg`,
        freshName = `${a}/${randomUUID()}.jpg`;
      const mediaA = `${a}/${sha}.jpg`,
        mediaB = `${b}/${sha}.jpg`;
      await tx`insert into auth.users(id) values(${a}::uuid),(${b}::uuid)`;
      await tx`insert into public.health_beta_members(user_id) values(${a}::uuid),(${b}::uuid)`;
      const setRole = async (
        role: "anon" | "authenticated" | "service_role",
        user = "",
      ) => {
        await tx`reset role`;
        await tx`select set_config('request.jwt.claims',${JSON.stringify({ role, ...(user ? { sub: user } : {}) })},true),set_config('request.jwt.claim.sub',${user},true)`;
        if (role === "authenticated") await tx`set local role authenticated`;
        else if (role === "service_role") await tx`set local role service_role`;
        else await tx`set local role anon`;
      };
      const expectDenied = async (
        label: string,
        run: (scope: typeof tx) => Promise<unknown>,
      ) => {
        let denied = false;
        try {
          await tx.savepoint(run);
        } catch (error) {
          denied = (error as { code?: string }).code === "42501";
        }
        check(denied, label);
      };
      const insertMedia = async (name: string) =>
        tx`insert into storage.objects(bucket_id,name,owner_id,metadata) values('health-record-media',${name},${name.split("/")[0]},'{"size":128,"mimetype":"image/jpeg"}'::jsonb)`;
      const expectNoMutation = async (
        label: string,
        run: (scope: typeof tx) => Promise<unknown>,
      ) => {
        let blocked = false;
        try {
          await tx.savepoint(async (scoped) => {
            const rows = await run(scoped);
            blocked = Array.isArray(rows) && rows.length === 0;
            if (!blocked) throw new VerificationFailure(label);
          });
        } catch (error) {
          if ((error as { code?: string }).code === "42501") blocked = true;
          else throw error;
        }
        check(blocked, label);
      };
      await setRole("authenticated", a);
      await insertMedia(mediaA);
      await tx`insert into storage.objects(bucket_id,name,owner_id,metadata,created_at) values
        ('health-captures',${oldName},${a},'{"size":128,"mimetype":"image/jpeg"}'::jsonb,now()-interval '100 years'),
        ('health-captures',${freshName},${a},'{"size":128,"mimetype":"image/jpeg"}'::jsonb,now())`;
      await tx`select public.health_save_snapshot(${a}::uuid,'{"version":1,"fixture":"readiness"}'::jsonb,0)`;
      await expectDenied(
        "Account A cannot write media into B's folder",
        (scope) =>
          scope`insert into storage.objects(bucket_id,name,owner_id) values('health-record-media',${mediaB},${b})`,
      );
      await setRole("authenticated", b);
      await insertMedia(mediaB);
      const visible =
        await tx`select name from storage.objects where name in(${mediaA},${mediaB},${oldName},${freshName})`;
      check(
        visible.length === 1 && visible[0].name === mediaB,
        "Account B can read only its own media",
      );
      await expectNoMutation(
        "Account B cannot modify A's media",
        (scoped) =>
          scoped`update storage.objects set metadata='{}'::jsonb where name=${mediaA} returning name`,
      );
      await expectNoMutation(
        "Account B cannot delete A's media",
        (scoped) =>
          scoped`delete from storage.objects where name=${mediaA} returning name`,
      );
      await expectNoMutation(
        "Persistent media cannot be deleted directly by a client",
        (scoped) =>
          scoped`delete from storage.objects where name=${mediaB} returning name`,
      );
      // Represent a full 500 MB account with synthetic metadata only. Each row
      // obeys the 10 MB per-file limit; the savepoint removes all quota fixtures.
      let quotaVerified = false;
      try {
        await tx.savepoint(async (scoped) => {
          await scoped`insert into storage.objects(bucket_id,name,owner_id,metadata)
            select 'health-record-media',${b}||'/'||repeat(md5(${request}||n::text),2)||'.jpg',${b},'{"size":10000000,"mimetype":"image/jpeg"}'::jsonb
            from generate_series(1,49) n`;
          const last = `${b}/${createHash("sha256")
            .update("quota" + request)
            .digest("hex")}.jpg`;
          await scoped`insert into storage.objects(bucket_id,name,owner_id,metadata) values('health-record-media',${last},${b},'{"size":9999872,"mimetype":"image/jpeg"}'::jsonb)`;
          let rejected = false;
          try {
            await scoped.savepoint(async (over) => {
              const next = `${b}/${createHash("sha256")
                .update("over" + request)
                .digest("hex")}.jpg`;
              await over`insert into storage.objects(bucket_id,name,owner_id,metadata) values('health-record-media',${next},${b},'{"size":1,"mimetype":"image/jpeg"}'::jsonb)`;
            });
          } catch (error) {
            rejected = (error as { code?: string }).code === "54000";
          }
          check(
            rejected,
            "Persistent media rejects uploads above the account byte quota",
          );
          throw new QuotaVerifiedRollback();
        });
      } catch (error) {
        if (error instanceof QuotaVerifiedRollback) quotaVerified = true;
        else throw error;
      }
      check(
        quotaVerified,
        "Storage quota fixtures are rolled back without uploaded files",
      );
      await setRole("service_role");
      await tx`insert into public.health_generation_events(id,user_id,request_id,operation,provider,model,fallback,outcome,duration_ms)
        values(${randomUUID()}::uuid,${a}::uuid,${request}::uuid,'/api/chat','jev','jev-latest',false,'success',1)`;
      const candidates =
        await tx`select name from public.health_expired_capture_candidates() where name in(${oldName},${freshName},${mediaA},${mediaB})`;
      check(
        candidates.length === 1 && candidates[0].name === oldName,
        "Cleanup selects only expired temporary captures, never fresh or persistent media",
      );
      for (const role of ["anon", "authenticated"] as const) {
        await setRole(role, role === "authenticated" ? a : "");
        await expectDenied(
          `${role} cannot read private AI metadata`,
          (scope) =>
            scope`select id from public.health_generation_events where user_id=${a}::uuid`,
        );
        await expectDenied(
          `${role} cannot enumerate cleanup candidates`,
          (scope) =>
            scope`select * from public.health_expired_capture_candidates()`,
        );
        await expectDenied(
          `${role} cannot run cleanup`,
          (scope) => scope`select public.health_prune_operations()`,
        );
        await expectDenied(
          `${role} cannot mark account deletion`,
          (scope) =>
            scope`select public.health_begin_account_deletion(${a}::uuid)`,
        );
      }
      await setRole("service_role");
      const [policy] =
        await tx`select pg_get_functiondef('public.health_prune_operations()'::regprocedure) as body`;
      check(
        policy.body.includes("expires_at<now()") &&
          policy.body.includes("interval '90 days'") &&
          !policy.body.includes("storage.objects"),
        "Cleanup retention is bounded and does not directly delete Storage objects",
      );
      await tx`select public.health_begin_account_deletion(${a}::uuid)`;
      await setRole("authenticated", a);
      const after = `${a}/${createHash("sha256").update(randomUUID()).digest("hex")}.jpg`;
      await expectDenied(
        "Deletion marker blocks new persistent media",
        (scope) =>
          scope`insert into storage.objects(bucket_id,name,owner_id) values('health-record-media',${after},${a})`,
      );
      await expectDenied(
        "Deletion marker blocks new temporary captures",
        (scope) =>
          scope`insert into storage.objects(bucket_id,name,owner_id) values('health-captures',${a + "/" + randomUUID() + ".jpg"},${a})`,
      );
      await expectDenied(
        "Deletion marker blocks snapshot uploads",
        (scope) =>
          scope`select public.health_save_snapshot(${a}::uuid,'{"version":1}'::jsonb,0)`,
      );
      await tx`reset role`;
      // Auth cascade for generated account only. Actual media cleanup uses Storage API;
      // here the generated metadata objects disappear with the transaction rollback.
      await tx`delete from auth.users where id=${a}::uuid`;
      const [remaining] =
        await tx`select count(*)::int as count from public.health_generation_events where user_id=${a}::uuid`;
      check(
        remaining.count === 0,
        "Account deletion cascades private AI metadata",
      );
      throw new VerifiedRollback();
    });
  } catch (error) {
    if (error instanceof VerifiedRollback) verified = true;
    else throw error;
  } finally {
    await sql.end({ timeout: 3 });
  }
  if (!verified) throw new VerificationFailure("Verification did not finish.");
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: report.length,
        passed: report,
        fixtureRows: "rolled back",
        filesUploaded: 0,
        emailsSent: 0,
        realUserMutations: 0,
      },
      null,
      2,
    ),
  );
}
verify().catch((error: unknown) => {
  // Do not print database error payloads, connection URLs, SQL or credentials.
  console.error(
    JSON.stringify({
      ok: false,
      reason:
        error instanceof VerificationFailure
          ? error.message
          : "Readiness verification failed; transaction rolled back. Check migrations and connectivity.",
      lastCompletedCheck: report.at(-1) ?? "connectivity",
      sqlState:
        error &&
        typeof error === "object" &&
        "code" in error &&
        typeof error.code === "string" &&
        /^[0-9A-Z]{5}$/.test(error.code)
          ? error.code
          : undefined,
    }),
  );
  process.exitCode = 1;
});
