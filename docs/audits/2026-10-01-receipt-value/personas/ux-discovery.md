# Persona 1 — First-use discovery and information architecture

Date: October 1, 2026. Role: a senior UI/UX engineer examining the mental model, navigation and first useful action. This is an independent heuristic persona simulation from current web source, not research with a real participant. No app code changed. Existing uncommitted changes were inspected as current state and preserved.

## Task walkthrough

Scenario: a first-time grocery shopper has a receipt and wants to know whether uploading it will help with dinner and the next shop.

1. Welcome introduces Spot as a food/workout buddy. The four tour slides explain recording food eaten and movement, then account/setup collects a name and food/movement focus. None presents receipt benefits. Ready recommends one meal or movement and always sends the person to Chat (`src/features/onboarding/model.ts:21`, `:26`; `src/features/onboarding/Onboarding.tsx:63`, `:478`).
2. Chat greets them with “Tell me what you ate or what you did,” then “Tell Spot.” Camera is labeled “Take a meal photo”; attachment accepts an image/screenshot. Help examples omit receipts (`src/features/spot/Spot.tsx:337`; `src/ChatLayer.tsx:733`; `src/chat-guidance.ts:15`).
3. A person exploring Kitchen finds a meal-plan hero, “Add a receipt,” shopping preferences and a six-step first-week guide. The guide finally connects a receipt to less dinner uncertainty. It initially reveals only the next incomplete step, usually preferences (`src/KitchenPage.tsx:130`, `:152`, `:158`, `:165`; `src/features/planning/FirstWeek.tsx:19`, `:24`, `:31`).
4. Receipt capture initially gives photography instructions. Only after choosing a photo does it explain item identification/nutrition research; send leads back to Chat. In unavailable AI states it can save an image for later review (`src/App.tsx:1853`, `:1886`, `:1899`, `:1918`).
5. A grocery result card reports saved items and uncertain matches. Opening it enters Pantry, with product/quantity review and a dinner question at the bottom; receipt price review is behind purchase details (`src/AICards.tsx:95`; `src/App.tsx:2235`; `src/features/pantry/PantryDialog.tsx:343`, `:692`, `:695`). The functional value exists, but the shopper must discover and connect several surfaces to reach it.

## Findings

### 1. P1 — The first-use story excludes the central differentiator

Evidence: `src/features/onboarding/model.ts:26-54` describes personality, eaten food, workouts and rest. `src/features/onboarding/Onboarding.tsx:478-484` recommends a meal or movement; `:63` routes all focus choices to Chat.

Impact: someone can finish onboarding with a reasonable but incomplete model of another food/workout logger, without recognizing that receipts inform a usable pantry, dinner planning and recorded grocery spending. This is a predicted comprehension risk, not measured abandonment.

Recommendation: make one tour moment show an explicitly labeled example receipt becoming groceries, a possible dinner and missing ingredients. Explain that review is required and spending covers uploaded/reviewed receipts. Offer “Start with my groceries” as an initial focus with a receipt action or sample preview.

### 2. P1 — The default Chat surface teaches a meal-only capture model

Evidence: `src/features/spot/Spot.tsx:337-358` says what you ate/did; `src/ChatLayer.tsx:733-749` exposes meal camera and generic attachment; `src/chat-guidance.ts:15-18` gives help examples for nutrition/workout/pantry/food logging, with no receipt example. Dedicated receipt handling starts from Kitchen (`src/App.tsx:1654-1658`).

Impact: a user who knows they can upload a receipt still has to infer that an image action belongs to purchases. Generic image capture obscures intent and requires cross-tab exploration to find the explicit receipt flow.

Recommendation: add a visible “Use a grocery receipt” action in first-use Chat with a benefit sentence and the existing dedicated capture intent. Include “What can I make from my groceries?” and receipt guidance in local help. Expand the camera label to the supported intent or provide explicit meal/receipt choices.

### 3. P2 — The Kitchen guide conceals the causal path behind unrelated setup choices

Evidence: `src/KitchenPage.tsx:130-165` puts planner, scan/receipt actions and shopping invitation before FirstWeek. `src/features/planning/FirstWeek.tsx:25` introduces generic nutrition targets before step progress; `:31` defaults to one step. `src/features/planning/first-week.ts:26-38` starts with preferences, then explains a receipt chiefly as purchase details. Later benefits appear at `:50-67`.

