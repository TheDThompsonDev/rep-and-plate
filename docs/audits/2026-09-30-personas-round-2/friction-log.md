# Round-two friction and opportunity log

Every observed statement below is supported by retained local evidence. Expectations, wishes and recurring-use value are analyst hypotheses. “Friction” includes defects and cumbersome existing paths; an “opportunity” is not a launch requirement. No product fixes were made in this pass.

P1: correct before relying publicly on affected records. P2: next correction/usability batch. P3: lower urgency polish/convenience. Research: obtain production evidence before claiming a defect. Priority is audit triage, not a measured user vote.

| ID | Type | Priority | Finding |
|---|---|---|---|
| R2-01 | friction | P1 | [Untouched manual macro defaults become confirmed zero nutrition](#r2-01) |
| R2-02 | friction | P2 | [Unconfigured sample targets still become progress criteria](#r2-02) |
| R2-03 | friction | P2 | [Persistent notification intercepts Chat Send](#r2-03) |
| R2-04 | friction | P2 | [Older manual meals cannot be retrieved through native diary](#r2-04) |
| R2-05 | friction | P2 | [Workout detail and correction history stops after twelve sessions](#r2-05) |
| R2-06 | friction | P2 | [Guest backup tool promises automatic account saving](#r2-06) |
| R2-07 | friction | P2 | [Pantry review queue bypasses the available product-match comparison](#r2-07) |
| R2-08 | friction | P2 | [Kilogram workouts switch back to pounds in conversation](#r2-08) |
| R2-09 | friction | P2 | [Planner invents a purchase date for manually entered stock](#r2-09) |
| R2-10 | friction | P2 | [Rest timer is lost when navigating within the app](#r2-10) |
| R2-11 | friction | P3 | [Clarification footer forgets already-clear meal intent](#r2-11) |
| R2-12 | friction | P3 | [Invalid backup exposes raw parser error](#r2-12) |
| R2-13 | opportunity | P2 | [Reuse a personal workout instead of reconstructing it](#r2-13) |
| R2-14 | opportunity | P2 | [Same-load setup works through Adjust exercise but is easy to miss](#r2-14) |
| R2-15 | opportunity | P2 | [Generated meal plans stop at ingredients, not a cooking method](#r2-15) |
| R2-16 | opportunity | P3 | [Changing the portion of a repeated manual meal requires four calculations](#r2-16) |
| R2-17 | opportunity | P3 | [Use the same account-data tool name in privacy help and navigation](#r2-17) |
| R2-18 | opportunity | P3 | [Named variety can still mean the same pantry base every day](#r2-18) |
| R2-19 | investigation | Research | [Optimize and budget cold-start images and JS](#r2-19) |

<a id="r2-01"></a>

## R2-01: Untouched manual macro defaults become confirmed zero nutrition

**friction · P1** · reproduced data-confidence defect. Origin: [SH-R2-01](shared/report.md).

**Personas:** complete beginner, fit but new to calorie tracking.

**Observed:** Open Enter meal manually. All four nutrient fields initially contain numeric 0. Enter only a name and 170 calories from a hypothetical menu; leave protein, carbs and fat untouched. Save succeeds, displaying Confirmed 170 cal 0g protein 0g carbs 0g fat. The only instruction is Your own values, saved exactly as entered. Weekly review counts this as non-estimated nutrition. Reproduced independently in both contexts.

**Expected / hypothetical need:** A novice who knows menu calories but not macros may expect omitted knowledge to remain unknown, rather than being treated as measured zero.

**Possible wish / proposed response:** Require deliberate nutrient entry or provide explicit unknown macros with incomplete-data treatment in totals. Preserve valid deliberately entered zeros.

**Already available / scope check:** src/App.tsx:239 initializes all nutrients at0 and confidence confirmed; MealEditor:2378-2383 parses all fields and sets confirmed. Required inputs already have defaultValue0. Native parity differs: other audit agent verified native starts blank and rejects missing values.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Related original findings:** F26. This is a residual or extension, not proof that every original remedy failed.

**Evidence:** [shared/evidence/beginner/11-manual-meal-empty.txt](shared/evidence/beginner/11-manual-meal-empty.txt) · [shared/evidence/beginner/raw-manual-defaults.json](shared/evidence/beginner/raw-manual-defaults.json) · [shared/evidence/beginner/21-calories-only-before-save.png](shared/evidence/beginner/21-calories-only-before-save.png) · [shared/evidence/beginner/22-calories-only-saved.txt](shared/evidence/beginner/22-calories-only-saved.txt) · [shared/evidence/beginner/51-weekly-review.txt](shared/evidence/beginner/51-weekly-review.txt) · [shared/evidence/fit-new-tracker/22-calories-only-saved.txt](shared/evidence/fit-new-tracker/22-calories-only-saved.txt) · [native/06-calories-only-rejected.txt](native/06-calories-only-rejected.txt)

<a id="r2-02"></a>

## R2-02: Unconfigured sample targets still become progress criteria

**friction · P2** · reproduced cross-surface copy/behavior inconsistency; improvement hypothesis. Origin: [SH-R2-02](shared/report.md).

**Personas:** complete beginner, fit but new to calorie tracking.

**Observed:** Neither persona configured targets. The new Nutrition banner correctly labels samples and target guide explicitly allows logging without a calorie goal. After one215cal meal the prominent ring still says1785 calories left of2000. You labels them Your saved daily targets. Weekly review says0 of2 logged days reached your current110g target, even though the only reviewed goals were explicitly left unconfigured.

**Expected / hypothetical need:** A logger who intentionally has no goal may expect descriptive recorded totals rather than progress toward an untouched example.

**Possible wish / proposed response:** Use a goal-free view until targets are explicitly configured, or consistently label every comparison as illustrative. This is not a request for automatic calorie prescriptions.

**Already available / scope check:** NutritionPage.tsx:199 renders calories left based on meals.length, not targetsConfigured; YouPage.tsx:556 always says saved daily targets; features/insights/insights.ts:162 generates reached-current-target text. No hide-goals control found in target editor.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Related original findings:** F08. This is a residual or extension, not proof that every original remedy failed.

**Evidence:** [shared/evidence/beginner/10-targets-expanded.txt](shared/evidence/beginner/10-targets-expanded.txt) · [shared/evidence/beginner/13-manual-saved.txt](shared/evidence/beginner/13-manual-saved.txt) · [shared/evidence/beginner/50-you.txt](shared/evidence/beginner/50-you.txt) · [shared/evidence/beginner/51-weekly-review.txt](shared/evidence/beginner/51-weekly-review.txt) · [shared/evidence/fit-new-tracker/50-you.txt](shared/evidence/fit-new-tracker/50-you.txt)

<a id="r2-03"></a>

## R2-03: Persistent notification intercepts Chat Send

**friction · P2** · observed and separately reproduced. Origin: [DEV-01](native/report.md).

**Personas:** developer.

**Task / reproduction:** Save a manual meal, switch to Chat, type and click Send without dismissing saved notice

**Observed:** Send center hit-tests to Dismiss notification and normal pointer click fails; dismissing notice permits Send

**Expected / hypothetical need:** Keep notifications clear of composer actions and define dismissal/expiry behavior

**Possible wish / proposed response:** Keep notifications clear of composer actions and define dismissal/expiry behavior

**Potential recurring value:** Recoverable extra action blocks a central workflow

**Confidence / boundary:** observed and separately reproduced. Expo-web native preview; physical device behavior unverified.

**Source:** [mobile/App.tsx:237](C:/Users/danny/Documents/coding/fitness/mobile/App.tsx:237)

**Evidence:** [native/40-toast-over-composer.png](native/40-toast-over-composer.png) · [native/failures.json](native/failures.json) · [native/failure.png](native/failure.png)

<a id="r2-04"></a>

## R2-04: Older manual meals cannot be retrieved through native diary

**friction · P2** · observed plus alternate-route source review. Origin: [DEV-02](native/report.md).

**Personas:** developer.

**Task / reproduction:** Save a meal dated August31 while current day is September30

**Observed:** Meal persists and exports, but selectable diary days are September24–30. You/review/chat/pantry supply no alternate full food archive or manual meal editor

**Expected / hypothetical need:** Expose arbitrary day selection or searchable full history and a post-save link to chosen date

**Possible wish / proposed response:** Expose arbitrary day selection or searchable full history and a post-save link to chosen date

**Potential recurring value:** Ordinary history eventually cannot be corrected, repeated or deleted through the app

**Confidence / boundary:** observed plus alternate-route source review. Expo-web native preview; physical device behavior unverified.

**Related original findings:** F18. This is a residual or extension, not proof that every original remedy failed.

**Source:** [mobile/src/screens.tsx:59](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:59)

**Evidence:** [native/09-old-meal-disappears.png](native/09-old-meal-disappears.png) · [native/10-week-history-controls.txt](native/10-week-history-controls.txt) · [native/journey.json](native/journey.json) · [native/synthetic-guest-backup.json](native/synthetic-guest-backup.json)

<a id="r2-05"></a>

## R2-05: Workout detail and correction history stops after twelve sessions

**friction · P2** · observed 13 actual UI sessions. Origin: [DEV-03](native/report.md).

**Personas:** developer.

**Task / reproduction:** Start, log and finish thirteen sessions

**Observed:** Thirteen sessions are persisted; only twelve correction cards render, without pagination/full history

**Expected / hypothetical need:** Keep recent summary but provide all history

**Possible wish / proposed response:** Keep recent summary but provide all history

**Potential recurring value:** Returning users lose UI access to older set details/corrections even though data remains

**Confidence / boundary:** observed 13 actual UI sessions. Expo-web native preview; physical device behavior unverified.

**Related original findings:** F28. This is a residual or extension, not proof that every original remedy failed.

**Source:** [mobile/src/NativeWorkout.tsx:258](C:/Users/danny/Documents/coding/fitness/mobile/src/NativeWorkout.tsx:258)

**Evidence:** [native/31-thirteen-workouts.png](native/31-thirteen-workouts.png) · [native/returning.json](native/returning.json)

<a id="r2-06"></a>

## R2-06: Guest backup tool promises automatic account saving

**friction · P2** · observed fresh guest. Origin: [DEV-04](native/report.md).

**Personas:** developer.

**Task / reproduction:** Fresh guest without server/account opens Cloud & your records

**Observed:** Unconditional account saves automatically copy appears above missing-server instruction

**Expected / hypothetical need:** Render storage/sync status from actual connection/account state

**Possible wish / proposed response:** Render storage/sync status from actual connection/account state

**Potential recurring value:** User can misunderstand recovery and cross-device availability

**Confidence / boundary:** observed fresh guest. Expo-web native preview; physical device behavior unverified.

**Related original findings:** F03. This is a residual or extension, not proof that every original remedy failed.

**Source:** [mobile/src/Cloud.tsx:88](C:/Users/danny/Documents/coding/fitness/mobile/src/Cloud.tsx:88)

**Evidence:** [native/13-guest-cloud-copy.png](native/13-guest-cloud-copy.png) · [native/13-guest-cloud-copy.txt](native/13-guest-cloud-copy.txt) · [native/02-guest-storage-copy.txt](native/02-guest-storage-copy.txt)

<a id="r2-07"></a>

## R2-07: Pantry review queue bypasses the available product-match comparison

**friction · P2** · existing capability difficult to discover. Origin: [R01](root-findings.json).

**Personas:** six-months, fit-new-tracker, beginner.

**Task / reproduction:** Receipt capture → pantry food-review queue

**Observed:** A live synthetic receipt saved two food items and one nonfood item. The queue correctly excluded nonfood. Review Kroger Vitamin D Whole Milk opened a manual details form without the saved USDA candidates. Closing that form returned to Your groceries; expanding the item exposed Review USDA matches and the retained candidates.

**Expected / hypothetical need:** A request to confirm product and nutrition offers the candidates already found for that receipt item.

**Possible wish / proposed response:** Put product matching and manual label correction together at the queue entry, so confirming a package does not require discovering a second review path.

**Already available / scope check:** Product matching is present, including barcode, text search and package-serving calculator. This is a routing/discoverability issue, not a request to build product search.

**Current workaround:** Close the manual editor, expand the item in Your groceries, choose Review USDA matches.

**Potential recurring value:** Potential weekly cost for receipt/pantry users; not relevant to people who only log meals.

**Suggested acceptance:** For an uncertain food with saved candidates, the queue entry exposes match comparison and manual correction without backing out into a different list; purchase quantity remains explicitly reviewed.

**Confidence / boundary:** High for observed routing/source; unvalidated for human preference or severity.

**Related original findings:** F27. This is a residual or extension, not proof that every original remedy failed.

**Source:** [src/features/pantry/PantryDialog.tsx:343](C:/Users/danny/Documents/coding/fitness/src/features/pantry/PantryDialog.tsx:343) · [src/AICards.tsx:195](C:/Users/danny/Documents/coding/fitness/src/AICards.tsx:195) · [src/AICards.tsx:199](C:/Users/danny/Documents/coding/fitness/src/AICards.tsx:199)

**Evidence:** [evidence/capture-deep/03-receipt-details.txt](evidence/capture-deep/03-receipt-details.txt) · [evidence/capture-deep/04-product-review.txt](evidence/capture-deep/04-product-review.txt) · [evidence/capture-deep/06-expanded-product.txt](evidence/capture-deep/06-expanded-product.txt) · [evidence/capture-deep/07-usda-candidates.txt](evidence/capture-deep/07-usda-candidates.txt)

<a id="r2-08"></a>

## R2-08: Kilogram workouts switch back to pounds in conversation

**friction · P2** · reproduced-product-defect. Origin: [K01](kitchen/report.md).

**Personas:** expert.

**Task / reproduction:** Select kg, start Upper Body, Adjust Bench Press to 80 kg, save, record 8 reps. Compare set with reply. Reproduced using per-set load and upfront adjustment.

**Observed:** Two separate sessions display 80 kg in the set/history but append Got it. Bench Press, set 1: 176.3698 lb × 8 reps. Corrections also report pounds. UI numeric data remains correct.

**Expected / hypothetical need:** Conversation uses the chosen workout unit with sensible display precision.

**Possible wish / proposed response:** Conversation uses the chosen workout unit with sensible display precision.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Related original findings:** F13. This is a residual or extension, not proof that every original remedy failed.

**Source:** [src/workouts.ts:188](C:/Users/danny/Documents/coding/fitness/src/workouts.ts:188)

**Evidence:** [kitchen/expert/16-refinished-correction.txt](kitchen/expert/16-refinished-correction.txt) · [kitchen/expert/17-return-to-options-history.txt](kitchen/expert/17-return-to-options-history.txt) · [kitchen/expert/37-kg-reproduction-adjust.txt](kitchen/expert/37-kg-reproduction-adjust.txt) · [kitchen/expert/41-kg-chat-visible.png](kitchen/expert/41-kg-chat-visible.png)

<a id="r2-09"></a>

## R2-09: Planner invents a purchase date for manually entered stock

**friction · P2** · reproduced-product-defect. Origin: [K02](kitchen/report.md).

**Personas:** expert, six-months.

**Task / reproduction:** Add a manual ingredient with quantity and label nutrition, open planner. No purchase-date field exists. Reopen after reload: purchase language remains. Open spending to see manual-stock records in the receipt-review list.

**Observed:** Manual stock is entered without purchase information. Kitchen correctly says Captured Sep 30. Planner says 6 labeled servings remain from your 2026-09-30 purchase. Spending also lists each manual ingredient as a grocery trip with a purchase date needing review, despite no receipt.

**Expected / hypothetical need:** Keep capture/on-hand dates distinct from purchases, including suggestions and spending-review eligibility.

**Possible wish / proposed response:** Keep capture/on-hand dates distinct from purchases, including suggestions and spending-review eligibility.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Related original findings:** F14. This is a residual or extension, not proof that every original remedy failed.

**Source:** [src/features/pantry/manual-ingredient.ts:10](C:/Users/danny/Documents/coding/fitness/src/features/pantry/manual-ingredient.ts:10) · [src/features/planning/meal-plans.ts:127](C:/Users/danny/Documents/coding/fitness/src/features/planning/meal-plans.ts:127) · [src/features/shopping/ShoppingDialog.tsx](C:/Users/danny/Documents/coding/fitness/src/features/shopping/ShoppingDialog.tsx)

**Evidence:** [kitchen/six-months/29-add-Rolled-oats.txt](kitchen/six-months/29-add-Rolled-oats.txt) · [kitchen/six-months/35-planner-settings.txt](kitchen/six-months/35-planner-settings.txt) · [kitchen/six-months/37-generated-dinner-week.txt](kitchen/six-months/37-generated-dinner-week.txt) · [kitchen/six-months/43-spending-without-receipts.txt](kitchen/six-months/43-spending-without-receipts.txt) · [kitchen/six-months/final-state.json](kitchen/six-months/final-state.json)

<a id="r2-10"></a>

## R2-10: Rest timer is lost when navigating within the app

**friction · P2** · reproduced-product-defect. Origin: [K03](kitchen/report.md).

**Personas:** expert.

**Task / reproduction:** Start timer, immediately open another bottom-navigation page, return to Workouts, expand Rest timer. No timer remains. Two reproductions were well inside 90 seconds.

**Observed:** Start 90-second rest, navigate Nutrition then Workouts: timer becomes Ready when you are. Repeated through Kitchen with the same result while the active workout persists.

**Expected / hypothetical need:** A running countdown remains tied to its end time across ordinary tab navigation.

**Possible wish / proposed response:** Custom rest duration could help an experienced lifter; only the 90-second preset is present. This preference is a hypothesis, not a participant request.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Related original findings:** F11. This is a residual or extension, not proof that every original remedy failed.

**Source:** [src/WorkoutPage.tsx:123](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:123) · [src/WorkoutPage.tsx:504](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:504)

**Evidence:** [kitchen/expert/39-rest-running.txt](kitchen/expert/39-rest-running.txt) · [kitchen/expert/40-rest-navigation-result.txt](kitchen/expert/40-rest-navigation-result.txt) · [kitchen/expert/42a-rest-live.txt](kitchen/expert/42a-rest-live.txt) · [kitchen/expert/42-rest-navigation-reproduction.txt](kitchen/expert/42-rest-navigation-reproduction.txt)

<a id="r2-11"></a>

## R2-11: Clarification footer forgets already-clear meal intent

**friction · P3** · observed secondary-copy mismatch in real provider conversation. Origin: [SH-R2-03](shared/report.md).

**Personas:** fit but new to calorie tracking.

**Observed:** After explicitly describing peanut butter eaten for breakfast and inability to remember amount, assistant helpfully offers an assumed portion or note-only option. Footer nevertheless says it needs more context before treating this as a meal or grocery purchase. Main answer is useful; interaction does not dead-end.

**Expected / hypothetical need:** The uncertainty should remain about portion, not whether the already-described breakfast was eaten.

**Possible wish / proposed response:** Use the known conversation intent when selecting clarification footer, or omit redundant generic footer when the assistant already explains the open choice.

**Already available / scope check:** server/ai.ts:172 contains the generic fallback. One live conversational occurrence; source-confirmed fallback, not claimed deterministic provider repeatability.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Related original findings:** F30. This is a residual or extension, not proof that every original remedy failed.

**Evidence:** [shared/evidence/fit-new-tracker/25-first-live-reply.txt](shared/evidence/fit-new-tracker/25-first-live-reply.txt) · [shared/evidence/fit-new-tracker/26-uncertain-followup-reply.txt](shared/evidence/fit-new-tracker/26-uncertain-followup-reply.txt) · [shared/evidence/fit-new-tracker/28-portion-estimate.txt](shared/evidence/fit-new-tracker/28-portion-estimate.txt)

<a id="r2-12"></a>

## R2-12: Invalid backup exposes raw parser error

**friction · P3** · observed deliberate malformed file. Origin: [DEV-05](native/report.md).

**Personas:** developer.

**Task / reproduction:** Select malformed synthetic JSON via Import a backup file

**Observed:** Records remain unchanged and restore is unavailable, but raw syntax error is displayed

**Expected / hypothetical need:** Explain invalid backup and invite another file with optional technical detail

**Possible wish / proposed response:** Explain invalid backup and invite another file with optional technical detail

**Potential recurring value:** Recovery explanation is technical and lacks a next step

**Confidence / boundary:** observed deliberate malformed file. Expo-web native preview; physical device behavior unverified.

**Source:** [mobile/src/storage.ts:295](C:/Users/danny/Documents/coding/fitness/mobile/src/storage.ts:295)

**Evidence:** [native/50-invalid-import.png](native/50-invalid-import.png) · [native/import-rejection.json](native/import-rejection.json)

<a id="r2-13"></a>

## R2-13: Reuse a personal workout instead of reconstructing it

**opportunity · P2** · missing-capability-hypothesis. Origin: [K04](kitchen/report.md).

**Personas:** expert, six-months.

**Observed:** Expert substituted OHP, changed its sets/target/load, and moved Row earlier. After finishing, Choose your next workout and Start workout returns the original Upper Body starter with Incline Press and original ordering. History and last actual loads persist, but no Save routine or Repeat session action was found in workout choices/history/builder source.

**Expected / hypothetical need:** A repeat-use lifter may want the same exercise lineup with fresh unlogged sets.

**Possible wish / proposed response:** Save as a personal routine or repeat this workout, explicitly reviewing loads and clearing completion. Do not auto-prescribe progression.

**Confidence / boundary:** Actual reset observed; absence checked in these UI/source surfaces, not every possible conversation phrasing. AI workout generation was not invoked in this lane..

**Related original findings:** F11, F28. This is a residual or extension, not proof that every original remedy failed.

**Source:** [src/workouts.ts:126](C:/Users/danny/Documents/coding/fitness/src/workouts.ts:126) · [src/WorkoutPage.tsx:317](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:317) · [src/WorkoutPage.tsx:926](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:926) · [src/features/workout-planning/WorkoutBuilder.tsx](C:/Users/danny/Documents/coding/fitness/src/features/workout-planning/WorkoutBuilder.tsx)

**Evidence:** [kitchen/expert/11-customize-unstarted-exercise.txt](kitchen/expert/11-customize-unstarted-exercise.txt) · [kitchen/expert/17-return-to-options-history.txt](kitchen/expert/17-return-to-options-history.txt) · [kitchen/expert/18-next-session-customization-not-reused.txt](kitchen/expert/18-next-session-customization-not-reused.txt) · [kitchen/expert/37-kg-reproduction-adjust.txt](kitchen/expert/37-kg-reproduction-adjust.txt)

<a id="r2-14"></a>

## R2-14: Same-load setup works through Adjust exercise but is easy to miss

**opportunity · P2** · found-but-hard-to-discover. Origin: [K05](kitchen/report.md).

**Personas:** expert, six-months.

**Observed:** Entering 80 kg in the first set leaves the next set without a confirmed load. Before logging anything, Adjust exercise to 80 kg confirms all sets; verified in expert second session and tracker Goblet Squat at 35 lb. After a recorded set, exercise-level weight is disabled and per-set editing remains available.

**Expected / hypothetical need:** Efficient repeated sets without losing the ability to record differing loads.

**Possible wish / proposed response:** Expose Apply this load to remaining sets near the first set, or point to the existing upfront Adjust exercise path. Do not describe bulk load setup as missing.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Related original findings:** F22. This is a residual or extension, not proof that every original remedy failed.

**Source:** [src/features/progress/set-loads.ts:7](C:/Users/danny/Documents/coding/fitness/src/features/progress/set-loads.ts:7) · [src/WorkoutPage.tsx:1337](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:1337)

**Evidence:** [kitchen/expert/08-second-set-load-required.txt](kitchen/expert/08-second-set-load-required.txt) · [kitchen/expert/10-adjust-after-recording.txt](kitchen/expert/10-adjust-after-recording.txt) · [kitchen/expert/37-kg-reproduction-adjust.txt](kitchen/expert/37-kg-reproduction-adjust.txt) · [kitchen/six-months/45-adjust-before-logging-and-alternate.txt](kitchen/six-months/45-adjust-before-logging-and-alternate.txt)

<a id="r2-15"></a>

## R2-15: Generated meal plans stop at ingredients, not a cooking method

**opportunity · P2** · missing-capability-hypothesis. Origin: [K07](kitchen/report.md).

**Personas:** six-months, expert.

**Observed:** One real HTTP 200 dinner week provides seven titles, ingredient quantities and partial nutrition but no preparation directions. Stew, bake, casserole, gratin and skillet names have no heat/time/method. In this request minutes were null because no cooking-time constraint was supplied.

**Expected / hypothetical need:** A person trying a newly suggested dish may need enough method to prepare it.

**Possible wish / proposed response:** Offer a separate reviewed cooking-method view with instructions that cannot make inventory claims. Current generated-note removal is an intentional truthfulness tradeoff, not a failed request.

**Confidence / boundary:** Did not cook the meals or assess taste/nutritional adequacy. One request cannot characterize all generations..

**Related original findings:** F19. This is a residual or extension, not proof that every original remedy failed.

**Source:** [src/features/planning/meal-plans.ts:57](C:/Users/danny/Documents/coding/fitness/src/features/planning/meal-plans.ts:57) · [src/features/planning/MealPlanner.tsx:118](C:/Users/danny/Documents/coding/fitness/src/features/planning/MealPlanner.tsx:118)

**Evidence:** [kitchen/six-months/planner-response.json](kitchen/six-months/planner-response.json) · [kitchen/six-months/37-generated-dinner-week.txt](kitchen/six-months/37-generated-dinner-week.txt) · [kitchen/six-months/49-planned-meal-detail-no-method.png](kitchen/six-months/49-planned-meal-detail-no-method.png)

<a id="r2-16"></a>

## R2-16: Changing the portion of a repeated manual meal requires four calculations

**opportunity · P3** · validated missing convenience in this specific path; not blocked functionality. Origin: [SH-R2-04](shared/report.md).

**Personas:** fit but new to calorie tracking, expert, six-months.

**Observed:** Same-portion repeat works and exposes editable date and nutrition. To repeat yogurt as two original servings, the auditor had to double215/18.3/33/0.4 into430/36.6/66/0.8 and edit the note. Save correctly succeeded. The repeat dialog offers no portion multiplier.

**Expected / hypothetical need:** A new tracker repeating a familiar food in a different amount may think in one or two servings rather than independently calculating four nutrient values.

**Possible wish / proposed response:** Offer0.5x/1x/2x or a serving multiplier on repeated saved meals, with a review before saving. Keep stock effects explicit.

**Already available / scope check:** App.tsx MealEditor and domain.ts:320 repeatMeal copy the same values; no multiplier parameter/control. This is not globally missing: recipe portion logging and barcode servings already support amount-based nutrition. Scope is repeated generic/manual meals.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Related original findings:** F16. This is a residual or extension, not proof that every original remedy failed.

**Evidence:** [shared/evidence/fit-new-tracker/16-repeat-review.txt](shared/evidence/fit-new-tracker/16-repeat-review.txt) · [shared/evidence/fit-new-tracker/63-repeat-portion-choice.txt](shared/evidence/fit-new-tracker/63-repeat-portion-choice.txt) · [shared/evidence/fit-new-tracker/64-double-manual-math.txt](shared/evidence/fit-new-tracker/64-double-manual-math.txt) · [shared/evidence/fit-new-tracker/65-double-repeat-saved.txt](shared/evidence/fit-new-tracker/65-double-repeat-saved.txt) · [kitchen/expert/26-correct-synthetic-food-and-repeat.txt](kitchen/expert/26-correct-synthetic-food-and-repeat.txt) · [kitchen/expert/27-repeat-today-persists.txt](kitchen/expert/27-repeat-today-persists.txt) · [kitchen/six-months/26-correct-synthetic-food-and-repeat.txt](kitchen/six-months/26-correct-synthetic-food-and-repeat.txt) · [kitchen/six-months/34-log-correct-portion.txt](kitchen/six-months/34-log-correct-portion.txt)

<a id="r2-17"></a>

## R2-17: Use the same account-data tool name in privacy help and navigation

**opportunity · P3** · Exists but wording differs. Origin: [DEV-W03](native/report.md).

**Personas:** developer.

**Observed:** Privacy refers to Account & saved data; native entry is Cloud & your records

**Possible wish / proposed response:** Use the same account-data tool name in navigation and help so the existing recovery tool is easier to find.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Evidence:** [native/12-data-help.txt](native/12-data-help.txt)

<a id="r2-18"></a>

## R2-18: Named variety can still mean the same pantry base every day

**opportunity · P3** · quality-limit-observation-with-hypothesis. Origin: [K08](kitchen/report.md).

**Personas:** six-months.

**Observed:** Variety mode returned seven different titles, but every dinner was one serving oats plus one serving milk plus a different vegetable. This satisfies the current at-least-three-title check and truthfully discloses partial nutrition and shortages.

**Expected / hypothetical need:** A person selecting variety may mean different primary ingredients or meal patterns.

**Possible wish / proposed response:** Explore a clearer variety preference or stronger ingredient-pattern diversity, while retaining an explicit repeat-friendly choice.

**Confidence / boundary:** Single sparse-pantry generation. No claim that users dislike oats or that all plans behave this way; no additional paid generation was needed..

**Related original findings:** F19. This is a residual or extension, not proof that every original remedy failed.

**Source:** [src/features/planning/meal-plans.ts:62](C:/Users/danny/Documents/coding/fitness/src/features/planning/meal-plans.ts:62)

**Evidence:** [kitchen/six-months/planner-response.json](kitchen/six-months/planner-response.json) · [kitchen/six-months/37-generated-dinner-week.txt](kitchen/six-months/37-generated-dinner-week.txt)

<a id="r2-19"></a>

## R2-19: Optimize and budget cold-start images and JS

**investigation · Research** · Engineering investigation supported by measured payload. Origin: [DEV-W02](native/report.md).

**Personas:** developer.

**Observed:** About15.3MB initial resource transfer from uncompressed loopback static server; principal JS4.06MB and multiple2.2–2.35MBPNGillustrations

**Possible wish / proposed response:** Check production transfer size and slow-network startup before choosing an optimization.

**Already available / scope check:** Loopback transfer was uncompressed; the observed interface remained usable. No production latency defect established.

**Confidence / boundary:** Observed behavior as described; hypothetical wishes unvalidated with humans.

**Evidence:** [native/baseline.json](native/baseline.json) · [native/journey.json](native/journey.json)

## Rejected or bounded candidate wishes

- Applying one load across an exercise already works through Adjust exercise; it is not an absent feature.
- Unknown portions can receive an explicit estimate-or-note choice. The estimate branch succeeded; the note-only branch was offered but not exercised.
- Product matching, barcode serving amounts and recipe portions already exist. The generic repeated-meal path is the narrower portion-scaling opportunity.
- Native unknown-macro rejection is honest about requiring all values; it is distinct from web defaults being silently accepted as confirmed zeros. Its optional calories-only wish is consolidated with the first finding.
- No natural user avoidance, actual emotional reaction or retention was measured. Physical-device, hosted-service and human-study boundaries remain open.
