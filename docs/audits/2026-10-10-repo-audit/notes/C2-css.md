# C2-css — Q3: one CSS namespace, cascade-order overrides, duplicated tokens

Finding: Q3 (README section 3). Playbook: CYC refactor (behavior-preserving). Managed `cyc run start` is blocked by CYC-ASSETS-001; checks run directly.

## Plan (written before editing)

Goal: remove `src/readability.css` as a cascade-order override, hoist tokens to one `:root`, resolve the `.edit-form` / `.user` collisions, replace token-equal hex literals — with an identical rendered result.
Done when: computed-style diff before/after is empty for Chat, Nutrition, Workouts, Kitchen, You at 320/390/1440; `tsc`, `build`, and the four focused Playwright specs pass; before/after screenshots of Chat and Nutrition match.

Approach: repair in place. Evidence from scout:
- Import order (`src/main.tsx:5-6`): `./styles.css` then `./readability.css`. Feature CSS imported by components is injected earlier (module graph order), so the effective cascade is feature CSS → styles.css → readability.css. Appending readability's live rules at the tail of styles.css is the exact cascade position; folding an override into its original rule is only safe when that exact selector list has no later declaration of the same property in styles.css.
- Dead readability selectors (no TSX consumer for the class): 58 of 85 class names, e.g. `card-footnote`, `metric-*`, `review-glance*`, `daily-insight*`, `capture-strip*`, `bottom-nav`, `demo-capture*`, `page-note*`, `sidebar-note`, `profile-button`, `desktop-crumb`, `message-bubble`, `message-time`, `chat-heading`, `chat-banner`, `chat-thread`, `exercise-plan`, `set-row`, `review-content`, `processed-list`, `history-list`.
- Tokens: `--green/--deep/--mint/--text/--muted/--line/--serif/--shadow` only in `styles.css:3-17` `:root`. `--mint` and `--muted` have no `var()` consumer anywhere. `chat.css:7-9` re-declares `--green/--text/--serif` scoped to `.app-shell.chat-home` (not my file; it only changes the 15 `var()` uses in styles.css when rendered inside the Chat shell — a theme scope). `--refined-ink/muted/line` are scoped to `.fuel-chat.refined-surface` (`refined-tabs.css:30-33`) with all 19 consumers in that file. `--avatar-size` lives only in chat.css; `--spot-size` is an inline per-instance value from `Spot.tsx:74,158` overridden per context with `!important` in spot.css.
- `.edit-form`: base rules in styles.css; `readability.css:312` overrides label color/size; `pantry.css:227-228` scopes `.pantry-manual-confirm` under `.edit-form` (consumer `ManualIngredient.tsx:6,13`).
- `.user`: `styles.css:789-830,2086` legacy `.message.user` / `.user .message-body` have no TSX consumer (`message-body`, `message-bubble`, `chat-avatar`, `message-time`: 0 hits); `chat.css` `.fuel-message.user` / `.user .fuel-bubble` is the live one (not my file).

Change:
- `scripts/css-baseline.ts` (new) → Playwright computed-style snapshot + diff + screenshots.
- `src/styles.css` → single `:root` token block; readability live rules merged (folded where provably safe, appended otherwise); dead legacy `.message*` block removed; token-equal hex literals → `var()`.
- `src/readability.css` → deleted; `src/main.tsx:6` import removed.
- `src/features/pantry/pantry.css:227-228` → `.pantry-manual-form .pantry-manual-confirm`; `src/features/pantry/ManualIngredient.tsx:6` adds `pantry-manual-form`.
- Other owned CSS files → only literal→token substitutions where the literal equals a token value.

Keep consistent: every TSX `className="edit-form"` consumer (13 files) keeps the base styles; chat.css scoped tokens untouched (recorded for orchestrator); `tests/*.spec.ts` selectors unchanged.

Test: computed-style diff (red if any property changes), `npx tsc --noEmit`, `npm run build`, 4 focused specs, screenshot comparison.

Baseline JSON location (scratch, not in repo): `C:\Users\danny\AppData\Local\Temp\claude\C--Users-danny-Documents-coding-fitness\7055d929-92ef-4f1f-a485-d15cb188402b\scratchpad\C2-css\` (`before.json`, `before-rerun.json`, `after.json`, `after2.json`, `diff-*.json`, plus the saved pre-merge copies `styles.before.css`, `readability.before.css` and the scratch tools `css-tools.mjs`, `merge.mjs`, `root-edit.mjs`, `pngdiff.mjs`).

## Result

Rendered output unchanged (computed-style diff empty on 15 page/width surfaces; screenshots identical apart from icon antialiasing), with `src/readability.css` gone, one `:root` token block, the `.edit-form` / `.user` collisions resolved and the token-equal literals replaced.

### Reproduction (red first)

The regression check is `scripts/css-baseline.ts` (new; a tool, not a spec). `snapshot` loads the app as a returning guest (same seed as `tests/app-fixture.ts`, `/api/status` mocked unavailable, reduced motion, `#chat|#nutrition|#workouts|#kitchen|#you` at 320/390/1440 px, and waits until two consecutive snapshots agree so IndexedDB hydration has settled) and records 21 computed properties (color, background-color, font-family/size/weight, line-height, margin x4, padding x4, border-radius x4, display, row/column-gap) for every `[class]` element keyed by a DOM path. `diff` exits 1 on any element or property change.

