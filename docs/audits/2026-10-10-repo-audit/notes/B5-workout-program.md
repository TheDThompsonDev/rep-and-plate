# B5-workout-program — F2 (fitness setup does not drive Workouts)

Finding: F2 (section 2). Treated as high risk (product feature, persisted schema change, both platforms).

## Plan (scout)

Goal: the fitness setup collects training days, equipment and experience; a deterministic `trainingProgram` is saved on the profile; Workouts leads with "Your week" and the next session on web and native; the AI request carries the answers.
Done when: (1) Vitest proves derivation, equipment filtering, skip-preserves-originals and legacy-snapshot parse; (2) `tests/fitness-setup.spec.ts` saves a program through onboarding and sees it on Workouts; (3) `tests/workout-surface.spec.ts` still passes 12/12 and shows the single setup entry point; (4) a new program journey starts, finishes and advances the next session; (5) `npm --prefix mobile run check` and lint pass; (6) `npx tsc --noEmit` and `npx vitest run src server` pass for files I own.

Approach: extend. `applyFitnessSetup` (src/features/progress/fitness-goal.ts:95) already saves the goal and starting weight from one draft; the onboarding step, the You editor and native all call it. Adding program fields to the same draft and deriving the program inside `applyFitnessSetup` keeps every consumer on one path. `workoutPlans` (src/workouts.ts:82) stays the source of sessions; `startPlan` (src/workouts.ts:122) is generalized to a template start so program sessions use the same unconfirmed-load start (`weight: 0, weightConfirmed: false`).

Context: USER_READINESS "One personal training week" (persisted chosen program/schedule, beginner completes a first session without assumed loads). Ledger NUTRITION-SETUP-001: native must import only the data module, never a renderer that pulls CSS — all program logic lives in `src/features/progress/training-program.ts`. PERSONA-20260930 / ticket 16: no automatic load escalation, no recovery claims; loads are chosen by the user. Wave A added `stateMigrations` (src/domain.ts:380); the schema change is additive and optional, so version stays 1. No ledger entry about programs or Workouts landing.

Trade-offs decided:
- Program sessions are derived once and stored (not recomputed on render) so the week the user confirmed stays stable if starter plans change later; re-saving the setup re-derives.
- "Bodyweight" is always part of the equipment set; unchecked equipment means bodyweight substitutes from a small fixed table, so a week is always startable. Substitutes are named exercises with no technique guide (exerciseTechnique falls back to its generic "ask a trainer" cues).
- Experience only changes set count (new → 2 sets, otherwise 3). It never changes loads or reps; no progression.
- Next session = count of finished sessions whose title matches a program session since the program was saved, modulo the week length. Deterministic from records, no clock.
- `trainingDays: ''` in the draft means "leave the training week as it is" (onboarding skip → none; editor → existing program kept). Removal is an explicit "Remove training week" action on Workouts. This protects the You editor (which did not pass the program) from silently deleting a program.

Change:
- `src/features/progress/training-program.ts` (new): schema, labels, equipment table, `deriveTrainingProgram`, `nextProgramSession`, `startProgramSession`, `programEquipmentText`, `clearTrainingProgram`.
- `src/features/progress/fitness-goal.ts`: draft gains `trainingDays`, `equipment`, `experience`; `fitnessDraft(goal, program)`; `parseFitnessSetup` validates; `applyFitnessSetup` derives and saves `profile.trainingProgram`.
- `src/features/progress/FitnessSetup.tsx` + `fitness-setup.css`: optional "Your training week" fields; `program` prop.
- `src/domain.ts`: `profile.trainingProgram: trainingProgramSchema.optional()` (schema region only).
- `src/workouts.ts`: `startSessionTemplate` used by `startPlan`.
- `src/WorkoutPage.tsx` + `workouts.css`: selection model (program session or plan); "Your week" landing; entry point when no program; `onSaveFitness` prop renders FitnessSetup in a Modal.
- `src/App.tsx`: pass `onSaveFitness` to WorkoutPage (props only).
- `src/YouPage.tsx:1078`: pass `program={state.profile.trainingProgram}` (one prop, outside listed scope, recorded here).
- `src/features/onboarding/draft.ts`: optional program fields with defaults so old drafts parse; `Onboarding.tsx` ready-step summary.
- `src/ai-contract.ts` + `src/ai-client.ts`: `context.trainingProgram` (answers only).
- `src/features/workout-planning/WorkoutBuilder.tsx`: default equipment text from the program (context only).
- `mobile/src/FitnessSetup.tsx`, `NativeWorkout.tsx`, `Onboarding.tsx`, `screens.tsx`, `KitchenTools.tsx` (builder default equipment): parity.
- Tests: `training-program.test.ts` (new), `fitness-goal.test.ts`, `tests/fitness-setup.spec.ts`, `tests/workout-surface.spec.ts`, `tests/training-program.spec.ts` (new), `mobile/e2e/fitness-setup.spec.ts`.
- Docs: `docs/context/onboarding.md` paragraph.

