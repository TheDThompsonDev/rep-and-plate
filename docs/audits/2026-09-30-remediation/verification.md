# Remediation verification

September 30, 2026. This records local checkout verification, not a deployed release or a study with human participants. See the [31-finding acceptance map](README.md) and unchanged [original audit](../2026-09-30-personas/report.md).

## Aggregate checks

| Check | Result | Retained evidence |
| --- | --- | --- |
| `npm test` | 371 shared/server tests and 8 agent-script tests passed | [Unit log](evidence/unit-final.log) |
| `npm run build` | TypeScript and production web build passed | [Build log](evidence/build-final.log) |
| `npm run agents:check` | Passed | [Adapter typecheck](evidence/agents-check.log) |
| Full web Playwright suite, desktop and 390px touch viewport | 266 passed; no failures/skips/flakes | [Web results](evidence/web-final.json) |
| Native typecheck, lint, export and full Expo-web journeys | Passed; 23 journeys, no failures/skips/flakes | [Native evidence](native.md), [final results](native-suite.json) |
| Five fresh persona walkthroughs | 177 saved checkpoints across all five personas; no page errors | [Walkthrough records](evidence/persona-walkthroughs.json) |
| Unmocked local provider checks | 3 passed: historical walking proposal, exact label decimals/date, focused missing-portion question | [Live results](evidence/shared-live.json) |
| Five main pages at 320/390/1440px | 15 overflow checks passed; Escape restored target-dialog focus at all three widths | [Layout records](evidence/layout-check.json) |

The final web suite uses a root-owned persistent Vite server with two workers and no overlapping browser suite; native uses a fresh static Expo-web export on a separate loopback port. Both clients use synthetic isolated records. Native browser tests are not iOS/Android hardware tests. Most browser journeys mock cloud/AI at the transport boundary; only the specifically identified live provider checks and persona captures exercised the configured local provider.

The five-persona replay preceded the final voice-load, planner replacement and generated-note refinements. Those changes are covered by the subsequent dedicated regressions and final aggregate suites; the replay is not represented as a second complete human-style traversal after every edit.

## Reviewed behavior and visual evidence

- Decimal values survive correction, repeats and reloads. Pending estimates remain unlogged while edited, including cancellation. Manual food capture works with AI unavailable.
- Shared chosen-load guards protect buttons, typed text and voice from recording an unchosen starter load. Optional effort, flexible exercise order, kg conversion and historical corrections preserve recorded evidence.
- Direct stock calculations govern pantry availability. Generated plan notes are discarded; manually authored notes remain. This removes generated cooking directions as well as unverifiable stock advice. A schedule with ingredient quantities is not a tested recipe.
- Web automatic account refresh now closes record-bound editors before applying the replacement. The new regression verifies the newer meal plan remains after reload and in the mocked account. Native replacement guards also reject late planner generations and clear temporary recipe values.
- [Web first-set screenshot](evidence/web-workout-first-set.png) and [measurement](evidence/web-workout-layout.json): at 390×844, the first load field starts at y=636.8 and Save is visible above the composer/navigation. Reordering follows set entry; rest controls expand on demand. Technique guidance remains available before logging. No horizontal overflow.
- [Native workout screenshot](native-workout.png) and [measurement](native-layout.json): first load and rep inputs align at y=567, each 49px high; Save is visible above navigation. The timer is visual and does not promise background alerts.

## Failure and recovery record

Failures were retained and repaired; no tests were skipped or weakened to pass.

