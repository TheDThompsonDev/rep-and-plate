# Rep and Plate five persona prelaunch audit

September 30, 2026 · Agent-led product audit of the current working tree

**I recommend holding a broad public launch while correcting the numeric-entry defects, reconciling AI totals, and making the first-use promises match what the app can actually record.** The app has a useful foundation: reviewed meal proposals, persistent records, purchasing separated from eating, recipe portion accounting, and guarded account operations. The existing regression suites pass, but the exploratory journeys exposed ordinary tasks those suites do not protect.

This report answers how the five requested personas encounter the app, what they would expect, what may pleasantly surprise or frustrate them, and which tools they would probably use repeatedly. **These are simulated perspectives, not five research participants.** Interactions, screenshots, application output, and source findings are evidence. Thoughts, emotional reactions, future usage and avoidance are explicitly hypotheses. No satisfaction scores, conversion rates, retention forecasts or invented participant quotes are used.

The [full friction log](friction-log.md) contains 31 entries with expectation, observation, predicted reaction, frequency, evidence, and proposed response. [Structured JSON](friction-log.json) is available for triage. Nothing in the product was fixed or published during this audit.

## What needs attention first

| Workstream | Concrete evidence | Release judgment |
|---|---|---|
| Reliable numeric editing | Web cannot save a name-only change when macros contain decimals. Native entry changes typed 18.3 into 183. | Fix before asking people to depend on their records. F01–F02 |
| One trusted estimate | A live reply says 23 g protein; its card and saved meal say 18.3 g. | Use one canonical set of totals. F06 |
| Honest first-use promise | The tour welcomes walks; a 20-minute walk capture is declined. Guest setup promises account saving. Generic calorie targets remain prominent. | Repair the promise or the capability before broad acquisition. F03, F07–F09 |
| Useful training history | Finished sessions cannot be corrected through the observed flows. Profile history omits loads; native history is only a summary. | Resolve before positioning this as a dependable training log. F04–F05, F12, F28 |
| Release operations and native usability | No support contact configured; native labels expose internal values; real-phone and real-email release evidence remains outstanding. | Complete the release checks and native cleanup. F21–F25 |

These are five groups of work, not five isolated defects. The log contains six High-priority entries, including the support prerequisite for a public launch. Medium items include task friction and product-fit gaps; their priority can change with the intended launch audience.

| Web correction blocked | Native input altered in Expo-web |
|---|---|
| ![The web meal editor rejects existing 18.3 g protein during a name-only correction](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/38-decimal-edit-save.png) | ![Typing 18.3 leaves 183 in the native protein field](C:/Users/danny/Documents/coding/fitness/docs/audits/2026-09-30-personas/evidence/n15-decimal-typing.png) |

## What I actually examined

The web app ran from this working checkout on localhost. Five separate browser contexts went through fresh onboarding, all four main tabs, the profile, and the full set of primary tools. They produced **177 saved checkpoints**. The expert, six-month tracker and developer used the direct account/setup route; the complete beginner and fit new tracker viewed the full four-slide introduction. Each used the guest path through the actual UI, selected their relevant focus, saved a synthetic body-weight entry, and returned after reload. The developer context used a desktop viewport; the others used 390-pixel mobile layouts.

Additional hands-on journeys exercised populated states: live meal estimation and correction, confirmation and reload, decimal editing, set-load and rep logging, partial workout completion, history, manual nutrition labels, pantry purchases, recipe preparation, fractional consumption and undo, a synthetic receipt with nonfood items, product review, a live seven-day plan, and interruption of an unsaved plan. I also inspected the native React Native interface through a freshly built Expo-web export, including its onboarding and every main tool family.

Account creation, recovery, account switching, conflict handling, private record ownership, deletion and assistant connection lifecycle were exercised by the **existing automated fixtures**. This run did not create a real cloud account or send confirmation/recovery email. The local server can call configured AI without reproducing hosted preview admission; local guest AI success must not be advertised as hosted guest capability.

All data entered was synthetic. The uploaded receipt was the repository’s clearly marked fictional Kroger receipt. No real user’s browser storage was cleared. Existing uncommitted product changes were preserved.