Keep consistent: `mobile/src/store.tsx:256` `saveOnboardingProfile` → applyFitnessSetup (gets the program for free); `src/features/onboarding/Onboarding.tsx:75` same; `src/YouPage.tsx:1078` and `mobile/src/screens.tsx:514` profile editors (must pass `program` so re-saving keeps it); `server/http.ts:177` parses `aiRequestSchema` (optional field passes); `tests/workout-surface.spec.ts` names ("Start workout", "Lower Body ~35 min", `.workout-preview`) must survive; `completedWorkoutHistory` title filter (`sample|demo|example`) — program titles avoid those words.

Test: red-first Vitest for the shared model; the Playwright specs above; `npm --prefix mobile run check`, `npm --prefix mobile run lint`; `npx tsc --noEmit`.

Open: none that changes the solution.

## Challenge pass (before build)

- Could a saved program misrepresent effort? Sessions carry rep targets and set counts only; loads start unconfirmed exactly like plans, and the copy says "starting targets you confirm". No "example" wording on program sessions; no PR/record wording anywhere.
- Could legacy snapshots break? The field is optional and nested under `profile`; `parseStoredState` of a version-1 snapshot without it is unchanged; a snapshot with a malformed program is rejected as `invalid` (same as any schema failure), tested.
- Could onboarding drafts from before this change fail to parse? New draft fields have zod defaults; tested by parsing an old-shape draft.
- Could the You editor delete a program? Only an explicit non-empty `trainingDays` replaces it; `''` preserves. Tested.
- Could the next-session counter mis-advance? It only counts finished sessions with a program title on or after the program's start day; starter plans and AI sessions do not advance it.
- Cycle risk: `domain.ts → fitness-goal.ts → training-program.ts → workouts.ts → domain.ts`. `workouts.ts` and `training-program.ts` use imported bindings only inside functions, so module init order is safe; verified by Vitest importing each module first and by the browser journey.

## Build log

- RED: `npx vitest run src/features/progress/training-program.test.ts` failed at import (module absent). Built `training-program.ts`; two assertions were then wrong in the test, not the code: a regex matched the label "Bodyweight", and `finishWorkout(workout, <past date>)` produced `finishedAt < startedAt`, which `completedWorkoutHistory` correctly drops. Fixed the assertions (keys of each exercise are exactly name/sets/target; finish with the default clock). 19/19.
- Cycle found by the first full Vitest run: `vite.config.ts` bundles `server/http.ts -> ai-contract -> fitness-goal -> training-program -> workouts -> domain -> ai-contract`, and `domain.ts` reads `chatActionSchema` at top level, so the new runtime edge threw a TDZ in the bundled config. Fix: `workoutPlans` moved to a leaf `src/workout-plans.ts` (re-exported from `workouts.ts`, no consumer change) and the two helpers that need `workouts.ts`/history (`nextProgramSession`, `startProgramSession`) moved to `training-week.ts`, imported only by renderers.
- Type narrowing: the draft's `equipment` is `EquipmentChoice[]` (bodyweight is implied, never chosen). The other agent's new `src/features/onboarding/useOnboarding.test.ts` fixture needed the three draft fields; one-line fixture edit, recorded here. Its pre-existing unused `ONBOARDING_KEY` import is theirs.
- RED (browser): `tests/training-program.spec.ts` failed after finishing a session because the hero still showed Session 1; the selection state was only re-derived when the program object changed. Replaced the effect with a derived selection keyed on a basis string (program answers + next index), which also removed a `react-hooks/set-state-in-effect` warning.
- Second browser failure was my test: a finished session reopens in its saved view after reload (existing behavior), and the week leads with Session 2 after "Choose your next workout". Test corrected.
- Visual pass at 320px in the browser pane showed that saving from Workouts with no goal opted the person into weekly weigh-ins (default cadence). Setup from Workouts now starts with cadence "When I choose" when no goal exists (web and native); the select remains editable.

