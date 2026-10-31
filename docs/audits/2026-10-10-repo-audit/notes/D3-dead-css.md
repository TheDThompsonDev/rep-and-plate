# D3-dead-css — Q3 follow-up: dead legacy chat rules in styles.css / chat.css

Finding: Q3 (README section 3), the follow-up the C2 agent left in `notes/C2-css.md` ("For the orchestrator": still-dead `.chat-layout`, `.chat-heading*`, `.chat-banner*`, `.chat-thread`, `.chat-date*`, `.chat-meal-*` rules). Playbook: CYC refactor (behavior-preserving). Managed `cyc run start` is blocked by CYC-ASSETS-001; checks run directly.

## Plan (written before editing)

Goal: delete the dead legacy chat rule cluster from `src/styles.css` (and `src/chat.css` if present) with an identical rendered result.
Done when: fresh computed-style baseline diff is `NO DIFFERENCES` on all 15 surfaces; `npx tsc --noEmit`; `npm run build`; rule counts recorded.

Approach: repair in place (pure removal). Deletion criterion as assigned: a rule goes only when every selector in its list names a class with no class-like occurrence in any `.ts/.tsx/.html` under `src/`, `mobile/src/`, `index.html`, `server/preview-page.ts`. A class-like occurrence means the name is not preceded by `.`, `/`, a word character or `-` (so the `./chat-thread` module import in `ChatLayer.tsx:49` and `chat-thread.test.ts:10` does not count) and not followed by a word character or `-` (so `chat-main` does not match `chat-ma`). Prefixes were grepped too (`chat-meal`, `chat-date`, `page-`, `-heading`): every `*-heading` class in consumers is a literal string and none is `page-heading` or `chat-heading`; nothing builds these names dynamically.

Context: `error-ledger.md` DEMO-REMOVAL-001 (B1) pruned 251 dead rules from styles.css by a selector-level script and left `readability.css` to C2; C2 (CSS-NAMESPACE-001) merged readability, removed the `.message*`/`.user` cluster and built `scripts/css-baseline.ts`. Line numbers in C2's note (`728-800`) still matched the top-level block; the media counterparts had moved to 1676, 1975-2047 and 2416-2421.

Change: `src/styles.css` → delete five ranges (pre-edit lines) listed below. `src/chat.css` → nothing (cluster absent). `scripts/css-baseline.ts` → unchanged (ran as-is).
Keep consistent: `.chat-main` (`App.tsx`) sits directly before the dead block at top level and in the 760 px block and must survive; `.page-heading`/`.chat-heading` shared selector lists at 217-237 may only go if both classes are unused (both are: 0 hits).
Test: baseline diff (red if any sampled property changes), tsc, build, rule counts.

