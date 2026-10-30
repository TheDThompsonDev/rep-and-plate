# A4-native — C8, Q7, native lint warnings

Findings: C8 (section 1), Q7 (section 3), nine `expo lint` warnings (section 4).

## Plan (scout)

Goal: native chat shows server `warnings`; screens stop asserting `h.state!`; native lint is clean. Done when: a native Spot Check warning is visible in Expo web; zero `h.state!` in `mobile/`; `expo lint` reports 0/0; typecheck passes; focused native specs pass.

Approach: extend. The web already renders `message.warnings` (src/ChatLayer.tsx:534-538) and the store already gates rendering on `h.state` (mobile/App.tsx:73); native only needs the same read and a typed boundary.

Context: READINESS-001 (epoch-bound readiness gate; `state` is set only to loaded records and never reset to null; edits are refused through `change()` while a new owner loads). VERIFY-SWARM-001 (do not share servers). No ledger entry about chat warnings or `state!`. Working tree already carries uncommitted header-account edits in `mobile/App.tsx`, `mobile/src/QuickAccount.tsx` and twelve native specs; they are left as they are.

Change:
- `mobile/src/chat-warnings.ts` (new): pure `visibleWarnings(message)` that drops blank and duplicate strings; Vitest test beside it.
- `mobile/src/ChatScreen.tsx`: render `visibleWarnings(m)` in a card after the meal estimate, where the web renders them; replace U+FFFD with "·".
- `mobile/src/store.tsx`: `useLoadedHealth()` returning `Store & { state: AppState }`; throws with a pointer to the App gate if records are not loaded.
- Thirteen files: `useHealth()` + `h.state!` → `useLoadedHealth()` + `h.state`, only in components that asserted. Components that never asserted keep `useHealth()`.
- Lint: unused imports in Capture/KitchenTools/Shopping/tools; duplicate React import in tools; the two recorder effects get stable `remove`/`stop` callbacks so the dependency arrays are complete without changing when they run.
- `mobile/e2e/spot.spec.ts`: one new journey posting a dated meal whose server reply nulls the meal and returns `Spot Check: which date was this meal?`.

Keep consistent: `mobile/App.tsx` readiness gate (renders a spinner or `h.error` while `state` is null; unchanged); `AccountSync` (`h.recordsReady ? h.state : null`, unchanged); `Onboarding.tsx` and `Spot.tsx` scene components use `h.state?.` above or beside the gate and keep `useHealth()`; `src/ai-client.ts:168` writes `warnings` onto the assistant message (unchanged, read only).

Test: new e2e test red before the ChatScreen change; `npm --prefix mobile run check`; `npm --prefix mobile run lint`; `npx vitest run src server`; focused native specs with Metro started by Playwright's `webServer` on 8081.

Open: none.

## Build log