## Change and mechanism

- `src/features/progress/training-program.ts` (new, data only): `trainingProgramSchema` (daysPerWeek 2-6, equipment incl. implied bodyweight, optional experience, `startedOn`, 2-6 sessions of name/target/sets), `deriveTrainingProgram` (week template per day count; each starter exercise kept when its equipment is available, otherwise the first available substitute from a fixed table ending in a bodyweight movement; sets = 2 for new/unstated, 3 otherwise; minutes scaled for 2 sets), `programAnswers`/`trainingAnswersSchema` for AI context, `programEquipmentText`, `clearTrainingProgram`. No load, weight or record field exists in a program.
- `src/features/progress/training-week.ts` (new): `nextProgramSession` counts finished sessions whose title is a program title and whose finish day >= `startedOn`, modulo week length; `startProgramSession` builds `Exercise`s with `weight: 0, weightConfirmed: false` and empty sets, via `startSessionTemplate`.
- `src/workouts.ts`: `startSessionTemplate` extracted from `startPlan` (same history push, same empty sets); `startPlan` delegates. `workoutPlans` re-exported from `src/workout-plans.ts`.
- `src/features/progress/fitness-goal.ts`: draft gains `trainingDays`/`equipment`/`experience`; `fitnessDraft(goal, program)` pre-fills; `parseTrainingAnswers` validates; `applyFitnessSetup` sets `profile.trainingProgram` only when `trainingDays` is non-empty.
- `src/domain.ts:121`: `trainingProgram: trainingProgramSchema.optional()` under `profile`; version stays 1.
- `src/features/onboarding/draft.ts`: the three fields with zod defaults so pre-change drafts parse; `Onboarding.tsx` ready step summarizes the week.
- `src/features/progress/FitnessSetup.tsx` + CSS and `mobile/src/FitnessSetup.tsx`: optional "Your training week" fieldset (days select, then equipment checkboxes + experience select), `program` prop.
- `src/WorkoutPage.tsx` + `workouts.css`: hero selection is a program session or a starter plan; with a program the landing leads with "Your week", the next session ("Next up"), the hero copy "Starting targets you confirm...", "Start this session", exercises with "Choose load - sets x reps", then "Starter plans" and the existing recent-training section; without one, today's landing plus one "Set up your training week" button and hint. The setup Modal renders the shared `FitnessSetup` and an explicit "Remove training week". Active-session resume and browse behave as before.
- `src/App.tsx`: one new prop `onSaveFitness` on `WorkoutPage` (same `applyFitnessSetup` path as You). `src/YouPage.tsx:1078`: `program` prop so the goal editor pre-fills and preserves the week.
- `src/ai-contract.ts` / `src/ai-client.ts`: `context.trainingProgram` carries answers only (days, equipment, experience). `WorkoutBuilder.tsx` (web) and `KitchenTools.tsx` (native builder) default the equipment field from the program.
- Native: `NativeWorkout.tsx` leads with "Your week" cards (next up first, "Start Session N - ..."), "Edit training week"/"Set up your training week" opening a Sheet with the shared form and "Remove training week"; `screens.tsx` passes `program`; `Onboarding.tsx` ready summary. `store.tsx` `saveOnboardingProfile` already calls `applyFitnessSetup`, so native onboarding saves the program with no store change.

## Consumers checked

