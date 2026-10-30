# Phone-testing deployment — September 30, 2026

User explicitly requested deployment of the current changes for testing on their phone. The existing production project was updated; invitation/account restrictions were preserved.

| Item | Result |
|---|---|
| Phone browser URL | https://repandplate.com |
| Target/status | Production / Ready |
| Deployment | dpl_5ikQczm3izpMKu3QYx6MNg163SjZ |
| Immutable URL | https://dannys-health-nk1dywnjv-dthompsondev.vercel.app |
| Source | Verified working-tree snapshot; no new Git commit |
| Prior production | https://dannys-health-q1vcyynm0-dthompsondev.vercel.app |

All 128 changed source/test files in the remediation manifest matched their verified hashes before deployment. The API bundle was rebuilt, then Vercel built the frontend and bundled API remotely using production settings. Deployment used `--prod --skip-domain`; invitation/app/API checks passed before `vercel promote` switched the production site. Inspection of repandplate.com resolved to this deployment.

The hosted database matched the configured production Supabase project. The missing additive `20260929_agents.sql` migration was applied. Three tables enforce RLS and deny browser roles; both RPCs are restricted to the server role. Synthetic transaction checks covered creation, stale revision rejection, owner collision rejection and separate admission. Test rows were rolled back. Migration hash and checks are retained in `database.json`.

## Live verification

- `staged.json`: existing invitation unlocks HTML/API; authenticated status still requires an account; cookie-free status remains protected. Public native bootstrap remains available by design.
- `phone-smoke.json`: fresh isolated Chromium context at 390×844, no route mocks. Invitation, onboarding, goal-free totals, blank manual nutrients, decimal repeat scaling, saved routine, Kitchen access, navigation and reload persistence passed. No page errors or horizontal overflow. `phone-routine.png` was visually inspected.
- `account-smoke.json`: a real synthetic Supabase account signed in, passed beta authentication, created a nutrition-only connection, authenticated with its scoped token, and lost access immediately after revocation. The synthetic account and cascading data were removed. No emails or user records were touched.
- `error-scan.log`: deployment-specific error-level log query over the last 20 minutes returned no entries. This is a bounded scan, not ongoing monitoring.

Initial verification mistakes are retained: the staged check incorrectly expected public `/api/cloud/config` to require an invitation; the existing native bootstrap exception was confirmed in source and the check corrected. The phone check initially expected a populated-day label on an empty diary; the actual goal-free empty-state copy was confirmed before correcting that assertion. Neither required a product change.

## Testing on a phone

Open repandplate.com in Safari or Chrome, enter the existing invitation code if prompted, and sign in normally. Reload an already-open tab to load the updated build. Guest changes stay in that browser; use your account for account-backed records.

This deploy serves the responsive web app and API. Separate signed iOS/Android app distribution was not performed. Real physical-phone camera/microphone behavior and confirmation/recovery email delivery still need direct testing. The earlier remediation report's undeployed status describes the earlier handoff; this record supersedes it for the web/API release.

No invitation codes, account tokens or database credentials are included in these evidence files.
