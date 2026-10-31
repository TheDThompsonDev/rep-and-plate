# Workout remediation and independent review

R2-08, R2-10, R2-13 and R2-14 are implemented in shared workout operations and both clients. R2-05 also prompted correction of the web history surface.

## Result

- Workout conversation uses the selected lb/kg display unit, rounded consistently, while old records remain in canonical pounds.
- Rest uses a persisted absolute end time. Leaving Workouts, reopening the screen and reloading do not restart or lose the countdown. Finishing or starting another session clears it.
- A personal routine stores exercise order, names, target reps, set counts and optional prior-load references. Starting it retains completed history and begins with empty sets and unconfirmed loads. Removing a routine leaves actual sessions intact. Routine storage is optional and compatible with old backups; it remains inside the private workout snapshot.
- A visible action applies a confirmed load to the remaining unrecorded sets. Earlier actual loads/reps do not change. Deliberate zero means bodyweight.
- Full web history and recent-training counts use actual recorded sessions independently of the bounded AI context. AI requests still receive at most five sessions, eight exercises per session and ten sets per exercise. The diary can display larger valid imported histories.

## Failures that improved the implementation

The first five shared regressions failed against the previous operations, then passed after implementation. Additional history regression demonstrated that the old presentation helper clipped valid nine-exercise/twelve-set records; clipping now belongs only to the AI wrapper.

The 13-session UI fixture exposed a timestamp mismatch: the display normalized imported ISO dates to milliseconds, but correction compared raw strings. Correction now compares timestamp values. Both layouts reopen the oldest session and retain its actual sets.

Independent review found that confirming an unchanged load reference did not refresh the input draft. The reproduced bodyweight case left remaining load fields blank after confirming zero. Input identity now includes confirmation state. Review also found that recent-training counts still inherited AI size limits; they now use full-history records. The UI fixture checks 112 actual sets across five sessions, including a 108-set imported session.

An initial mobile run lost a load input during parallel source edits; the unchanged four-test rerun passed after the shared lane froze. HMR is a suspected cause, not a proven product diagnosis. That failure is retained. Final aggregate testing runs against stable source.

## Evidence and boundaries

- `evidence/workouts-red.log`, `workouts-green.log`: initial red/green shared tests.
- `evidence/history-bounds-red.log`, `history-bounds-green.log`: diary versus AI bounds.
- `evidence/workouts-browser-final.json`: older ISO timestamp correction failure, retained.
- `evidence/zero-load-red.json`: confirmed bodyweight display failure, retained.
- `evidence/workouts-browser-verified.json`: eight desktop/mobile workflow checks passed before the final aggregate suite.
- `evidence/full-web.json`: final aggregate includes the expanded recent-training assertion, elapsed-time navigation, reload, routine review/removal and older-history correction.
- The mobile saved-routine screenshot was visually inspected: prior-load reference, fresh-set explanation and Start/Remove actions fit the 390px dialog.

These are synthetic automated journeys and source review, not evidence of five human participants' satisfaction. Native hardware backgrounding and operating-system notification behavior remain separate device checks.

## Narrow compatibility/privacy challenge

The new routine/rest fields do not enter connected-assistant projections. An explicit projection regression includes private routine text and verifies it is absent from the external context. Existing exact-scope service tests reject ungranted operations and omit nutrition for pantry-only connections.

Optional `nutrition.goalsConfigured` clarifies existing numeric targets. Legacy snapshots without the flag are accepted; false or absent means defaults, not chosen targets. External consumers must honor that documented meaning. No new permissions, automatic sends or unreviewed writes were introduced.

Examined and dismissed: routine reuse logging old sets (fresh null arrays and unconfirmed loads); previous records overwritten by bulk load changes (only unrecorded sets change); timer reset on navigation (persisted end time); AI request growth after exposing all history (bounded wrapper retained).