The source baseline was HEAD `a3f10044e78b55502b307458b7ef160ecffe8095` plus the working changes recorded in the evidence manifest. Several primary READMEs describe an older state of the application; current code and fresh observations took precedence.

## The experienced gym goer and fitness enthusiast

This persona understands programming, food quantities and progressive training. The working assumption is that they want fast, precise capture and reliable comparisons; they do not need an extended introduction to fitness.

**First use.** They can skip the character tour, choose Movement & workouts, and finish setup quickly. Nevertheless, they land in the same Chat home as the food-focused persona; the selected focus changes the ready-screen suggestion rather than supplying a personalized routine. The tone may be pleasant for someone who likes a companion, or expendable for someone seeking a utility. No actual preference was observed.

**Training journey.** The live request “80 kg for 5 reps, then 80 kg for 5 reps” produced a review card with two sets at 176.37 lb and explicitly explained the conversion. That is a useful surprise: familiar shorthand is understood and is not silently saved. The active-session flow also preserves individual set loads and understands “Got 5,” even when the visible rep buttons offer only 6–9. These are credible reasons to keep using the app.

The likely resistance appears in the next layer of training. Workout entry and display remain in pounds, the web flow advances through a prescribed exercise order, and the reviewed interface has no reorder, skip, superset, rest-timer or effort-rating workflow. Absence of all of those is not automatically a launch blocker, but together they limit its fit as this persona’s primary training tool. After saving, the web profile history shows reps without loads, native history lacks a session detail action, and the observed finish path offers no correction or reopen. Those last problems affect basic record trust rather than optional sophistication.

**Food and Kitchen.** They would probably appreciate ingredient breakdowns, label corrections and fractional batch portions. They are also the persona most likely to notice a reply/card discrepancy or want to repeat a fixed breakfast without another AI estimate. Building a pantry is potentially worthwhile if they meal-prep; it is overhead if they already have a routine.

**Predicted recurring use.** Daily meal review and workout capture are plausible core tools after correctness repairs. Body-weight history, previous-session comparison and prepared batches are likely weekly or recurring utilities. Grocery spending, mascot variations and assistant connections are optional. A serious training program may continue to live elsewhere until flexible session handling and history improve.

**Avoidance.** No natural avoidance was observed: the walkthrough deliberately opened everything. My hypothesis is that this persona would skip repeated onboarding, extensive shopping setup and AI workout generation when they already have a program. That is a proposed research question, not a discovered behavior.

Relevant evidence: [kg capture](evidence/expert/07-live-response.txt), [active workout](evidence/08-active-workout.txt), [actual 45 lb set](evidence/09-workout-five-reps.txt), [finished session](evidence/11-workout-finish.txt), [profile history](evidence/22-workout-history.txt).

## The complete beginner

This persona is new to both structured exercise and nutrition tracking. Their first success should be small and understandable, without requiring them to already know fitness vocabulary or target numbers.

**First use.** The full Spot tour explains that estimates are reviewed before logging and that missed days do not deserve punishment. That is a strong direction for reducing intimidation. The interface is visually coherent, the tour can be skipped, and the name is optional. The guest setup’s account-saving promise is misleading, though the later screen correctly explains local storage.

The setup asks what to call the person and whether they prefer food, movement or both. It does not establish exercise experience or help choose calorie targets. A beginner then encounters 2,000 kcal and gram targets, along with a starter Upper Body session whose first exercise is a 185 lb bench press. The web page labels the loads as examples; that qualification matters and should be preserved. It does not provide the missing decision support.

**First movement.** This walkthrough tried a very ordinary first action: recording a 20-minute walk. Spot replied that it could not capture the walk as resistance training and offered Build a workout. The tour explicitly said a walk counts. This is the most important first-use mismatch for this persona. The plausible reaction is confusion or feeling that the activity they chose does not belong here; it was not measured as an emotion.

**First food.** A simple meal can be described in Chat, and its estimate can be checked before counting it. However, understanding whether a target or estimate is suitable remains work for the user. “Log a meal” goes to Chat rather than a simple manual food form. A person without AI access can still use labels, pantry tools and manual workouts, but the promised manual path for a basic unlabeled meal is not obvious.

