import "dotenv/config";
import postgres from "postgres";
import { readFile } from "node:fs/promises";

const raw = process.env.SUPABASE_DB_URL;
if (!raw || !process.env.SUPABASE_URL)
  throw Error(
    "Set the Supabase database connection in the server environment.",
  );
const url = new URL(raw),
  project = new URL(process.env.SUPABASE_URL).hostname.split(".")[0];
if (!(
  url.hostname === `db.${project}.supabase.co` ||
  (url.hostname.endsWith(".pooler.supabase.com") &&
    decodeURIComponent(url.username).endsWith(`.${project}`))
))
  throw Error("Database and Supabase project must match.");
const sql = postgres(raw, {
  ssl: "require",
  max: 1,
  connect_timeout: 15,
  prepare: false,
  onnotice: () => {},
});
try {
  if (process.argv.includes("--apply")) {
    await sql.unsafe(
      await readFile(
        new URL("../supabase/migrations/20260928_beta.sql", import.meta.url),
        "utf8",
      ),
    );
    console.log(
      "Beta migration applied. Access is closed until testers are added to health_beta_members.",
    );
  }
  await sql.begin(async (tx) => {
    const [permissions] =
      await tx`select has_function_privilege('anon','public.health_admit(uuid,boolean)','EXECUTE') as anon,
      has_function_privilege('authenticated','public.health_chat_claim(uuid,uuid,text)','EXECUTE') as client,
      has_function_privilege('service_role','public.health_admit(uuid,boolean)','EXECUTE') as server`;
    if (permissions.anon || permissions.client || !permissions.server)
      throw Error("RPC_PERMISSIONS");
    const a = crypto.randomUUID(),
      b = crypto.randomUUID(),
      request = crypto.randomUUID();
    await tx`insert into auth.users(id) values(${a}),(${b})`;
    // Simulate the session switching to B after a client preflight approved A.
    for (const operation of ['save', 'delete']) {
      let rejected = false;
      try {
        await tx.savepoint(async scoped => {
          await scoped`select set_config('request.jwt.claim.sub',${b},true)`;
          await scoped`set local role authenticated`;
          if (operation === 'save') await scoped`select public.health_save_snapshot(${a}::uuid,'{"version":1}'::jsonb,0)`;
          else await scoped`select public.health_delete_snapshot(${a}::uuid,1)`;
        });
      } catch (error) { rejected = (error as {code?: string}).code === '42501'; }
      if (!rejected) throw Error('ACCOUNT_SWITCH_MUTATION');
    }
    const [unchanged] = await tx`select count(*)::int as total from public.fuel_snapshots where user_id in (${a}::uuid,${b}::uuid)`;
    if (unchanged.total !== 0) throw Error('ACCOUNT_SWITCH_WROTE_DATA');
    const [denied] =
      await tx`select public.health_admit(${a}::uuid,true) as value`;
    if (denied.value.allowed) throw Error("ALLOWLIST");
    await tx`insert into public.health_beta_members(user_id) values(${a}),(${b})`;
    const [first] =
      await tx`select public.health_admit(${a}::uuid,true) as value`;
    if (!first.value.allowed) throw Error("ADMISSION");
    const [claim] =
      await tx`select public.health_chat_claim(${a}::uuid,${request}::uuid,'hash') as value`;
    const [busy] =
      await tx`select public.health_chat_claim(${a}::uuid,${request}::uuid,'hash') as value`;
    const [mismatch] =
      await tx`select public.health_chat_claim(${a}::uuid,${request}::uuid,'other') as value`;
    const [other] =
      await tx`select public.health_chat_claim(${b}::uuid,${request}::uuid,'hash') as value`;
    if (
      claim.value.status !== "new" ||
      busy.value.status !== "busy" ||
      mismatch.value.status !== "mismatch" ||
      other.value.status !== "new"
    )
      throw Error("ISOLATION");
    const [stale] =
      await tx`select public.health_chat_finish(${a}::uuid,${request}::uuid,${crypto.randomUUID()}::uuid,'{}'::jsonb) as saved`;
    if (stale.saved) throw Error("STALE_LEASE");
    await tx`select public.health_chat_finish(${a}::uuid,${request}::uuid,${claim.value.lease}::uuid,'{"test":true}'::jsonb)`;
    const [cached] =
      await tx`select public.health_chat_claim(${a}::uuid,${request}::uuid,'hash') as value`;
    if (cached.value.status !== "cached") throw Error("CACHE");
    await tx`update public.health_api_usage set ai_calls=100 where owner=${a}`;
    const [limited] =
      await tx`select public.health_admit(${a}::uuid,true) as value`;
    if (limited.value.allowed) throw Error("QUOTA");
    // Deliberately roll back test users, usage and leases. No customer data changes.
    throw Error("VERIFIED_ROLLBACK");
  });
} catch (error) {
  if ((error as Error).message === "VERIFIED_ROLLBACK")
    console.log(
      "Database checks passed: server-only permissions, allowlist, quota, cross-account isolation, duplicate claims and stale leases. Test data rolled back.",
    );
  else {
    console.error(
      "Beta database setup/check failed. No credentials or raw database errors are printed.",
    );
    process.exitCode = 1;
  }
} finally {
  await sql.end({ timeout: 3 });
}