1. The initial aggregate web run reused a development server owned by another runner. That runner stopped it, producing connection-refused failures. [Initial output](evidence/web-integration-first.json) is invalid product evidence. A later isolated workout check also crossed a Vite restart; root then froze source and owned the server.
2. The first stable aggregate run found two legacy voice fixtures that relied on preset starter loads. Fixtures now choose their load explicitly. A separate unchosen-load regression was added: spoken reps request a load instead of claiming a recorded set. [Failure](evidence/voice-load-before.log), [repair](evidence/voice-load-after.log), [12 voice journeys](evidence/voice-checks.json).
3. A complete [262-test web run](evidence/web-before-boundary-fix.json) passed before the final independent review identified planner replacement and generated-note issues. New regressions are included in the final aggregate count; the earlier run is not presented as evidence for those subsequent fixes.
4. The web planner boundary regression failed before the fix because the editor survived a newer account copy. [Before](evidence/planner-before.json); [desktop/mobile after](evidence/planner-after.json). Native has separate failing and passing replacement evidence in [native notes](native.md).
5. A paraphrased stock claim escaped the earlier note keyword filter. [Red](evidence/f19-notes-red.log), [20 planning/recurring tests](evidence/f19-notes-green.log), [6 Kitchen journeys](evidence/f19-notes-browser.log). The repair replaces the heuristic with a clear generated-note boundary.
6. Live provider checks exposed ignored capture dates and invented portions. Deterministic boundary checks repaired these cases; [before](evidence/shared-live-before.json) and [after](evidence/shared-live.json) remain available. These examples do not establish general model accuracy.
7. A subsequent web run passed 263/264; one legacy seeded-diary fixture rendered empty records. Five unchanged isolated repetitions passed. Its startup path only awaited navigation before injecting records, which could overlap asynchronous hydration/initial persistence. The fixture now waits for the actual Chat input, drains durable writes and asserts seeded meals after reload. [Failed aggregate](evidence/web-fixture-race.json), [unchanged investigation](evidence/nutrition-investigation.json), [10 desktop/mobile repetitions after fixture repair](evidence/nutrition-stable.json). This is recorded as a suspected fixture race, not a proven production defect; nutrition assertions were retained and no product code changed for this failure.
8. The next [264-test aggregate](evidence/web-before-render-loop-fix.json) passed its assertions, but shutdown inspection found React maximum-update-depth errors during legacy plan revisions. Autosave compared raw JSON strings: normalization changed object field order, so equivalent drafts repeatedly looked unsaved. The repair compares schema-normalized local and saved plans. A new desktop/mobile regression checks persisted edits, preserved approved originals, bounded writes and absence of console errors. It measured 44 writes for one action [before repair](evidence/autosave-loop-red.log); [20 focused journeys](evidence/autosave-loop-green.log) passed afterward, including exactly one write for that action. The final aggregate includes these additional cases, and [final server output](evidence/vite-final.log) is separately inspected for React loop diagnostics.
9. The first aggregate with that new regression passed 260/266: five recurring-plan cases lost their directly injected fixture and one unrelated case had a blank-page startup timeout. The recurring fixtures mutated the compatibility mirror, then reread it in a separate browser step, allowing an intervening app write to replace the intended fixture. They now drain the durable queue, construct and save the exact snapshot directly, and assert its contents after reload. All [10 recurring journeys](evidence/recurring-fixture-fixed.log) and [2 immediate autosave repeats](evidence/recurring-fixture-repeat.log) passed. The isolated startup case passed [three unchanged repetitions](evidence/flows-startup.json); its cause remains unproven. [The failed aggregate is retained](evidence/web-before-fixture-repair.json). Final aggregate verification uses two workers to reduce local contention; the same tests, assertions and timeouts remain in force.

The build reports a bundle-size warning. Native lint reports nine pre-existing warnings and zero errors. Neither was silently disabled. The CYC controller could not create a run because fingerprint selection exceeded its existing limit (`CYC-ASSETS-001`); no configuration was relaxed and no controller-managed completion is claimed. Direct command results and the exact-response/artifact gate are the verification record.

## Limits before release

No deployment, public admission change, real email or support message was sent. Signed hardware builds, real camera/microphone and assistive technology behavior, email delivery, hosted migrations/configuration, representative receipt accuracy, provider cost/latency and real human usability remain release checks. Five simulated persona walkthroughs exercise flows; they do not measure delight, avoidance or long-term adoption.

Changes remain in the existing working tree with earlier unrelated work preserved. The final artifact manifest binds reviewed files to their hashes; it is a revision record, not a correctness certificate.



