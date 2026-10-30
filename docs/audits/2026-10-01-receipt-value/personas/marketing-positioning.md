# Persona 4: Positioning and jobs-to-be-done strategist

Audit date: October 1, 2026. Independent marketing perspective on the current Rep & Plate implementation. No production changes.

## Role and evidence boundary

I evaluate whether a person can explain the product's useful difference, name their own reason to try it, and see a believable exchange for the effort of uploading a receipt. Evidence is a source walkthrough of the preview, onboarding, Chat, Kitchen, capture modal, and receipt success card. This is an expert assessment, not observed customer research. All predicted reactions below are hypotheses. No market research establishes a unique competitive capability. Parent-reported browser validation is contextual; I did not execute those tests independently.

## Walkthrough

An invited newcomer encounters a calm food-and-training preview, then a mascot introduction about meals, movement, and returning without guilt. The default Chat context continues the food-and-workout frame. The receipt's strongest practical benefit becomes explicit in Kitchen's first-week card: less uncertainty about dinner. Kitchen offers Add a receipt, whose modal first explains how to photograph it, then explains grocery identification and nutrition research after selecting an image. Sending enters Chat. The success card confirms groceries saved, uncertain matches, and separation from today's intake; it opens grocery details. The longer value chain requires confirming products/quantities, planning, identifying missing ingredients, cooking, and logging a portion.

## Findings (five)

1. **P1 — The first promise does not introduce the receipt reason to choose.** `server/preview-page.ts:10` offers a calmer way to keep up with food, training, and yourself; `src/features/onboarding/Onboarding.tsx:159` leads with good food, real life, and an invested plate; `src/features/onboarding/model.ts:29` defines the tour around food logging, movement, and encouragement. Hypothesis: a busy shopper classifies this as another tracker before learning its grocery-to-meal capability. Put one plain receipt-to-outcome sentence and a small concrete example before the account decision; retain Spot as the voice delivering it. The invitation page may intentionally be a teaser, but its generic positioning should not silently become the acquisition message.

2. **P1 — Kitchen contains the clearest proposition, while the default entry surface reinforces a different job.** `src/features/spot/Spot.tsx:330` says “Your food. Your reps. Your pace.” and `src/features/spot/Spot.tsx:336` asks what the user ate or did; `src/ChatLayer.tsx:746` says “What happened?” Conversely, `src/features/planning/FirstWeek.tsx:24` explicitly connects a receipt to less “what's for dinner?” Hypothesis: someone can competently use Chat without discovering the reason to save a grocery receipt. Bring the Kitchen outcome into the first Chat state with a clearly optional action such as “Plan from my groceries” and an explanation that starts with a receipt.

3. **P1 — The upload asks for effort before explaining the whole exchange.** `src/App.tsx:1919` gives photo instructions before file selection; `src/App.tsx:1856` explains identification and nutrition research after selection. `src/features/planning/first-week.ts:35` describes the receipt as including purchase details, while `src/features/planning/first-week.ts:43` establishes a subsequent product/quantity review. Hypothesis: the shopper hears “organize my receipt” rather than “help decide what to cook.” Before choosing a file, show: “Add a grocery receipt → check products and quantities → plan meals using your groceries.” State that estimates can need review. Avoid claiming that one photo instantly provides a complete accurate pantry or plan.

4. **P1 — The success card ends at storage rather than demonstrating a useful next result.** `src/AICards.tsx:111` confirms item count, `src/AICards.tsx:115` flags matches needing review or available sources, and `src/AICards.tsx:120` confirms separation from intake. All are useful, but none explains the next practical payoff. Hypothesis: “saved” feels like filing paperwork, making a second upload hard to justify. Add a state-aware next action beside the confirmation: review uncertain groceries first; once usable, ask for a meal idea or open the planner with those groceries. Describe the concrete benefit in that action rather than implying that every receipt is ready to plan from.

