# Account recovery and deletion

Updated 2026-09-29. Code is shared by web and Expo; live email delivery still requires a real mailbox check after configuration.

## Header account access (working change, October 2)

The top-right icon opens a compact account panel on every web screen using FuelHeader and in the native shell. Signed-in users see their email and Sign out directly; guests see Sign in (and Create account on web). View your profile and Account settings & backups retain the existing destinations. Web uses the existing focus-managed Modal; native uses Sheet. Closing the panel leaves the current screen and chat draft intact.

QuickAccount retains local-scope sign-out and native session invalidation. Successful and server-rejected logout both follow the auth library's local session clearing behavior, returning to welcome with sign-in available. Account records and ownership boundaries are preserved; native durable account archives are the source of truth during transitions. No auth provider, password flow, account deletion, or record ownership behavior was changed.

Guards: `tests/header-account.spec.ts`, `mobile/e2e/header-account.spec.ts`, existing profile journeys using `e2e-shared/profile-navigation.ts`, and account/security/onboarding coverage. Evidence: `docs/audits/2026-10-02-header-account/`. Awaiting acceptance; hosted production and physical phones are not covered by local browser checks.

## Recovery and password changes

- **Forgot password?** appears on the sign-in step and the account panel on both platforms. It requests an existing-account email code (`shouldCreateUser: false`), accepts the code and a new password, and returns the user to normal sign-in.
- Recovery and password changes use isolated Supabase clients with no persistence, no auto-refresh, no URL-session detection and unique storage keys. Verifying a recovery code does not enter onboarding, switch the active account, or attach local records to a temporary recovery session.
- Signed-in password changes require current-password authentication for the same verified account. Wrong/expired codes, weak passwords, rate limits and connection errors leave existing records intact.
- Supabase's **Magic Link** email template must include the one-time `{{ .Token }}` code; its default link-only template cannot satisfy native code entry. Set a branded subject and clear code-based body in the project's Auth email configuration. No application deep link is required for this recovery flow.
- Account creation still requires confirmation when enabled in Supabase. Verify Site URL, allowed redirects, sender identity and actual delivery separately. Private beta membership remains separate from account creation.

## Deletion boundary

`POST /api/account/delete` requires a verified bearer, typed `DELETE`, and a current password checked again on the server. The body deliberately accepts no user ID or email. Deletion remains available without beta membership or a local record-owner binding.

1. Authenticate the bearer and reauthenticate its exact account with a stateless client.
2. Insert an account-deletion marker and disable beta admission. Snapshot writes (including legacy direct writes) and new storage uploads use the same account lock and reject marked accounts.
3. Remove objects only underneath that authenticated user's prefix in `health-captures` and `health-record-media`, in bounded batches. Partial cleanup stays marked and can be retried.
4. Delete the Auth user only after storage is empty. Foreign keys remove snapshots, membership, chat requests and generation events. A trigger also removes user-specific usage and leases; aggregate global counts remain.
5. Pause device sync before the request. After confirmed success, remove only that account's active/local archived records, then sign out if the same account is still selected. Other accounts and unowned guest data are preserved. Failed remote deletion never clears local records. A failed local cleanup offers a separate retry.

Preserved copies of unreadable snapshots (`fuel.prototype.v1.corrupt-<ts>`, RECORDS-OVERWRITE-001) belong to the archive they were taken from. A copy made while an account is selected carries that account's encoded owner as its suffix, like `health.account.<owner>`; a guest copy has no suffix. The 3-copy bound and content dedupe apply per archive. `clearBrowserAccount` removes only that account's copies, by the same `:<userId>` suffix match as its other keys; a guest's and other accounts' copies stay (`src/platform/browser-records.ts` `corruptRecordsKey`/`corruptRecordsOwner`, `src/features/cloud/account-storage.test.ts`).

Offline device copies and downloaded exports are not remotely erased. The UI states this explicitly. A storage/provider outage can leave deletion marked and unfinished; the user can sign in and retry deletion, but cannot resume account uploads during cleanup.

Apply `20260929_account.sql` before `20260929_sync.sql`; `20260929_operations.sql` supplies generation-event cascade/retention separately. Server service credentials never enter the browser/native bundles.

## Evidence and limits

- Unit coverage: invalid bearer, missing typed confirmation, tampered target, wrong or mismatched reauthentication, owner path boundary, both buckets, cleanup interruption/retry; isolated password flow, expired code, wrong email, weak/rejected password.
- Browser coverage: recovery failure then success with no persisted session; full deletion failure preserves records, typed confirmation gates success; account switching archives original records and opens separate state.
- Native browser recovery runs the same code in the Expo component, including invalid-code retry. Physical-device email keyboard/clipboard behavior and actual SMTP deliverability require device/mailbox checks.
- No real user account is deleted by automated UI tests; deletion responses use fixtures.
