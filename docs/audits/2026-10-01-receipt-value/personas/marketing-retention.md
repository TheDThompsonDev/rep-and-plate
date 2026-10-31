# Persona 6 — Lifecycle and growth marketing

Role: a lifecycle marketer evaluating the first useful result, repeat grocery routine, and honest activation measurement. This is an independent code and documentation audit, not a study of real customers. Behavioral impacts below are hypotheses. Controlled browser tests reported by the parent establish tested behavior, not conversion or retention.

## Core assessment

The useful loop is purchase → check groceries → plan meals with known stock → buy shortfalls → record the next trip → log portions actually eaten. A receipt adds purchase evidence and groceries; it does not by itself create accurate nutrition, a ready meal plan, or proven savings. The differentiating proposition should make that loop tangible before the upload request and continue to explain progress after extraction.

## Five findings

1. **P1 — First useful outcome is postponed by the default journey.** `src/features/planning/FirstWeek.tsx:17` picks the first unfinished step and `src/features/planning/first-week.ts:27` places preferences first. Only that step is shown unless expanded (`src/features/planning/FirstWeek.tsx:31`). Receipt upload is not technically gated, but the promoted route starts with setup. Hypothesis: visitors may infer that substantial setup precedes any receipt benefit. Offer a visible receipt-first route alongside optional tailoring, with a concrete preview of what follows.

2. **P1 — The extraction success message sells storage rather than the next payoff.** `src/AICards.tsx:111` says items were saved; `src/AICards.tsx:115` prioritizes checks or nutrition sources. The existing distinction from daily intake is valuable. Hypothesis: the user does not yet see how the stored items help dinner or the next shop. Add a state-specific next action: review uncertain groceries, then create meal ideas from confirmed stock. Do not call incomplete quantities ready for planning.

3. **P1 — The proposed activation step can look complete before the valuable work is done.** `src/features/planning/first-week.ts:37` marks the receipt step complete on existence of a purchase receipt, while pantry readiness requires every lot to be reviewed with known remaining quantity (`src/features/planning/first-week.ts:10`). A saved receipt is a capture milestone, not full activation. Give extraction, review readiness, and first useful plan separate progress labels; measure time and abandonment between them. Test whether one usable ingredient or meal can produce an early win without requiring all historical pantry lots to be corrected.

4. **P2 — The repeat-upload reason is present but distant from the upload loop.** `src/features/shopping/ShoppingDialog.tsx:813` explains adding a receipt after shopping to update the pantry. The checklist's shopping step is framed as closure (`src/features/planning/first-week.ts:57`), not the beginning of the next grocery cycle. Hypothesis: customers treat receipts as one-time onboarding. At a completed shopping list or next kitchen visit, show a contextual action explaining that the next receipt records new purchases and helps refresh planning stock. Background reminders are not implemented per `README.md:141`; proposals for them require separate product work and notification consent.

5. **P2 — A strong recurring payoff is hidden in spending, with important boundaries to preserve.** `src/features/shopping/ShoppingDialog.tsx:896` brings trips together, but totals include only reviewed receipts and also nonfood (`src/features/shopping/ShoppingDialog.tsx:898`). `src/features/shopping/shopping.ts:22` skips unchecked/unknown totals; `src/features/shopping/shopping.ts:65` identifies receipt prices as historical. Make reviewed grocery-trip history an explicit secondary benefit before upload and after review. Avoid promising cashback, automatic rewards, guaranteed savings, a complete household budget, or nutrition accuracy from abbreviated receipt names.

## Existing strengths

- “A receipt today. Less ‘what’s for dinner?’ tomorrow.” connects a mundane action with a recognizable need.
- Purchases remain separate from intake; review flags, quantities and sources make uncertainty inspectable.
- The app already supports a shopping list, reviewed spending, pantry-based planning, and portion logging. Lifecycle messaging can connect existing behaviors rather than sell an unimplemented reward system.
- Historical prices and incomplete spending are disclosed. Keep those boundaries when simplifying copy.

## Copy proposals to test

- Before upload: **“Turn your grocery trip into a starting point for dinner.”** Supporting text: “Photograph your receipt to save groceries and purchase details. Check uncertain products and amounts, then plan meals with what you have.”
- After extraction, if checks remain: **“Your groceries are saved. Check these items to help your meal plan use the right food and amounts.”** Primary action: “Check groceries.”
- When usable pantry stock exists: **“Put these groceries into a meal plan.”** Supporting text: “Review the meals and portions before approving your plan.”
- After shopping: **“Bought the missing ingredients? Add your new receipt.”** Supporting text: “Record this trip, check the new groceries, and connect them to your plan.”
- Spending benefit: **“Keep reviewed grocery trips together.”** Supporting text: “See recorded purchases by store. Missing receipts and unchecked totals are not included.”

These are proposed messages, not implemented changes. Do not describe automatic price savings, waste prevention, health outcomes, or full receipt accuracy as established benefits.

## Research and metrics plan

Run two moderated cohorts: first-time household shoppers and people returning after one real grocery trip. Use their own receipts only with consent; otherwise supply realistic mixed-food/nonfood receipts and explicitly label the simulation. Ask participants to explain the benefit before uploading, choose their next action after extraction, and explain what adding a second receipt changes. Observe whether they can reach a useful reviewed meal or spending outcome; record task failures and reasons without interpreting hesitation as proof of conversion loss.

Proposed funnel events, subject to an explicit privacy and consent design: receipt entry viewed → capture started → submitted for extraction → extraction succeeded/failed → groceries reviewed sufficiently for chosen task → first receipt-derived plan approved or trip total reviewed → first receipt-linked portion logged → second distinct grocery trip captured and reviewed. Never count image-only offline saves as successful extraction, ambiguous items as confirmed, or retries/duplicate photographs as second purchases. Do not send receipt text, photos, item names, diet restrictions, exact prices, or store identity into analytics by default. `docs/context/shopping.md:21` states that cross-user shopping analytics are not implemented; this plan does not assert an existing funnel.

Report separately: time to first useful outcome, review burden per extracted receipt, abandonment by stage, provider failure/latency, product/quantity completeness, outcome reached by cohort, and second-trip completion after the participant's actual shopping interval. Use capture and review as intermediate milestones; use an approved useful plan or reviewed trip summary as candidate activation definitions and validate which correlates with return behavior. Set targets only after a baseline. Compare copy variants only after usability failures are resolved and with sample-size and decision rules agreed in advance. There is currently no evidence supporting a numerical uplift or superiority over competitors.
