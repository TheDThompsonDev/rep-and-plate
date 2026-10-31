# Native persona friction remediation

Implemented in the existing Expo 57 / React Native interface. No deployment, account mutation, email delivery, package installation, or physical-device execution was performed. Existing unrelated working changes were preserved.

| Audit concerns | Native remedy |
|---|---|
| F02, F16, F18, F26 | Nutrition fields keep raw decimal text until Save. Nutrition now offers an offline manual meal form and Repeat meal with date/portion review. Repeat creates a separate intake record without pantry or recipe deductions. Selected day travels through message.captureDay to the shared request builder. Future dates are rejected. |
| F03, F08 | Guest setup explains device-only storage and backup options. Untouched targets are labeled samples at the point of use; saving chosen targets marks them configured. Target setup explains their origin rather than inventing a personalized prescription. |
| F04 | Native overview now explicitly says days with food logged, rather than suggesting meal-only totals count all activity. Shared activity records feed the broader review. |
| F06, F17 | Fix it opens a local editable estimate. Cancel preserves the original card; Save changes that pending card and replaces stale prose. No second AI request or intake occurs until explicit acceptance. Saved-meal correction replaces linked stale message prose as well. |
| F07 | Manual walking/cardio capture and reviewed AI activity cards. Recent activities show duration/date and support edit or confirmed removal. |
| F09–F13, F22, F28 | Starter loads require deliberate choice, including explicit zero. Compact aligned load/reps rows save atomically, with optional RPE. Users can jump between exercises, reorder or substitute unrecorded exercises, consult shared technique guidance, and use a visual rest timer. Units persist as lb/kg with canonical-pound storage. Finish reviews partial sets; current and historical sessions can reopen for correction using shared finish-time preservation. History shows performed loads/reps/RPE. |
| F14 | Grocery trip headings distinguish reviewed purchase date from capture date; a missing purchase date is not silently presented as a known purchase date. |
| F15 | Recipe name, yield, and selections survive the guided detour to Pantry. Add ingredient manually accepts known serving nutrition and available stock offline, then Return to recipe draft completes preparation. Recipe drafts are session state, not a promise of durable recovery after terminating the app. |
| F19, F20 | Planner exposes pantry-only versus shopping-supported and variety choices, applies shared generated-plan validation, and saves generated and edited plans as drafts automatically. Approval stays explicit. |
| F21, F29 | Food, Shopping, and Cooking & training sections reveal only relevant controls. Enum choices and list labels use readable names. All sections save together; optional defaults remain optional. Budget fields also preserve fractional text. |
| F23 | Date controls expose button roles and selected state; daily targets and Kitchen planning hero expose named button roles. Existing shared controls retain their accessible names. |
| F24 | Saving a private package label retains the barcode and opens its saved product in Scanner without re-entry. |
| F25 | Native support uses the shared user-supplied email default while preserving configured overrides. No message was sent; inbox delivery remains unverified. |
| F27 | Pantry prioritizes food matches/unknown quantities in a review queue and offers a package count × labeled servings calculator. Nonfood is excluded from this queue. |
| F31 | Mobile guide now describes automatic account saving, ownership confirmation, offline saving status, and manual backup/restore as recovery paths. Restore summaries include workouts, activities, and body measurements. |

## Verification

- `npm run mobile:check`: passed; [log](native-check.log).
- `npm --prefix mobile run lint`: passed with zero errors and the same nine pre-existing warnings; [log](native-lint.log).
- Fresh Expo web export: passed; [log](native-export.log).
- Full existing and new Expo-web browser suite: **23 passed, 0 failed/skipped/flaky**, 46.0 seconds; results in [native-suite.json](native-suite.json), final run starting 2026-09-30 15:43:30 UTC. New behavioral journeys cover decimal/manual/repeated intake, selected-day AI capture and local estimate correction, chosen kg loads and reopened sessions with RPE, editable walking logs, recipe setup through offline pantry entry, and backup replacement that rejects stale drafts and late planner results.
- [390 × 844 workout screenshot](native-workout.png) visually inspected. [Layout evidence](native-layout.json) measures both first-set inputs at y=567 with matching 49 px heights and a 390 px document width. Both inputs and Save are visible above the navigation bar. An earlier intermediate layout placed the first input at y=1028; controls/guidance were moved below the set rows before final verification.
- Existing workout tests were updated for intentional behavior changes: choose a starting load, save load and reps together, and confirm finish. Their persisted load/repetition assertions remain intact. Preference tests navigate the new sections and readable field names.

The initial development-server test attempt encountered duplicate Metro port ownership and timed out during page navigation. That attempt was stopped; a fresh static export served on loopback was used for the complete verification run. This was a test-server issue, not a hidden skipped product check.

Physical iPhone/Android keyboards, VoiceOver/TalkBack, actual camera/microphone behavior, background timer alerts, email handling, and signed binaries remain unverified. The rest timer explicitly describes itself as visual with no background alerts. This work supplies navigation/reordering and reusable starter/generated logging, not a claim of advanced automatic programming or individualized coaching.

## Replacement boundary follow-up

A late integration review found that same-owner backup replacement could retain the old in-memory recipe draft and accept an outstanding planner response after its sheet had closed. The added `mobile/e2e/draft-boundaries.spec.ts` reproduced both before changes: [native-boundary-before.json](native-boundary-before.json) records the old recipe title still present, seven generated meal fields reappearing, and the prior plan saved into the replacement records.

Record replacement now advances a provider scope before any asynchronous write, closes tools, clears capture/recipe/barcode drafts, and remounts local screen state. Old mutation closures reject commits from the prior scope. Planner commits also check mount state and the account epoch; account invalidation closes the planner. Manual backup restore uses the same replacement path as account restoration. The account tool intentionally retains its instance during the first guest-record ownership claim, so the existing successful-link feedback is preserved; explicit replacement still closes it. Failed replacement writes show a global notice even after the tool closes.

The final export log and full-suite report are regenerated after these changes and after the shared planner policy that removes provider-generated cooking/stock prose. Generated plans remain ingredient/portion schedules; user-written notes remain editable and preserved.
