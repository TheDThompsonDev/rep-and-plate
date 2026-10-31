# Rep and Plate friction log

September 30, 2026. This is an agent-led audit, not a study with human participants. Observed results and source-backed gaps are separate from predicted reactions. No abandonment, annoyance, delight, or long-term adoption was measured. Priorities are audit judgments; a High issue can be a functional defect, a broken first-use promise, or a public-launch prerequisite.

Read the [persona report](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/report.md) for scope, positive findings, full coverage, and recurring-use hypotheses. The [JSON log](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/friction-log.json) supports future triage.

| ID | Priority | Area | Finding |
|---|---|---|---|
| [F01](#f01) | High | Meal correction | Saving a meal containing 18.3 g protein and 0.4 g fat is blocked by step=1 numeric validation. |
| [F02](#f02) | High | Meal correction | Sequentially typing 18.3 into the protein field displays 183; onChangeText immediately applies Number(v). |
| [F03](#f03) | Medium | Guest onboarding | Guest setup says Your account saves changes automatically after Try on this device first. |
| [F04](#f04) | Medium | Activity overview | After one saved workout, You shows 0 of 7 days and Your first log starts the picture, beside 1 workout recorded. |
| [F05](#f05) | Medium | Workout history | Profile Workout history shows reps only; the 45 lb load is omitted. |
| [F06](#f06) | High | Review a corrected estimate | Live correction prose says 23 g protein, 34 g carbs and 1 g fat; its card and saved meal use 18.3, 33 and 0.4. |
| [F07](#f07) | High | First movement capture | A 20-minute walk request was declined as unsupported resistance-training capture and redirected toward Build a workout. |
| [F08](#f08) | Medium | Daily targets | Fresh state uses 2000 kcal, 110 g protein, 250 g carbs and 78 g fat. |
| [F09](#f09) | Medium | Start training | Web defaults to Upper Body with 185 lb bench, 60 lb incline dumbbell press and other example loads. |
| [F10](#f10) | Medium | Exercise understanding | Web exercise detail repeats load, sets, targets and adjustment instructions; illustrative photos do not provide movement instruction. |
| [F11](#f11) | Medium | Busy gym workout | Web active flow reveals the current exercise and a noninteractive Up Next card. |
| [F12](#f12) | High | Finish and correct a session | Finish immediately saves a partial workout. |
| [F13](#f13) | Medium | Record load in familiar units | Workout inputs and history use lb. |
| [F14](#f14) | Medium | Find an older grocery trip | Uploaded synthetic receipt dated Sep 25 appears under Sep 30 in pantry and grocery headings; note separately acknowledges Sep 25. |
| [F15](#f15) | Medium | Create a recipe | Empty batch form requires groceries with known quantities and nutrition. |
| [F16](#f16) | Medium | Repeat a familiar meal | No direct repeat/copy/favorite action found in meal diary or editor. |
| [F17](#f17) | Medium | Fix an unlogged estimate | Fix it removes the proposal card and prefixes the composer with Correction to Breakfast. |
| [F18](#f18) | Medium | Backfill yesterday | Nutrition's Log a meal/Tell Spot navigates to Chat without passing selectedDay. |
| [F19](#f19) | Medium | Get a useful first week | One live dinner plan using a sparse oats/milk pantry returned Oatmeal with Milk on all seven days. |
| [F20](#f20) | Medium | Leave a generated draft briefly | Closing the generated unsaved seven-day plan and reopening shows Create my week with no draft. |
| [F21](#f21) | Medium | Set food preferences | Native shows preferredStores, unknown, economy, flexible, open, usual and lower-case enum names; web has human-readable labels and select controls. |
| [F22](#f22) | Medium | Log a set between efforts | At 390x844 the first set weight editor occupies a narrow right column; the first reps control is below the initial viewport. |
| [F23](#f23) | Medium | Navigate dates and targets | Native Nutrition date selectors and Your daily targets appear as text in the accessibility snapshot; corresponding Pressables lack accessibilityRole. |
| [F24](#f24) | Low | Use a newly entered label | After Save my label the scanner reopens with blank barcode digits, requiring re-entry before adding groceries or food. |
| [F25](#f25) | High for public launch | Get help | Help explicitly says no support contact is configured and to contact the inviter. |
| [F26](#f26) | Medium | Log a simple meal without connected AI | Nutrition's Log a meal routes to Chat. |
| [F27](#f27) | Medium | Turn a receipt into a usable pantry | The synthetic three-line receipt was extracted, including nonfood; two food matches required review and quantities stayed unknown, disabling consumption. |
| [F28](#f28) | Medium | Inspect past workout performance | Native recent session card displays title, date and total set count, with no detail action in the current screen. |
| [F29](#f29) | Low | Set a few preferences | One food/routine form combines restrictions, dislikes, favorites, household, budget, brands, stores, cooking equipment and workouts. |
| [F30](#f30) | Low | Clarify an uncertain portion | After an explicit breakfast statement with unknown peanut butter amount, Spot asked an appropriate portion question, then added that it needed context to decide whether this was a meal or grocery purchase. |
| [F31](#f31) | Medium | Understand release behavior | README and mobile README still describe manual snapshot transfer rather than automatic account saving, while current account UI, implementation and readiness repair notes describe automatic saving. |

## F01

**Meal correction · High · web**

**Affected personas:** All food trackers. **Expectation:** Rename a saved meal without changing its nutrition.

**Observed:** Saving a meal containing 18.3 g protein and 0.4 g fat is blocked by step=1 numeric validation.

**Predicted reaction:** Likely frustration and distrust: even a name-only correction cannot be saved. **Repeat-use exposure:** Every decimal meal correction.

**Proposed response:** Accept fractional nutrition values and test name-only edits.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/38-decimal-edit-save.txt); [src/App.tsx:1960](C:/Users/danny/Documents/coding/fitness/src/App.tsx:1960).

## F02

**Meal correction · High · native Expo-web**

**Affected personas:** All food trackers. **Expectation:** Type 18.3 g and keep 18.3 g.

**Observed:** Sequentially typing 18.3 into the protein field displays 183; onChangeText immediately applies Number(v).

**Predicted reaction:** Likely unnoticed bad data or repeated retyping; physical-keyboard behavior still needs phone confirmation. **Repeat-use exposure:** Every fractional manual entry.

**Proposed response:** Keep raw text while editing; parse and validate only on save.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/n15-decimal-typing.txt); [mobile/src/tools.tsx:63](C:/Users/danny/Documents/coding/fitness/mobile/src/tools.tsx:63).

## F03

**Guest onboarding · Medium · web and native**

**Affected personas:** All; beginner especially. **Expectation:** Know whether records are local or account-backed.

**Observed:** Guest setup says Your account saves changes automatically after Try on this device first. The later ready screen correctly says local.

**Predicted reaction:** Likely false confidence about backup; actual account saving is separate. **Repeat-use exposure:** First use and device changes.

**Proposed response:** Show storage copy conditional on guest/account mode.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/02-guest-setup.png); [src/features/onboarding/Onboarding.tsx:434](C:/Users/danny/Documents/coding/fitness/src/features/onboarding/Onboarding.tsx:434), [mobile/src/Onboarding.tsx:395](C:/Users/danny/Documents/coding/fitness/mobile/src/Onboarding.tsx:395).

## F04

**Activity overview · Medium · web; similar native wording**

**Affected personas:** Expert; beginner; fitness-first. **Expectation:** A completed workout counts as a day of recorded activity.

**Observed:** After one saved workout, You shows 0 of 7 days and Your first log starts the picture, beside 1 workout recorded. The headline reads meal-only loggedDays.

**Predicted reaction:** Likely sense that training did not count. **Repeat-use exposure:** Every workout-only day.

**Proposed response:** Count explicitly defined activity days, or rename this as days with food logged.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/21-profile.txt); [src/YouPage.tsx:320](C:/Users/danny/Documents/coding/fitness/src/YouPage.tsx:320).

## F05

**Workout history · Medium · web**

**Affected personas:** Expert; six-month lifter. **Expectation:** See the load and reps actually performed.

**Observed:** Profile Workout history shows reps only; the 45 lb load is omitted. Workouts Session history separately retains loads.

**Predicted reaction:** Likely extra navigation and doubt about whether loads were saved. **Repeat-use exposure:** Every comparison with previous training.

**Proposed response:** Reuse the load-aware history rendering across entry points.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/22-workout-history.txt); [src/YouPage.tsx:944](C:/Users/danny/Documents/coding/fitness/src/YouPage.tsx:944), [src/WorkoutPage.tsx:535](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:535).

## F06

**Review a corrected estimate · High · shared AI; observed web**

**Affected personas:** Expert; six-month tracker; new calorie tracker. **Expectation:** Reply and confirmation card agree on the numbers.

**Observed:** Live correction prose says 23 g protein, 34 g carbs and 1 g fat; its card and saved meal use 18.3, 33 and 0.4. Server sums components but preserves independent answer.reply.

**Predicted reaction:** Likely uncertainty over which answer to trust; downstream total used the card. **Repeat-use exposure:** Possible on each generated estimate; frequency unmeasured.

**Proposed response:** Render numeric prose from canonical structured totals, or omit duplicated numeric claims.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/34-corrected-breakdown.txt); [server/ai.ts:215](C:/Users/danny/Documents/coding/fitness/server/ai.ts:215), [server/ai.ts:266](C:/Users/danny/Documents/coding/fitness/server/ai.ts:266), [src/ai-client.ts:140](C:/Users/danny/Documents/coding/fitness/src/ai-client.ts:140).

## F07

**First movement capture · High · shared AI; observed web**

**Affected personas:** Complete beginner; fitness-first. **Expectation:** Record the walk explicitly welcomed by onboarding.

**Observed:** A 20-minute walk request was declined as unsupported resistance-training capture and redirected toward Build a workout. Tour says a walk counts.

**Predicted reaction:** Likely failed first success for a walking beginner. **Repeat-use exposure:** Every non-strength activity attempt.

**Proposed response:** Support duration-based activity capture or narrow the introduction and suggested action honestly.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/beginner/07-live-response.txt); [src/features/onboarding/model.ts:38](C:/Users/danny/Documents/coding/fitness/src/features/onboarding/model.ts:38), [server/ai.ts:80](C:/Users/danny/Documents/coding/fitness/server/ai.ts:80).

## F08

**Daily targets · Medium · web and native**

**Affected personas:** Beginner; fit but new to calories. **Expectation:** Understand where targets come from and choose sensible personal values.

**Observed:** Fresh state uses 2000 kcal, 110 g protein, 250 g carbs and 78 g fat. Editor labels them samples but offers numeric fields without guided goal setup; web Nutrition calls them saved targets.

**Predicted reaction:** Likely treating defaults as personal recommendations or avoiding target setup. **Repeat-use exposure:** Daily interpretation of progress.

**Proposed response:** Mark untouched defaults at the point of use; offer a clearly bounded setup path or allow tracking without targets.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/04-nutrition-empty.txt); [src/domain.ts:176](C:/Users/danny/Documents/coding/fitness/src/domain.ts:176), [src/NutritionPage.tsx:264](C:/Users/danny/Documents/coding/fitness/src/NutritionPage.tsx:264), [src/App.tsx:2055](C:/Users/danny/Documents/coding/fitness/src/App.tsx:2055).

## F09

**Start training · Medium · web and native**

**Affected personas:** Complete beginner. **Expectation:** An approachable session suitable for the stated experience.

**Observed:** Web defaults to Upper Body with 185 lb bench, 60 lb incline dumbbell press and other example loads. Native lists templates before showing their loads. No experience selection changes these templates.

**Predicted reaction:** Likely intimidation or extra setup; no claim that anyone attempted these loads. **Repeat-use exposure:** First workout and each new template.

**Proposed response:** Require deliberate starting-load choice; make beginner options and example status unmistakable before start.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/06-workouts-empty.txt); [src/workouts.ts:88](C:/Users/danny/Documents/coding/fitness/src/workouts.ts:88), [mobile/src/screens.tsx:429](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:429).

## F10

**Exercise understanding · Medium · web and native**

**Affected personas:** Complete beginner; six-month lifter. **Expectation:** Know what the exercise, sets and reps mean and how to perform it.

**Observed:** Web exercise detail repeats load, sets, targets and adjustment instructions; illustrative photos do not provide movement instruction.

**Predicted reaction:** Likely leaving the app to learn the exercise; coaching preference remains a hypothesis. **Repeat-use exposure:** Unfamiliar exercises.

**Proposed response:** Provide concise terminology and credible technique guidance, or position this explicitly as a logger.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/06-workouts-empty.txt); [src/WorkoutPage.tsx:227](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:227).

## F11

**Busy gym workout · Medium · web; native differs**

**Affected personas:** Expert; six-month lifter. **Expectation:** Change exercise order or skip occupied equipment without inventing sets.

**Observed:** Web active flow reveals the current exercise and a noninteractive Up Next card. No reorder/skip/superset/rest/RPE controls found. Native exposes all exercises but lacks the web substitution form.

**Predicted reaction:** Likely parallel use of another training logger for advanced routines. **Repeat-use exposure:** Most sessions for users needing flexible programming.

**Proposed response:** Choose the intended training scope; add reorder/skip and program reuse before advanced progression claims.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/08-active-workout.txt); [src/WorkoutPage.tsx:289](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:289), [src/WorkoutPage.tsx:409](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:409), [mobile/src/screens.tsx:455](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:455).

## F12

**Finish and correct a session · High · web and native**

**Affected personas:** All training personas. **Expectation:** Recover from an accidental finish or correct a saved set.

**Observed:** Finish immediately saves a partial workout. Web then disables adjustment and removes rep-edit controls; native returns to template list. No reopen/edit-finished flow found.

**Predicted reaction:** Likely permanent incorrect history or resort to export-level repair. **Repeat-use exposure:** Occasional but consequential.

**Proposed response:** Provide a finish summary, undo/reopen, and bounded correction of saved sessions.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/11-workout-finish.txt); [src/WorkoutPage.tsx:141](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:141), [src/WorkoutPage.tsx:445](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:445), [mobile/src/screens.tsx:523](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:523).

## F13

**Record load in familiar units · Medium · web and native**

**Affected personas:** Expert; international users. **Expectation:** Keep kg as the display and entry unit.

**Observed:** Workout inputs and history use lb. Live 80 kg capture correctly converted to 176.37 lb and disclosed conversion. Body weight separately supports kg.

**Predicted reaction:** Likely arithmetic or round-trip confusion in a kg gym; conversion is a positive safeguard. **Repeat-use exposure:** Every set for kg users.

**Proposed response:** Add workout display/entry unit preference while preserving canonical storage.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/expert/07-live-response.txt); [src/WorkoutPage.tsx:600](C:/Users/danny/Documents/coding/fitness/src/WorkoutPage.tsx:600), [mobile/src/screens.tsx:460](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:460).

## F14

**Find an older grocery trip · Medium · web; shared receipt data**

**Affected personas:** Six-month tracker; developer. **Expectation:** Identify the purchase by its receipt date.

**Observed:** Uploaded synthetic receipt dated Sep 25 appears under Sep 30 in pantry and grocery headings; note separately acknowledges Sep 25. receipt.date is capture day; purchase.purchaseDate is separate.

**Predicted reaction:** Likely confusion reconciling spending and pantry age. **Repeat-use exposure:** Catch-up receipt uploads.

**Proposed response:** Label captured date versus purchase date and use reviewed purchase date in trip headings.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/56-purchase-details.txt); [server/ai.ts:189](C:/Users/danny/Documents/coding/fitness/server/ai.ts:189), [src/features/shopping/ReceiptReview.tsx:74](C:/Users/danny/Documents/coding/fitness/src/features/shopping/ReceiptReview.tsx:74).

## F15

**Create a recipe · Medium · web and native**

**Affected personas:** Six-month tracker; expert meal-prepper. **Expectation:** Save a batch from known ingredients without first maintaining full inventory.

**Observed:** Empty batch form requires groceries with known quantities and nutrition. It provides no inline manual ingredient path. After pantry setup, fractional portions and undo work correctly.

**Predicted reaction:** Likely postponement by users who want a recipe calculator rather than inventory management. **Repeat-use exposure:** Every new recipe until pantry exists.

**Proposed response:** Offer direct ingredients or a clear guided prerequisite with preserved recipe draft.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/15-prepare-without-pantry.txt); [src/features/recipes/RecipeDialog.tsx:190](C:/Users/danny/Documents/coding/fitness/src/features/recipes/RecipeDialog.tsx:190), [mobile/src/KitchenTools.tsx](C:/Users/danny/Documents/coding/fitness/mobile/src/KitchenTools.tsx).

## F16

**Repeat a familiar meal · Medium · web and native**

**Affected personas:** Expert; six-month tracker. **Expectation:** Repeat yesterday's breakfast quickly with unchanged quantities.

**Observed:** No direct repeat/copy/favorite action found in meal diary or editor. Recurring meal plans and prepared batches exist but require separate setup.

**Predicted reaction:** Likely continuing to use Chat or another tracker for habitual meals. **Repeat-use exposure:** Daily.

**Proposed response:** Provide Repeat meal with reviewed date/portion; preserve provenance without double stock deduction.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/37-meal-editor.txt); [src/NutritionPage.tsx:332](C:/Users/danny/Documents/coding/fitness/src/NutritionPage.tsx:332), [src/App.tsx:1900](C:/Users/danny/Documents/coding/fitness/src/App.tsx:1900), [mobile/src/tools.tsx:21](C:/Users/danny/Documents/coding/fitness/mobile/src/tools.tsx:21).

## F17

**Fix an unlogged estimate · Medium · web; shared model**

**Affected personas:** All food personas. **Expectation:** Adjust a portion while retaining the original card for comparison.

**Observed:** Fix it removes the proposal card and prefixes the composer with Correction to Breakfast. Correction requires another AI request; the original prose stays.

**Predicted reaction:** Likely uncertainty or abandonment if the next request fails; this run did return a replacement card. **Repeat-use exposure:** Common during estimation.

**Proposed response:** Keep the pending proposal editable or visible until a replacement is accepted.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/32-meal-correction.txt); [src/App.tsx](C:/Users/danny/Documents/coding/fitness/src/App.tsx), [src/ChatLayer.tsx](C:/Users/danny/Documents/coding/fitness/src/ChatLayer.tsx).

## F18

**Backfill yesterday · Medium · web and native navigation; web editor**

**Affected personas:** Six-month tracker; forgetful returner. **Expectation:** Carry the selected day into the add-meal flow and correct dates afterward.

**Observed:** Nutrition's Log a meal/Tell Spot navigates to Chat without passing selectedDay. AI request day is today. Web saved-meal editor has no date field; native editor does.

**Predicted reaction:** Risk of accidental today logs unless the user explicitly types the date; this is a handoff gap, not proof of every backfill failing. **Repeat-use exposure:** Catch-up use.

**Proposed response:** Pass selected day into capture and allow reviewed date edits on both platforms.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/37-meal-editor.txt); [src/NutritionPage.tsx:299](C:/Users/danny/Documents/coding/fitness/src/NutritionPage.tsx:299), [src/ai-client.ts:25](C:/Users/danny/Documents/coding/fitness/src/ai-client.ts:25), [mobile/src/tools.tsx:42](C:/Users/danny/Documents/coding/fitness/mobile/src/tools.tsx:42).

## F19

**Get a useful first week · Medium · live web planner**

**Affected personas:** All meal-planning personas. **Expectation:** Useful variety or a clear choice to expand beyond limited pantry stock.

**Observed:** One live dinner plan using a sparse oats/milk pantry returned Oatmeal with Milk on all seven days. It flagged partial nutrition and shortages correctly but prose claimed milk sufficiency while the stock check said quantity unknown.

**Predicted reaction:** Likely disappointment with planning value; one constrained example does not establish general quality. **Repeat-use exposure:** Weekly if adopted.

**Proposed response:** Ask pantry-only versus shopping-supported, offer diversity, and derive stock claims from validated quantities.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/59-plan-result.txt); [src/features/planning/MealPlanner.tsx](C:/Users/danny/Documents/coding/fitness/src/features/planning/MealPlanner.tsx), [server/plans.ts](C:/Users/danny/Documents/coding/fitness/server/plans.ts).

## F20

**Leave a generated draft briefly · Medium · web**

**Affected personas:** All planners. **Expectation:** Recover a generated week after closing the dialog.

**Observed:** Closing the generated unsaved seven-day plan and reopening shows Create my week with no draft. No unsaved-change warning appeared. Save draft exists at the bottom of the long plan.

**Predicted reaction:** Likely lost review effort and a second generation request. **Repeat-use exposure:** Any interrupted planning session.

**Proposed response:** Autosave draft state or warn on close; keep save action reachable.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/60-draft-after-close.txt); [src/features/planning/MealPlanner.tsx:21](C:/Users/danny/Documents/coding/fitness/src/features/planning/MealPlanner.tsx:21), [src/components.tsx:198](C:/Users/danny/Documents/coding/fitness/src/components.tsx:198).

## F21

**Set food preferences · Medium · native Expo-web**

**Affected personas:** Beginner; fit new tracker. **Expectation:** Plain-language choices equivalent to the web app.

**Observed:** Native shows preferredStores, unknown, economy, flexible, open, usual and lower-case enum names; web has human-readable labels and select controls.

**Predicted reaction:** Likely uncertainty about unknown and open, especially when grouping is unclear. **Repeat-use exposure:** Setup and occasional edits.

**Proposed response:** Map stored enums to user-facing labels and accessible group names.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/n14-preferences.txt); [mobile/src/tools.tsx](C:/Users/danny/Documents/coding/fitness/mobile/src/tools.tsx).

## F22

**Log a set between efforts · Medium · native Expo-web at 390 px**

**Affected personas:** Expert; six-month lifter. **Expectation:** Reps and load visible together with few taps.

**Observed:** At 390x844 the first set weight editor occupies a narrow right column; the first reps control is below the initial viewport. All 12 set editors expand into a long scroll.

**Predicted reaction:** Likely more scrolling in the gym; actual phone timing unmeasured. **Repeat-use exposure:** Every workout.

**Proposed response:** Compact aligned set rows, combined load/reps save, and focus on active set while allowing jump navigation.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/n08-workout-390.png); [mobile/src/screens.tsx:479](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:479).

## F23

**Navigate dates and targets · Medium · native Expo-web accessibility**

**Affected personas:** Developer; keyboard/screen-reader users. **Expectation:** Interactive elements expose role and state.

**Observed:** Native Nutrition date selectors and Your daily targets appear as text in the accessibility snapshot; corresponding Pressables lack accessibilityRole. Kitchen hero has the same pattern.

**Predicted reaction:** Likely harder control discovery; VoiceOver/TalkBack impact needs real-device confirmation. **Repeat-use exposure:** Every assisted navigation session.

**Proposed response:** Add button roles, names and selected/pressed state; verify with assistive technology.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/n03-nutrition.txt); [mobile/src/screens.tsx:83](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:83), [mobile/src/screens.tsx:173](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:173), [mobile/src/screens.tsx:271](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:271).

## F24

**Use a newly entered label · Low · web**

**Affected personas:** New calorie tracker. **Expectation:** Continue directly to the saved product and portion.

**Observed:** After Save my label the scanner reopens with blank barcode digits, requiring re-entry before adding groceries or food.

**Predicted reaction:** Likely redundant work after a long form. **Repeat-use exposure:** Unknown or store-specific products.

**Proposed response:** Retain the barcode and open the confirmed product automatically.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/43-label-saved.txt); [src/App.tsx](C:/Users/danny/Documents/coding/fitness/src/App.tsx), [src/features/labels/LabelCapture.tsx](C:/Users/danny/Documents/coding/fitness/src/features/labels/LabelCapture.tsx).

## F25

**Get help · High for public launch · web and native configured environment**

**Affected personas:** All; developer. **Expectation:** A reachable support destination.

**Observed:** Help explicitly says no support contact is configured and to contact the inviter. This is understandable for invitation-only preview but not public launch.

**Predicted reaction:** Likely stuck after account/data problems outside a private cohort. **Repeat-use exposure:** Exceptional but critical.

**Proposed response:** Configure and exercise an owned support channel before public release.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/25-privacy.txt); [src/features/support/SupportAndPrivacy.tsx](C:/Users/danny/Documents/coding/fitness/src/features/support/SupportAndPrivacy.tsx), [mobile/src/SupportAndPrivacy.tsx](C:/Users/danny/Documents/coding/fitness/mobile/src/SupportAndPrivacy.tsx).

## F26

**Log a simple meal without connected AI · Medium · web and native**

**Affected personas:** Beginner; new calorie tracker. **Expectation:** Manual tracking includes an obvious direct meal form.

**Observed:** Nutrition's Log a meal routes to Chat. No direct new-meal calories/macros form or ordinary food-name search found there. Manual label, pantry and workout paths exist, but require more context.

**Predicted reaction:** Likely confusion under the guest manual-tracking promise, especially without a barcode. **Repeat-use exposure:** Every unsupported/offline ordinary meal.

**Proposed response:** Expose a simple manual meal entry and clear offline capture path.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/n11-native-manual-meal.txt); [src/NutritionPage.tsx:299](C:/Users/danny/Documents/coding/fitness/src/NutritionPage.tsx:299), [mobile/src/screens.tsx:201](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:201).

## F27

**Turn a receipt into a usable pantry · Medium · web; shared pantry requirements**

**Affected personas:** All Kitchen adopters. **Expectation:** A receipt quickly produces usable amounts.

**Observed:** The synthetic three-line receipt was extracted, including nonfood; two food matches required review and quantities stayed unknown, disabling consumption. Product/serving confirmation remains necessary.

**Predicted reaction:** Useful honesty, but likely more work than the effortless receipt promise suggests. **Repeat-use exposure:** Every ambiguous receipt item.

**Proposed response:** Show a short prioritized review queue with package-to-serving guidance; measure completion burden with real receipts.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/55-receipt-details.txt); [src/features/pantry/PantryDialog.tsx](C:/Users/danny/Documents/coding/fitness/src/features/pantry/PantryDialog.tsx), [src/features/products/ReceiptProductReview.tsx](C:/Users/danny/Documents/coding/fitness/src/features/products/ReceiptProductReview.tsx).

## F28

**Inspect past workout performance · Medium · native Expo-web**

**Affected personas:** Expert; six-month lifter. **Expectation:** Open a finished session and see loads and repetitions.

**Observed:** Native recent session card displays title, date and total set count, with no detail action in the current screen. Web has a richer Session history dialog.

**Predicted reaction:** Likely native app insufficient as the only lifting log. **Repeat-use exposure:** Every repeat workout.

**Proposed response:** Provide a load-aware native history detail and route from each recent session.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/n09-finished-workout.txt); [mobile/src/screens.tsx:540](C:/Users/danny/Documents/coding/fitness/mobile/src/screens.tsx:540).

## F29

**Set a few preferences · Low · web and native**

**Affected personas:** Beginner; fit new tracker. **Expectation:** A short setup focused on the current task.

**Observed:** One food/routine form combines restrictions, dislikes, favorites, household, budget, brands, stores, cooking equipment and workouts. Web has fourteen controls before save.

**Predicted reaction:** Possible optional avoidance due to setup burden; no human avoidance observed. **Repeat-use exposure:** First setup and preference edits.

**Proposed response:** Group by goal, support progressive disclosure, and retain defaults without requiring full completion.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/20-preferences.txt); [src/features/preferences/PreferencesDialog.tsx](C:/Users/danny/Documents/coding/fitness/src/features/preferences/PreferencesDialog.tsx).

## F30

**Clarify an uncertain portion · Low · shared AI; observed web**

**Affected personas:** Fit but new to calorie tracking; beginner. **Expectation:** A follow-up focused only on the missing portion.

**Observed:** After an explicit breakfast statement with unknown peanut butter amount, Spot asked an appropriate portion question, then added that it needed context to decide whether this was a meal or grocery purchase.

**Predicted reaction:** Possible confusion about repeating information already supplied; the focused portion question itself is useful. **Repeat-use exposure:** Ambiguous-portion conversations.

**Proposed response:** Use intent-specific clarification copy and preserve the already-known eaten/purchased classification.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/fit-new-tracker/07-live-response.txt); [src/ChatLayer.tsx](C:/Users/danny/Documents/coding/fitness/src/ChatLayer.tsx), [server/ai.ts](C:/Users/danny/Documents/coding/fitness/server/ai.ts).

## F31

**Understand release behavior · Medium · repository documentation**

**Affected personas:** Software developer. **Expectation:** Runbooks describe the current storage and launch architecture.

**Observed:** README and mobile README still describe manual snapshot transfer rather than automatic account saving, while current account UI, implementation and readiness repair notes describe automatic saving. Older verification counts also remain in README.

**Predicted reaction:** Likely incorrect debugging assumptions and release instructions; this is documentation drift, not proof that synchronization is broken. **Repeat-use exposure:** Development, support and release handoffs.

**Proposed response:** Reconcile the primary README and mobile guide with current account continuity, deployment and test evidence.

**Evidence:** [captured state](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/27-account.txt); [README.md](C:/Users/danny/Documents/coding/fitness/README.md), [mobile/README.md](C:/Users/danny/Documents/coding/fitness/mobile/README.md), [docs/READINESS_REPAIRS_2026-09-29.md](C:/Users/danny/Documents/coding/fitness/docs/READINESS_REPAIRS_2026-09-29.md).