**Exploring the rest.** Kitchen contains a useful first-week sequence, but it is a grocery workflow. It does not solve the initial walking or calorie-understanding gap. Recipes require pantry data; swaps require confirmed products; planning is a longer review task. Those can wait until the person has completed the simple food or movement action they came for.

**Predicted recurring use.** A clear one-meal or one-activity capture, understandable daily summary and lightweight check-in could become regular habits. Pantry quantities, detailed macros and spending comparisons are likely optional initially. A guided starter routine could be useful; the present templates should not be confused with individualized coaching.

**Avoidance.** The only observed non-completion was the unsupported walk capture. There is no evidence that this persona hated or refused Kitchen. Potential postponement of complicated setup is a hypothesis.

Relevant evidence: [full tour and setup checkpoints](evidence/persona-walkthroughs.json), [walk result](evidence/beginner/07-live-response.txt), [generic targets](evidence/05-targets.txt), [starter session](evidence/06-workouts-empty.txt).

## The six month gym goer who already tracks calories

This persona has enough experience to know their routine and compare the app with an existing logging habit. They are likely to care about grams, corrections, saved meals and consistent weekly totals more than introductory motivation.

**First food journey.** The live lunch request specified cooked rice, cooked chicken and olive oil. The reply and card included all three components, including the oil. This demonstrates inclusion of an easily omitted ingredient in this case; it is not an accuracy benchmark. The meal stays unlogged until confirmation.

The important daily friction appears after capture. A saved breakfast with fractional macros survives reload and displays the same totals, but the web editor cannot save a renamed title until fractional nutrient values are changed to integers. The native decimal typing defect can change the intended amount. These defects matter more than adding another recommendation feature.

**Habitual meals and catch-up.** The diary has no direct repeat-yesterday or favorite-meal action in the reviewed controls. Prepared batches and repeated meal plans do support reuse, but require different setup. Selecting an earlier day and then choosing Log a meal does not pass that day into Chat. Explicitly typing the date can work, but the interface should carry the context. The web meal editor cannot correct a date; the native editor can.

**Kitchen and shopping.** This persona may be the best fit for the deeper food tools. In the manual batch experiment, five 100 g servings of synthetic oats entered the pantry without adding calories. Preparing two servings into four portions left three raw servings. Logging half a portion reduced prepared stock to 3.5 portions, and undo restored it to four without deducting raw oats again. That is useful repeat-use behavior.

The cost is setup. Receipt items may need package, serving and quantity review. A new batch cannot be entered independently of pantry ingredients. This is reasonable inventory accounting, but a person coming only for a recipe calculator will encounter a dependency they may not expect.

**Predicted recurring use.** Meal capture, correction, daily/weekly totals, repeated portions and training history have the strongest fit. Recipes become core if this person batch cooks. Receipts, shopping lists and meal plans are weekly tools if they own household food planning; they are optional otherwise. Price research and assistant connections are situational.

**Avoidance.** No avoidance was observed. A plausible choice is to keep using an existing calorie app if repeat logging and corrections remain slower here. The audit does not establish that they actually would.

Relevant evidence: [lunch capture](evidence/six-months/07-live-response.txt), [save failure](evidence/38-decimal-edit-save.txt), [prepared batch](evidence/49-batch-prepared.txt), [half portion](evidence/50-batch-half-portion.txt), [undo](evidence/51-portion-undone.txt).

## The fit person who is new to tracking calories

This persona is comfortable with exercise but unfamiliar with weighing food, serving bases and interpreting calorie estimates. Being fit does not imply that they want weight loss or know their macro targets.

**First use.** They choose Food & meals after the full introduction. The review-before-logging explanation is useful. The application does not require a weight-loss goal, and body-weight entries explicitly do not alter food targets. Those are positive boundaries.

**First meal.** The live request described toast with peanut butter while explicitly admitting that the peanut butter amount was unknown. Spot did not immediately invent a completed meal. It asked about the amount and offered a tablespoon/gram reference. That is a good uncertainty response. It then added a generic message about deciding between a meal and a grocery purchase, despite the clear breakfast context. The extra wording is confusing rather than useful.

