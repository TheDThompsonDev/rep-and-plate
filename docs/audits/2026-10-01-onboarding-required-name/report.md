# Setup choice order and required name

Implemented locally on web and native; user acceptance pending.

The setup options now run Food & meals → Movement & workouts → Groceries & dinner → A little of all three. The combined option remains selected by default. Your name is required, blank and whitespace-only names cannot continue, and surrounding whitespace is removed before saving. Shared validation runs before both account binding and completion. Saved names are used in Spot's greeting.

Account restoration needed a consequential consumer correction: a nondefault name previously made even an otherwise empty device count as local history. When a setup name exactly matches the account name, the existing first-sync restoration can continue. Different names, changed profile fields, tracking records and edits during a download continue to require review. Existing records and account archives are preserved; completed-user records are not migrated.

## Evidence

- Initial new browser regression failed on the old ordering (6.4 seconds).
- First focused pass: new ordering/name checks passed, eight legacy account fixtures failed at empty-name continuation.
- Second pass: 24/28; four account restoration checks exposed the name-only conflict. The focused sync regression reproduced conflict instead of saved, then passed after the exact-name exception.
- Final focused web onboarding/guide/account suite: 28/28. Sync unit suite: 8/8. Expo-web onboarding and account restoration: 5/5. Original record-preservation, account-switch, zero-upload and interrupted-restore assertions remain intact.
- Final configured unit/build/browser commands plus native types/lint: see evidence logs and verification.json for executed outcomes.
- Screenshot and visual-observation.json record the actual order, required field, blank/whitespace rejection and enabled continuation with a name. Screenshot was visually inspected.

## Review and limits

Reviewed the shared model, hook entry points, web/native callers and sync predicate against the requested behavior. No open implementation finding. The mandatory name reaches both profile writers; validation precedes side effects. Name matching alone cannot bypass the other fresh-device checks. Account identity/epoch protection remains in place.

CYC run startup refused at the preexisting CYC-ASSETS-001 source fingerprint bound (20,000 files/128 MiB). Configuration was unchanged. Direct configured checks were used; no managed-run completion is claimed. Native interaction was exercised through Expo web, not a physical iOS/Android device. No deployment or commit was requested.

Reusable finding pending acceptance: setup identity fields affect the first-sync empty-device decision; preserve account-restoration and conflict checks when tightening onboarding. Failure history is in docs/context/error-ledger.md, entry ONBOARDING-NAME-001.