- Red: `npx playwright test --config mobile/playwright.config.ts e2e/spot.spec.ts -g "server Spot Check warning" --workers 1` failed at `toBeVisible` for `Spot Check: which date was this meal?` while the reply bubble was visible (Metro started and stopped by Playwright's `webServer`). Fix: `ChatScreen.tsx` renders `visibleWarnings(m)` in a card after the meal estimate.
- `npx vitest run mobile/src/chat-warnings` 3/3 passed; the root Vitest picks mobile tests up because its default include covers `mobile/src/**/*.test.ts`.
- `npm --prefix mobile run check` passed after the migration (zero `state!` left in `mobile/`).
- First `npm --prefix mobile run lint` after adding the test crashed: eslint-config-expo lists a `typescript` import resolver that is not installed, and the node resolver cannot follow vitest's exports-only dependencies, so `import/namespace` threw `typescript with invalid interface loaded as resolver`. Smallest fix, outside the listed scope but inside `mobile/`: `mobile/eslint.config.js` gains `'import/core-modules': ['vitest']` in the existing settings object.
- `npx vitest run src server`: 442 passed, 20 failed in `server/ai.test.ts`, `server/beta.test.ts`, `server/chat-boundaries.test.ts`, `server/readiness-migrations.test.ts`, `src/ai.test.ts`, `src/features/cloud/account-client.test.ts`, `src/features/cloud/sync.test.ts`, `src/features/products/quantities.test.ts`. All eight are modified in the working tree by other agents (red-first tests for C3/C4/C5/F4/F5/Q8 and the composer work) and none import `mobile/`; the new mobile test passed in the same run.

## Change and mechanism

- C8: `mobile/src/ChatScreen.tsx` reads `message.warnings` through `visibleWarnings()` (`mobile/src/chat-warnings.ts`) and renders each string in a `Card` with `s.muted` text after the meal estimate, the position the web uses (`src/ChatLayer.tsx:534-538`). The server's date Spot Check (`server/ai.ts:262`) nulls the meal and pushes the warning; native now shows the warning where it previously showed nothing. The activity card separator is "·" instead of U+FFFD.
- Q7: `mobile/src/store.tsx` exports `LoadedStore = Store & { state: AppState }` and `useLoadedHealth()`, which throws with a pointer to the App gate if `state` is null and otherwise returns the same store object (a cast, no new identity). Every component that asserted `h.state!` now calls it; components that never asserted (`Capture`, `ManualIngredient`, `PantryEditor`, `ReceiptEditor`, `Label`, `PriceEditor`, `Connection`, Spot scene components, `Onboarding`, `QuickAccount`, `Sheet`) keep `useHealth()`. Rendering is unchanged: `mobile/App.tsx:73` still shows the spinner or `h.error` while `state` is null, `AccountSync` still reads `h.recordsReady ? h.state : null`, and `state` is only ever assigned from a completed load (`store.tsx` `gate.refresh`, `change`, `saveOnboardingProfile`, `applyAgentAction`, `restoreRecords`), so the throw is unreachable at runtime; every migrated component mounts under the gate (tabs fragment, tools fragment, `Connections`, `AccountSync`, or children of those).
- Lint: `Capture.tsx` drops unused `View`/`Linking`; `remove` and `stop` become `useCallback`s keyed on the expo-audio `recorder` (memoized per preset by `useAudioRecorder`), so the unmount effect depends on `[recorder, remove]` and the 60-second cutoff effect on `[status.durationMillis, status.isRecording, stop]` without re-running on unrelated renders. The unmount effect also re-arms `active.current` on run so the array is honest if the recorder ever did change. `KitchenTools.tsx` drops `mealPlanSchema`, `Shopping.tsx` drops `View`, `tools.tsx` merges the duplicate React imports and drops `View`.

## Consumers checked

`mobile/App.tsx` gate and tool/tab fragments (unchanged), `mobile/src/AccountSync.tsx` readiness read, `src/ai-client.ts:168` writer of `warnings`, `server/ai.ts:262/303` warning producers, `mobile/e2e/spot.spec.ts` and `native-flows.spec.ts` journeys, header-account edits already in the tree (left intact).

## Commands and results (final file state)

- `npm --prefix mobile run check`: passed.
- `npm --prefix mobile run lint`: 0 errors, 0 warnings (was 0/9).
- `npx vitest run src server`: 442 passed, 20 failed; `mobile/src/chat-warnings.test.ts` 3/3 passed. The 20 failures are in eight test files other agents modified this wave (listed above); none import `mobile/`.
- Native specs. First attempt with Playwright's own `webServer` Metro: spot 3/3 passed, native-flows 0/4, every failure a `page.reload` navigation stall or `net::ERR_ABORTED` within the 30 s test timeout. Metro's log from a second server showed the cold bundle takes ~10 s and watch mode is on by default while other agents edit `src/**`, which the bundler watches (ledger line 113 records the same stall). Second attempt with Metro started by me, `CI=1 npx expo start --web --port 8081 --clear` (reloads disabled), warmed with one bundle request: `e2e/native-flows.spec.ts` 4/4 passed in 15.7 s, `e2e/spot.spec.ts` 3/3 passed in 6.3 s (including the new warning journey). Metro was stopped afterwards and 8081 confirmed free. Port 5173 was not touched.

## Not checked

Physical devices and the voice recorder on hardware (the effect refactor is verified by typecheck, lint and review only; no native spec exercises recording). The full native suite and the full web suite were not run. The 20 unrelated Vitest failures were not investigated beyond attribution.

## Ledger-ready paragraph

NATIVE-WARNINGS-001 — Native chat omitted server warnings and asserted loaded records. `ChatMessage` never read `message.warnings`, so date and portion Spot Checks that withhold a card left the phone with a bare reply; it now renders them through a small pure helper with a Vitest test and an Expo-web journey that was red first. `useLoadedHealth()` replaces 49 `h.state!` assertions with one typed boundary under the existing readiness gate; rendering during load and owner switches is unchanged. Native lint is clean: unused imports removed and the recorder effects given stable callbacks rather than disabled rules. Lesson for native browser verification in a swarm: start Metro with `CI=1` (watch disabled) and warm the bundle before `playwright test`, because Metro watches the whole repository and concurrent `src/**` edits abort in-flight reloads; Playwright's auto-started Metro runs in watch mode. Root Vitest already includes `mobile/src/**/*.test.ts`; `mobile/eslint.config.js` lists `vitest` as a core module because eslint-config-expo's `typescript` resolver is not installed.
