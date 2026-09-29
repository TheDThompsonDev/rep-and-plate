# Kitchen and navigation

September 26, 2026. User explicitly chose to keep Workouts and replace the bottom You destination with Kitchen. The top-right profile icon opens You from each main surface; on You it marks the current page. Profile editing remains available through the page's existing edit controls. Chat remains the default homepage. Scan remains the central action and opens the existing scanner.

Bottom bar: **Chat · Nutrition · Scan · Workouts · Kitchen**. Routes `#kitchen`, `#you` and legacy `#review` work on refresh and hash navigation. You has no selected bottom destination; its profile icon carries `aria-current=page`.

`src/KitchenPage.tsx` uses actual state and existing domain helpers:

- Pantry balances exclude used/empty stock; unknown or inconsistent amounts are separate from known item counts. Nutrition is per saved labeled serving and is withheld when it needs review.
- Prepared recipes show remaining portions and estimated nutrition per portion. Upcoming meals come from the latest saved plan, with draft status visible. Partial ingredient nutrition is not shown as a complete estimate.
- Shopping needs use the latest plan's remaining scheduled meals and current pantry balances. Past meals and meals already logged through the plan are excluded. Unknown pantry amounts remain quantity checks rather than assumed shortages. This is derived from the plan, not a new standalone editable shopping-list store.
- Package-date reminders use saved label dates only, and never assert food is fresh or expired. Recent receipts open their exact existing review.
- Pantry, recipes, planning and scanning use existing dialogs. Receipt capture opens Chat; asking for meal ideas sends a user-requested prompt through the existing Chat path. Merely visiting Kitchen makes no AI request and changes no records.
- Photography is decorative meal inspiration, not a claim that a shown meal is in a person's pantry. No example data is installed into the app.

Verification: CYC `09b31dd1-ec2d-400b-8ed7-271ed420df33`; `tests/kitchen.spec.ts` covers routing/refresh, profile and workout access, connected tools, actual quantities, portions, date reminders, shopping shortfalls, 320px fit and final controls. `tests/barcode-entry.spec.ts` covers scanner access on all five pages; prior You journeys now enter through the header. Assertions compare parsed saved state because schema parsing can reorder JSON fields after reload without changing data.

Physical-camera testing and live model accuracy remain separate from mocked-provider browser checks.

## September 29 readiness fixes (implemented, awaiting user acceptance)

- Web and native Kitchen now share a six-step first-use guide: preferences, receipt capture, pantry review, approved week, missing groceries, and logging an eaten portion. It derives progress from saved records, opens the existing tools, and initially shows only the next step. It never makes an AI request just by opening Kitchen.
- Missing or exhausted planned ingredients can be explicitly connected to a reviewed purchased pantry lot in either planner. `planning/pantry-links.ts` accepts a checked whole-recipe quantity in that lot's labeled servings. Only identical labels or unambiguous physical mass/volume conversions are suggested. Density and raw/cooked conversions are never guessed. The user confirms product, preparation state and amount; saved plan identity is retained, the staged update becomes a draft, and logged meal bindings cannot be changed. Reapproval updates future shopping/nutrition calculations without altering inventory or consumption history.
- Planner shopping checks exclude meals already logged under the same plan ID. Consumption continues through the existing idempotent pantry ledger; linking or approving cannot deduct stock.
- `planning/basket.ts` estimates only additional required quantities using the exact linked purchase's reviewed line total and purchased servings, with receipt dates no more than 30 days old. Missing quantities/prices remain unknown; currencies are separate. These are historical quantity estimates, not package-rounded checkout quotes or guaranteed savings. Budget comparisons are withheld for incomplete or mixed-currency evidence.
- Regression coverage: `pantry-links.test.ts` covers the audited rice purchase, explicit review, exhausted-lot replacement, logged-history protection, unsafe conversions, dietary exclusions, stock allocation, stale/missing prices and mixed currencies. `tests/plan-purchase-connection.spec.ts` and native `e2e/plan-purchase.spec.ts` exercise review → approval → logging using fixture groceries. These do not establish real receipt extraction accuracy or physical-device camera reliability.
