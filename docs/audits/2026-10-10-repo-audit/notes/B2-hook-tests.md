# B2-hook-tests — Q5 (hook and store half): first hook-level Vitest coverage

Finding: Q5 (README section 3), the `useBrowserRecords` / `useOnboarding` / `mobile/src/store.tsx` half. Playbook: verify/feature (tests only; no non-test source changes). Managed `cyc run` cannot start here (CYC-ASSETS-001), so checks are run directly.

## Plan (written before editing)

Goal: hook and store behaviour that the ledger relies on (RECEIPT-JOURNEY-002 action-boundary journaling, READINESS-001 owner-switch gate, the first-prompt marker retry guard from `tests/onboarding-first-log.spec.ts:120`) gets a fast unit guard that goes red when the mechanism regresses.
Done when: (1) three new `*.test.ts` files pass under `npx vitest run src server mobile/src`; (2) at least two tests shown red against a temporarily broken source, source restored byte-identical; (3) `npx tsc --noEmit`, `npm run lint`, `npm --prefix mobile run check`, `npm --prefix mobile run lint` pass; (4) each file < 2 s.

Approach: create. No hook test infrastructure exists (`find src server mobile/src -name "*.test.tsx"` is empty; neither `jsdom` nor `happy-dom` nor `@testing-library/*` is installed, root or transitively). Render hooks with `react-dom/client` + `React.act` inside a tiny `render` helper per file (so the mobile file renders with mobile's own `react`/`react-dom` 19.2.3 rather than the root 19.3.0). DOM via `// @vitest-environment happy-dom`.

Dependency: `happy-dom` (devDependency, 7 transitive deps) rather than `jsdom` (20 transitive deps). Vitest 5 lists `happy-dom` as a built-in environment name; neither implements IndexedDB, so `browser-records.ts` falls back to the `localStorage` path exactly as the existing node-environment `browser-records.test.ts` exercises.

Context: ledger RECEIPT-JOURNEY-002 ("functional edits execute synchronously at the action boundary") and READINESS-001 ("saves now journal at the action boundary"; "epoch-bound readiness gate ... stale asynchronous callbacks cannot publish to the new account"). Wave A note A1 added `readStoredState()` (`fresh | loaded | unreadable`) and `persistOpenedRecords()`; A4 added `useLoadedHealth()`. No prior failed approaches for hook tests in the ledger.

Change (new files only):
- `src/platform/useBrowserRecords.test.ts` — mount write skipped for unreadable snapshot (blob stays, copy kept, no error callback); fresh device gets its first durable snapshot; functional updates compose synchronously and the synchronous journal is readable by a fresh module registry while the durable writer is blocked; failure callback on a rejected durable write; rendered subscribers see the new state.
- `src/features/onboarding/useOnboarding.test.ts` — in-memory `OnboardingAdapter`; guest progression welcome → intro → account → setup → goals → nutrition → ready → finish; finish saves name + goals + weight + details + targets through one `saveProfile` call before the record is written and clears the draft; goals skipped / targets skipped / details only; draft resume; replay leaves record and draft untouched; failed first-prompt marker attempted once across re-renders with an App-style effect.
- `mobile/src/store.test.ts` — `react-native`, `./storage`, `./auth`, `./api` mocked with factories (the real `react-native` entry is Flow and cannot be parsed); `useLoadedHealth` throws above the gate and returns typed state beneath it; owner switch during a slow load (`invalidateCloudSync()`) rejects the stale load; `send` while a reply is in flight holds the text in the composer with `PROCESSING_DRAFT_NOTICE` and sends nothing (the busy path changed under me mid-wave, see Consumers); `applyAIResult` replay adds no second answer.
- `package.json` / `package-lock.json` — `happy-dom` devDependency only.

Keep consistent: `src/features/onboarding/Onboarding.tsx:40-80` (the only `useOnboarding` consumer; test mirrors its `complete()` composition); `src/App.tsx:191,210` (hook tuple shape; the `firstLog && tracked → dismissFirstLog` effect the marker test mirrors); `mobile/App.tsx:73` (readiness gate the `useLoadedHealth` test models); `eslint.config.js` (root lint ignores `mobile/`; mobile `expo lint` treats `vitest` as a core module).

Test: the three files themselves; red demonstrations recorded below.

Open: none that change the solution.

## Reproduction (red first)

No defect to reproduce: Q5 is a coverage gap, so "red" here means each guard was shown to fail against a deliberately broken source, after which the source was restored with `cp` from a copy taken seconds earlier and checked with `cmp` (byte-identical every time; `useOnboarding.ts` and `owned-state.ts` still match HEAD, the other two match the other agents' working-tree versions).

| Break (temporary) | Red result |
| --- | --- |
| `useBrowserRecords.ts`: delete `if(opened.status==='unreadable')return Promise.resolve();` | `skips the passive mount write for an unreadable snapshot` failed: `expected '{"version":1,...' to be '{broken'` (the corrupt blob was overwritten: the Q1 defect) |
| `useBrowserRecords.ts`: delete `void persistBrowserRecords(next).catch(()=>failure.current());` (back to passive-only persistence) | `applies functional updates synchronously and journals them before React renders` and `reports a rejected durable write ...` failed (`vi.fn` called 0 times; journal never written) |
| `useOnboarding.ts`: `useCallback(` → `((fn) => fn)(` on `dismissFirstLog` (new identity every render) | `attempts a failing first-prompt marker save once` failed: `expected '' to match /Fixture marker write rejected/` (the App-style effect re-fired until the fake device accepted the 4th write). The first fixture rejected forever and the break showed only as a 5 s `act` timeout; it now rejects three times then accepts, so the extra attempts are counted instead of hanging. |
| `useOnboarding.ts`: delete the `writeDraft(draftKey(expectedIdentity), null)` call in `finish` | `walks welcome → ... → finish` failed at `drafts.has(draftKey(null))`: `expected true to be false` |
| `mobile/src/store.tsx`: `if (controller.current) {` → `if (false) {` in `send` | `send holds a second message while a reply is in flight` failed: `expected "vi.fn()" to be called 1 times, but got 2 times` |
| `src/platform/owned-state.ts`: delete the post-load `if (!live() \|\| (await this.deps.owner()) !== owner \|\| !live()) return;` | `an owner switch during a slow load rejects the previous owner's records` failed: `expected { version: 1, ... } to be null` (A's stale load published into B's session: the READINESS-001 defect) |

## Change and mechanism

- `src/platform/useBrowserRecords.test.ts` (5 tests, 1.2 s) — mounts the hook with `react-dom/client` + `act`; `localStorage` replaced by an in-memory `Storage` whose data keys are enumerable (same stand-in as `browser-records.test.ts`); `indexedDB` stubbed to `undefined`. The action-boundary test blocks the shared write queue with a never-resolving `browserRecordTransaction`, fires two functional updates outside `act`, and asserts (a) `current.current` already composed both, (b) no render happened yet, (c) `health.pending.guest` already holds the edit, and (d) a fresh module registry's `hydrateBrowserRecords()` + `readState()` opens that edit: the "Save then reload while the durable writer is blocked" journey from READINESS-001 at hook level. The failure test flips storage rejection on only after the previous write landed and checks that the latest callback (not the mount-time one) is called exactly once while the edit stays visible and journaled.
- `src/features/onboarding/useOnboarding.test.ts` (7 tests, 1.3 s) — an in-memory `OnboardingAdapter` (record, draft slots, write log, per-value rejection). `saveLikeOnboarding` reproduces `Onboarding.tsx:65-76`'s `complete()` with the real `applyFitnessSetup`/`applyNutritionSetup`, so "saving goals/weight/details/targets together" is asserted on a resulting `AppState` (fitness goal, body-weight entry under `draft.weightEntry`, baseline, targets, `targetsConfigured`) plus the ordering `saveProfile` → record write → draft cleared. Skip paths follow `Onboarding.tsx:501,507` (`fitness:null`, `nutrition:null`, details-only `{ baseline }`). The marker test mounts an `App.tsx:210`-style effect (`firstLog && tracked → dismissFirstLog()`) and counts adapter writes across five re-renders.
- `mobile/src/store.test.ts` (3 tests, 1.5 s) — `vi.mock` factories for `react-native` (Flow source, unparseable), `./storage`, `./auth`, `./api`; `vi.hoisted` holds the controllable `loadDevice`/`saveDevice`/`chat` mocks and the deferred loads. The gate test drives the real `OwnedStateGate` + `sync-control` singleton: owner A's load is left pending, `invalidateCloudSync()` fires with owner B, A resolves (must not publish; `change()` must return `false`; `saveDevice` untouched), then B resolves. `useLoadedHealth` is checked above the gate through an error boundary (`onCaughtError` silenced) and beneath a `mobile/App.tsx:73`-style gate.
- `package.json` / `package-lock.json` — `happy-dom@^20.14.6` devDependency. Justification: no DOM implementation existed (root or transitive); Vitest 5 supports `happy-dom` as an environment name; it carries 7 transitive dependencies against jsdom's 20; neither has IndexedDB, so `browser-records.ts` takes the same `localStorage` fallback path the existing tests use. `@testing-library/react` was not added: a 12-line `render` helper per file covers what these tests need and lets the mobile file render with mobile's own `react`/`react-dom` 19.2.3.
- No non-test source file changed. No `vite.config.ts` change was needed (per-file `// @vitest-environment happy-dom`).

## Consumers checked

- `src/features/onboarding/Onboarding.tsx:40-80` — the only `useOnboarding` consumer; `complete()` composition mirrored. During this wave another agent widened `FitnessSetupDraft` (`trainingDays`, `equipment`, `experience`) and updated my `fitnessFixture` at `useOnboarding.test.ts:87` to match; kept as their minimal consumer fix.
- `src/App.tsx:191` (hook tuple `[state, setState, current]`) and `:210` (the `firstLog && tracked` effect) — shapes asserted by the tests.
- `mobile/App.tsx:73` readiness gate and the screens on `useLoadedHealth()` — modelled by the `Gate`/`Below` probe.
- `mobile/src/store.tsx` `send` changed mid-wave (busy path now `holdWhileReplying` + `PROCESSING_DRAFT_NOTICE`, `mobile/src/composer.ts`); the test asserts that behaviour (`draft`, `notice`, `busy`, no second `chat` call, no second user message). My restore copy already contained that change (verified by content and timestamps), so nothing of theirs was overwritten.
- `eslint.config.js` (root ignores `mobile/`; `react-hooks` rules apply to `src/**`, so the marker effect destructures first to satisfy `exhaustive-deps`) and `mobile/eslint.config.js` (`vitest` as core module; `array-type` and `import/first` satisfied).

## Commands run (final file state)

- `npx vitest run src server mobile/src` — 79 files, 526 tests passed, 4.7 s (wave-A baseline in note A1: 71 / 472).
- `npx vitest run <each new file>` — 5 / 7 / 3 passed; 1.23 s / 1.26 s / 1.54 s.
- `npx tsc --noEmit` — exit 0.
- `npm run lint` — exit 0; 72 warnings, 0 errors, none in the new files.
- `npm --prefix mobile run check` — exit 0. `npm --prefix mobile run lint` — exit 0, 0 warnings.
- No Playwright run (assignment: other agents share the server this wave).

## Not checked / limits

- Account (Supabase) paths of `useOnboarding` (`authenticate`, owner binding, `verifyOwner`, auth-epoch resets): untested here; they need a Supabase client fake and belong with the account-lifecycle work.
- `HealthProvider.applyAgentAction`, `restoreRecords`, `saveOnboardingProfile`, the 185 s abort timer and `cancel()`: not covered.
- `useBrowserRecords` under real IndexedDB: neither happy-dom nor jsdom implements it; the browser specs remain the only IndexedDB evidence.
- During the wave, `npx vitest` twice failed at config load with `ReferenceError: Cannot access 'chatActionSchema' before initialization` (a `src/domain.ts` ↔ `src/ai-contract.ts` import cycle from another agent's in-progress edit); it cleared within a minute and did not recur. Flagged for the orchestrator in case that cycle is still latent in the final tree.
- No real bug found in the three modules; nothing marked `test.fails`/`skip`.

## Ledger-ready paragraph

Q5 (hook/store half): the first hook-level Vitest guards exist for `useBrowserRecords` (unreadable snapshots skip the mount write; functional edits compose and journal synchronously at the action boundary, so a reload with the durable writer blocked still opens the edit; a rejected durable write reaches the latest failure callback while the edit stays visible), `useOnboarding` (guest progression; skip and details-only paths saved together in one `saveProfile`; draft resume; replay leaves record and draft untouched; a failed first-prompt marker is attempted once across re-renders), and `mobile/src/store.tsx` (`useLoadedHealth` throws above the gate and is typed below it; an owner switch during a slow load discards the stale load and rejects edits until the new owner's records arrive; `send` during a reply holds the text in the composer; replaying an `applyAIResult` adds no second answer). Infrastructure: `happy-dom` devDependency, per-file `@vitest-environment`, a 12-line `react-dom/client` + `act` render helper per file; mobile tests mock `react-native`/expo modules with `vi.mock` factories because the React Native entry is Flow. Six source breaks were shown red and restored byte-identical. Learned: a `vi.hoisted` mock must mutate (not reassign) shared arrays in `beforeEach`; a "reject forever" fixture turns an infinite effect loop into an `act` timeout, so cap the rejection to make the loop countable.