- Baseline stability: two pre-change captures → `NO DIFFERENCES`. (An earlier capture without the settle loop showed `margin: auto` resolving to 0 vs 400 px mid-hydration; fixed in the tool, not the app.)
- The check went red for a real defect: my first merge folded `@media (max-width: 760px) .text-button {font-size: 10px}` into styles.css while its earlier top-level `.text-button {font-size: 11px}` had to be appended (a styles.css media rule conflicts), so the override moved ahead of the rule it used to follow. Diff: `Nutrition@320/390 ... button.text-button font-size "10px" -> "11px", line-height "15px" -> "16.5px"`. The merge rule was corrected (see mechanism) and the diff returned to empty.

### Change and mechanism

- `src/main.tsx:6` removed `import "./readability.css"`; `src/readability.css` deleted (working-tree deletion, unstaged). Cascade before: feature CSS (component imports) → styles.css → readability.css. Every one of the 170 readability rules was classified by the scratch `merge.mjs` (reproducible from the saved copies):
  - **125 dead**: every selector names a class with no class-like `.ts/.tsx` occurrence (the regex excludes module paths such as `./chat-thread` and longer names such as `fuel-workout-hero`). These are the legacy Today/demo/review/exercise-plan/`.message*`/`.chat-banner` selectors B1 listed; dropped.
  - **15 folded** into the identical selector list at the same media level in styles.css, only when that declaration is not `!important`, no later styles.css rule declares the same property for one of those selectors, and no earlier readability rule being appended shares a selector and property (computed to a fixpoint; this demoted `.text-button`, `.section-heading h2`, `.meal-nutrition > span`, `.insight-card strong`, `.insight-card p` to the append set). Examples: `.eyebrow` color, `.chat-main` height/padding-bottom, `.modal-intro, .capture-modal > p`, `.privacy-note*`, `.upload-zone span`, 760 px `.section-note`, 760 px `.chat-main`.
  - **30 appended** at the tail of styles.css (`/* Merged from the former readability.css ... */`, `src/styles.css:2440-2560`) in original order, grouped by media — the exact position they occupied in the cascade.
- `:root` (`src/styles.css:3-22`) now holds every global token once: `--green --deep --mint --text --muted --line --serif --shadow` plus `--refined-ink/--refined-muted/--refined-line`, which were scoped to `.fuel-chat.refined-surface` (`refined-tabs.css:30-33`, removed there). Safe because all 19 consumers are rules under the Nutrition/Kitchen/You roots that carry `refined-surface` (`NutritionPage.tsx:119`, `KitchenPage.tsx:110`, `YouPage.tsx:312`). `:root { color: #243b32 }` became `var(--text)`.
- Tokens intentionally left with more than one value, winning value verified by the baseline: `--green/--text/--serif` are re-declared on `.app-shell.chat-home` in `src/chat.css:7-9` (not my file) — a theme scope that re-colours the 15 `var()` uses in styles.css only inside the Chat shell; `--avatar-size` lives only in chat.css (40 px, 34 px under 600 px); `--spot-size` is set inline per instance by `Spot.tsx:74,158` and overridden per context with `!important` in `spot.css:180,549,574,586` — a component size, not a palette token. Nothing renamed; a rename would either change the Chat rendering or require editing chat.css.
- `.edit-form` collision: `pantry.css:227-228` `.edit-form .pantry-manual-confirm` → `.pantry-manual-form .pantry-manual-confirm` (same specificity); the `ManualIngredient.tsx:6` form now has `edit-form pantry-manual-form`. The 13 other `className="edit-form"` consumers are untouched (14 occurrences total).
- `.user` collision: the styles.css `.message`, `.message.user`, `.chat-avatar`, `.message-body`, `.user .message-body`, `.message-bubble(p)`, `.message.user .message-bubble`, `.message-time(svg)`, `.message-image` rules and their 760 px counterparts were deleted (former `styles.css:783-849, 2080-2110`). No TSX renders those classes; the live `user` class is composed as `fuel-message ${message.role}` (`ChatLayer.tsx:452`) and `workout-message ${m.role}` (`WorkoutPage.tsx:921,942`), styled by chat.css / workouts.css.
- Literals equal to a token value: `kitchen.css:25,208,216,309` `#647d79` → `var(--refined-muted)`, `kitchen.css:153,311` `#e2eee8` → `var(--refined-line)`, `styles.css:5` → `var(--text)`. No other literal outside chat.css equals a token. Remaining hex literals: 1338 across all CSS (was 1402), 227 in styles.css, 129 in chat.css. `workouts.css:2 color: #102333` equals chat.css's scoped `--text`, not a global token, and was left.

