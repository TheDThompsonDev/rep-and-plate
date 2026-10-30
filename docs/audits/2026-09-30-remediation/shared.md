# Shared model and AI remediation

Implemented September 30, 2026. These are shared web/native and server changes; the root and native agents own the user interfaces and browser verification. Existing uncommitted product work was preserved. No deployment, database migration or account mutation was performed.

| Finding | Shared change | Evidence |
| --- | --- | --- |
| F06 | Meal reply text is generated from the same normalized component totals as its proposal card. Independent provider prose cannot contradict those totals. | `server/ai.test.ts`; live yogurt 215 kcal / 18.3 g protein / 33 g carbs / 0.4 g fat |
| F07 | Reviewed timed-activity proposals and manual records store title, date and minutes separately from strength sets. Acceptance is idempotent. Activities never change calorie targets or infer calorie burn. | `src/remediation.test.ts`; live 20-minute walk |
| F08 | Optional `profile.targetsConfigured` distinguishes generic initial numbers from chosen targets; the flag also travels to Spot. Fresh accounts start with false. | Schema round trips; root/native target editors |
| F09 | Built-in starters have no invented load or previous performance. A set cannot be recorded until its load is explicitly chosen; zero is an explicit valid choice. Existing saved sessions retain their original data. | Regression failed before fix; passes afterward |
| F10 | Eight starter exercises have concise technique cues and a primary-source guide link. Unknown custom names receive general setup guidance rather than an inappropriate variation's instructions. | `src/exercise-technique.ts`; sources below |
| F11 | Reordering preserves recorded sets, aligned loads/effort, and conversation exercise references. Optional per-set effort persists through schema and exercise-size changes. | `src/remediation.test.ts` |
| F12 | Current finished sessions reopen in place. Reopening history removes that exact entry from history, preserves its original start date, and archives the current finished session. Active sessions cannot be silently overwritten. | Reopen and duplicate-history regressions |
| F13 | UI conversion helpers keep stored pounds compatible with history/integrations while allowing kg entry and display. | 80 kg round trip and invalid-load boundaries |
| F16 | Repeating a meal copies its exact nutrition/portion while clearing batch/lot links. It neither consumes nor restores pantry or prepared portions. The new record explains this. | Repeat regression checks identity, stock references and schema |
| F18 | Capture messages persist their selected diary day; AI context totals use that day while actual today remains separate. An undated capture deterministically uses the selected day even when the model defaults to today. Explicit date language retains the model's reviewed date interpretation. | Selected-date unit tests and live historical yogurt/walk |
| F30 | A clear consumed-food statement cannot be redirected into a generic meal-versus-groceries question. For typed consumed food with no recognizable quantity, an invented provider serving is held for a portion question. | Unit reproduction plus real-provider peanut-butter capture |

## APIs for interface integration

- `src/domain.ts`: `repeatMeal(state, mealId, day?)`; optional `profile.targetsConfigured`, `profile.workoutUnit`; `Exercise.weightConfirmed`, `Exercise.setEffort`; `Message.captureDay` and activity review state; `AppState.activities`.
- `src/activities.ts`: `addActivity(state, {title,day,minutes,note})`, `resolveActivityProposal(state,messageId,accept)` and activity types/schemas.
- `src/workouts.ts`: `displayLoad(pounds, unit?)`, `storedLoad(value, unit?)`, `reopenWorkout`, `reopenHistoryWorkout`, `finishWorkout`, `moveWorkoutExercise`, `exerciseTechnique`. Reopened sessions persist `originalFinishedAt` through reload; finishing a correction restores that timestamp and clears the marker so historical training does not move to today.
- `exerciseTechnique(name)` returns `{title,cues:string[],source:{title,url}}`.
- `buildAIRequest(state,message,selectedDay?)` preserves actual `day` and separate `captureDay`; source message captureDay survives retry/reload.
- `server/ai.ts` exposes providerAnswerSchema, with a required nullable activity field for provider strict output and a backward-compatible optional stored-answer field.

