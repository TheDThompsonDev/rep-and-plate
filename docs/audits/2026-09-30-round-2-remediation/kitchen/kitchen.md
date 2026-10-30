# Kitchen round-two remediation

Implemented R2-07, R2-09, R2-15 and R2-18. Product source and tests are frozen for the root verification run. This lane did not commit or deploy, change unrelated product files, or manage the shared Vite server.

## Changes

**R2-07: one coherent receipt-item review route.** Pantry queue entries with saved product candidates now open those candidates directly. Product search/scanning has an immediate **Enter package details manually** path. The manual form can return to suggested products without losing its typed raw field values. Applying a reviewed product and saving manual label details both clear the relevant review requirements without logging intake. Existing package-serving guidance remains available. The browser regression completes both candidate selection and manual correction from the same queue, including a round trip between forms.

**R2-09: manual stock is not a purchase.** Pantry lots carry optional `purchaseDate` and `capturedDate` provenance in addition to the compatibility `date` value. Suggestions use a purchase date only when supplied; otherwise they say stock was recorded. `purchaseReceipts` recognizes existing `manual-ingredient:` records, so no migration or schema change to saved grocery receipts is required. Manual stock remains available for pantry, recipes and meal plans, but is excluded from spending totals, missing-receipt counts, spending review lists and historical purchase-price evidence. Grocery detail view no longer offers receipt price/date review for manual stock and labels its initial stock total accordingly. The shared agent applied this same filtering to the Chat context's recorded-receipt count; native uses the shared helper for its spending list.

**R2-15: optional reviewed cooking methods.** Saved plans accept an optional/null `cookingMethod`; old plans remain readable. Generation requests explicitly structured methods. Steps contain an allowed cooking action, zero-based references to the meal's listed ingredients, optional minutes and optional Celsius temperature. Rendering uses these structured fields rather than generated free-form prose, so the previous removal of provider stock assurances remains intact. The method display converts supplied oven temperatures to Fahrenheit as well.

Every generated method starts unreviewed. Each meal exposes its method, and the user's review persists with the plan. Ingredient/portion edits invalidate review. Reviewing a method in an approved plan creates a separate draft revision, retaining the original approved week. Linking a purchased ingredient also clears method review. Method generation/review checks require valid distinct ingredient references, coverage of every listed ingredient, time for heated actions and an oven temperature for baking. Ordinary legacy plan reads do not acquire the new completeness requirements.

A method is optional: if a generated method fails these completeness checks, only that method becomes null. The valid ingredient schedule remains reviewable with **No cooking method saved for this meal**. Core ingredient identities, dates, categories, amounts, exclusions and pantry-only coverage still receive full validation. Opening, reviewing or discarding a method never changes stock or logs food. A reviewed flag records a user's review, not a food-safety certification. Steps are deliberately a bounded cooking vocabulary rather than an unrestricted recipe essay.

**R2-18: ingredient-based variety.** The option now says **Prefer varied ingredients** and explains that different names or garnish rotations alone do not create variety. The provider prompt requests different primary-ingredient combinations for shopping-supported plans and permits honest repeats when a pantry is small. A shared ingredient-pattern check groups identical or substantially overlapping ingredient sets, excluding common seasoning-only differences. Both clients show actual pattern counts and useful feedback for repeated bases. This is explicitly a guide to repetition, not a nutritional-balance claim. A valid repeated week is retained rather than rejected merely for lacking three titles; true pantry shortages still block pantry-only generation.

**Related target context fix.** `PlanningContext.goalsConfigured` is optional for compatibility. The server omits numeric goals from provider input unless this flag is explicitly true, and the prompt does not treat generic defaults as personal goals. Web and native callers project `profile.targetsConfigured` into that flag. Root/shared own their caller edits.

**Provider reference reliability.** Two live attempts exposed invented or malformed pantry lot references. The server now supplies short request-local `pantry_item_N` identifiers, with a structured response enum limited to those exact identifiers or null for additional ingredients. The provider projection omits raw receipt/item/product IDs while retaining stock, nutrition, ingredient, package-date and line-price context. Exact aliases map back before the existing core validator runs. Unknown references still fail; there is no name matching or fuzzy correction. The mapping clones provider output and never mutates source pantry records. This boundary is server-only.

## Shared integration

