# Spot implementation

Spot is Rep & Plate's cute, expressive, absurdly theatrical companion: dinner plate in front,
weight plate behind. Food is never good or bad. A saved record earns a quiet
“Logged.” No guilt, streak pressure, unsolicited interruptions, or fake claims.

## Mapping and migration

- `ChatLayer.tsx` and native `ChatScreen.tsx` already own multimodal capture.
  Keep their photo, barcode, voice, retry, and review tools; introduce Spot here.
- `ai-contract.ts`, `ai-client.ts`, `domain.ts`, and `server/ai.ts` share validated
  proposals and persistence. Add reviewed workout captures without replacing an
  active workout, and retain explicit meal confirmation.
- Shared `features/spot` owns character states, onboarding copy, comeback rules,
  and weekly calculations. Platform renderers own imagery and accessibility.
- Navigation keeps existing destinations and deep links. Spot is the Chat icon;
  the central Scan action opens barcode scanning directly on every screen.
  The header uses a separate leaning pose with his elbow on the final “e”.
- First launch uses a dedicated welcome, four-part Spot introduction, account
  creation/sign-in, personal setup and completion before the app is mounted.
  The tour is skippable and replayable; it is no longer an inline chat card.
- Nutrition/workout empty states and weekly summaries use Spot selectively.
- Character visibility is an optional saved preference. Text and actions remain
  usable when imagery is disabled or fails. Motion respects system preferences.

## Scope boundaries

No push notification system exists, so this does not introduce one. Catch-up
uses the existing text/image flow; it must not invent dates or silently backdate
records. Multi-image bulk reconstruction and automatic historical import remain
separate work. A model's confidence is not permission to overwrite records.

## Asset library

The approved chaos direction now appears before the first log. Four skippable
onboarding screens introduce Spot through a press conference, pasta investigation,
leg-day melodrama and the recovery department. Practical food/workout guidance
stays beside the joke. Shared entry-flow copy lives in `features/onboarding/model.ts`; scene
identity lives in `features/spot/scenes.ts`. Both renderers use the same five
native-resolution assets, copied into web/public and the native bundle.

Food and workout empty states use compact contextual scenes. Completed workouts
get Spot's press conference after the existing save condition succeeds. The
optional mood picker includes four theatrical scenes, and shared AI voice guidance
uses the same self-directed absurdity while keeping estimates and confirmations
clear. No timer, forced popup or inferred emotional state is introduced.

Existing web users can replay via Chat menu → Meet Spot. Native users can replay
via You → Meet Spot. Replay is transient presentation state; drafts, completed
onboarding, illustration preferences and records are retained. Changing between
introduction and regular greeting remounts the presentation to start on slide one.
Failed art collapses out; text, Skip, Back and Next remain available. Native scene
images use explicit square dimensions to avoid intrinsic-height layout inflation.

The reaction pack adds peeking, comically tired, burger-happy and sunglasses poses.
Onboarding, return greetings, empty food/training screens and confirmed saves use
these reactions. Chat's “Another Spot mood” cycles twelve local greetings without
changing the draft or records. Saved-log captions appear only after existing save
conditions succeed. Character preferences and missing-art fallbacks remain intact.

The humor belongs to Spot: tiny shoes, big feelings, exaggerated fatigue. Food,
bodies, missed days and performance are never the punchline. The shared voice
guidance also gives AI replies permission for an occasional short aside while
keeping questions and confirmations clear. No timers, unsolicited popups or
automatic mood inference. `spot-moods.html` / `spot-moods.png` provide an editable
and shareable caption sheet for future promotional use.

`public/images/spot/spot-atlas.png` and `mobile/assets/spot/spot-atlas.png` contain
the same six-pose atlas generated with the built-in image tool from the supplied
Spot brand reference. Columns/rows: neutral, welcome, Rep; curious, satisfied,
Rep with towel. Visual mappings are centralized, not copied into each screen.
Use the library for product interactions and future marketing derivatives.

The exact prompt, cell map, and file paths are in
[`public/images/spot/README.md`](../../public/images/spot/README.md).

## Verification — September 28, 2026

- Dedicated entry-flow correction: 247 unit/domain/server checks and all 200 web
  browser checks passed. Native full run passed 10 of 11 checks; the remaining
  test expected the retired inline introduction. Updated it to open the full
  tour from You, then both native Spot checks passed. Account creation,
  confirmation-required sign-in, owned-record rejection, sign-out, reload,
  replay preservation and failed-save retry have browser regressions. Web build,
  native typecheck, native lint (zero errors, ten existing warnings) and all
  iOS/Android/web exports passed. Inspected decoded art and layouts at web
  320/390/1100px and native 320/390px. Supabase settings confirm email signup is
  enabled and confirmation is required; email delivery and physical-phone
  behavior were not exercised. CYC's source fingerprint limit still prevents
  controller startup; direct project checks were used.

