# C3-e2e-helpers — Q10 shared Playwright helpers

Finding: Q10 (section 3). Twelve native specs import `../../tests/profile-navigation`; `mobile/e2e` also imports `../../tests/cloud-fixture` (10 specs), `../../tests/ai-fixtures` (2) and `../../tests/account-recovery-fixture` (1). `send` is defined in five web specs, `setup` and `seed` in three each.

## Plan (scout)

Goal: `mobile/e2e` imports nothing from `tests/`; genuinely identical helpers live once under `e2e-shared/`. Done when: `grep -rn "../../tests" mobile/e2e` is empty; `npx tsc --noEmit` and `npm --prefix mobile run check` resolve `e2e-shared` through an explicit include; `npm run lint` covers `e2e-shared/`; focused web and native specs pass with unchanged assertions.

Approach: create `e2e-shared/` (root), move the four cross-imported helper modules there, and add `e2e-shared/chat.ts` for the two identical `send` bodies. Relative imports (`../e2e-shared/...`, `../../e2e-shared/...`): Playwright resolves them natively from both roots, and the tsconfig scope is include-only (a `paths` alias would need `compilerOptions`).

Context: no ledger entry on helper layout. NATIVE-WARNINGS-001 / B6-FOLLOWUPS: start Metro with `CI=1`, warm once, one Metro cycle per code state, free 8081 afterwards. VERIFY-SWARM-001: do not touch the shared 5173 server. Baseline before edits: root `tsc` fails only on `src/chat-thread.test.ts` (C1's in-progress file); mobile check exit 0; lint 0 errors / 71 warnings.

Helper comparison (bodies read side by side):
- `send` — identical in `ai-flows` (arrow), `preference-proposals`, `recipe-proposals` (fill "Message Rep & Plate", click "Send message") → `e2e-shared/chat.ts` `send`. Identical in `flows` and `no-demo` (same plus `expect(status "Rep & Plate is responding").toHaveCount(0)`) → `sendAndWaitForReply`, imported `as send` so call sites do not change. `chat-composer.spec.ts` `send` goes through its local `composer()` locator; kept local.
- `setup` — `agent-connections` (in-process agent server + routes), `recipe-proposals` (chat route + recipe batch seed), `recipes` (status abort + grocery seed): all divergent, kept local.
- `seed` — `pantry-dates` (fixed clock, three dated items), `receipt-products` (one receipt item), `shopping` (routes, product snapshot, purchase): all divergent, kept local.

Change:
- `e2e-shared/profile-navigation.ts` ← `tests/profile-navigation.ts` (moved, unchanged).
- `e2e-shared/cloud-fixture.ts` ← `tests/cloud-fixture.ts`; `readBrowserRecords` from `../tests/record-fixture` (stays where it is per C1); `expect`/`Page` from `@playwright/test` (the old `./app-fixture` import re-exported the same objects and its `test` binding was unused).
- `e2e-shared/account-recovery-fixture.ts` ← `tests/account-recovery-fixture.ts` (moved, unchanged).
- `e2e-shared/ai-fixtures.ts` ← `tests/ai-fixtures.ts`; `tests/ai-fixtures.ts` becomes a one-line re-export because 20+ `src/`, `server/`, `mobile/src/` tests and C1's `tests/chat-thread.spec.ts` import it and are outside this scope.
- `e2e-shared/chat.ts` (new): `send`, `sendAndWaitForReply`.
- `tests/*.spec.ts`: import lines only, plus removal of the five `send` bodies.
- `mobile/e2e/*.spec.ts`: `../../tests/` → `../../e2e-shared/`.
- `tsconfig.json`: `"e2e-shared"` in include. `mobile/tsconfig.json`: explicit `include` of `**/*` (the previous default) plus `../e2e-shared/**/*`.
- `eslint.config.js`: header comment lists `e2e-shared/`; the ignore list already lets `eslint .` reach it.
- `playwright.config.ts`, `mobile/playwright.config.ts`: comment pointing at `e2e-shared/`; no option exists that scopes helper imports.

Keep consistent: web specs importing `./cloud-fixture` (9), `./ai-fixtures` (10, incl. C1's untouched `chat-thread.spec.ts` via the shim), `./account-recovery-fixture` (1), `./profile-navigation` (18); `mobile/src/store.test.ts`, `server/*.test.ts`, `src/**/*.test.ts` importing `tests/ai-fixtures` (shim); `.local-checks/header-account-visual.ts` (git-ignored local script importing `../tests/cloud-fixture`; will need its import retargeted).

Test: `npx tsc --noEmit`; `npm --prefix mobile run check`; `npm run lint`; `npm --prefix mobile run lint`; web `spot`, `you-connected`, `account-security`, `header-account` plus the five `send` specs; native `header-account`, `spot`, `native-flows` with a `CI=1` Metro; `grep -rn "../../tests" mobile/e2e`.

Open: none.

## Build log

- Reproduction (structural finding, no behavior defect): `grep -rn "../../tests" mobile/e2e` listed 23 import lines across 17 native specs (`profile-navigation` 12, `cloud-fixture` 10, `ai-fixtures` 2, `account-recovery-fixture` 1); `grep -nE "^(async function|const) (setup|send|seed)"` listed `send` in five web specs, `setup` and `seed` in three each.
- Moves done with plain `mv` (working tree only, nothing staged). `tests/profile-navigation.ts` was untracked, the other three were tracked, so `git status` shows them as deleted plus an untracked `e2e-shared/`.
- `e2e-shared/cloud-fixture.ts` first two lines rewritten (record-fixture path, `@playwright/test` instead of `./app-fixture`); the rest is byte-identical.
- Root `npx tsc --noEmit --listFilesOnly` lists the five `e2e-shared/*.ts` files and follows the shim; `node node_modules/typescript-compiler/bin/tsc --noEmit --listFilesOnly` in `mobile/` lists the same five plus `tests/record-fixture.ts` and the shim (via `mobile/src/store.test.ts`).
- `npx eslint e2e-shared`: 1 warning (`no-explicit-any` at `cloud-fixture.ts:23`, the same `remote: null as any` the baseline counted under `tests/`), proving the root gate reaches the directory. Total warnings went 71 → 70: the unused `test` binding that `cloud-fixture` imported from `./app-fixture` no longer exists.
- First focused web run (10 spec files, both projects, `--workers 2`): 72 passed, 2 failed, both `tests/preference-proposals.spec.ts` in the `mobile` project (`Review preference changes` card count 0 after `send`). The desktop project of the same tests passed in the same run, the shared `send` body for that spec is byte-equivalent to the removed local one, and `find src -mmin -25` listed 15 `src/**` files other agents changed during the run (`ChatLayer.tsx`, `chat.css`, `App.tsx`, `main.tsx`, ...), which the shared Vite server on 5173 reloads mid-test. Rerun of that spec alone: 6/6 passed in 7.9 s. VERIFY-SWARM-001 class, not a regression.

## Change and mechanism

`e2e-shared/` is a root directory that both Playwright suites reach by relative path (`tests/x.spec.ts` → `../e2e-shared/`, `mobile/e2e/x.spec.ts` → `../../e2e-shared/`). Playwright transforms any imported `.ts` file regardless of `testDir`, so no Playwright option was needed; both configs carry a comment pointing at the directory. Typecheck coverage is explicit: root `tsconfig.json` includes `e2e-shared`; `mobile/tsconfig.json` gains an `include` of `**/*` (what Expo's base gave it implicitly) plus `../e2e-shared/**/*`. The root ESLint gate already lints every non-ignored directory, so `eslint .` now covers `e2e-shared/`; the header comment says so.

Contents: `profile-navigation.ts` (`openProfile`), `cloud-fixture.ts` (`mockCloud`, `openAccount`, `signIn`, `stored`), `account-recovery-fixture.ts` (`exercisePasswordRecovery`), `ai-fixtures.ts` (`requestFixture`, `resultFixture`) and the new `chat.ts` (`send`, `sendAndWaitForReply`). `tests/ai-fixtures.ts` remains as `export * from "../e2e-shared/ai-fixtures"` because `src/`, `server/`, `mobile/src/` unit tests and C1's `tests/chat-thread.spec.ts` import it and are owned elsewhere; retargeting them and deleting the shim is a follow-up. `cloud-fixture` still imports `readBrowserRecords` from `tests/record-fixture.ts` (kept in place per the assignment), so `e2e-shared` has one remaining dependency on `tests/`.

Helpers kept local, with the reason: `send` in `tests/chat-composer.spec.ts` (goes through the spec's `composer()` locator) and in C1's `tests/chat-thread.spec.ts` (not mine to touch); `setup` in `agent-connections` (in-process agent server), `recipe-proposals` (chat route + recipe batch seed), `recipes` (status abort + grocery seed); `seed` in `pantry-dates` (fixed clock, dated items), `receipt-products` (one receipt item), `shopping` (routes, product snapshot, purchase). None of the bodies match another.

## Consumers checked

- 18 web specs importing `openProfile`, 9 importing `cloud-fixture`, 10 importing `ai-fixtures` (9 retargeted, `chat-thread.spec.ts` left on the shim), 1 importing `account-recovery-fixture`: import lines only.
- 17 native specs: `../../tests/` → `../../e2e-shared/`; `mobile/e2e/header-account.spec.ts` (untracked, another agent's) included because the grep criterion requires it.
- Unit tests importing `tests/ai-fixtures`: `npx vitest run src server mobile/src/store.test.ts` 80 files / 536 passed.
- `tests/record-fixture.ts`, `tests/app-fixture.ts`, `mobile/e2e/app-fixture.ts`: untouched.
- `.local-checks/header-account-visual.ts` (git-ignored local script) still imports `../tests/cloud-fixture`; it will need `../e2e-shared/cloud-fixture`. `docs/context/account-lifecycle.md:11` names `tests/profile-navigation.ts`; orchestrator-owned.

## Commands and results (final file state)

- `npx tsc --noEmit`: exit 0 (baseline before edits failed only on C1's then-missing `src/chat-thread.ts`; that resolved during the wave).
- `npm --prefix mobile run check`: exit 0.
- `npm run lint`: 0 errors, 70 warnings (baseline 71).
- `npm --prefix mobile run lint`: exit 0, no output.
- `npx vitest run src server mobile/src/store.test.ts`: 80 files, 536 tests passed.
- Web: `npx playwright test tests/spot.spec.ts tests/you-connected.spec.ts tests/account-security.spec.ts tests/header-account.spec.ts tests/ai-flows.spec.ts tests/preference-proposals.spec.ts tests/recipe-proposals.spec.ts tests/flows.spec.ts tests/no-demo.spec.ts tests/account-recovery.spec.ts --workers 2`: 72 passed, 2 failed (preference-proposals, mobile project, concurrent `src/**` edits on the shared server); `npx playwright test tests/preference-proposals.spec.ts --workers 2`: 6 passed.
- Native: 8081 confirmed free; `CI=1 npx expo start --web --port 8081 --clear` from `mobile/`; warmed with one bundle request (200, 9.5 MB, 13.5 s); `npx playwright test -c playwright.config.ts e2e/header-account.spec.ts e2e/spot.spec.ts e2e/native-flows.spec.ts --workers 1`: 8 passed in 20.2 s; Metro killed by PID; `netstat` shows no 8081 listener. Port 5173 never touched.
- Standalone proof: `grep -rn "../../tests" mobile/e2e` returns nothing. `mobile/e2e` still imports `../../src/**` (shared domain code), which the finding did not cover.

## Not checked

The full web and native suites. `tests/*.spec.ts` are still outside the root `tsconfig.json` include (only `e2e-shared` and whatever specs import transitively are typechecked), as before this change; adding `tests` would be a separate decision because other agents are adding specs this wave. Physical devices. The `.local-checks` scripts were not run.

## Ledger-ready paragraph

E2E-SHARED-001 — Native browser specs depended on the web suite's helper directory (audit Q10): 17 `mobile/e2e` specs imported `../../tests/{profile-navigation,cloud-fixture,ai-fixtures,account-recovery-fixture}`, and `send` was pasted into five web specs. Shared helpers now live in root `e2e-shared/` (`profile-navigation`, `cloud-fixture`, `account-recovery-fixture`, `ai-fixtures`, new `chat.ts` with `send`/`sendAndWaitForReply`), imported by relative path from both suites; root `tsconfig.json` includes `e2e-shared` and `mobile/tsconfig.json` has an explicit `include` of `**/*` plus `../e2e-shared/**/*`, so both typechecks list the directory and `eslint .` lints it. `tests/ai-fixtures.ts` is a re-export shim for the unit tests in `src/`, `server/` and `mobile/src/`; `cloud-fixture` still reads `tests/record-fixture.ts`. `setup`/`seed` bodies and `chat-composer`'s `send` differ per spec and stayed local. Assertions unchanged: focused web 74/74 across two runs (two first-run failures were VERIFY-SWARM-001 reloads from concurrent `src/**` edits), native 8/8 on a `CI=1` warmed Metro that was stopped afterwards, Vitest 536/536. Gotcha: a bare `include` in `mobile/tsconfig.json` replaces Expo's implicit `**/*`, so it must be listed explicitly alongside any outside directory.