- `contracts.ts`: `CookingStep`, `cookingStepSchema`, `cookingMethodSchema`; optional/null `PlannedMeal.cookingMethod`.
- `meal-plans.ts`: `cookingStepText(step, meal)`, `cookingMethodIssue(meal)`, `reviewCookingMethod(plan, mealId, reviewed)`, `invalidateCookingReview(before, after)`, `planVarietySummary(plan)`, `planningGenerationContext(context)`.
- `reviewCookingMethod` returns `{plan, mealIds}` using the existing approved-plan revision mechanism.
- `pantry/receipt-origin.ts`: `isPurchaseReceipt` and `purchaseReceipts`; the latter is also exported through shopping helpers.
- Native owns its method editor/review controls, target-context projection and final export. This lane did not edit mobile files.

## Verification

Canonical commands:

```text
npx vitest run src/features/planning src/features/pantry src/features/shopping --reporter=json --outputFile=docs/audits/2026-09-30-round-2-remediation/kitchen/green-related-units-canonical.json
npx playwright test tests/kitchen-round-two.spec.ts tests/kitchen-remediation.spec.ts --workers=1 --reporter=json --output=docs/audits/2026-09-30-round-2-remediation/kitchen/green-browser-canonical-output
npx playwright test tests/kitchen-round-two.spec.ts --grep "structured cooking" --workers=1 --reporter=json --output=docs/audits/2026-09-30-round-2-remediation/kitchen/green-salvage-browser-output
```

- **73 related unit tests passed** on final source. They cover legacy compatibility, manual stock provenance, unknown real purchase dates, chosen-goal projection, structured-method validation, review immutability/invalidation, useful optional-method recovery, core date/stock rejection and ingredient-pattern variety.
- **12 targeted browser checks passed** across desktop and mobile before the final optional-method recovery adjustment. They include the earlier kitchen remediation regressions.
- **2 affected browser checks passed** again after that adjustment. The seven-meal fixture retains six complete methods, visibly omits the incomplete seventh, persists review through reload, invalidates review after an amount change, leaves intake/inventory untouched and reports no console errors/page errors.
- **16 alias/planning tests passed** after the final server boundary, including six new server regressions. All six server regressions failed against the original unaliased boundary: [red-references.json](red-references.json). The exact round trip, unknown-alias rejection, null-only empty pantry, retained package dates/prices and unchanged stock pass in [green-references.json](green-references.json). `npx tsc -b --pretty false` also passed after this change; root performs aggregate verification.
- The initial six unit regressions failed before implementation: [red-unit.json](red-unit.json). The queue regression failed because the manual editor bypassed candidates: [red-browser.json](red-browser.json). Optional-method recovery was also tested red before its fix: [red-optional-method.json](red-optional-method.json).
- An expanded test run had two spending-assertion failures caused by a test file containing a Windows-encoded middle dot. The actual UI already showed the correct zero reviewed/zero unchecked counts. The fixture was corrected to a Unicode escape and the canonical 12-check run passed. Earlier noncanonical result files are retained for provenance.

## Controlled live provider results and limits

Synthetic real-provider dinner-planning attempts used isolated browser contexts, one dinner category, a seven-day week, and no approval or cooking/intake actions:

1. [First response](live-planner.json): HTTP 422 for an unknown pantry lot reference. The existing core validator rejected it and saved no plan.
2. [Second response](live-planner-second.json): HTTP 422 because a structured method omitted a listed ingredient. This exposed the optional-method blocking problem; the recovery described above was then implemented and tested red/green.
3. [Post-method-recovery response](live-planner-final.json): HTTP 422 for another invalid pantry reference. [Record comparison](live-final-summary.json) confirms no plan saved and unchanged intake, pantry events and groceries. Repetition established the reference-boundary problem, leading to the exact server alias fix.

4. [Post-alias response](live-planner-alias.json): **HTTP 200**. Seven dinners produced **seven ingredient patterns**, with **six complete methods retained** and **one incomplete optional method omitted**. All methods remain unreviewed. [Record comparison](live-alias-summary.json) confirms one new **draft** and unchanged intake, pantry events and groceries. There were **no console errors or page errors**. The real generated method is visible in the [viewport screenshot](live-alias-method-viewport.png); a [full-page screenshot](live-planner-alias.png) and [ARIA snapshot](live-planner-alias.txt) are also retained.

This establishes one successful real-provider run through the corrected boundary, not a guarantee of provider quality for every recipe or pantry. Earlier error screenshots and console records are preserved; their HTTP-error console entries correspond to rejected 422 responses, not render failures. Root's final aggregate evidence is authoritative for the complete app.

Root also updated first-week copy to refer to cooking methods/package guidance and excluded manual stock from the receipt-completion step, after coordination with native. This lane did not edit that shared first-week area.
