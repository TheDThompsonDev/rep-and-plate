# Shared nutrition remediation

Implemented R2-01, R2-02, R2-11 and R2-16. Original round-two audit evidence remains unchanged.

- **R2-01:** New manual meal inputs start blank and require deliberate values for all four nutrients. The UI explains known zero versus unknown and points unknown values toward a reviewed Spot estimate. Explicit zeros and fractional values remain valid. Existing records are not rewritten; this is not a partial-nutrition schema migration.
- **R2-02:** Unconfigured targets produce descriptive totals in Nutrition, shared Chat/detail summaries, You, local nutrition replies and weekly insight cards. Goal denominators, progress percentages and attainment judgments appear only after explicit configuration. AI guidance uses the existing `goalsConfigured` context flag. Connected-assistant nutrition projection now includes optional `goalsConfigured`, with a documented false/absent interpretation; scopes and non-nutrition fields are unchanged.
- **R2-11:** The generic uncertain-intent footer now says nothing has been added and refers to the existing question. It no longer questions whether a clearly established meal was groceries. Direct known-meal portion clarification remains specific. No additional live provider call was necessary; normalization regression uses the audited follow-up transcript.
- **R2-16:** Repeating a generic saved meal offers a positive portion multiplier up to100, an explicit Apply step and editable review before Save. Scaling always starts from the original portion, preserves decimal nutrition, scales component servings/nutrients and validates schema limits. Repeat retains estimate confidence, removes stock/recipe links and explains that pantry/prepared portions are unchanged. Invalid/unapplied amounts cannot be silently saved.

Shared API: `scaleMealPortion(meal, multiplier)` is a pure validated nutrition/component scaler. `repeatMeal(state, id, day = today(), multiplier = 1)` remains backward-compatible and returns a copied meal with no stock effects. Native agent received this contract before integration.

Narrow integration requests also completed: App workout replies receive the selected unit; AI-created workout state retains saved routines. Kitchen's `purchaseReceipts` filter now controls AI shopping trip counts while on-hand ingredients remain available to planning context.

## Verification

Before fixing, four unit regressions failed for unchanged scaled values, accepted invalid multipliers, sample-target judgments and the old generic footer. Two mobile browser regressions failed because manual inputs contained0 and no multiplier existed. These were product failures, not harness failures.

After fixing:

- 56 tests passed across `src/nutrition-round-two.test.ts`, insights, weekly review, connected-assistant context, server AI and server agent services.
- 26 desktop/mobile browser journeys passed across new nutrition regressions, date/midnight/history journeys and the earlier persona remediation suite.
- The configured-target nutrition ring case in `tests/flows.spec.ts` passed on desktop and mobile.
- `npx tsc --noEmit` passed after root resolved an unrelated in-flight workout compatibility error.
- `verify.ts` captured four UI screenshot/ARIA pairs in `evidence/`; the goal-free screen and portion review were visually inspected at390×844. No browser console/page errors were recorded.

Existing tests were updated only where deliberate input requirements changed: manual creation supplies all nutrients, choosing1900 calories checks the explicit target confirmation, and a target-percentage fixture marks its targets configured. A pre-existing insights suffix test was incorrectly nested inside a meal fixture helper; its closing brace was moved so that test actually runs at top level.

## Limits

The numeric goal values remain in stored state and external context for compatibility; false or absent `goalsConfigured` must not be treated as personalized targets. External consumers need to honor that documented metadata. Existing manually saved zero values cannot be distinguished retrospectively from intentional zeros and are preserved. Browser evidence uses synthetic records; it is not a second human study. Final full-suite verification belongs to the root agent. No commit or deployment was made.

## Full-suite follow-up

The first integration run exposed three outdated goal assertions: the You goal-edit journey now explicitly confirms its intended targets, while the two accepted-meal/example-exclusion journeys assert recorded protein totals and absence of a target progress bar. Product goal-free behavior was correct.

The connected planning journey refreshed immediately after saving preferences, then read IndexedDB once before hydration flushed the synchronous recovery journal. The journal is written at the action boundary and read by onboarding hydration; the test read helper only reads the durable store. The test still refreshes immediately, now verifies the restored preference in the real reopened form, then polls the durable copy. It does not wait for persistence before refresh or weaken the separate blocked-writer durability regression. No product code change was made for these failures.

All four affected journeys passed on desktop and mobile (8/8) with one worker. Output directory: `followup-browser/`.