`src/features/onboarding/Onboarding.tsx:75` and `mobile/src/store.tsx:256` (both call `applyFitnessSetup`; verified by web and native onboarding journeys), `src/YouPage.tsx:1078` and `mobile/src/screens.tsx:514` (profile editors now pass `program`; re-saving the goal keeps the week, asserted in `tests/fitness-setup.spec.ts`), `server/http.ts:177` (`aiRequestSchema` is shared; optional field accepted, asserted in `fitness-goal.test.ts`), `tests/workout-surface.spec.ts` existing names and `.workout-preview` structure (12/12 before, now 14/14 with the new test), `completedWorkoutHistory` title filter (program titles contain none of sample/demo/example), `src/features/onboarding/useOnboarding.test.ts` (other agent; fixture extended), onboarding specs (`onboarding`, `onboarding-resume`, `onboarding-nutrition`: 20/20).

## Commands and results (final file state)

- `npx tsc --noEmit`: clean.
- `npx vitest run src server`: 79 files, 526 tests passed (includes `training-program.test.ts` 9 tests, `fitness-goal.test.ts` 4).
- `npm --prefix mobile run check`: passed. `npm --prefix mobile run lint`: 0 errors, 0 warnings.
- `npx eslint src/WorkoutPage.tsx ...`: no warnings on changed lines (two pre-existing warnings remain in `ExerciseAdjustmentDialog`, lines ~1462/1477, untouched).
- `npx playwright test tests/training-program.spec.ts tests/workout-surface.spec.ts tests/fitness-setup.spec.ts --workers 2`: 14 passed (desktop + mobile), 20.0 s. Earlier runs in this session were red for the reasons in the build log.
- `npx playwright test tests/onboarding.spec.ts tests/onboarding-resume.spec.ts tests/onboarding-nutrition.spec.ts --workers 2`: 20 passed.
- Native: Metro started by me with `CI=1 npx expo start --web --port 8081 --clear`, bundle warmed with one request (10.6 s, 9.5 MB), then `npx playwright test --config mobile/playwright.config.ts e2e/fitness-setup.spec.ts --workers 1`: 1 passed (6.9 s), covering days/equipment/experience choice, saved program, "Your week" on the Workouts tab and starting Session 1 with `weight: 0, weightConfirmed: false`. Metro stopped afterwards; 8081 free; 5173 untouched throughout.
- Visual: browser pane at 320x760: no-program landing (one setup button + hint), the setup dialog with the week fieldset, and the "Your week" landing with Session 1 "Next up", the "Starting targets you confirm" note and "Choose load - 2 x 8" exercise rows; no horizontal overflow (also asserted in the program spec).

## Not checked

Physical devices; the full web and native suites (orchestrator runs them); live provider behavior with the new `context.trainingProgram` field (the server passes `savedContext` through unchanged and the shared schema accepts it, but no prompt text mentions it; `server/**` is out of scope); the native You-profile editor journey with a program (type-checked and lint-clean; the web equivalent is covered); exercise-technique cues for substitute names (they fall back to the generic "ask a trainer" guide by design).

## Ledger-ready paragraph

WORKOUT-PROGRAM-001: Fitness setup did not drive Workouts (audit F2). The goals step and both profile editors now collect an optional training week (days 2-6, equipment, experience) in the same `FitnessSetupDraft`, and `applyFitnessSetup` derives `profile.trainingProgram` deterministically from the starter plans with equipment substitutes and two sets for someone new; programs never store a load and nothing progresses automatically. Web and native Workouts lead with "Your week" and the next session (counted from finished sessions carrying a program title since the week began) with starter plans and the AI builder beneath; without a week the old landing gains one setup entry point. An empty days answer preserves any existing week (removal is explicit), old drafts parse through zod defaults, and the version-1 snapshot schema is additive. Lessons: (1) a runtime import from `fitness-goal.ts` into `workouts.ts` closes a cycle through `domain.ts -> ai-contract.ts` that only breaks when `vite.config.ts` is bundled (TDZ on `chatActionSchema`), so plan data lives in a leaf module and state-dependent helpers in a renderer-only module; (2) derive "which session leads" from the records (finished-count basis) rather than syncing it in an effect, which both fixed the post-finish hero and satisfied `react-hooks/set-state-in-effect`; (3) a 320px visual pass caught a default (weekly weigh-in cadence) the tests did not: entering the shared goal form from Workouts now defaults cadence to "When I choose" when no goal exists.
