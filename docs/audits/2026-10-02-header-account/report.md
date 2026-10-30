# Direct account access — October 2

The header icon previously navigated to the full You page, where authentication actions required finding the account section. It now opens a compact account panel with the current email and Sign out, or guest Sign in. Web also offers Create account. Profile and backup settings remain separate links within that panel.

The application owns the web account dialog; a small shared header context connects all five web surfaces to it. Native opens the existing Sheet and reuses QuickAccount. No credential, authentication, deletion, ownership, or synchronization contracts changed. Account settings still open the existing full panel. Web Escape/backdrop/Close restores focus to the opener and closing the menu retains the current route and composer.

## Evidence and review

- Red check could not find the new account dialog. A header-specific accessible name avoids ambiguity with the existing chat Account action.
- Web regressions cover all five headers, focus return, direct sign-in, visible sign-out, record preservation, reload after logout and failed upstream logout. Installed auth-js clears the local session even on upstream logout failure; preserving the existing welcome transition is intentional.
- Existing profile journeys now explicitly use the menu's View your profile action; their record, goal, receipt, workout and draft assertions remain.
- Native test fixes preserve the configured HTTPS connection fixture, scope Sign in to the active dialog, and check the durable owner archive for a seeded real weight entry during transitions. Intermediate failed runs remain in evidence.
- Semantic review: dialog focus and dismissal, route/draft continuity, no automatic uploads, existing auth epoch guards, account ownership, failed sign-out handling, retained profile/backups and both renderers. No new provider or credential storage.
- Screenshots for guest and signed-in panels at 390 and 1440 pixels are retained in evidence. The phone panels were visually reviewed; primary auth actions and both secondary links fit without scrolling.

Final checks and file hashes are recorded in `evidence/verification.json` and `evidence/source-manifest.json`.

Final results: 432 unit tests across 69 files; 344 desktop/mobile-width web journeys; 29 native Expo-web journeys; production build, native typecheck, native lint and diff check passed. Native lint retains nine existing warnings, and the production build retains its existing bundle warning.

## Limits

CYC run start failed at the existing 20,000-file / 128 MiB source fingerprint limit. Direct configured commands were run instead. Native browser verification uses Expo web, not physical iOS/Android. Live hosted authentication and deployment are not verified. Existing native lint and web bundle warnings remain. This change is local and uncommitted; no new push was requested. Working implementation awaits user acceptance.