Impact: preferences, targets, planning and shopping all compete with receipt activation. A person may understand “set up the app” before understanding why doing the work is worthwhile.

Recommendation: show a concise, persistent three-part preview: “Receipt → check groceries → dinner ideas and missing ingredients.” Keep setup available at the point its answers improve the first result. Retain full six-step progress as optional detail and all target provenance safeguards.

### 4. P2 — The upload request explains technique before reward

Evidence: `src/App.tsx:1918-1942` gives lighting, store/items/total instructions and file limits. The explanation after selection at `:1853-1857` promises identifying groceries/researching nutrition but still omits the resulting dinner/shopping use. `src/features/planning/FirstWeek.tsx:24` supplies the stronger benefit elsewhere.

Impact: the person is asked to find and photograph a potentially private, fiddly document before the capture surface answers “what do I get?” The value is available, but not at the exact commitment point.

Recommendation: above camera/file actions show a concrete supported result: “Turn this shop into groceries you can check, dinner ideas from what you have, and a list of what is missing.” Explain expected checking in one sentence. Provide a clearly labeled sample receipt preview, with examples kept separate from personal records.

### 5. P2 — Upload success celebrates storage more than the next useful outcome

Evidence: `src/AICards.tsx:109-120` emphasizes item count, nutrition sources and “Saved to groceries.” Opening enters `PantryDialog` (`src/App.tsx:2235-2250`). Its review queue is useful (`src/features/pantry/PantryDialog.tsx:343`) but “What can I make with these?” appears after pantry/history at `:695-707`.

Impact: a successful upload can feel finished before a usable outcome. Users must enter a record and scroll past reviews/inventory to discover the payoff. Correction can appear as pure work without an obvious reward.

Recommendation: add a receipt-scoped next-action summary to the result: “Check N uncertain items” and then “Find a dinner from these groceries.” Put the relevant review/benefit action near the top of the receipt-scoped pantry. Keep purchase, stock and intake separate; do not bypass product/quantity safeguards or claim complete nutrition.

## What works

- Kitchen has a dedicated receipt action and a clear, warm dinner-oriented headline (`src/KitchenPage.tsx:124`, `:154`).
- The first-week guide already supplies a real receipt → review → plan → shop → cook sequence and derives progress from saved state (`src/features/planning/first-week.ts:24-80`). This provides useful existing structure for improvements.
- Purchase versus consumption is reinforced at upload, result and logging; uncertain products/quantities remain explicit (`src/App.tsx:1856`; `src/AICards.tsx:120`; `src/features/pantry/PantryDialog.tsx:343`).
- The review queue prioritizes up to three items and explains packages × servings per package with an example (`src/features/pantry/PantryDialog.tsx:343`).

## Uncertainty and scope

This persona did not conduct live browser/device tasks, authenticate, upload a real receipt or contact users. Source establishes labels, ordering and route behavior, not actual visibility, success rates or comprehension. Historical readiness documents are context only; newer source includes improvements they may describe as missing. Representative receipt extraction accuracy remains unmeasured in `docs/context/receipt-evaluation.md:3`. Private-preview account access can also limit capture; recruitment should use approved participants or clearly separated sample mode. Recommendations are hypotheses to validate, not observed user behavior.

## Proposed usability validation

Recruit 5–8 first-time target shoppers for think-aloud sessions, including people who already track food and people who primarily plan household meals. Give them the neutral task: “You have just bought groceries. Decide whether this app can help you plan dinner and your next shop.” Do not mention the upload action. Test welcome/Chat first, then ask them to use a consented/redacted receipt or clearly labeled fixture. Record unaided discovery, time to first receipt action, navigation detours, explanation of expected reward before upload, recovery from one uncertain product/quantity, ability to distinguish bought versus eaten, and time to an actionable dinner/missing-ingredient result. Ask for the next action after upload without coaching. Compare current flow with a receipt benefit/action prototype using counterbalanced order; separate fixture usability from real extraction quality. Agree acceptance criteria before testing; suggested target: at least 80% identify the receipt benefit and find the capture action unaided, and no participant interprets purchases as eaten intake.
