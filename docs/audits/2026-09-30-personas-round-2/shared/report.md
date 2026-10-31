# Novice journeys after remediation

These are two agent-led simulated sessions, not interviews or real participant testimony. Casey is a complete beginner; Morgan is physically fit but new to calorie tracking. The observations below came from isolated fresh guest browser contexts at 390 × 844, with actual Meet Spot onboarding and UI-entered synthetic data. There were no seeded records or mocked responses. Morgan made three real provider requests about an uncertain peanut-butter portion. Neither session represents physical exercise, medical validation, a week of real behavior, or measured retention.

Both could complete the core loop: understand onboarding, log and correct food, repeat food to yesterday, enter movement, save and correct training, and review saved records. Four remaining issues/opportunities were supported by the paths. [Structured findings](findings.json) contains priority, source locations, evidence and availability checks.

| Finding | Assessment | Practical effect |
| --- | --- | --- |
| SH-R2-01: manual unknown macros become confirmed zero | P1 data-confidence defect, reproduced in both contexts | A calories-only menu entry silently acquires apparently confirmed zero protein/carbs/fat. |
| SH-R2-02: untouched sample targets become progress criteria | P2 residual F08 inconsistency | Goal-free logging is promised, but ring, You and weekly review still compare against samples. |
| SH-R2-03: clarification footer asks about already-known meal intent | P3 residual F30 copy mismatch | Helpful portion guidance is undermined by an unrelated meal-versus-grocery footer. |
| SH-R2-04: repeated generic meal needs manual portion math | P3 convenience opportunity | Two servings require changing four nutrition values independently. Same-portion repeat works. |

## What the beginner actually did

Casey opened all four Meet Spot panels, selected guest use and “A little of both,” and reached Chat. The guest setup now clearly says records stay on this device. Nutrition explicitly identifies the targets as samples. The expanded “New to targets?” section says recording meals without choosing a goal is allowed; Casey left targets unconfigured. Kitchen’s six-step first-week guide was inspected without claiming those setup steps had been completed.

A hypothetical label-based yogurt was entered with 215 calories, 18.3 g protein, 33 g carbs and 0.4 g fat. Saving worked. A name-only correction retained decimals. Repeat meal opened an editable review, clearly stated same portions and no pantry/recipe changes, and successfully saved to September 29. Previous-day navigation found the record; its name was corrected. “Log a meal” then opened Chat with the September 29 capture-date banner and a “Use today instead” action. These are concrete improvements over F01/F16/F18, not just available controls.

The deliberate calories-only probe then exposed SH-R2-01. A fresh manual form has actual input values `0` in all four nutrition fields, not empty placeholders. The auditor changed only the name and calories to 170. Save produced “Confirmed 170 cal 0g protein 0g carbs 0g fat.” The form gives no unknown-versus-zero guidance. [Raw defaults](evidence/beginner/raw-manual-defaults.json), [before-save screenshot](evidence/beginner/21-calories-only-before-save.png), and [saved record](evidence/beginner/22-calories-only-saved.txt) preserve the distinction between untouched defaults and deliberately entered zeros. Weekly review subsequently says none of these meals still uses estimated nutrition.

Casey entered a 20-minute walk. The form explicitly says it does not estimate calorie burn or change food targets. In the Upper Body starter, no load was prescribed and rep buttons were locked until the auditor chose a synthetic 15 lb load. The expanded Bench Press guidance provided setup cues and an ACE guide link. One set was recorded, optional effort set to 6, and the 90-second rest timer started. A partial-finish dialog accurately stated 1 of 12 sets recorded and left empty sets unrecorded. “Correct this workout” reopened it, 8 reps became 7, and history showed exactly 15 lb × 7. No physical lifting was performed or recommended by this audit.

You showed two days with meals or movement and accurately counted the one saved workout/set. The weekly review carefully framed partial food logs and unknown days, which is good. However it also judged 0 of 2 days against a “current 110g target” that had never been selected. You calls the same sample values “Your saved daily targets.” Those observations support consistent goal-free reporting, not a demand for automatic calorie prescriptions.

Food and routine preferences were compact on entry. Casey expanded only the relevant sections, saved 20-minute cooking time and a short-session/walking preference, reloaded, and verified persistence. Body-weight entry and external assistant connections were visible but not used in this scenario. That is a scenario choice, not evidence of dislike or abandonment.

## What the fit new tracker actually did

Morgan took the same actual onboarding and food-correction path with “Food & meals” as the initial focus. Decimal label nutrition, repeat-to-yesterday, correction and selected-date handoff all worked. No goal was chosen. A separate calories-only probe reproduced SH-R2-01.

