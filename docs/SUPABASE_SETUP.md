# Rep & Plate accounts and private saved records

This is the first account/storage increment. It adds email sign-in and a manually uploaded private copy of the current device records. **It is not automatic synchronization, a photo-storage service, or a completed public deployment.**

## Project configuration

In the server's untracked `.env`, set:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_public_key
```

The publishable key is designed for browser use. Rep & Plate sends only that key and the project URL from `GET /api/cloud/config`; elevated secret/service-role keys are not needed for the runtime. The client accepts only modern `sb_publishable_` keys and an HTTPS `*.supabase.co` project URL in this initial version. A custom project domain would need an explicit configuration update. [Supabase key types](https://supabase.com/docs/guides/getting-started/api-keys)

Enable email/password authentication in the Supabase project. Keep email confirmation enabled. Set the Auth Site URL to the application's actual origin, currently `http://127.0.0.1:5173` for local use; configure the eventual production origin before deployment. The sign-up screen asks the user to confirm their email and return to sign in. It creates an account only after the user submits the form. Rep & Plate never creates test accounts as part of the build. [Email sign-up reference](https://supabase.com/docs/reference/javascript/auth-signup)

Apply `supabase/migrations/20260925_fuel.sql` in this project's Supabase SQL Editor, or with a trusted database migration connection. A publishable or service-role API key is **not** a PostgreSQL migration connection and cannot be used to execute arbitrary SQL. The migration is repeatable, does not remove existing application data, and only replaces the policies/functions it owns. It requires authority to create the table, sequence, policies, and functions in `public`.

For local automated setup, add `SUPABASE_DB_URL` to the untracked `.env`. Copy the **Session pooler** connection string from **Connect** when the local network cannot reach IPv6. Substitute the database password, URL-encoding reserved characters. This is separate from the project API URL and API keys; never prefix it with `VITE_`.

```sh
npm run db:setup
npm run db:verify
```

The setup command checks that the database connection belongs to the configured API project, applies the migration over TLS, and checks that ownership policies are enabled. The verification command tests actual database permissions with two UUID-only fixtures inside a transaction that always rolls back. It sends no email and leaves no account or snapshot rows; the revision sequence can have harmless gaps. It covers owner access, cross-user and anonymous rejection, stale writes/deletes, delete/recreate conflicts, and invalid/oversized records. This tests database roles directly; it does not replace a real-user sign-in/confirmation check.

Restart the local Rep & Plate server after changing environment variables. Open **You → Account & backups**. If a database function or table is missing, Rep & Plate shows a setup message rather than claiming the upload worked.

## What the migration creates

- `public.fuel_snapshots`: one row for each signed-in user's UUID, containing the versioned application JSON, a revision, and an update timestamp. The foreign key references `auth.users` with cascading removal when that account is deleted through an authorized account-management flow.
- Row Level Security for select, insert, update, and delete: authenticated users can access only the row where `auth.uid() = user_id`. Anonymous users have no table privileges. Update checks protect both the old and new owner value.
- `fuel_save_snapshot(p_state, p_expected_revision)`: an invoker-rights function that derives ownership from the authenticated session. Revision zero means create only if no copy exists. A stale revision fails with `40001`; there is no automatic overwrite retry.
- `fuel_delete_snapshot(p_expected_revision)`: deletes the authenticated user's saved copy only when the reviewed revision still matches.
- A database sequence gives every saved revision a new number, including after deleting and recreating a copy. Revision numbers can skip. This prevents a stale device from accidentally matching a recreated copy's revision.