## Boundary checks

Activity-only accounts are not fresh devices. Existing generic cloud comparison already protected them; a regression now proves first sync enters conflict rather than replacing that local activity. `prepareSnapshot` retains activities and review state. Backup summaries now include timed activities, workouts and body measurements so those copies are visible.

External agent connections retain their explicit existing projection and scopes: new activity titles and notes are not silently disclosed. A regression verifies that exclusion. The projection now includes the latest finished strength session before another session archives it, with timestamp/title deduplication and actual per-set loads. This fixes an existing omission within the already authorized workout scope.

Final integration review also fixed weekly Spot volume to use each performed set's actual load, including starter sessions whose unchosen default is zero. Historical workout corrections retain their original completion timestamp through a reload. A portion-only answer immediately following Spot's amount question preserves the preceding capture's explicit date; a new independent meal does not inherit that old date. Each case has a focused regression.

All additions are optional in stored version-1 schemas. Existing accounts and snapshots remain readable. Built-in starter changes do not rewrite performed work or saved history. Exact external integrations still receive pounds.

## Verification and live discoveries

- `evidence/shared-before.log`: three initially failing regressions for invented starter loads, selected capture date, and missing finished-session reopen.
- `evidence/ai-before.log`: initially failing canonical-nutrition and focused-clarification checks.
- `evidence/portion-before.log`: a provider-invented portion was demonstrably accepted before the deterministic portion guard.
- `evidence/shared-focused.log`: focused cloud/model/server tests. The root's final test run remains authoritative after integration.
- `evidence/shared-suite.log`: 367 shared/server tests passed across 59 files at 10:16 local time; other agents were implementing concurrently, so final aggregate verification is recorded by the root.
- `evidence/shared-live-before.json`: real provider proposals handled the new activity schema and decimal nutrition, but ignored the chosen historical date and invented two tablespoons of peanut butter. These failures led to deterministic normalization changes rather than more prompt instructions alone.
- `evidence/shared-live.json`: after fixes, all three live checks passed. `live-shared.ts` reproduces the small paid-provider smoke test using local server environment configuration without printing credentials.
- TypeScript compile passed at the integration boundary before the final narrow server normalization changes; the root runs final compile/build.

The passing live file predates only the cosmetic classification change that marks a held portion as `uncertain` for Spot's clarification presentation. Nutrition, date and no-mutation outcomes are unchanged; final unit checks cover that classification. Live smoke checks are not an accuracy benchmark. Date recognition and quantity recognition are conservative English text guards, not comprehensive language parsers; explicit ambiguous dates and photo portions still require review. No real phone, email delivery or human usability study was performed by this agent.

## Technique sources

Cues are concise paraphrases checked against primary sources, not generated individualized training prescriptions. The interface should retain source links and the option to ask a qualified trainer for a demonstration. Source pages were read September 30, 2026.

- [ACE: barbell chest press](https://www.acefitness.org/resources/everyone/exercise-library/5/chest-press/)
- [ACE: incline chest press](https://www.acefitness.org/resources/everyone/exercise-library/25/incline-chest-press/)
- [ACE: seated row](https://www.acefitness.org/resources/everyone/exercise-library/48/seated-row/)
- [ACE: triceps pressdown](https://www.acefitness.org/resources/everyone/exercise-library/3/triceps-pressdown/)
- [NASM: goblet squat](https://www.nasm.org/resource-center/exercise-library/goblet-squat)
- [NASM: dumbbell Romanian deadlift](https://www.nasm.org/resource-center/exercise-library/dumbbell-romanian-deadlift)
- [NASM: reverse-lunge instructions](https://www.nasm.org/resource-center/blog/squat-alternatives)
- [ACE: calf raises](https://www.acefitness.org/resources/everyone/exercise-library/51/calf-raises/)
- [Mayo Clinic: weight-training technique](https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/weight-training/art-20045842)
