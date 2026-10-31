# Audit verification and reproduction

September 30, 2026. The audit is complete as an evidence-backed assessment. The application is not declared ready for public launch. The failing audit checks are findings to repair, not unfinished implementation work hidden behind passing baseline tests.

## Current executed checks

| Check | Result | Evidence and interpretation |
|---|---|---|
| `npm test` | Passed | 345 shared/server tests plus 8 agent-script tests, 353 total. [Unit log](evidence/unit.log) |
| `npm run build` | Passed | TypeScript and Vite production build. Large-chunk warning remains; it is not a measured user latency result. [Build log](evidence/build.log) |
| Existing web Playwright suite | 240 passed, zero skipped, failed or flaky | Desktop and phone layouts. Approximately 258 seconds. Provider/cloud responses are predominantly fixtures. [JSON](evidence/web-suite.json) |
| `npm run mobile:check` | Passed | Native shared-domain type check. [Log](evidence/mobile-typecheck.log) |
| `npm --prefix mobile run lint` | Zero errors, nine warnings | Unused imports, duplicate imports and hook-dependency warnings. They are not silently treated as zero warnings. [Log](evidence/mobile-lint.log) |
| Fresh Expo web export | Passed | `node node_modules/expo/bin/cli export --platform web`, run from `mobile`. Current native source was exported before inspection. [Log](evidence/mobile-export-corrected.log) |
| Existing native-interface suite | 18 passed, zero skipped, failed or flaky | Against fresh production Expo-web export, approximately 41 seconds. Not iOS/Android hardware. [JSON](evidence/native-suite.json) |
| Five fresh persona walkthroughs | Completed, zero captured page exceptions | 34, 38, 34, 38 and 33 checkpoints, 177 total. Guest UI setup; all primary surfaces; one measurement and reload per context. [Records](evidence/persona-walkthroughs.json) |
| Responsive and focus check | Passed in the checks run | Five main surfaces at 320, 390 and 1440 px, no document or inspected-control horizontal overflow. Escape restored focus to Edit daily targets at each width. [JSON](evidence/layout-check.json) |
| Five new audit regression checks | **Five failures reproduced** | Each failed at its behavioral assertion, not setup, import, transport or selector errors. [JSON](evidence/audit-regressions.json) |

Existing suite totals are 353 unit tests and 258 browser tests. The five new failing checks are additional and must not be included in a claim that all tests pass.

## The five failing checks

| Finding | Expected behavior asserted | Actual result |
|---|---|---|
| F01 | A name-only correction of a fractional-nutrition meal saves | Dialog remains open because 18.3 and 0.4 violate `step=1` |
| F02 | Typing `18.3` in native protein entry preserves `18.3` | Field displays `183` |
| F03 | Guest setup does not promise account saving | Exact account-saving promise is present |
| F04 | A day with a saved workout counts under recorded activity | Headline remains `0 of 7 days` |
| F05 | Profile workout history includes the actual `45 lb` load | History includes reps, omits loads |

The checks preserve synthetic fixtures and assert the desired behavior. No product code was changed to make them pass. These tests are audit artifacts rather than an alteration of the default project suite.

## Reproduce the audit checks

Start the existing local app with `npm run dev` from the repository root. Build native web with the CLI command above, then run `node docs/audits/2026-09-30-personas/serve-native.mjs` from the root. The static preview binds only to loopback port 8081.

Run:

```text
node node_modules/@playwright/test/cli.js test --config docs/audits/2026-09-30-personas/audit.config.ts
```

On the audited revision this is expected to exit with five failed assertions. After repairs, the same expected-behavior checks should pass. Their date fixtures use the local calendar date. The native-entry test requires the fresh Expo-web export.

`persona-walkthroughs.mjs` reruns the five independent guest walkthroughs. **It sends four synthetic prompts to the configured live AI service** and can incur ordinary provider usage. It should not be run as an offline fixture suite. Its beginner response wait reached its heuristic limit because a plain conversation answer had no proposal card; the captured reply exists. Do not interpret `liveElapsedMs` as a provider latency benchmark. The other three card responses were observed in roughly 5–8 seconds in this local run, which is still not a performance study.