**Understanding quantities.** Scan offers a clear choice between adding groceries and logging eaten food. The manual label form correctly distinguishes per serving, per 100 g and per 100 mL, and explains that blank and zero have different meanings. The same form is substantial work for a newcomer: product, brand, serving text, quantity, unit, nutrition basis, four nutrient fields and confirmation. After saving, the barcode is cleared and must be entered again to use the product.

The larger unanswered question is what to do with the dashboard’s targets. Numeric editing alone does not teach the meaning of a target, and the introduction does not establish one. The relevant improvement is a bounded explanation and a supported setup choice, not an assumption that this person should eat less.

**Exploring workouts and Kitchen.** Their training experience makes workout logging plausible, but they still encounter the unit/history constraints described above. Recipe portions may become useful after they learn servings; a full pantry and price-comparison workflow is not a prerequisite for calorie awareness and should not feel like one.

**Predicted recurring use.** A reviewed photo/text/label meal, simple daily totals and an understandable weekly view are plausible core tools. Barcode correction and preferences are occasional utilities. Body weight is optional. Detailed pantry accounting, price research and AI training plans are likely habit-dependent rather than universally valuable.

**Avoidance.** No observed avoidance. A likely optional deferral is the deeper shopping/recipe setup until serving-size concepts are understood.

Relevant evidence: [uncertain peanut butter](evidence/fit-new-tracker/07-live-response.txt), [manual label](evidence/42-manual-label.txt), [blank barcode after save](evidence/43-label-saved.txt), [product review](evidence/44-product-review.txt).

## The software developer auditing the app

This perspective prioritizes state integrity, error recovery, cross-platform parity, operational readiness and whether test coverage represents real user behavior.

**Entry and architecture.** Primary navigation and fresh state are understandable, sample meals are not silently counted as personal intake, and tools share domain logic. Existing account tests cover significant boundaries: account separation, failed reauthentication, interrupted restore, revision conflicts, large photos and retry-safe assistant proposals. This is meaningful engineering work.

**Where passing tests fall short.** All 353 existing unit tests and 258 existing browser tests passed in this run. Five added audit checks assert expected user behavior and all fail on the current implementation: decimal meal rename, native decimal typing, guest storage copy, workout-only activity days and load-aware profile history. They are preserved as failing checks, not skipped or rewritten to match the defects. The live reply/card mismatch is an additional output-quality finding outside these five deterministic checks.

**Mechanisms behind the important defects.** Web uses step=1 for all meal nutrition inputs even though the data schema accepts fractional values. Native converts field text with Number on every change, so an intermediate “18.” becomes “18” before the next digit. The server recomputes structured meal totals from components but returns independently authored reply text. The profile activity headline reads a meal-day count, and a separate workout-history component omits load rendering. These are specific boundaries a repair can address without redesigning the app.

**Native parity.** Expo-web is valuable for shared component verification, but it is not a signed iPhone/Android test. It exposes native settings labels such as preferredStores and unknown, missing semantic roles on some Pressables, a very tall workout form, and less useful historical detail. Body-weight unit support exists while workout load entry remains lb. A local export without the EAS-provided API URL initially shows unavailable account configuration; that is a known local setup boundary, not proof the production EAS profile has a broken URL.

**Operations and maintainability.** Public support is unconfigured. Real signup/recovery mail, signed-device permissions and interruption, representative receipts, provider costs and deployment of current assistant-connection work remain separate release evidence. README and the native guide still describe manual cloud snapshots even though current implementation saves linked account records automatically. That drift will mislead support and future changes unless reconciled.

**Predicted recurring use.** For this persona, exports, diagnostics, connection scopes/revocation, recovery, conflict states and known reproducible fixtures are essential audit tools. They are not necessarily everyday product features for the other four personas. The rest of the app is evaluated for correctness rather than personal lifestyle fit.

Relevant evidence: [verification inventory](verification.md), [five failing audit checks](regressions.spec.ts), [failure results](evidence/audit-regressions.json), [native preferences](evidence/n14-preferences.txt), [privacy and support](evidence/25-privacy.txt).

