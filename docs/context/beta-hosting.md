# Internal beta: Supabase + Vercel

## Responsibilities

- Expo/React Native: native iPhone and Android app, local records and offline review.
- Vercel: existing Vite web app and a Node 24 streaming API (`api/health.mjs`, bundled from `server/vercel-entry.ts`). No Next.js migration needed.
- Supabase Auth: email sign-in; Postgres: snapshots, approved testers, usage and short-lived AI request results; Storage: private capture uploads.
- Existing OpenAI/JEV/USDA integrations remain server-side.

## Implemented

The hosted API verifies each bearer token with Supabase `getUser`; Host and caller-supplied user IDs cannot grant access. Public `/api/cloud/config` exposes only the project URL and publishable key so native sign-in can bootstrap. Only `APP_ORIGIN` is accepted as a browser origin. Native apps use bearer authentication without Origin.

`20260928_beta.sql` was applied to the configured project. Server-only RPCs enforce membership in `health_beta_members`, 30 requests/minute/user, two active requests/user, ten globally, 500 requests/day/user (100 AI), and 5,000 requests/day globally (1,000 AI). Day boundaries are UTC. Admission is atomic across Vercel instances; active leases expire after four minutes. Denied and failed provider attempts are not free retries. Supabase failure denies access. These request limits are not a dollar-accurate billing cap; configure provider spending limits separately.

Chat claims are scoped to verified user ID + request UUID + input hash. Results replay for ten minutes; mismatched payloads fail rather than returning unrelated data. Lease checks prevent expired workers overwriting a new worker. Rows are pruned during admission; expired records may remain up to a day longer and indefinitely during inactivity, so this is not a scheduled deletion guarantee.

Hosted photos/audio upload directly to the private `health-captures` bucket under the authenticated user's ID. The server validates ownership, file type and size before reconstructing the existing provider request. Clients attempt removal once the server has read the file. Failed or interrupted cleanup can leave orphan files. The insert policy caps the normal number of outstanding uploads at 50/account, but concurrent uploads can race that count; it is a guardrail, not a hard byte quota. Add scheduled Storage API cleanup before broader rollout. No public capture URLs are used.

Mobile and hosted-web API calls use the current session and require explicit ownership confirmation for existing local records. A different account/project cannot send those records to AI or upload/restore cloud snapshots. Session changes abort active requests. This is a personal-device beta: signing out retains locally visible records; it is not a shared-device lock screen. Account switching requires a separate installation/browser profile until a reviewed per-account local migration exists. Backups remain explicit upload/restore with revision checks, not automatic synchronization.

Native SecureStore sessions are chunked into small atomic generations. TypeScript 7 is installed as `typescript-compiler` for type checking (large shared Zod contracts overflowed TS6); standard TypeScript 6 remains for Expo's ESLint tooling. The parser is resolved explicitly from `mobile/` for shared parent-directory modules. Existing hooks/unused-import lint warnings remain; no lint errors.

## Deployed beta

Deployed September 28, 2026 at **https://repandplate.com**, in the separate `dannys-health` project under `dthompsondev`. The existing `undersold` project was not modified. Production uses Node 24, the 240-second API function and exact-origin CORS. Provider and Supabase server credentials are configured only as server environment variables; the database password was not uploaded. Preview environments are not configured.

The user-authorized account `dannythompson901@gmail.com` is approved in `health_beta_members`. No invitation or sign-in email was sent. EAS preview/production profiles supply `EXPO_PUBLIC_API_URL=https://repandplate.com`; a manual hosted Connection uses this URL with an empty pairing code.

A deployed smoke test verified public config, unauthenticated rejection, unapproved-account rejection, approved-account access, cross-origin rejection, private image upload, foreign-folder rejection, nonpublic media, a real streamed AI reply, and replay of the completed request. The synthetic account and uploaded image were removed afterward. This does not establish the real user's email delivery or real receipt/audio interpretation.

## Before broader testing

The public name is now **Rep & Plate**, served at **https://repandplate.com**; `www` redirects to the apex. The existing Vercel project remains `dannys-health` internally. Native application identifiers, local storage keys, snapshot formats and the legacy deep-link scheme are retained for compatibility; new deep links can use `repandplate://`. Display names and export filenames use the new brand.

Browser storage is isolated by origin: records from localhost or the old Vercel URL do not automatically appear on the custom domain. Export from the original origin and import the backup, or use an explicitly uploaded cloud snapshot. No existing records are deleted by the rename. Supabase Auth Site URL/email redirects and sender branding still require verification in the Supabase dashboard for `https://repandplate.com`; changing the Vercel domain does not change those settings.

1. In Supabase, configure/verify the sign-in email template with `{{ .Token }}` for mobile OTP, an approved sender and appropriate auth limits. Native OTP requests do not create new accounts. Approve additional testers explicitly. Actual email delivery and this user's sign-in remain unverified.
2. Exercise real receipts/audio, cloud save/conflict/restore and interrupted uploads against the deployment on phones. Add scheduled capture cleanup and a stronger upload quota before expanding access.
3. Complete EAS project/signing, branded icons/launch assets, signed iOS and Android distribution, and physical-phone permission/keyboard/background/camera tests. The existing debug Android build and JS exports are not release distribution.
4. Give preview browser deployments their own exact `APP_ORIGIN` and preferably a separate Supabase project. Keep provider secrets and the database password out of client-public variables.

## Checks

The shared snapshot client now uses `health_save_snapshot` and `health_delete_snapshot`, which compare the expected account to `auth.uid()` inside the mutation transaction. Database checks simulate a switch to account B after account A's client preflight and prove that neither snapshot is written or deleted. Existing legacy RPCs remain for backward compatibility; newly built clients use the account-bound wrappers.

`node --import tsx scripts/setup-beta.ts --apply` installs the additive migration. Omit `--apply` to check it. Checks use temporary users and roll back the transaction, including test leases and usage. Tests cover RPC privileges, membership, quota, cross-account request isolation, duplicate and mismatched requests, and stale lease protection.

Run root unit/build/browser checks, `npm run mobile:check`, mobile lint, native Playwright flows, and `npm run mobile:export`. The native hosted-auth journey uses deterministic auth/API fixtures, confirms a valid bearer token, and asserts an ownership mismatch sends no second request.

## Primary documentation

- [Supabase verified user lookup](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Supabase private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals)
- [Vercel function limits](https://vercel.com/docs/functions/limitations): design uses small JSON requests and a 240-second ceiling rather than depending on larger payload/extended-duration beta limits.
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
