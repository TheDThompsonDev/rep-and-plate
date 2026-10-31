# Persona 3 — Activation and downstream payoff engineer

This is a heuristic simulation of an expert reviewing the web application's source and existing tests on 2026-10-01. It is not observation of a real user. No production code was changed. Existing test assertions were read, not rerun by this reviewer. Severity describes likely activation friction, not measured conversion loss.

## The journey I traced

Kitchen → Add a receipt → preview/send → saved grocery card in Chat → pantry/product/quantity review → request a dinner or create a seven-day draft → approve → acquire/link missing ingredients → log an eaten portion → updated stock → repeat a week or upload the next receipt.

The app has useful downstream capabilities. The main concern is how much the user must understand and configure before the receipt turns into an immediately useful answer.

## Findings

### 1. High — Upload success reports storage, while the useful outcome is another discovery task

**Evidence:** `src/AICards.tsx:95` defines GroceryCard with one `onOpen` action; `src/AICards.tsx:111` reports item count saved, `src/AICards.tsx:117` offers estimates/sources, and `src/AICards.tsx:120` correctly separates groceries from intake. `src/ChatLayer.tsx:445` routes it to purchase-specific pantry review. The dinner action exists at the bottom of the pantry (`src/features/pantry/PantryDialog.tsx:704`), and the meal planner is a separate entry in Kitchen (`src/KitchenPage.tsx:129`).

**Inference:** A successful upload can feel like an inventory entry rather than a solved dinner or shopping problem. The receipt card does not itself explain what can be done next with the ready portion of this purchase. This concerns the deterministic card; generated assistant text may offer more guidance and needs live validation.

**Recommendation:** Give the receipt result a stable payoff panel: “N foods saved; M need a check,” one concrete next action such as “Find tonight's dinner with these,” and a separate review action. Show prerequisites only for the ingredients needed by that action. Keep “not eaten” explicit.

**Validation:** With a new user and a controlled mixed-confidence receipt, ask them to get one useful dinner idea without coaching. Measure whether they can describe the outcome before navigating, review steps taken, and time from upload completion to an actionable meal.

### 2. High — One unrelated or used food can keep the first-week guide on pantry review

**Evidence:** `src/features/planning/first-week.ts:10` requires every pantry lot to have no review flag, a known remaining amount, and a consistent balance. `src/features/pantry/ledger.ts:25` includes all food lots, including those marked used, and unknown purchased amounts yield a null balance (`src/features/pantry/ledger.ts:34`). In contrast, the visible review queue excludes used items (`src/features/pantry/PantryDialog.tsx:169`). `src/features/planning/FirstWeek.tsx:17` always chooses the first incomplete step.

**Inference:** An unresolved food that the household has already used can keep “Check what came home” incomplete even when it is absent from the queue and other foods are sufficient for a useful dinner. This is a navigation recommendation mismatch; it does not mean the planner universally forbids proceeding.

**Recommendation:** Base next-step readiness on available foods relevant to the chosen outcome. Exclude explicitly used stock from outstanding review prerequisites. Offer a visible partial-progress route: “Plan with the foods already checked.”

**Validation:** Seed one reviewed available food plus one unresolved used food. Confirm the guide does not prescribe an unresolvable review. Then add an unrelated uncertain food and verify that planning with ready ingredients remains discoverable.

### 3. Medium — A full week is the prominent first payoff, although a single dinner would require less commitment

**Evidence:** Kitchen's prominent inspiration card opens the meal planner (`src/KitchenPage.tsx:129`). The planner describes a seven-day draft (`src/features/planning/MealPlanner.tsx:93`) and its primary initial action is “Create my week” (`src/features/planning/MealPlanner.tsx:98`). The first-week guide begins with household preferences (`src/features/planning/first-week.ts:27`) and continues through pantry checks, approval, shopping and consumption. A smaller “What can I make with these?” path exists at the pantry bottom, and use-up ideas appear after the planner controls (`src/features/planning/MealPlanner.tsx:131`).

**Inference:** Receipt upload asks for a small action, but the prominent route then presents week planning, household settings, review and shopping. Users seeking tonight's answer may infer more work than the benefit warrants.