`layout-check.mjs` reruns the isolated viewport/focus probes. `explore.mjs` and `serve-native.mjs` are local audit utilities. Exploration browser data is isolated from the user's normal browser.

## Live versus simulated service evidence

Live local UI calls covered two stages of the yogurt/banana meal, an 80 kg bench capture, a walking request, a weighed lunch, an uncertain peanut-butter portion, a fictional receipt, and a seven-day dinner plan. These establish observed outcomes, not population accuracy, reliability or cost. The same meal can produce a different model answer on a later run; snapshots preserve what actually happened here.

The receipt contained milk, oats and dish soap with a printed September 25 date. All three lines were retained; soap was nonfood; food quantities and matches still required review. The app displayed the September 30 capture date in headings while mentioning the printed date separately. No conclusion about real receipt coverage follows from one synthetic image.

Account creation/recovery/deletion and cloud save/restore tests used the repository's mock services. Assistant proposal lifecycle tests cover the local CLI/service boundary and mocked native hosted acknowledgment. No real recovery mailbox, current hosted migration installation or physical-device key storage was verified by those passes.

The native local export did not receive `EXPO_PUBLIC_API_URL`; this explains the initial account-connection error. `mobile/eas.json` supplies the hosted URL for preview/production builds. That local error was not classified as a production outage. Native manual interaction, mocked network journeys and shared-domain behavior were still inspected.

## Source and visual review

Important paths reviewed include onboarding and its shared flow, Chat result application, server meal-component normalization, Nutrition day navigation, both meal editors, workout templates and set recording, both workout-history presentations, pantry and recipe contracts, planner persistence, native screen semantics, support surfaces and current context/readiness notes.

UI review used the current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) as a checklist for semantics, forms, focus, layout and preservation of user input. Findings cite actual code/UI evidence in the friction log. It was not an automated accessibility certification.

Screenshots were visually inspected for onboarding, the decimal-save failure, the native workout form at 390 px, and selected report examples. Accessibility snapshots were used for the full surface inventory. No claim is made that every screenshot or every platform permutation received a separate visual review. The Markdown report is editable repository documentation; its source and links were checked, rather than claiming a separate PDF render.

## Tooling limitations and rejected observations

- CYC `run start --session b5e00bf0543c7b1062fec8f19a7c7e63` failed before creating a run because the source fingerprint exceeded its file/size limit. This matches existing `CYC-ASSETS-001`. Controller configuration was not weakened; direct checks above replace no assertions and no controller-managed completion is claimed.
- The first native export command appended `web` to the package script's existing `--platform all`, producing a command/configuration error. The direct Expo CLI command was then used successfully; the initial failure is retained in `mobile-export.log` and is not a product defect.
- An agent-browser setup click did not advance during early exploration. A fresh Playwright journey through the same setup succeeded. No onboarding blocker was inferred from that tool-only behavior.
- One exploration step attempted to open Recipes while the parent Pantry dialog remained open after closing its date editor. The nested dialog was then closed correctly. This was an automation sequencing error, not an application navigation failure.
- Browser hardware was unavailable; camera and microphone fallback copy was observed. Real decoding, audio transcription, backgrounding and safe areas still need signed-device checks.

## Release evidence still needed

1. Signed iOS and Android builds on physical phones: keyboard, camera, barcode, voice, accessibility, background/resume, interrupted storage and expired sessions.
2. Actual signup confirmation and recovery email delivery with the configured hosted templates.
3. A configured and exercised support contact and the intended public admission policy.
4. Permissioned representative receipt/photo ground truth and real-provider operating cost/budget evidence.
5. Current hosted assistant-connection migration/deployment verification before advertising remote integration support.

Historical backend verification in the September 29 readiness notes is useful context, not a substitute for rerunning a changed hosted boundary. No deployment, commit, migration or real-user data deletion was performed in this audit.
