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
