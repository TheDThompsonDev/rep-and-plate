# Verify recipe

Use isolated Playwright browser contexts. Never clear or seed the user's actual browser storage.

1. Run `node node_modules/vitest/vitest.mjs run src server`, `npm run build`, and `node node_modules/@playwright/test/cli.js test`. CYC runs these same commands.
2. `tests/nutrition-day.spec.ts`: seed a real meal today, a real meal yesterday, and a legacy sample. Check personal totals and exclusion of the sample; select Week to inspect history; open daily target editing; advance through local midnight and simulate wake after a date change; verify the old meal is still accessible with its original date. The mobile case saves `nutrition-personal.png` in its test output directory.
3. `tests/barcode-entry.spec.ts`: open Scan from Chat, Nutrition, Workouts, Kitchen, and You; You is reached through the top-right profile button. Close Scan and compare saved state. At 320px open it from the composer and verify the draft, camera, attachment, voice, and send controls remain usable.
4. `tests/scanner-flows.spec.ts`: enter/resolve a barcode using deterministic product fixtures, review a portion, add once, and check unavailable/unknown paths. Physical camera decoding still needs a real-device check.
5. `tests/nutrition-connected.spec.ts`: accepted Chat meal appears, edits change totals, reload preserves it, and planning tools open without extra AI calls.
6. Inspect the mobile dashboard image and the seven-day row at 320px and 390px. Verify readable numbers, no horizontal overflow, no controls hidden under navigation, and **Not logged** rather than zero intake for missing days.
7. `tests/refined-tabs.spec.ts`: verify previous-day/today totals, Day/Week switching, actual You activity, and the last settings/Chat actions at 320px. Check that `.refined-surface` owns scrolling while `.nutrition-scroll` and `.you-scroll` overflow remains visible. Inspect the recorded Nutrition/You images. Do not seed prototype weight values into personal records.
8. `tests/kitchen.spec.ts`: verify Kitchen routing and refresh, profile access to You, preserved Workouts, pantry/recipe/planning dialogs, real stock versus unknown quantities, per-portion estimates, saved package dates and shopping shortfalls. Grocery browsing must leave daily nutrition unchanged. Inspect populated and empty mobile Kitchen and final-action reachability.

Provider calls are mocked in these UI checks. Live USDA/OpenAI connectivity and physical camera scanning are not demonstrated by a passing browser fixture.

10. `tests/receipt-capture.spec.ts`: open Kitchen receipt capture without navigating, choose camera/library, cancel or replace a photo, preview before submitting, preserve Chat drafts and intake, and save for review when AI is unavailable. Inspect `receipt-preview.png` from the mobile run. Phone camera launch is hinted by `capture="environment"`; verify actual capture separately on a physical phone.

9. `tests/shopping.spec.ts`: save household/budget preferences; review receipt prices without changing intake; normalize swap quantities; require review of online price leads; add/dismiss swaps; manage a persistent list; generate a household meal plan and transfer only known shortfalls. Inspect `smart-swaps-320.png` and `shopping-list.png` from isolated browser runs. `tests/receipt-products.spec.ts` also verifies barcode matching against an existing receipt does not duplicate a purchase.