## Likely regular use versus optional value

Every cell below is a hypothesis based on the persona definition and observed tool requirements, not a retention measurement.

| Tool | Experienced enthusiast | Complete beginner | Six month tracker | Fit new calorie tracker |
|---|---|---|---|---|
| Meal text/photo review | Likely daily if precise and quick | Likely core once understandable | Likely daily | Likely core |
| Daily and weekly nutrition | Likely daily/weekly | Useful with explained targets | Likely core | Useful with explained targets |
| Workout set logging and history | Core only if flexible and trustworthy | Useful with suitable guidance; walking currently unsupported | Likely core | Useful if replacing an existing log |
| Body-weight history | Optional recurring measure | Optional, not a prerequisite | Optional weekly tool | Optional, goal-dependent |
| Barcode and label correction | Frequent for packaged foods | Situational | Frequent for packaged foods | Useful learning aid but needs serving guidance |
| Prepared recipes and leftovers | Core if meal-prepping | Later/optional | Strong recurring fit for batch cooking | Later/optional |
| Receipt and pantry maintenance | Weekly if managing food inventory | Optional setup burden | Weekly if household planner | Optional |
| Meal planning and shopping list | Weekly if needed | Potential guided help; current setup is substantial | Weekly if owning shopping | Optional |
| Swaps, prices and spending | Goal-dependent | Optional | Goal-dependent | Optional |
| Spot illustrations and moods | Preference-dependent | May reduce intimidation | Preference-dependent | May make learning friendlier |
| Assistant connections | Niche unless already using agents | Unlikely to be initial priority | Niche | Niche |
| Account saving and recovery | Foundational, ideally low attention | Foundational | Foundational | Foundational |

The developer’s frequent-use set is different: diagnostics, account/data boundaries, repeatable tests and integration controls. Do not use their enthusiasm for agent connections as evidence that everyday fitness users need them.

No real avoidance was measured. Because this was an exhaustive directed audit, every persona was instructed to inspect the entire application. It would be misleading to infer natural discovery or adoption from that completion.

## Useful behavior to preserve

The following are observed strengths, not simulated praise.

- **Proposals remain proposals.** Live food and workout captures requested review; they did not silently become intake or completed training. Corrected food totals persisted after confirmation and reload.
- **Purchasing, preparation and eating stay distinct.** The pantry and batch experiment preserved stock and calorie boundaries, including fractional portions and undo.
- **Uncertainty can be explicit.** Unknown peanut butter quantity prompted a question; unknown receipt quantities blocked consumption rather than pretending package count meant servings.
- **Nonfood receipt items survive.** The synthetic milk/oats/soap receipt produced three lines, with soap marked nonfood and not given nutrition.
- **Partial plans show limitations.** The live plan identified incomplete nutrition, missing quantities and unpriced needs. Its unsupported prose about milk sufficiency should be repaired without removing those structured safeguards.
- **Recorded history survives navigation and reload.** Synthetic body-weight entries persisted for all five profiles. Existing tests cover meal edits, session loads, recipe transactions and account restoration.
- **Unavailable hardware has alternatives.** Camera startup failed in the headless browser with photo/manual-barcode alternatives; microphone startup failed with a type-instead message. Actual device capture was not established.
- **Basic web layout and modal behavior are sound in the checks run.** All five main surfaces had no document/control horizontal overflow at 320, 390 and 1440 px. Escape closed the target editor and restored focus at all three widths. This is not a full accessibility certification.

## Coverage of the whole app

“Browsed” means the visible surface was entered and inspected. “Exercised” means an action and its result were checked. A fixture is not evidence that a production service or physical device works.

