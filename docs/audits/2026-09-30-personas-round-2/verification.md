# Evidence and limits

## Source and execution

Audit date: September 30, 2026. Web ran from the current dirty working tree on `http://127.0.0.1:5173`; HEAD was `a3f10044e78b55502b307458b7ef160ecffe8095`. [source-before.json](source-before.json) fingerprints 288 app/source/script files, including pre-existing work. All 288 were unchanged in the closing comparison recorded in [source-after.json](source-after.json). This is not a deployment or commit.

The native developer lane used the existing Expo-web export at `http://127.0.0.1:8081`. Its [baseline](native/baseline.json) records bundle hashes and 95 reachable source files. None was newer than the export, and the lane verified those source hashes remained unchanged. This corroborates source parity; it does not attest a reproducible signed mobile build.

Each persona used an isolated browser context with fictional data. The user's actual browser storage was not changed. No real account was created and no email was sent. The code under review was held stable; audit scripts and artifacts are the deliverables.

## Fresh evidence

| Check | Result | Evidence and interpretation |
|---|---|---|
| Five fresh onboarding/full-surface traversals | All completed; 177 checkpoints; zero captured page/console errors | [Common results](evidence/persona-walkthroughs.json), [script](persona-walkthroughs.mjs). Browsing includes empty states and is not completion of every workflow. |
| Four representative live Chat requests | Reviewable strength, walk, food estimate and portion clarification responses | Each persona's `07-live-response.txt`; unmocked local provider. No numerical accuracy or reliability benchmark. |
| Expert and six-month deeper journeys | Real UI-created populated records, return use, live planning and correction | [Sessions](kitchen/sessions.json), [report](kitchen/report.md). See lane report for live versus local actions and harness limitations. |
| Beginner and fit/new-tracker deeper journeys | Food, dates, activity, set logging/correction, preference persistence and three-turn uncertainty conversation | [Findings and coverage](shared/findings.json), [report](shared/report.md). No preseeded records or provider fixtures. |
| Developer/native deeper journeys | 39 captured checkpoints; zero page/console errors; observed defects separately retained | [Fresh journey](native/journey.json), [returning use](native/returning.json), [fault injection](native/failures.json), [invalid import](native/import-rejection.json). RN Web animation fallback warnings occurred. |
| Live synthetic receipt | Three lines retained; two food items; zero meals; reviewed $12.77 persisted | [Receipt result](evidence/capture-deep/02-receipt-result.txt), [stored summary](evidence/capture-deep/persisted-summary.json), [return](evidence/capture-deep/11-reload-spending.txt). Printed test receipt was visually checked. No real package match was confirmed. |
| Focused current desktop fixtures | 16 passed, zero failed/skipped | [Playwright JSON](evidence/capture-fixtures.json). Tests: `voice-flows`, `scanner-flows`, `receipt-capture`, `agent-connections`; one worker against root-owned server. Provider/auth/media fixtures are explicitly simulated. |

The previous remediation's full unit/browser results remain available in its [verification record](../2026-09-30-remediation/verification.md). They were not all rerun during this audit and are not counted as fresh round-two checks. New findings are retained observations, not tests rewritten to pass or fixes introduced here.

## Whole-app coverage

“Browsed” means entered and inspected. “Exercised” means an action and resulting state were checked. “Fixture” means controlled responses/faults, not the real service.