The functions use an empty search path and explicit schema names. They do not use `SECURITY DEFINER` or bypass ownership policies. Table privileges are necessary for invoker-rights functions; clients are expected to use the save/delete functions for application-level conflict checks. RLS is the cross-user security boundary, while compare-and-swap guards ordinary client races. No shared food catalog or public correction-write permission is created. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security), [database function guidance](https://supabase.com/docs/guides/database/functions)

## Explicit user actions

**Sign in** changes the authenticated account only. It does not upload local records or replace the device's records. A metadata read shows whether a saved copy exists.

**Upload this device's records** presents counts and a confirmation before sending the current meals, messages, groceries, pantry events, preferences, plans, products, and workouts. Embedded photos are part of that private JSON copy. An existing saved copy is replaced only if its reviewed revision still matches.

**Load my saved records** downloads and validates the saved JSON, shows a preview, and asks for confirmation before replacing local state. Export this device first to keep a second copy. There is no merge between two devices in this increment.

**Delete my cloud copy** requires typing DELETE. It removes that saved record, not the sign-in account or local browser state. The app does not yet provide account deletion, recovery email UI, multi-factor controls, or an automatic retention policy.

**Export this device's records** downloads a JSON file without requiring sign-in. Export is available even when the upload would be too large. This increment does not provide a file-import UI.

**Sign out on this device** removes the local auth session. The local Rep & Plate data remains on the device; this is displayed in the UI. There is not yet a per-account local browser database, so explicitly check the local data before uploading after an account switch. There are no automatic cross-account uploads.

## Limits and conflict behavior

The browser accepts up to 4.8 MB of serialized records, leaving room for JSONB formatting under the database's 5 MB limit. Embedded receipt/meal photos can use most of that capacity. Object storage, signed image URLs, photo deduplication, and image cleanup are not implemented by this migration. Larger records remain on the device and can be exported.

Uploads are blocked while a chat capture is pending. Every cloud operation checks the authenticated user and rejects account changes. If another device changed the saved copy, the upload stops. Export the local copy, load and review the latest saved copy, then decide what to upload. The app does not silently merge or retry a conflicting write.

An interrupted save may have succeeded remotely. Check the saved copy before retrying; a stale revision will stop a duplicate overwrite. Cloud operations have bounded client request timeouts.

## Verification and release gate

`npx vitest run src/features/cloud/client.test.ts` verifies public-key filtering, snapshot validation/limits, account-switch checks, CAS RPC arguments, conflicts, safe error handling, and ownership validation in returned data. These are mocked unit tests; **they do not prove the installed project's RLS configuration**.

`npx playwright test tests/cloud.spec.ts` checks the account flow on desktop and mobile with all Supabase calls mocked: email-confirmation messaging, sign-in without automatic upload, explicit upload/restore review, typed deletion confirmation, export, conflict handling, and failed writes preserving local records. Six browser checks passed during implementation; no real accounts were created by these tests.

Before opening this to real users, apply the migration and run a database/integration suite with two explicitly authorized test accounts and a signed-out client. Verify:

1. The signed-out client cannot select, insert, update, delete, or invoke save/delete functions.
2. Each account can save, read, revise, and delete only its own copy.
3. Account A cannot read or change account B's row, including by submitting B's UUID directly.
4. Two saves using the same expected revision allow only one winner.
5. After deleting and recreating a copy, an old revision still cannot overwrite it.
6. An oversized or unsupported-version snapshot is rejected.
7. An old local snapshot survives cloud configuration errors, failed auth, conflicts, and cancelled restore review.

Until those checks run against the configured project, describe the cloud feature as implemented but deployment verification pending. Project URL/key connectivity alone does not validate row ownership or database migrations. Supabase explicitly recommends testing policy allow/deny behavior. [RLS testing guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

## Configured project verification

The migration was applied successfully on September 25, 2026. All 19 database-role checks passed against the configured project. Temporary fixture rows were rolled back and no email was sent. This validates database isolation and conflict behavior. A separate real browser check also passed: password sign-in without automatic upload, reviewed upload, recipe/portion/date preservation, reviewed restore, typed-confirmation cloud deletion and sign-out retaining local records. The synthetic account and snapshot were deleted and their absence verified. No emails were sent. Real-user confirmation-email delivery remains unverified.

Run this separate integration check only when intended: `npx tsx scripts/verify-cloud-browser.ts --run`. It needs the local app running and the configured server-side admin key to create/delete one temporary synthetic account. The browser receives only the publishable key, and the script does not save tokens, passwords, browser storage, screenshots or traces. It is not part of `npm test`; without `--run` it performs no network changes.