### Consumers checked
- `tests/*.spec.ts` selectors (`.refined-surface`, `.nutrition-ring-label`, `.nutrition-scroll`, `.you-scroll`) unchanged; specs pass.
- `src/features/pantry/PantryDialog.tsx:58,260,502` keep plain `edit-form` (no `.pantry-manual-confirm` inside them).
- chat.css / ChatLayer.tsx not edited. A concurrent ChatLayer.tsx edit landed during this run (a `./chat-thread` module import); the merge was re-run against the current tree and the stricter class check keeps those two rules dead.

### Commands and results
- `npx tsx scripts/css-baseline.ts snapshot <scratch>/before.json --shots docs/audits/2026-10-10-repo-audit/notes/C2-css/before`; `... snapshot before-rerun.json`; `... diff before.json before-rerun.json` → `NO DIFFERENCES`.
- `... snapshot after.json --shots .../notes/C2-css/after`; `... diff before.json after.json --out diff-after.json` → `NO DIFFERENCES` (15 surfaces; 81/97/76/68/130 classed elements for Chat/Nutrition/Workouts/Kitchen/You).
- Screenshots: `cmp` identical for chat-390, chat-1440, nutrition-320. Pixel diff (canvas, scratch `pngdiff.mjs`): chat-320 33 px (max channel delta 18/255) in the composer icon row, nutrition-390 30 px (23) and nutrition-1440 15 px (36) on the tab-bar Spot/barcode icons; 4x crops in `notes/C2-css/diff-crops/` show identical content. chat-320 reproduces the same 33 px between two captures of the unchanged CSS (after vs after2), which is the antialiasing noise floor.
- `npx tsc --noEmit` → exit 0. Script type-check (scratch tsconfig: strict, bundler resolution, `allowImportingTsExtensions`) → exit 0.
- `npm run build` → built (the chunk-size warning is pre-existing).
- `npx playwright test tests/refined-tabs.spec.ts tests/you-connected.spec.ts tests/kitchen.spec.ts tests/nutrition-round-two.spec.ts --workers 2` → 14 passed (desktop + mobile).
- `npx vitest run src server` → 80 files, 536 tests passed.

### Not checked
- Dialog/modal states (edit forms, reviews, workout session, the pantry manual-ingredient form) are not in the computed-style sample; the 15 folds there rest on the static conditions above (exact selector, no later same-property declaration, no `!important`, no re-ordered sibling), and the 30 order-sensitive rules were appended rather than folded for that reason. Equal-specificity rules with *different* selector text that happen to match the same element are the one case the static check cannot see; the sampled surfaces showed none.
- Native (`mobile/`) has no CSS; untouched. Full browser suite left to the orchestrator.

### For the orchestrator
- `src/chat.css:7-9` still re-declares `--green/--text/--serif` on `.app-shell.chat-home`. If one value per token is wanted, the behavior-preserving change is to rename these to `--chat-green/--chat-text/--chat-serif` **and** give the styles.css `var()` uses that render inside `.chat-home` a matching scoped alias; the simpler option is to accept the scope as the Chat theme. Nothing in my files depends on either choice.
- Still-dead legacy chat rules in styles.css left for a follow-up (same evidence as the deleted cluster): `.chat-layout`, `.chat-heading*`, `.chat-banner*`, `.chat-thread`, `.chat-date*`, `.chat-meal-card*`, `.chat-meal-top*` (the `styles.css:728-800` region and its 760 px block). Not deleted because they lie outside the `.user` collision this slice was asked to resolve.
- `src/main.tsx` also carries another agent's uncommitted `BrowserRecordsNotice` lines; mine is only the removed import.
- `.gitignore` already excludes `docs/audits/`; the before/after PNGs and crops under `notes/C2-css/` are on disk only.

### Ledger-ready paragraph
CSS-NAMESPACE-001 — `src/readability.css` worked only as a cascade-order override of `styles.css` (imported second in `src/main.tsx`), and `:root` tokens were duplicated with different values in `chat.css`/`refined-tabs.css`. Fix: a computed-style baseline tool (`scripts/css-baseline.ts`: five pages x three widths, 21 properties per classed element, settle loop for IndexedDB hydration) captured before any edit; readability rules were then dropped when dead (125), folded into the identical selector only when no later same-property declaration or earlier appended sibling could re-order them (15), or appended at the tail of styles.css where their cascade position is unchanged (30). The first merge folded a mobile `.text-button` override ahead of its appended base rule and the baseline diff caught the 10→11 px change; the fixpoint rule fixed it. `--refined-*` hoisted to `:root` (all consumers under `refined-surface` roots); `--green/--text/--serif` in chat.css are a Chat-shell theme scope and were left; `--spot-size`/`--avatar-size` are component sizes, not tokens. Dead legacy `.message*`/`.user` rules removed; pantry's `.edit-form` descendant rule prefixed `.pantry-manual-form`. Verification: diff empty, tsc/build clean, 14 focused browser checks and 536 unit tests pass; screenshots differ only by at most 33 antialiased icon pixels, reproduced between two captures of identical CSS. Lesson: when splitting an override file between in-place folds and a tail block, order constraints exist between the moved rules themselves, not only against the destination file.
