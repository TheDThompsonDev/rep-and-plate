# Project context

| Area | Covers | Document | Verification reference |
| --- | --- | --- | --- |
| AI providers | Qwen 3.5-Flash generation, Jev decision checks, source grounding and separate voice service | [Provider decisions](ai-providers.md) | Provider regression tests and live synthetic receipt, plan, label, workout and search checks |
| Receipt shopping | Receipt prices, household preferences, evidence-based swaps, researched prices, private spending and persistent shopping list | [Shopping decisions](shopping.md) | CYC `9d6064db-c63e-4611-83db-f1fe2d708066`; shopping, receipt barcode and Chat browser journeys; live synthetic receipt/price checks |
| Kitchen and profile navigation | Pantry, prepared recipes, upcoming meals, shopping needs, receipt access; Kitchen bottom destination and You profile entry | [Kitchen decisions](kitchen.md) | CYC `09b31dd1-ec2d-400b-8ed7-271ed420df33`; Kitchen, barcode and migrated profile browser journeys |
| Personal nutrition | `src/domain.ts`, `src/useLocalDay.ts`, `src/NutritionPage.tsx`, `src/ai-client.ts`, insights and reviews | [Nutrition decisions](nutrition.md) | Working changes based on `4bd8875`; CYC run `03a46f6a-02f7-45e0-adcc-c52bdffffde3` |
| Regression history | Daily totals, example records, navigation tests | [Error ledger](error-ledger.md) | See individual entries |
| UI verification | Barcode entry, Nutrition, local dates, record preservation | [Verify recipe](verify-recipe.md) | Executable Playwright journeys |
| Product direction (proposed) | Current readiness gaps, Nutrition/You information architecture, release gates | [Readiness audit](../USER_READINESS.md) | Source and clean-screen inspection, isolated concept checks at 320/390/1100px; CYC `81e96d35-bf14-4881-88ac-321ae3915836`. Not yet user-approved or implemented in the app. |
| Visual direction correction | Original mint, rounded, photographic identity; continuous mobile scroll; user rejected the plain journal concept | [Refinement notes](../design/REFINEMENT.md) | CYC `f7bb458b-d3d4-4ecf-864d-d638a336ce16`; isolated concept checks at 320/390/1100px. User approved the revised concept; implementation is documented below. |
| Approved UI implementation | Nutrition day/week browsing, mint/photo hierarchy, actual You activity, single surface scroll and connected actions | [Implementation decisions](nutrition.md) | CYC `344e5737-d910-494f-858f-2cd72e6c8ec7`; `tests/refined-tabs.spec.ts` and existing connected flows. Approved concept implemented using real records, without fictional weight trends. |
