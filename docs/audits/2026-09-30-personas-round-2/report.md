# Rep & Plate — second five-persona audit

September 30, 2026 · Remediated working tree · Simulated persona sessions

The previous fixes made the core tasks substantially more usable, but this repeat audit found remaining behavior problems and recurring-use opportunities. The next work should address record confidence, access to older records, truthful saving status and blocked controls before expanding the feature set. A remedy for each original finding did not mean every related path was resolved.

After merging duplicate observations, the log contains **12 observed friction items, 6 improvement hypotheses and 1 performance investigation**. The friction items include copy and navigation inconsistencies as well as defects; these are not nineteen launch blockers. The performance item is explicitly unproven on production.

| Address first | Then simplify | Validate before expanding |
|---|---|---|
| Unknown macros becoming confirmed zeros; older native history access; truthful guest saving status; notification covering Send | Consistent workout units; persistent rest timer; goal-free summaries; receipt-review routing | Reusable routines; repeated-meal scaling; cooking directions and meaningful meal variety |

These were five **simulated perspectives**, not human research participants. Actual UI actions, saved data, screenshots, live responses and source traces support observations. Wishes, likely frustration or pleasant surprise, future use and potential avoidance are explicitly hypotheses. No participant quotes, satisfaction scores, retention forecasts or manufactured avoidance are used.

Start with the [prioritized friction and opportunity log](friction-log.md), its [structured JSON](friction-log.json), and the [coverage and verification record](verification.md). The original [31 findings](../2026-09-30-personas/friction-log.md) and [remediation map](../2026-09-30-remediation/README.md) remain unchanged. App source was held stable during this pass; findings are recommendations, not implemented changes.

## What the repeat sessions established

All five fresh onboarding and full-surface traversals completed, with **177 retained checkpoints and no captured page or console errors**. The four representative live requests exercised kg strength capture, walking, a component-based lunch and an unknown food portion. A separate live synthetic receipt exercised purchase extraction, review navigation, package-serving calculation and reviewed spending. Sixteen focused desktop fixtures passed for voice, scanner, receipt and assistant-connection behaviors; those fixtures do not establish real microphone, account or provider behavior.

The deeper sessions went beyond opening screens: manual meals and decimal corrections, backfilling and repeating meals, uncertainty clarification, activities, actual set entry, partial completion and historical correction, recipe portions and undo, plan generation/edit/approval/repeat, shopping and backup/recovery. The expert/tracker lane retained 80 additional checkpoints; the developer/native lane retained 39, alongside the separate novice and receipt evidence. All 288 fingerprinted app/source/script files were unchanged at the closing comparison. Read the coverage table before interpreting “whole app”: some external services and hardware paths remain untested.

## What each persona might keep using

The following is a product-fit hypothesis grounded in the executed journeys, not evidence of adoption.

| Persona | Plausible recurring essentials | Evidence-backed direction to make it easier | Occasional or optional value |
|---|---|---|---|
| Experienced gym enthusiast | Precise set logging, correction, load history, repeated meals | Consistent chosen units throughout; reusable routines and better comparison with prior sessions | AI workout generation if already following a program; grocery planning if not managing household food |
| Complete beginner | One understandable meal or movement entry, a simple daily picture, starter exercise guidance | Handle partially known food values honestly; offer a true goal-free start; keep the next action easy to reach | Full pantry, spending, swaps and assistant connections can wait |
| Six-month gym and calorie tracker | Decimal food records, quick repeat, backfill, training history, batch portions | Easier meal/routine reuse, editable recurring plans and fewer review-path detours | Shopping tools depend on whether they buy and prepare the household’s food |
| Fit but new to calories | Portion learning, explicit estimates, easy correction, daily/weekly view | Continue helping when a portion is unknown; avoid treating sample targets as personal judgments | Exercise instruction may be redundant; detailed pantry setup is optional |
| Developer auditor | Inspectable persistence, export/import, clear saving state, recovery, accessible controls | Reach all saved history; prevent notifications blocking actions; make guest/account status truthful | Connections are useful for integration testing, not evidence that every fitness user wants them |

## Experienced gym enthusiast

The fresh route allowed skipping the character tour. A live 80 kg bench entry became an explicit review card. In the deeper workout, kg rows, per-set loads, flexible exercise order, rest, optional effort, partial-finish confirmation and historical correction worked. Those are observed capabilities with plausible daily value.

The remaining unit mismatch sits in workout Chat: a set entered in kg is narrated as a long decimal in pounds. The record and primary workout display can be correct while the feedback still makes the user mentally convert. That is a consistency issue, not a need for another measurement feature. The rest timer also reset during ordinary navigation, reproduced twice; a timer that starts successfully still needs to survive looking elsewhere in the app.

A customized starter session also leads to a plausible wish for a reusable routine and prior-session context. This is broader than correcting one completed session. The desired convenience should preserve deliberate load confirmation; automatically treating yesterday’s weight as today’s recorded performance would be the wrong shortcut. See the [expert deep-session report](kitchen/report.md) for the exact executed paths and source checks.

