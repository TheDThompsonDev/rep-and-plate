# Round-two audit remediation

Three coordinated agents implemented nutrition, kitchen and native changes; the lead implemented shared/web workout changes and reviewed integration. The original round-two audit is unchanged. This report maps the complete set of 12 friction items, six opportunities and one performance investigation to the resulting behavior.

## Acceptance map

| ID | Remedy | Evidence |
|---|---|---|
| R2-01 | New manual nutrients start blank and require deliberate values; valid zero and decimals remain supported. Unknown values no longer silently become confirmed zero. | Shared report; nutrition-round-two tests |
| R2-02 | Goal-free tracking displays recorded totals without target judgments. Explicitly chosen goals remain available and reversible. Planner omits unchosen numeric goals from provider input; connected assistants receive documented configuration metadata. | Shared/native reports; context, insights and planning unit checks |
| R2-03 | Native notices sit clear of the Chat composer, including persistent storage failures. | Native pointer hit-test and regression |
| R2-04 | Native diary can browse older dates; saving or correcting a dated meal opens its date. | Native old-date and corrected-date regressions |
| R2-05 | Native history loads older sessions for correction. Web full history and recent counts no longer inherit AI truncation. Valid imported date formats reopen correctly. | Native history check; workout evidence |
| R2-06 | Guest backup copy accurately describes local saving and sign-in requirements. | Native guest check and screenshot |
| R2-07 | Pantry Review opens product-match candidates, USDA search and manual label correction in the existing review flow. | Kitchen desktop/mobile regression |
| R2-08 | Workout Chat and corrections honor selected kg/lb units with rounded displays. | Shared workout tests and both clients |
| R2-09 | Manual stock has distinct provenance; its capture date is not called a purchase date. Manual entries are excluded from spending, purchase counts and receipt-price evidence while remaining available stock. | Kitchen unit/UI tests; first-week progress guard |
| R2-10 | Persisted rest end time survives navigation/reload and elapsed time; session transitions clear it. | Workout unit/UI and native parity |
| R2-11 | Clarification footer stays neutral instead of reopening an already established meal-versus-groceries question. | AI normalization regression |
| R2-12 | Invalid native backups show actionable format guidance and retain current records. | Native invalid-import check |
| R2-13 | Save/reuse/remove personal workout routines. Reuse starts empty sets and unconfirmed loads without rewriting history. | Workout schema/operation/UI tests; native parity |
| R2-14 | A visible remaining-set load action avoids repeated entry and protects performed sets. Confirmation refreshes unchanged zero/reference fields correctly. | Red/green bodyweight UI; shared operations |
| R2-15 | Optional cooking methods use bounded steps tied to listed ingredients. They require explicit review, lose review status after ingredient/portion changes, and never imply stock use or intake. Incomplete generated methods are omitted without discarding a valid schedule. | Kitchen structured-method tests; native review parity |
| R2-16 | Repeated meals support reviewed fractional multipliers; nutrients and component servings scale together without changing pantry/prepared stock. | Shared scaler tests and both clients |
| R2-17 | Native privacy help and navigation use the same account-data tool name. | Native help check |
| R2-18 | Variety guidance considers ingredient patterns, reports actual repetition and preserves useful drafts from small pantries. | Kitchen pattern tests and UI |
| R2-19 | Guest onboarding reuses already-loaded artwork; production-export transfer and JS sizes are measured with a reproducible regression budget. | Native production preview, budget and report |

## Verification and follow-through

| Check | Final result |
|---|---|
| Shared/server unit checks and CLI integration | 408 passed |
| Desktop and mobile-web browser journeys | 284 passed, no skips or flakes |
| Native production-preview journeys | 32 passed, no skips or flakes |
| Web build, agent typecheck, native typecheck and all-platform export | Passed |
| Native lint | Zero errors; nine existing warnings |
| Guest preview transfer | 15,313,988 → 10,664,401 bytes; 30.36% reduction |
| Preview budgets | Below 11,000,000 transfer bytes and 4,300,000 combined web-JS bytes |

The final browser suite covers the unchanged web UI; the subsequent isolated server reference fix was checked with six focused regressions, a fresh complete unit/CLI run, build and a successful live provider journey. The final native export's reachable sources did not change during that server-only correction.

Aggregate command results are recorded in `verification.json`; detailed lane evidence is in [shared/report.md](shared/report.md), [kitchen/kitchen.md](kitchen/kitchen.md), [native/native.md](native/native.md) and [workouts.md](workouts.md). Failed checks are retained alongside their corrective evidence rather than erased. Independent workout review produced two fixes, and full-suite failures were investigated before changing any assertion.

The support destination remains the user-provided `dthompsondev@gmail.com`.

Live verification also reproduced a pantry-reference failure twice: the provider returned identifiers that did not exist in the request. The server now sends short request-local aliases, constrains generated references to that alias set or explicit missing-ingredient `null`, and restores original IDs by exact lookup before the existing validation. It does not match foods by name or repair unknown references. Source stock, restrictions, dates and quantity checks remain authoritative. This server-only follow-through does not change the verified native export.

After that correction, the controlled live request returned HTTP 200 with seven dinners and seven measured ingredient patterns. Six complete methods remained unreviewed; one incomplete optional method was omitted. One draft autosaved, with groceries, pantry events and intake unchanged. No console/page errors were observed. The lead visually inspected the retained-method screenshot: the instructions, incomplete-nutrition explanation and review checkbox were readable. See [live evidence](kitchen/live-alias-summary.json).

## Material limits

- These are synthetic persona workflows, automated checks and source review, not five real participants or evidence of satisfaction/retention.
- Three controlled planner attempts before the reference fix returned safe 422 responses: two invalid pantry references and one incomplete optional method. A fourth request after the fixes succeeded as described above. One successful synthetic week does not establish general recipe quality or provider reliability. Invalid core references still require a retry and cannot change stock or intake.
- Earlier manual zero values cannot be retrospectively distinguished from deliberate zeros and are preserved.
- Ingredient-pattern variety is a heuristic, not nutritional-balance certification. Cooking-method review is not a food-safety guarantee.
- Performance figures apply to the local uncompressed production Expo-web preview. Remaining artwork and JS are substantial; physical-device/network performance and hosted caching are not established by these figures.
- Physical iOS/Android interaction, camera/microphone permissions, real email delivery, and hosted deployment checks remain release validation. No deployment or commit is included.
- CYC controller startup hit its existing source-fingerprint asset limit. No configuration was relaxed; direct project checks and the exact-response/artifact gate were used. This is not a controller-managed completion claim.