5. **P2 — The audience promise currently spans three different motivations without choosing an acquisition wedge.** `src/features/onboarding/model.ts:21` offers food, movement, or both, while `src/KitchenPage.tsx:159` introduces budget, family, or protein and `src/features/planning/FirstWeek.tsx:24` emphasizes dinner decisions. Hypothesis: a budget-focused household cook, a protein-focused lifter, and a general tracker infer different products. Test one primary acquisition audience and adapt secondary examples to that audience. Current evidence favors a household shopper who wants meal decisions from groceries already purchased; it does not prove demand or exclude lifters. A movement-first user should retain an equally clear route to their own goal.

## Strengths worth keeping

- The existing Kitchen sentence “A receipt today. Less ‘what's for dinner?’ tomorrow.” is a strong outcome-first starting point (`src/features/planning/FirstWeek.tsx:24`).
- Receipt capture correctly keeps household purchases separate from meals eaten (`src/App.tsx:1856`; `src/AICards.tsx:120`). This is an understandable trust signal when paired with why purchases matter.
- The longer journey honestly names product, quantity, recipe, portion, and cost review (`src/features/planning/first-week.ts:43`, `src/features/planning/first-week.ts:51`). Review requirements should accompany the promise.
- Kitchen connects stock to missing ingredients (`src/KitchenPage.tsx:397`), providing concrete evidence for the grocery-to-next-shop story.
- Spot's low-pressure tone can make review and returning approachable; test that interpretation rather than assuming everyone likes the mascot.

## Proposed proposition for testing

**Headline:** Turn your grocery receipt into a plan for dinner.

**Supporting copy:** Add a receipt, check the groceries and quantities, then plan meals from what you have and see what else you need. Purchases stay separate from what you eat.

**Primary CTA:** Start with my groceries.

**Expectation beside CTA:** You'll review uncertain products and amounts before planning. Receipt reading requires connected AI.

This is a proposed positioning direction, not measured winning copy. Do not add cash rewards, guaranteed savings, automatic accurate nutrition, complete spending coverage, or a claim of being the only receipt-based app. There is no evidence for those promises in this audit. Budget and protein can be supporting benefit examples after the core grocery-to-meal mechanism is understood.

## Audience tradeoffs

| Candidate audience | Job they may hire it for | Tradeoff to test |
| --- | --- | --- |
| Household shopper/cook | Decide meals from a recent grocery trip; identify missing ingredients | Product/quantity correction can feel like extra household administration |
| Protein-focused active adult | Use groceries to plan meals against reviewed personal nutrition targets | Dinner-first copy may understate nutrition usefulness; guessed matches can undermine trust |
| General meal/workout logger | Record food and training with encouragement | Receipt onboarding may feel irrelevant if they eat out or do not shop for a household |

## User research tasks

1. Recruit shoppers/cooks, protein-focused active adults, and current general trackers. After five seconds on the current entry, ask “Who is this for?”, “What do you get from a receipt?”, and “Why would you try it?” Capture unaided answers before explaining.
2. Ask participants to find a way to plan a meal from a recent grocery trip without prescribing Kitchen or an upload. Record the first chosen route, hesitation, and whether the receipt is discovered.
3. Before uploading, ask participants to predict the result and effort. After a representative receipt result with an uncertain product, compare their expectation with the review they actually face.
4. After the success card, ask “What can you do now?” Observe whether they review needed matches, choose a meal, or leave. Repeat with a fully reviewed receipt.
5. Test the proposed receipt-to-dinner framing against the current food-and-workout framing with each audience. Measure accurate explanation and intent to take the next relevant step; then observe a second grocery trip to distinguish curiosity from ongoing usefulness. Do not equate upload clicks with validated positioning.

## Decision

Prioritize moving the existing grocery-to-dinner benefit into first impression, pre-upload explanation, and post-upload next action. Validate the primary audience before recentering the entire app around receipts. The receipt is the input; an easier meal decision is the proposed reason to provide it.

