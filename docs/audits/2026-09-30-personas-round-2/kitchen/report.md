# Deep persona audit: experienced lifter and six-month tracker

These are simulated persona sessions, not interviews or usability-test participants. The actions and app results below were observed. Expectations, likely repeat-use priorities and wishes are hypotheses; no feelings, quotes, satisfaction ratings or task-time measurements have been invented.

Two isolated Chromium contexts started with the real guest onboarding UI. The expert used a 390×844 viewport; the six-month tracker used 1440×1000. Synthetic names, nutrition values and loads were entered through the UI. The local app used its real services: the one meal-plan request returned HTTP 200. No product records were injected and no API response was mocked. No product files were edited. The root audit covers the wider all-surface walkthrough and other personas; this lane deliberately goes deeper on repeated daily use.

Three defects were reproduced: workout conversation ignores the selected kg unit, planner suggestions mislabel manually entered stock dates as purchases, and a running rest timer disappears after navigating to another app page. Core records, recipe quantities, corrected workouts, meal copies, shopping checks and meal-plan drafts persisted in the paths exercised.

[Structured findings and priorities](findings.json) · [Chronological captures and console log](sessions.json)

## Experienced lifter: actual path and result

The fresh guest selected movement as the focus, reached Chat, opened Workouts and chose kg. The Upper Body starter did not prescribe a load. The persona entered 80 kg for bench set one, recorded eight reps and effort eight. The next set required a separate load confirmation. A second 80 kg set, seven reps, was saved; Row was moved earlier; Incline Press was substituted with Dumbbell Overhead Press, 20 kg, two sets of eight; one OHP set was logged. Jump-to-exercise worked.

Finish opened a partial-session review. After saving, the workout was reopened and bench set two corrected from seven to six. Session history retained 80 kg × 8, 80 kg × 6 and OHP 20 kg × 8. Starting the next Upper Body session restored the original starter lineup; the previous personal substitution and order were not reusable. Prior recorded bench performance remained visible. Reload retained kg and the active workout.

In the second session, using **Adjust Bench Press before recording** set all three loads to 80 kg. This resolved the apparent lack of same-load setup: it exists, but the first per-set editor does not explain the efficient path. After a recorded set, exercise-level load/name are locked while individual set loads remain editable. This is discoverability friction, not a missing bulk-load capability.

The kg set and history were correct, but the accompanying reply said **176.3698 lb × 8 reps**. The same mismatch appeared in the first session and in correction text. The source hardcodes pounds in `src/workouts.ts:188`.

A 90-second rest timer started successfully. Opening Nutrition and returning to Workouts replaced it with “Ready when you are.” A second reproduction through Kitchen did the same, well before the timer could finish. Workout records remained intact. The only visible duration was 90 seconds; custom durations are a separate optional wish, not the cause of the reset.

Food work then included reviewing explicitly synthetic targets, correcting a meal dated yesterday, retaining 18.3 g protein and 0.4 g fat, and repeating it today. The repeat form disclosed that pantry and prepared portions would not change. The recipe-first path preserved an entered batch name and four-portion yield while two manual pantry ingredients were created. Preparing oats deducted four oat servings and two milk servings without logging food. Eating 1.5 portions logged 337.5 calories and left 2.5 portions, without further raw-ingredient deductions. Reload preserved the result. Weekly review distinguished the saved workout from the second session in progress and described unlogged days as unknown.

Canonical evidence: [corrected history](expert/17-return-to-options-history.txt), [next starter reset](expert/18-next-session-customization-not-reused.txt), [kg mismatch screenshot](expert/41-kg-chat-visible.png), [timer running](expert/42a-rest-live.txt), [timer after navigation](expert/42-rest-navigation-reproduction.txt), [repeat form](expert/26-correct-synthetic-food-and-repeat.txt), [batch after reload](expert/32-recipe-portion-persists.txt), [weekly review](expert/43-profile-weekly-review.txt).

## Six-month tracker: actual path and result

This fresh guest selected both food and movement, reviewed synthetic daily targets, corrected yesterday’s chicken-and-rice lunch and repeated it today. Nutrition copies retained all entered values and remained editable by date. The same recipe-first route preserved the draft across pantry setup. After preparing four portions, logging 1.5, reloading and undoing that portion, the batch returned to four available portions. Logging one corrected portion then left three and recorded 225 calories. Only the two preparation inventory events existed; undo did not put the raw ingredients back.

A real shopping-supported, varied dinner week was generated for October 1–7. With six oat and six milk servings remaining, the app showed additional needs for the seventh day and missing vegetables. Nutrition said **at least 300 calories and 13 g protein**, disclosed that only two of three ingredients were known, and did not count unknown nutrition as zero. No price total was invented. Renaming the first dish, closing and reloading preserved the draft and the edit. Approval then enabled copying the schedule into an October 8 draft while the original week stayed approved. No planned meal was logged as eaten.

This single generated week used oats and milk every day with different vegetables: stew, risotto, porridge, bake, casserole, gratin and skillet titles. It meets the present title-count definition of variety. Whether ingredient-pattern variety would be more useful is a product hypothesis, not a claim that users dislike those meals. The plan has ingredient amounts but no cooking method. The source intentionally discards generated notes to avoid unsupported inventory claims. Separate trustworthy cooking instructions are therefore a plausible missing capability, with that tradeoff made explicit.