The live conversation was **peanut butter only**, with no toast or other foods in the request:

1. “I ate peanut butter for breakfast, but I do not know how much. How can I log that?” The assistant asked for tablespoons or grams without silently assigning an amount.
2. “I already ate it and cannot measure it now; I genuinely cannot remember how much. What can I do?” It offered an assumed common-serving estimate for review or a note-only option. This was helpful, not a dead end. The note-only branch was offered but not tested. Its secondary footer nevertheless asked whether the event was a meal or grocery purchase.
3. “Please use 2 tablespoons as an explicitly uncertain estimate of my peanut butter breakfast today. Show me the estimate for review.” A reviewable 190-calorie, 8 g protein, 6 g carbohydrate and 16 g fat proposal identified the portion as uncertain. Prose and card matched. Acceptance saved it with an estimate marker. This is a single unmocked sequence, not a provider reliability rate.

See [uncertain follow-up](evidence/fit-new-tracker/26-uncertain-followup-reply.txt), [proposal](evidence/fit-new-tracker/28-portion-estimate.txt), and [acceptance](evidence/fit-new-tracker/29-live-meal-accepted.txt). The transcript preserves both the successful guidance and the footer defect.

Morgan selected kg, entered a 25-minute run, and started Upper Body. “Adjust Bench Press” supplied a shared 20 kg load to all three sets; three 8-rep sets could then be recorded directly. This disproved an initial possible wish for applying one weight across sets: that capability already exists. The auditor moved Seated Cable Row earlier, used Jump to exercise, opened its guidance, started and ended rest, saved the partial workout, and saw 20 kg × 8 three times in history. Optional food/routine preferences also survived reload.

To explore portion changes, Morgan repeated the yogurt as two original servings. There is no multiplier in the generic meal-repeat form, so 215/18.3/33/0.4 had to become 430/36.6/66/0.8 by editing each field. It saved correctly. This is an ease-of-use opportunity, not inability to log two servings. Source and UI review confirm scope: recipes and barcode capture already have serving/portion controls, while this generic repeated meal path does not. [Before](evidence/fit-new-tracker/63-repeat-portion-choice.txt), [manual calculation](evidence/fit-new-tracker/64-double-manual-math.txt), [saved result](evidence/fit-new-tracker/65-double-repeat-saved.txt).

## Expectations, reactions and likely repeat use

For a beginner, the strongest likely recurring value is editable food logging, walking, short workouts with optional guidance, and descriptive weekly review. A reasonable expectation is that unknown nutrition remains unknown and that declining a goal does not produce goal-attainment judgments. We observed behaviors supporting those expectations; we did not observe a real person become upset.

For a fit new tracker, repeatable foods, portion review, previous-day corrections and kg workout history are plausible daily tools. A serving multiplier would reduce arithmetic in a path actually exercised here. The live uncertain-portion conversation and safe partial-workout correction are plausible pleasant surprises because they resolved genuine scenario questions. No claim is made that a real person experienced delight.

First-week explanation, exercise technique after familiarity, Spot mood changes, external assistant connections and body-weight history are optional relative to these particular tasks. Pantry, shopping and household meal planning may become useful if these people also manage groceries; this deep journey supplies no evidence that they would regularly use or avoid them. The parent audit separately covers those surfaces. We did not manufacture an avoidance list: the only observed non-use here was leaving calorie goals, body-weight measurements and external connections unset while completing the chosen tasks.

## Evidence and boundaries

`evidence/beginner/` and `evidence/fit-new-tracker/` pair numbered ARIA snapshots with screenshots. The manual-entry screenshot was visually inspected at the captured mobile viewport. Both console logs remained empty for warnings/errors, and no page errors were reported through the end of these interactions. Preferences and saved record counts survived reload. Other agents cover native and the broad common five-persona surface inventory; these sessions do not independently establish physical-phone, camera, microphone, signed-in sync or multiday reliability.

Harness failures are retained and excluded from product findings: an initial Notes label lookup, a View history lookup on a screen where history is reached via Choose your next workout, and a preferences summary/hidden-legend ambiguous selector. Each was corrected and the intended journey completed. Immediate snapshot 52 captured before the lazy preferences dialog; later 53/54 records the loaded dialog. Initial live-send snapshots 23/24 were overwritten by the second send, but 25–28 preserve the full exact conversation. `session.mjs` establishes isolated contexts; `steps.mjs` is the exploratory phase driver, not a one-command production test suite.

No product code was changed during this audit.