- In-app personality follow-up: 246 unit/domain/server checks passed. The full
  web suite passed 190 of 192 checks; the two failures referenced retired intro
  copy. After updating that expectation, all 24 flows checks passed. Ten focused
  web Spot checks passed, including first-use completion, skip, back, replay,
  missing art, draft preservation, persisted preferences and reviewed saves.
  Web production build, native typecheck and native lint passed (the same ten
  pre-existing lint warnings). All three native Spot journeys passed, including
  320px onboarding, completed and skipped introductions, replay with an unchanged
  draft/records, disabled scene art, confirmed workout capture and reload.
  Native Metro had stopped reliably serving bundles; restarting the same local
  preview with a clean cache restored sub-second reloads after the initial build.
  Web 320/390/1100px and native 320/390px onboarding screenshots were inspected.
  No physical-device or live-AI test.
  CYC startup hit the source fingerprint size limit; checks ran directly without
  changing its protected verification configuration. No managed-run completion
  is claimed. Screenshots: `spot-onboarding-web-*`, `spot-onboarding-native-*`.

- Story-scene follow-up: six new text-free 1254px square scenes and six 1080 ×
  1350 share cards, based on the supplied cheesecake chat example. Gallery lives
  at `/spot-studio/stories/index.html`, linked from the original studio. Desktop
  and mobile browser checks passed for filtering, caption copying, scene/card/ZIP
  downloads, source dimensions and 320px overflow. Card and gallery screenshots
  visually inspected; archive integrity verified and web build passed. These
  creative assets do not change automatic app replies or native behavior.

- Expanded library: twelve native-resolution transparent poses, twelve 1080px
  caption cards, and a ZIP with captions, prompts and source dimensions. The
  gallery is at `/spot-studio/index.html`; its source is `public/spot-studio`.
  Web and native renderers share the new captions and support every new pose.
  Six web Spot checks and two Expo-web Spot checks passed; native typecheck
  passed and lint retains only the same ten pre-existing warnings.
  Two gallery browser checks passed, covering category filters, copied captions,
  individual and ZIP downloads, all twelve full-size images and 320px overflow.
  Web production build passed. ZIP integrity and all exported dimensions verified.

- Personality/reaction follow-up: 14 web browser checks, six Expo-web native-app
  checks and 16 AI/capture tests passed. Mood changes preserve drafts and records;
  disabling illustrations hides the new reaction art. Web production build and
  native typecheck passed; native lint has only the same ten pre-existing warnings.
  Inspected both renderers at 320px and 390px and corrected atlas row boundaries
  to keep neighboring poses out of frame. No physical-device test was performed.
- Wordmark/navigation follow-up: web build and native TypeScript check passed;
  38 web browser checks and six native-app browser checks passed. Visually checked
  the leaning wordmark and restored Scan action at 320px and 390px on both renderers,
  plus desktop web at 1440px. Native checks run through Expo web, not a physical device.
  Screenshots: `spot-brand-web-390.png` and `spot-brand-native-390.png` in this folder.
- Web production build and native TypeScript check passed.
- All 229 unit/domain/server tests passed, including reviewed workout capture,
  duplicate prevention, historical meal dates, and weekly calculations.
- The 184-test web regression suite exercised desktop and small mobile layouts.
  After correcting visit metadata and updating expected labels for the new UI,
  all 52 tests covering affected navigation, backup, workout, weekly review, and
  Spot flows passed. The remaining tests passed in the broader run.
- Native capture, barcode, workout, backup and auth tests passed. New native
  Spot tests cover introduction, Rep capture, confirmation, reload, weekly view,
  disabled illustrations, comeback and preserved drafts.
  The final native suite passed all seven tests.
- Android, iOS and web production exports passed with the bundled atlas.
- Native lint has no errors; ten pre-existing warnings remain in other modules.
- Browser screenshots were inspected. An Expo development-server bundle stall
  was resolved by restarting Metro with a clean cache; reload tests then passed.

Earlier checks did not include deployment, signed store builds, or physical iPhone/Android testing.
Provider behavior is covered by schema/domain tests and mocked browser responses;
the new model prompt has not been smoke-tested against a live provider.

## Capture details

Spot never silently overwrites an active workout. A reviewed completed workout
goes into history, exactly once per proposal. Fix it retires the old proposal
before asking for corrected details. Explicit past meal dates survive acceptance.
Visit timestamps live in device-only metadata, separate from records and backups.
The illustration preference is saved with the app state; all tools retain text
labels and work with a plate-icon fallback when illustrations are off or missing.