| Surface | Fresh coverage | Practical limit |
|---|---|---|
| Welcome, tour, guest setup, return | All five; two full tours; all return after weight save. Additional novice tours and native guest setup | No real signup/recovery email |
| Chat and proposals | Four common live requests; three-turn live portion sequence; review/accept; exercised training chat and unconnected native retry | Small synthetic sample; no production quality or response-time claim |
| Voice | Fresh desktop fixtures for review/edit/send, cancellation, late permission, denial, unsupported browser and local set update | No real speech, microphone or phone permission journey |
| Meal/photo and receipt capture | Capture surfaces all five; actual upload/preview of synthetic receipt and live result; fresh cancel/offline fixture | No representative photo/receipt corpus or physical camera |
| Barcode, private labels, product matches | All five browse; fresh invalid/ambiguous/private-label/serving/upload-decode fixtures; actual retained receipt candidates and package calculator | Catalog fixture checks are not real lookup availability; candidates not confirmed against a physical package |
| Nutrition, targets, dates and food correction | Empty/populated, Day/Week, decimal edit, repeat/backfill, portion math, unknown-data probe; native older-date retrieval probe | Nutrition accuracy and appropriateness of goals not validated |
| Workouts and history | All templates/builder/history browsed; set loads, chosen units, reorder/jump, rest, technique, effort, partial finish, correction; 13 native sessions | No exercise performance or training-program efficacy study |
| Activity and body weight | Manual/live walking; running; activity count; common body-weight save/reload | No wearable sync, medical outcomes or long-term trend study |
| You and weekly review | All five; populated totals and unreviewed target comparisons; pending/completed review entry points | Not every possible generated review type recreated |
| Pantry and receipt review | Manual ingredients, stock, dates, live receipt queue, match/manual paths, nonfood exclusion, quantities | No real household inventory validation |
| Recipes and leftovers | Pantry prerequisite, preparation, fractional use, undo and return | No real cooking or spoilage evidence |
| Meal planning | Live week generation, edit/autosave/return, approval and repeat; shopping needs | One generated week is not representative culinary quality; generated ingredient schedules do not prove cooking guidance |
| Shopping preferences/list/swaps/spending | All tools browsed; relevant preferences saved/reloaded; deeper list/swap paths; live reviewed spending and return | Retail prices, availability and personal budget outcomes not verified |
| Account saving, backup, restore, reset | Account surfaces all five; actual local native export/import review and restoration; malformed input; injected persistence failure | No live account lifecycle, cross-device sync, actual deletion or hosted admission policy |
| Assistant connections | All five browse; current desktop lifecycle/acknowledgment/storage/conflict fixtures | No production external-assistant integration |
| Help/privacy/support | All five; native data-handling and diagnostic source review; owned support link visible | No message sent or support-response test |
| Accessibility and layout | Mobile/desktop common views, selected screenshot inspection, native overflow and nested keyboard focus check | No complete WCAG audit, screen-reader test or physical keyboard/device certification |

## Reproduction and audit tooling

Run the common script only with a separately owned Vite server: `node docs/audits/2026-09-30-personas-round-2/persona-walkthroughs.mjs`. It uses isolated contexts and makes four live local-provider requests. Lane scripts and exact actions are retained in their folders. Live results are nondeterministic; rerunning should not overwrite this evidence snapshot without first using a new output directory.

The focused fixture command was `node node_modules/@playwright/test/cli.js test tests/voice-flows.spec.ts tests/scanner-flows.spec.ts tests/receipt-capture.spec.ts tests/agent-connections.spec.ts --project=desktop --workers=1 --reporter=json`, with output redirected to the audit directory through `PLAYWRIGHT_JSON_OUTPUT_NAME` and `--output`.

Exploratory selector/timing mistakes were retained separately as harness evidence. Some snapshots show lazy loading; loaded follow-up snapshots support conclusions. Neither is counted as a product failure. A suspected missing apply-load-to-all-sets feature was rejected after finding and using Adjust exercise. A suspected portion-help dead end was rejected after a successful explicit-estimate conversation. The audit did not invent an issue to fill a persona quota.

The CYC controller could not start a run because source fingerprint selection exceeded the existing asset limit (`CYC-ASSETS-001`). Its configuration was not weakened. The direct evidence and response/artifact review gate are used; no controller-managed completion is claimed.

No public launch sign-off follows from these local results. Human wishes/avoidance, physical iOS/Android behavior, real email, production service behavior and representative food accuracy remain unverified.