Scratch (not in repo): `C:\Users\danny\AppData\Local\Temp\claude\C--Users-danny-Documents-coding-fitness\7055d929-92ef-4f1f-a485-d15cb188402b\scratchpad\D3-dead-css\` — `before.json`, `after.json`, `diff-after.json`, `before.log`, `after.log`, `diff.log`, `before-counts.txt`, `after-counts.txt`, `count-rules.mjs` (postcss rule counter + unused-class survey), `delete-ranges.mjs` (guarded line-range deletion, CRLF preserved).

## Result

48 dead rules (211 lines) removed from `src/styles.css`; rendered output unchanged (computed-style diff empty on 15 page/width surfaces). `src/chat.css` contains none of the cluster and was not edited.

### Reproduction / red check

The regression check is C2's `scripts/css-baseline.ts` (five pages x 320/390/1440, 21 computed properties per classed element, settle loop). A fresh pre-change baseline was captured first (`before.json`: 81/97/76/68/130 classed elements for Chat/Nutrition/Workouts/Kitchen/You, identical element counts to C2's run). The check's ability to go red for a cascade change was established in C2 (it caught the `.text-button` 10→11 px fold). It was not re-reddened here by deleting a live neighbour such as `.chat-main`, because that would have perturbed the shared 5173 server other agents were testing against (VERIFY-SWARM-001).

### Change and mechanism

Deleted from `src/styles.css` (pre-edit line numbers; each range guarded by its first/last line text before splicing):

| Range | Media | Rules | Selectors |
| --- | --- | --- | --- |
| 217-237 | top | 3 | `.page-heading h1, .chat-heading h1`; `... h1 em`; `... p` (`page-heading` also 0 consumer hits) |
| 728-835 | top | 22 | `.chat-layout` … `.chat-meal-number span` (`.chat-banner .icon-tile`, `> span:nth-child(2)`, `strong`, `small`, `> .mini-label`, `.chat-thread`, `.chat-date(span)`, `.chat-meal-card(:hover)`, `.chat-meal-top*`, `.chat-meal-number*`) |
| 1676-1678 | `(max-width: 1200px)` | 1 | `.chat-heading h1` |
| 1975-2047 | `(max-width: 760px)` | 20 | `.chat-layout` … `.chat-meal-number` (incl. `.chat-heading > .icon-button`, `.chat-heading .eyebrow`, `.chat-banner > .mini-label`, `.chat-meal-top .icon-tile(svg)`) |
| 2416-2421 | `(max-width: 380px)` | 2 | `.chat-meal-number`; `.chat-heading h1` |

Mechanism: every deleted selector contains a compound that requires an element carrying one of `chat-layout`, `chat-heading`, `chat-banner`, `chat-thread`, `chat-date`, `chat-meal-card`, `chat-meal-top`, `chat-meal-number` or `page-heading`. No element in any renderer (web TSX, native TSX, `index.html`, server preview page) carries those classes, so none of the rules ever matched; removing them cannot change a cascade. Descendant selectors that also name live classes (`.icon-button`, `.eyebrow`, `.icon-tile`, `.mini-label`) were included because the dead ancestor makes the whole selector unmatchable. Kept on purpose: `.chat-main` (now `styles.css:701` and `:1839`, consumer `App.tsx`), and the dead-by-the-same-heuristic neighbours outside the assigned cluster (`.added-label`, `.mini-label`, `.gentle-note*`, `.composer-area`, `.sample-phrases*`, …) — see "For the orchestrator".

`src/chat.css`: the only `chat-*` classes it styles are `chat-home` and `chat-main`, both live; the `.app-shell.chat-home` token scope at `chat.css:7-9` is untouched. No edit.

Line endings: both files are CRLF throughout; `styles.css` still 2349/2349 CRLF lines after the edit.

### Counts

| File | Rules before → after | Declarations before → after | Lines before → after | Rules whose every selector names an unused class (before → after) |
| --- | --- | --- | --- | --- |
| `src/styles.css` | 510 → 462 (−48) | 1353 → 1241 (−112) | 2560 → 2349 (−211) | 238 → 190 |
| `src/chat.css` | 230 → 230 | 776 → 776 | 1238 → 1238 | 6 → 6 |

(Counted with postcss `walkRules`; at-rules are not counted as rules.)

### Consumers checked
- `src/App.tsx` `chat-main` — rule kept at top level and in the 760 px block; baseline shows Chat unchanged at all widths.
- `src/components.tsx` `icon-tile`, `icon-button`, `eyebrow` (and 18 other `eyebrow` consumers incl. `server/preview-page.ts`) — only their `.chat-heading`/`.chat-banner`/`.chat-meal-top`-scoped descendants were removed; standalone rules untouched.
- `tests/*.spec.ts` — not edited; no spec selects any deleted class (none of the names occur under `tests/` either).
- Native (`mobile/`) has no CSS; `mobile/src` was part of the consumer grep and has no hits.

### Commands and results
- `npx tsx scripts/css-baseline.ts snapshot <scratch>/before.json` → exit 0, 15 surfaces (before any edit).
- `node <scratch>/count-rules.mjs src/styles.css src/chat.css` (before) → 510 / 230 rules.
- `node <scratch>/delete-ranges.mjs` → `removed 211 lines; file now 2349 lines` (all five guards matched).
- `node <scratch>/count-rules.mjs ...` (after) → 462 / 230 rules.
- `npx tsx scripts/css-baseline.ts snapshot <scratch>/after.json` → exit 0; `... diff before.json after.json --out diff-after.json` → every surface `0 removed, 0 added, 0 property changes`, **`NO DIFFERENCES`**, exit 0.
- `npx vite build` → `✓ built in 935ms`, exit 0 (chunk-size warning pre-existing).
- `npx tsc --noEmit` → **exit 1**: `src/features/receipts/journey.test.ts(108,19): error TS2554: Expected 4 arguments, but got 3.` Not mine and not CSS-related: that file is modified in the working tree by a concurrent agent and the failing `it("stamps receipt capture messages ...")` block does not exist at HEAD (`git show HEAD:src/features/receipts/journey.test.ts` ends the describe at the previous test). Re-run at the end of this slice: see final status line in my handoff.
- `npm run build` (`tsc && vite build`) → exit 1 on the same foreign tsc error before Vite runs; the Vite half was therefore run alone (above) and passes.

### Not checked
- Dialog/modal states and the workout session are not in the baseline sample; irrelevant here because no deleted selector can match any rendered element (consumer grep), not because of cascade reasoning.
- Playwright specs: not run (another agent runs the full suite this wave).
- The 190 remaining heuristic-dead rules in styles.css and 6 in chat.css were surveyed, not verified individually; see below.

### For the orchestrator
- `count-rules.mjs` (scratch) lists 190 further styles.css rules whose every selector names a class with no consumer hit — the legacy Workouts/Review/History/Today clusters (`.workout-plan-banner*`, `.exercise-plan*`, `.exercise-tabs*`, `.active-exercise`, `.exercise-header*`, `.set-row*`, `.rep-choices*`, `.custom-reps*`, `.finish-workout*`, `.review-*`, `.processed-list*`, `.empty-art*`, `.history-list*`, `.history-detail*`), the nutrition-prompt cluster (`.nutrition-page-grid`, `.nutrition-prompt*`, `.suggestion-nutrition`, `.insights-grid`), and the old composer (`.composer-area`, `.sample-phrases*`, `.send-button*`, `.composer-note*`, `.loading-dots`, `.added-label*`, `.mini-label`, `.gentle-note*`, `.icon-tile.lavender`). Outside this slice's assigned cluster; a follow-up can delete them with the same baseline guard. Dynamic class construction should be re-checked per cluster before deleting (e.g. `.icon-tile.lavender` — `icon-tile` takes a tone prop in `components.tsx`).
- `src/chat.css`: 6 heuristic-dead rules, all `.fuel-typing*` (`chat.css:637-660`, `:1010`). Not in my cluster; confirm `fuel-typing` is not composed as `` `fuel-${...}` `` before removing.
- `npx tsc --noEmit` is currently red on another agent's `src/features/receipts/journey.test.ts:108` (arity of `saveReceiptCapture`); the build script gates Vite on tsc, so `npm run build` is red for the same reason until that lands.
- Both CSS files remain CRLF; `scripts/css-baseline.ts` is still untracked (`??`), as C2 left it.

### Ledger-ready paragraph
CSS-DEAD-CHAT-001 — After C2 merged `readability.css`, `src/styles.css` still carried the legacy chat-page rules (`.chat-layout`, `.chat-heading*`, `.chat-banner*`, `.chat-thread`, `.chat-date*`, `.chat-meal-*`, plus `.page-heading*` sharing their selector lists) at top level and in the 1200/760/380 px media blocks; no renderer (web, native, `index.html`, server preview) emits those classes, and the two `chat-thread` text hits are the `./chat-thread` module import. Fix: a fresh computed-style baseline (`scripts/css-baseline.ts`, 15 surfaces) was captured first, then 48 rules / 211 lines were deleted by a guarded line-range script (each range checked against its first/last line, CRLF preserved) under the rule "delete only when every selector in the list contains a class with no class-like consumer occurrence, prefixes grepped for dynamic names"; `.chat-main` (live, `App.tsx`) adjacent to the block was kept. Result: diff `NO DIFFERENCES`; styles.css 510→462 rules; chat.css has no such cluster (only `chat-home`/`chat-main`, both live) and was not edited. `vite build` passes; `tsc`/`npm run build` were red on a concurrent agent's `journey.test.ts` arity error unrelated to CSS. A survey with the same heuristic still finds 190 unused-class rules in styles.css (legacy workout/review/history/composer clusters) and 6 `.fuel-typing*` rules in chat.css for a follow-up. Lesson: a descendant selector that names a live class (`.chat-heading > .icon-button`) is still dead when its required ancestor class never renders; judge rules by the compound that must match, not by any single class in the selector.