Both manual ingredients had been entered as food already on hand, with no purchase date or price. Kitchen called the date “Captured.” The planner nevertheless called it a **2026-09-30 purchase**. Reopening after reload retained this wording. Spending also listed both manual ingredients as trips requiring receipt amount/date review; this is unnecessary receipt-review work for records that never represented receipts.

The shopping list accepted all nine planned shortages twice without duplicating them. A manual Apples item, six pieces, was added and checked. After another reload there were ten entries and Apples stayed checked. Text explained that checking shopping items does not update pantry. Smart swaps explained its confirmed-product prerequisite; this lane did not invent a barcode-backed product to bypass it.

Finally the persona started Lower Body, used upfront Adjust exercise to set Goblet Squat to 35 lb, recorded ten and nine reps with effort eight, jumped to Standing Calf Raise and explicitly selected bodyweight. After three actual sets, partial finish required review. The session reopened, Goblet set two was corrected to eight, and the saved history retained loads and reps. The profile reported three meals across two days and one workout with three sets after reload.

Canonical evidence: [portion undo](six-months/33-undo-portion.txt), [corrected portion](six-months/34-log-correct-portion.txt), [raw real planner response](six-months/planner-response.json), [generated week](six-months/37-generated-dinner-week.txt), [recovered edit](six-months/38-edit-draft-close-reload.txt), [repeat week](six-months/39-approve-and-repeat-week.txt), [spending without receipts](six-months/43-spending-without-receipts.txt), [shopping reload](six-months/48-shopping-list-after-reload.txt), [corrected workout history](six-months/47a-workout-history.txt).

## Friction and opportunity classification

| ID | Classification | Priority | Finding / hypothesis |
|---|---|---|---|
| K01 | Reproduced defect; residual F13 | Medium | Selected kg is ignored by workout replies. Numeric set/history data is correct. |
| K02 | Reproduced defect; residual F14 | Medium | Manual on-hand capture dates become purchase claims; manual stock also creates receipt-review noise. |
| K03 | Reproduced defect; F11 addition | Medium | Rest timer resets on ordinary page navigation. |
| K04 | Missing capability hypothesis | High repeat-use opportunity | Save a personal routine or repeat the previous workout with fresh unlogged sets. Existing history is not a reusable routine. |
| K05 | Found but hard to discover; F22 | Medium opportunity | Same-load setup exists under upfront Adjust exercise. Expose it near the first set. |
| K06 | Missing convenience hypothesis; F16 | Medium opportunity | Review a 0.5×/1.5× ordinary meal copy without manually scaling four numbers. Fractional prepared portions already work. |
| K07 | Missing capability hypothesis; F19 tradeoff | Medium opportunity | Separate cooking instructions from inventory claims for new planned dishes. |
| K08 | Limited generation quality observation | Low; validate demand | Clarify or improve variety beyond distinct titles; one sparse-pantry sample is insufficient to generalize. |

No failure of decimal meal correction, direct repeat, dated manual entry, recipe prerequisite recovery, draft autosave, repeat-week isolation, shopping-list idempotency, or partial-workout correction was reproduced. These are meaningful improvements over F01, F12, F15, F16, F18 and F20. The expanded workout controls address substantial parts of F11. Recipe consumption and undo correctly maintained inventory consequences in both sessions.

## Likely regular use and deliberate non-use

These are predictions to validate with actual users, not observed longitudinal adoption.

| Persona | Regular-use essentials | Occasional / setup | Nice to have or deliberately not used in this simulation |
|---|---|---|---|
| Experienced lifter | Loads, reps, corrections, prior performance; repeat meals; batch portions if meal-prepping | Weekly review, targets/preferences, pantry maintenance, planning/list | AI-generated starter workouts were not requested for an already-known training routine. Price research was not pursued without real purchase data. These choices do not establish real-user avoidance. |
| Six-month tracker | Daily intake, targets, meal repeats/corrections, gym logging/history; prepared portions | Meal plans, repeat weeks, shopping list, preferences, weekly review | Future planned meals were not logged as eaten. Smart swaps stopped at its product-confirmation prerequisite. Price research and new-dish inspiration remain optional until supporting data/instructions are useful. |

Positive behaviors likely to support repeat use are the clear “planning is not eating” boundary, reviewable partial finish, actual performance history, decimal retention, recoverable drafts, and reversible portion logging. No emotional reaction is attributed to either persona. There is no evidence here that every feature needs expansion.

## Evidence limits and harness cleanup

There are 80 screenshot/ARIA checkpoints: 43 expert and 37 tracker. Both sessions recorded **zero console warnings/errors and zero page errors**. Four screenshots were visually reviewed, including the mobile kg reply and desktop planned dish. Screenshot captures reflect scrollable containers at their current positions; ARIA files capture the broader rendered content.

Nine harness step failures remain in `sessions.json`, visibly classified as script/locator failures. They include querying a combobox with the wrong label API, looking for a history action on the wrong view, a heading missing its “in progress” suffix, navigating while a dialog remained open, and querying shopping tabs as buttons. Relevant routes were subsequently completed with correct selectors. The first meal script produced interim zero-valued entries; these were corrected through the UI before the canonical repeat checks (steps 26/27). Do not use those earlier failed snapshots as evidence of nutrition correctness or a product defect.

The live planner was requested once. No AI workout generation, OCR, physical camera/microphone, real account sync, cross-device restore, large-history behavior, actual cooking, health outcome or long-term adherence claim was tested in this lane. Root and sibling reports supply wider coverage. `final-state.json` files are read-only exports of each synthetic session to substantiate resulting inventory and saved records. All scripts and new artifacts are confined to this audit directory.
