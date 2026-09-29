# Personal nutrition

## 2026-09-26 — Approved Nutrition / You refinement

User approved the original mint/white/emerald direction and requested implementation after rejecting the plain journal proposal. Production surfaces now use `src/refined-tabs.css`, scoped by `.refined-surface`; Chat and Workouts retain their existing layouts.

- Nutrition provides day browsing with previous/next/today controls and a Day/Week switch. A null selected day means the live local day, so midnight/wake refresh continues to work. Selecting a historical day changes the view only, never meal dates. Weekly history always covers the latest seven days and still offers dated editing.
- The hierarchy is summary, compact scan action, food record, photographic planning entry, one evidence-based insight, and food tools. The planning photo is decorative; it is not represented as an actual pantry recommendation. Meals use their own saved images or a neutral utensil placeholder. All insights remain available through the menu, including the no-record explanation.
- You shows the saved name, actual logging days and recorded workouts/sets from `weeklyReview`, connected reviews, saved targets, a workout entry, and existing food/account settings. The prototype's invented weight graph was intentionally not copied: no weight-check-in model exists yet. There are no invented planned workout counts or claimed missed goals.
- Each surface owns one vertical scroll container; its body sections no longer create nested scroll areas. The shared header sticks at the top and bottom navigation stays fixed within the app width. Bottom padding keeps final actions reachable; dialogs preserve the background position. Reduced-motion preferences disable transitions.
- Retain the existing callbacks for scanning, goals, meal editing, receipt review, Chat proposal review, planning, recipes and account operations. No storage schema, data migration or provider request behavior changed.

Verification reference: CYC `344e5737-d910-494f-858f-2cd72e6c8ec7`; `tests/refined-tabs.spec.ts`, updated `tests/nutrition-day.spec.ts` and `tests/flows.spec.ts`, plus the existing connected journeys. Isolated visual checks covered empty and populated records at 320/390/1100px, scrolling, final controls and modal scroll retention. Browser fixtures do not verify physical-device feel or live provider connectivity.

## 2026-09-26 — Personal days, examples, and direct capture

Working changes based on `4bd8875`; final evidence is recorded in CYC run `03a46f6a-02f7-45e0-adcc-c52bdffffde3`. Covers `domain.ts`, `useLocalDay.ts`, `App.tsx`, `NutritionPage.tsx`, shared navigation, AI context, insights and reviews.

- Examples are excluded through one shared selector, not by deleting stored records. Existing users may have edited meals or historical captures interleaved with demos. Never clear storage, retag historical dates as today, or remove records just to reset the display.
- Sample Chat cards say **Example · not counted**. Exclusion alone is insufficient if a card still claims that an example was added to intake. Sample meals also cannot consume real pantry ingredients.
- Fresh state contains an empty food log and a welcome. Explicit demo fixtures remain available for tests and sample capture. Real meals are identified by provenance, never by title or a built-in-looking ID alone. Older local-parser sample estimates have user text as their source but explicit demo notes.
- Daily accounting uses local calendar dates. The top-level date hook rerenders all consumers at actual next midnight and on focus, visibility, and page restoration. A 24-hour interval is incorrect across daylight-saving transitions.
- The week shows logged calories, not claimed total intake. Empty days say **Not logged**; a partial day is not a successful deficit or a complete food record. Saved targets are editable, but a body-weight example does not establish a personalized calorie prescription.
- Scan is an action between Nutrition and Workouts, not a fifth destination. Opening/canceling it must not change food records, page selection, or a Chat draft. Food/pantry actions still require the existing portion review.
- New empty-state tests must use `initialState()`. Tests intentionally demonstrating samples use `demoState()`. Personal meal fixtures need explicit source/note fields rather than blindly spreading a sample estimate.

Guards: `src/day.test.ts`, `tests/nutrition-day.spec.ts`, `tests/barcode-entry.spec.ts`, existing Nutrition/AI/scanner flows. The recipe below verifies the local UI without using a person's browser storage or paid providers.

Limit: this change does not implement weight measurements, weight trends, goal-weight projections, or automatic target recommendations. It provides the daily record and historical context those features can build on.