**Recommendation:** Make “Help me choose dinner tonight” a primary post-receipt action. Let users expand a successful meal into a week afterward. Keep the existing week planning route for users who want it.

**Validation:** Compare a single-dinner entry with the current week-first entry using the same receipt. Measure completion of one useful outcome, requests for help, abandonment, and whether users voluntarily continue to a week.

### 4. Medium — Receipt, food and price confirmation have different meanings but no unified readiness summary

**Evidence:** Adding any purchase receipt completes the receipt step (`src/features/planning/first-week.ts:37`), even before purchase amounts are confirmed. `src/features/shopping/ReceiptReview.tsx:165` explicitly says its confirmation covers amounts only; product and serving reviews remain separate. Spending counts reviewed receipts (`src/features/shopping/ShoppingDialog.tsx:898`), while basket estimates additionally need price, quantity, currency and a purchase date no older than 30 days (`src/features/planning/basket.ts:64`). GroceryCard counts only `needsReview` flags (`src/AICards.tsx:102`), not all missing quantity/price prerequisites.

**Inference:** “Saved,” “reviewed,” and “ready” are distributed across several interfaces. A user can see a success state yet later discover that dinner estimates or spending still require other checks. These safeguards are justified; their resulting work is hard to predict.

**Recommendation:** Summarize capability readiness together: ready for inventory, ready for meal estimates, and ready for spending. Explain which missing field unlocks the action the user selected. Avoid requiring price review to get dinner value.

**Validation:** Ask users what a newly saved receipt will contribute to intake, pantry, meal ideas and spending. Check comprehension before and after an integrated summary. Include missing currency, missing quantities and a partially matched receipt.

### 5. Medium — The first-week guide has no transition to a repeat-use success state

**Evidence:** `src/features/planning/FirstWeek.tsx:17` falls back to the last step when every step is complete, while its progress copy remains “N of six steps complete” (`src/features/planning/FirstWeek.tsx:27`). The application can repeat an approved week against current stock (`src/features/planning/MealPlanner.tsx:104`), but this capability remains inside the planner. Kitchen displays current stock and recorded spending, not a receipt-specific recap of useful outcomes.

**Inference:** After earning the first useful result, the guide continues to show the completed cook step. It misses the opportunity to make the return loop obvious: updated pantry → next meal or week → new receipt. This is not evidence that users fail to return.

**Recommendation:** Replace the completed checklist with a small factual recap and one current action: what was added, what was logged, what remains, and whether to repeat the week or plan another dinner. Report measured facts; do not invent money saved, waste avoided or time saved.

**Validation:** Complete the journey, revisit the next day and after a second receipt, and ask users what changed and what to do next. Check whether a completed checklist communicates ongoing value or looks finished.

## Strengths to preserve

- Purchased food is consistently separated from eaten intake in GroceryCard, Kitchen, pantry and plan approval. The receipt-capture test explicitly checks this (`tests/receipt-capture.spec.ts:5`).
- Portion logging, stock changes and undo have dedicated behavioral coverage. Pantry-link tests check fractional consumption once and preserved intake on undo (`tests/pantry-link-review.spec.ts:101`).
- Shopping review does not silently change food intake or quantities (`tests/shopping.spec.ts:137`), and unknown prices are not advertised as savings (`tests/shopping.spec.ts:173`).
- The planner provides ingredient coverage and partial nutrition estimates, while historical basket prices disclose their limits (`src/features/planning/MealPlanner.tsx:116`; `src/features/planning/basket.ts:122`).
- User-controlled approval and repeat-week drafts are sensible foundations for trust and repeated use.

## Limits and next evidence

This review does not establish visual hierarchy on a physical phone, extraction accuracy, real-provider latency, user comprehension, or a conversion effect. Source inspection is strongest for deterministic state and action paths. Test presence is not a claim that current tests passed. Parent review should verify the result card, mixed-confidence review path and completed guide in the browser; run actual usability sessions before treating the heuristics as observed behavior. An initial suspected cook-action routing defect was retracted: the cook step's action is `planner`, and Kitchen correctly maps `planner` to `onPlan`.
