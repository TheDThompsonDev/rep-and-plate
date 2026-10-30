# Goals, weight tracking and immediate account access

Implemented locally on web and native. User acceptance pending.

## User flow

Name/focus setup now leads to a dedicated Your goals step. Users choose lose/gain/maintain weight, build strength or healthier habits, choose lb/kg, provide current/target weight when relevant and choose daily, weekly or self-directed check-ins. Unknown measurements can be added later; the entire step can be explicitly deferred. A submitted starting weight becomes a real dated measurement, saved together with the goal at completion. No example data or calorie target is inferred.

The top-right profile icon retains its existing navigation to You. Sign in/Create account or direct Sign out now appears immediately under the user's name, above the weight log. Existing users can Set your goal here. Goal edits use the latest real measurement for target direction validation, and can change cadence/units without duplicating measurements. Goal-unit changes initialize the measurement form coherently; mixed-unit history is converted for comparison.

When the chosen check-in is due, the main app offers Log your weight. The prompt opens the profile log and clears after a new dated measurement. Weekly/daily timing uses measurement dates, not browser visits. These are in-app prompts, not push notifications. Latest recorded change and dated entries remain available. Existing duplicate-date rules prevent silently replacing a measurement; users can edit that entry instead.

Spot's request context now includes the chosen fitness goal and up to 30 recent real measurements. The validated contract retains the fields. The prompt respects the chosen direction and explicit units without assuming weight loss, presenting user targets as medical recommendations, claiming weight capture through chat, or treating generic macro defaults as configured targets. No live-provider personalization outcome is claimed.

## Checks and recovery

- RED: shared feature module absent; browser journey then failed on missing goals heading (6.4 seconds). Shared goal/measurement validation and the new renderer completed the pin.
- First renderer follow-up exposed select labels containing option text. Explicit accessible select labels corrected the real journey.
- Expanded focused web suite initially passed 31/32; a record read immediately after reload queried IndexedDB before hydration replayed the save journal. The failure snapshot already showed restored target 77. Three unchanged desktop repetitions gave 5/6; the final test waits for the restored target before checking durable records, preserving the exact expected values. The app still journals at the action boundary.
- Native initial pass 4/6: quick controls and the open Cloud sheet shared Sign in/out labels in Expo web. Fixtures target the active sheet actions using the repository's established selection convention; no product actions or record assertions were removed. Expanded account-security fixture required the same correction.
- Lint rejected synchronizing form unit through an effect. A unit-keyed measurement component replaces it on both renderers without changing lint rules.
- Native profile confirmation now writes the same account onboarding marker as web, with identity checks, preserving setup across reload.
- First full web suite passed 312/322; ten account/security failures came from whole-page Sign in/Create account selectors matching both the quick profile actions and open account dialog. The shared fixture and signup action now target that named dialog; upload, deletion, conflict and preservation assertions remain unchanged. The failed log is retained as browser-initial.log before final verification.
- Final configured unit/build/browser and native type/lint/journey outcomes are recorded in evidence/verification.json and their logs. The current source-manifest binds the reviewed revision.

## Review and retained learning

Reviewed goal schema compatibility, name/goal completion boundaries, same-day conflicts, retry IDs, original meals/macros, goal-unit propagation, legacy profiles, account archives, auth-event races, modal actions and native confirmation. New optional profile fields keep existing records readable; no forced migration or setup replay occurs for completed users. Skipping the new step leaves existing goal/weight data unchanged. Profile account actions reuse existing authentication and explicit owner confirmation; sign-out preserves records and does not modify snapshots.

React review: effects unsubscribe and ignore stale session reads; form validation catches rejected drafts; provider imports remain deferred on web; state updates compose against the existing durable record setter. No open implementation finding remains.

Failure history is retained in docs/context/error-ledger.md under FITNESS-SETUP-001. Candidate lesson pending user acceptance: onboarding body data is only useful when it reaches progress, regular logging and the validated conversational context; tight first-sync and record-boundary checks remain essential.

## Limits

CYC managed startup hit the existing source-fingerprint bound (20,000 files/128 MiB). The configured commands were run directly; no engine/config changes or managed completion are claimed. Native interactions were exercised through Expo web rather than physical devices. Existing nine native lint warnings and the build's existing bundle-size warning remain. No deployment or commit was requested.