| Area | Fresh persona coverage | Additional exercised behavior | Boundary |
|---|---|---|---|
| Welcome, intro, local setup, return | All five; two full tours | Optional name, focus choice, reload | Real email confirmation not exercised |
| Signup, sign-in, recovery, sign-out | Account surface all five | Current web/native account fixtures | Mocked cloud responses |
| Chat, meal review, correction | All five; distinct live prompts for four | Live replacement estimate, confirm, reload, edit failure | Nutritional accuracy not benchmarked |
| Photo and receipt capture | Capture surface all five | Live synthetic receipt; preview/cancel/offline fixtures | No representative receipt corpus |
| Voice | Dedicated manual inspection | Startup error; existing reviewed-transcript/cancel tests | No real speech or phone microphone |
| Barcode and manual labels | All five | Invalid code, store code, private label, add groceries | No physical-camera barcode decoding |
| Nutrition Day, Week, history | All five | Dates, real saved totals, fractional edit, existing midnight tests | Selected-day capture handoff gap |
| Targets and food preferences | All five | Generic values, full forms, existing save/reload tests | No personalized target calculator verified |
| Body-weight history | Saved and reloaded in all five | Existing dated edit/unit tests | No outcome or health benefit claims |
| Workout templates and builder | All five | Three templates, live kg capture, active load/reps, finish | No multiweek coaching validation |
| Workout history and corrections | All five | Both histories, partial finish, new failure checks | Finished correction flow absent |
| Pantry amounts, dates and meal links | All five browse | Manual purchase, dates, stock; existing reconciliation/undo tests | Real package matching coverage unknown |
| Recipes and leftovers | All five browse | Prepare, half portion, undo; existing linked-stock tests | Requires pantry-first setup |
| Meal plans, edits and repetition | All five browse | Live seven-day draft and draft loss; existing edit/repeat/log tests | One live plan is not a quality study |
| Purchased ingredients into plans | Shared coverage | Existing web/native reconciliation tests | Fixture product/plan data |
| Shopping list, swaps, spending | All five browse | Existing add/check/remove, swap and price-review tests | Current retail prices not evaluated |
| Pending and completed reviews | Profile surfaces all five | Existing review-resolution and durable-action tests | Not every pending item type created live |
| Account save, restore, export, deletion | All five browse | Current conflict/ownership/recovery/export/deletion tests | Real backend lifecycle not rerun |
| Assistant connections and proposals | All five browse | CLI/MCP scoped proposal, retry, revoke and native ack tests | Hosted deployment not established here |
| Help, privacy, diagnostics | All five | Privacy/support copy inspected; existing support tests | Support destination missing |
| Native interface | All major tool families inspected | Fresh export, 18 existing tests, decimal typing regression | Expo-web, not physical devices |
| Responsive and accessible behavior | Web at three widths | Overflow and focus restoration; native semantic inspection | No complete WCAG or assistive-device audit |

## Suggested sequence before launch

First repair **F01, F02 and F06** with shared canonical data and regression coverage. The success criterion is concrete: type decimal values without alteration, rename a fractional meal without changing nutrition, and make every displayed total agree with the saved record.

Next make the **initial promise and record lifecycle dependable**. Resolve walking capture versus marketing, explain untouched generic targets, show guest/account saving accurately, and allow correction after finishing a workout. Verify a complete first session for each of the four fitness personas, including a return visit.

Then address **repeat-use efficiency and native parity**: consistent history with loads, selected-day capture, repeat-meal entry, retained planning drafts, plain-language settings and compact set rows. Keep advanced programming and price research proportionate to the chosen launch audience.

Finally run **real release checks**: signed iOS/Android devices, real signup/recovery mail, a configured support route, representative permissioned receipts, actual provider budget controls, and the intended hosted admission policy. Prior readiness documents contain historical evidence for some backend work; they do not replace these current external checks.

The next human study should be task-based: first meal, first movement, one correction, an interruption and return, a second-day repeat, then an optional Kitchen task. Observe what participants discover or ignore without instructing them to open every feature. That is where genuine avoidance, delight, frustration and regular-use fit can be learned.

## Evidence and maintenance

Start with [verification and reproduction](verification.md), [the friction log](friction-log.md), and [the machine-readable log](friction-log.json). The evidence folder includes UI text snapshots and screenshots, current suite results, five persona walkthroughs, and the five intentionally failing audit checks.

This audit does not claim production readiness, real-user validation, comprehensive security testing, medical accuracy, physical-device parity or long-term retention. It establishes concrete current behavior and a reviewable prelaunch backlog.

