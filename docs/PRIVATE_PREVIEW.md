# Private preview

Hosted deployments show a branded coming-soon page until an invited visitor
enters the shared access code. The server-side gate covers the app, direct asset
URLs, and API endpoints. The hosted API independently validates the preview
cookie before its existing account and beta-membership checks.

## Configuration

- Set `PREVIEW_ACCESS_CODE` in Vercel Production and Preview environments to a
  cryptographically random secret of at least 20 characters (for example,
  `node -e "console.log(require('node:crypto').randomBytes(24).toString('base64url'))"`).
  Never commit this value or give it a `VITE_` / `EXPO_PUBLIC_` prefix.
- Vercel deployments are locked by default. A missing/short secret keeps the
  splash visible but denies entry. Redeploy after changing environment variables.
- Local development stays open unless `PRIVATE_PREVIEW=on` or a code is set.
- When deliberately launching publicly, set `PRIVATE_PREVIEW=off` and redeploy.
  Existing API account/membership authorization remains in place.

## Invited access

Open the domain, expand **Have an invitation?**, and enter the code. Access lasts
seven days in that browser via a signed, HttpOnly, Secure, SameSite cookie. The
code stays on the server. Visit `/preview` and choose **Leave preview** to lock
that browser again. Rotating the code and redeploying invalidates existing cookies.

The invitation gate also covers native API requests: a native client without
the preview cookie cannot access the hosted API while the gate is enabled.
Local native development services are unchanged. This gate does not modify
Supabase sign-up configuration or replace its row-level security policies.

The code should be shared privately with trusted testers. Login throttling is
best-effort per running instance, so a long random code is required. The splash
and protected responses are not cached; robots receive a disallow rule and
responses include no-index headers. Existing copies of app assets already saved
on a visitor's device cannot be retracted. Older Vercel deployment URLs must
remain protected by Vercel's deployment protection; this code gates new builds.

## Verification

`npm test -- --run server/preview-gate.test.ts` covers missing secrets, direct URL
and API protection, code checks, origin/size limits, cookie security, expiry,
rotation, logout, and throttling. `npm run build` includes the middleware in
type checking. Test both signed-out and invited browsing on the deployed domain.

On September 28, 2026, all 246 unit tests and the production build passed.
Desktop (1440px) and mobile (390px) browser checks covered the splash, incorrect
code, blocked API/assets, successful entry, persisted access on refresh, and
logout. The staged Vercel deployment also passed real code/cookie validation
through both routing middleware and the hosted API.
The same desktop/mobile browser flows then passed on `https://repandplate.com`
after promotion. The www domain redirects to the protected primary domain.