Potential pleasant surprise: flexible logging and correcting a finished session now work. Potential postponement: shopping setup or AI routine generation when the person already has those systems. Neither reaction was observed in a human.

## Complete beginner

The full introduction and local-storage setup were understandable in the inspected flow. The initial walk is now supported. Direct manual entry, decimal correction, repeating a meal to yesterday, changing that date’s meal, activity entry, starter guidance, rest and returning after reload were exercised successfully.

The remaining confidence problem is a calories-only entry. On the web, untouched macro fields start at zero, and the resulting meal is labeled confirmed with zero protein, carbohydrate and fat. This does not express “I know the calories but not the macros.” Native instead leaves those fields blank and rejects the incomplete entry. A beginner could plausibly want a simple calories-only path, but the immediate requirement is to avoid turning unknown information into confirmed values.

Sample targets are labeled on the Nutrition page; however, other summaries still evaluate recorded food against those unreviewed values. A goal-free or learning-first view is a grounded opportunity. It should be evaluated with people before adding another lengthy setup wizard. See the [novice session report](shared/report.md).

Potential pleasant surprise: a walk counts, mistakes can be corrected, and a missed or unlogged day is not automatically judged. No natural abandonment of Kitchen was observed; postponing it is only a hypothesis based on the extra setup it requires.

## Six-month gym and calorie tracker

The strongest repeat-use evidence is straightforward record handling: known decimals, reviewed dates, reusable meals and prepared portions. Pantry ingredients stayed separate from intake; preparing, logging a fraction and undoing a portion supplied useful accounting behavior. The live planner retained drafts through editing and return, with explicit approval and repetition.

The audit also found a labeling inconsistency: manually entered pantry ingredients have no known purchase date, yet planning prose refers to their capture date as a purchase. There is an additional discoverability issue after a receipt: the review queue opens manual details even when product matches already exist in another route. These are refinements to existing capabilities.

The generated dinner week supplied ingredient/portion schedules. It did not establish culinary quality or cooking directions. A wish for practical preparation guidance or less pantry-dominated variety is credible in that observed context, but one generated plan cannot establish general dissatisfaction. See the [food and Kitchen session report](kitchen/report.md).

Potential pleasant surprise: fractional portions and undo protect stock and intake separately. Pantry and spending remain optional for a tracker who does not want to manage groceries in the same app.

## Fit person new to calorie tracking

The common walkthrough asked about toast with an unknown peanut-butter portion and received a clarifying question. A separate deep conversation intentionally used **peanut butter only**. When unable to remember the amount, the assistant offered either a reviewable common-serving estimate or a note-only option. Explicit consent to an uncertain two-tablespoon estimate produced a labeled proposal and matching totals. It was not a dead end, and no missing portion-assistance feature is claimed.

A secondary helper line nevertheless asked whether the clearly eaten food was a meal or grocery purchase. The useful provider response and generic supporting copy were out of step. Consistent uncertainty messaging would make the existing capability easier to trust.

The same calories-only and unreviewed-target findings matter here. Fitness experience does not imply knowledge of calorie targets or portion weights. Barcode/label review, direct correction and clear estimates are plausible essentials; a detailed pantry or beginner lifting guidance need not be.

## Software developer auditor

The fresh web walkthrough covered account, privacy, diagnostics, support and connections. The default support route points to the owned address supplied by the user. Native deep checks exercised actual local export/import, offline-style manual record handling, interruption/return and an explicitly injected storage failure. The storage failure exposed a warning and allowed exporting the in-memory record that had not reached durable storage.

The additional native checks found important remaining boundaries: restricted history windows, an unconditional account-saving claim in guest state, and a saved-meal notification covering Chat Send until dismissed. These are concrete behavior findings with retained reproduction evidence. The report distinguishes the Expo-web result from physical iOS/Android behavior. See the [developer/native report](native/report.md).

Passing fixtures and zero page errors did not rule these issues out: valid application behavior can still hide a record, misstate its saving status or obstruct a control. No comprehensive security or accessibility certification is implied.

## What was actually avoided

No natural user avoidance was measured. The audit deliberately instructed every persona to open the whole app, which prevents using completion or noncompletion as evidence of spontaneous discovery or preference. Suspected postponement of advanced Kitchen setup, mascot interactions or integrations remains a research question.

In the live receipt session, the auditor did not apply a candidate product without a physical package to compare. That was an evidence constraint, not a simulated dislike of product matching. Camera, real speech, actual account email and deployment checks were not performed; those are scope boundaries, not abandoned features.

## Suggested next decision

Treat reproducible confidence, access and obstruction issues as the next correction batch. Treat convenience wishes as hypotheses to prioritize with human sessions. A useful human follow-up is an unprompted first task, a correction, an interruption and a second-day repeat; only then offer optional Kitchen tools. Observe what people discover, defer or ignore and ask about the moment immediately afterward. Do not turn every inferred wish into a launch requirement.

Physical-device behavior, real account/support email delivery, the intended hosted release, representative food accuracy, operating cost and long-term human use remain open. This audit reports the current local behavior and its limits.
