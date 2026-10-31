# Repository and product audit — 2026-10-10

Scope: code quality, half-baked features, and completeness of the Chat home page across the web app, server, and native app. Read-only audit; no source was changed. Findings are ranked within each section. Every claim below was checked against the working tree at commit `c2d6d0f` plus the uncommitted header-account work.

## Remediation status (2026-10-10, same day)

Fourteen agents in four waves repaired the findings below following the CYC flow with direct configured checks (the managed controller cannot start here, see below). Per-agent notes with red-first evidence are in [notes/](notes/). Ledger entries: `AUDIT-20261010` waves A–D in `docs/context/error-ledger.md`. All changes are uncommitted and await acceptance.

| Finding | Status | Note |
| --- | --- | --- |
| C1 dropped composer text, C2 no web cancel, C7 ungated retry | Fixed | A2-chat-composer |
| C3 stripped-card replies, C4 masked provider errors, C5 stage budgets | Fixed | A3-server-chat |
| C6 demo confidence text, F1 Today dashboard, F3 demo captures, dead welcome data | Removed | B1-demo-removal |
| C8 native warnings and U+FFFD, Q7 `h.state!` | Fixed | A4-native |
| F2 fitness setup feeds Workouts | Built (web + native, optional training week) | B5-workout-program |
| F4 local account delete, F5 agents migration | Fixed | A3-server-chat |
| F6 native parity | Documented as pending decisions in `docs/context/native.md` | A6-hygiene |
| Q1 unreadable records overwritten | Fixed, copies owner-scoped | A1-data-loss, B6-followups |
| Q2 App.tsx god component | Split: 48→19 useState, ChatLayer 47→0 props | D1-app-split |
| Q3 CSS consolidation | readability.css merged, tokens hoisted, dead rules removed, zero computed-style diff | C2-css, D3-dead-css |
| Q4 lint and CI | Root eslint flat config, lint script, GitHub workflow (not yet executed on GitHub) | A6-hygiene |
| Q5 missing tests | server/http + routes characterization, hook and store tests | B2-hook-tests, B3-server-routes |
| Q6 hosted/local drift | One `ROUTES` table and `BODY_LIMITS`; hosted chat parsed once | B3-server-routes |
| Q8 NaN totals, Q9 `any` merge, Q12 capture cast | Fixed | A5-type-safety |
| Q10 e2e coupling | `e2e-shared/` package; native suite standalone | C3-e2e-helpers |
| Q11 hygiene | `/docs` ignore removed, `.gitattributes`, tsbuildinfo untracked, Node statement aligned | A6-hygiene |
| Chat UX gaps (scroll anchoring, live regions, limits, date dividers) | Fixed | C1-chat-ux, D2-message-timestamps |
| Native voice transcript dropped while busy (found in wave A) | Fixed | B6-followups |

Final verification on the frozen tree: tsc clean; 570 unit tests in 84 files; root lint 0 errors / 68 warnings; native check and lint clean; agents suite 8/8; `npm run build` passes; web browser suite 378/378.

Still open, by decision rather than oversight:
- `public/spot-studio` (89 MiB of tracked design assets) ships with the app and blocks managed CYC runs (`CYC-ASSETS-001`); moving it out of `public/` is a product and repo decision.
- `docs/audits/` (61 MB of evidence screenshots) is no longer ignored but not added; commit, LFS, or prune is your call.
- One-time `git add --renormalize .` after the new `.gitattributes`.
- `styles.css` still has roughly 190 unused-class rules in legacy workout, review and composer clusters (listed in D3-dead-css); `chat.css` has six `.fuel-typing*` rules.
- Native `ChatScreen` stamps `at` but renders no date dividers yet.
- Hosted paths (Supabase auth, live providers, Vercel) and physical devices were not exercised.

## Where to start

1. Q1: stop overwriting unreadable guest records (data loss).
2. C1 and C2: keep the composer draft while a reply is processing, and add a web cancel button to match native.
3. F1 and F3: delete the legacy Today dashboard and gate or remove demo captures.
4. Repository hygiene: remove the `/docs` ignore rule, add a lint script and a CI workflow so the green checks above are enforced.
5. F2: make fitness setup actually drive the Workouts landing, or stop promising it.
6. Q2: begin splitting `src/App.tsx` with the AI-request hook and dialog reducer.

## Verification run

| Check | Command | Result |
| --- | --- | --- |
| Web typecheck | `npx tsc --noEmit` | passed |
| Unit tests (src + server) | `npx vitest run src server` | 69 files, 432 tests passed |
| Agent CLI/MCP suite | `npx vitest run scripts/agents` | passed |
| Native typecheck | `npm --prefix mobile run check` | passed |
| Native lint | `npm --prefix mobile run lint` | 0 errors, 9 warnings |
| Web browser suite | `npx playwright test` | 344 passed (desktop + mobile projects, 5.1 min) |
| Live chat walkthrough | In-app browser as a guest | Onboarding (5 steps) → typed meal → estimate card → accepted → "Logged." |

Not run: the native Expo browser suite (`mobile/e2e`), hosted deployment checks, physical devices, live provider accuracy.

## 1. Chat (home page)

### What works

- Text, camera photo, gallery image, receipt mode, barcode scan, and voice all reach the same `submitText` path. Voice is bounded to 60 s and transcribed server-side.
- Server pipeline: input boundary review → generation (Qwen primary, one OpenAI fallback) → JEV intent gate → deterministic normalization with provenance checks → USDA receipt candidates → output boundary review. Record proposals are stripped if either review denies them.
- Proposal cards (meal, workout, activity, preference, recipe portion, grocery) require explicit acceptance; accepted saves are idempotent and survive refresh. Verified live: a typed breakfast produced a reviewable estimate and "Logged." in about ten seconds.
- Honest empty, sign-in, setup, restricted and unavailable states; Spot intro, comeback greeting, first-entry card, and example prompts.
- Local commands (nutrition summary, start workout, what needs review) and tool openers work without a provider.

### Confirmed defects (ranked)

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| C1 | High | Voice transcripts and menu presets are silently dropped while a reply is processing. `submitText` returns early on `processing` without keeping the text; the Mic button stays enabled during processing. The grocery path handles this correctly by retaining the draft. | `src/App.tsx:711-714`, `src/App.tsx:2135`, `src/ChatLayer.tsx:791-809`, correct pattern at `src/App.tsx:367-370` |
| C2 | High | Web has no way to stop an in-flight request. `cancelPendingAI` is only called from reset, restore and account change, so the composer can be locked for up to 185 s. Native has a "Stop response" button. | `src/App.tsx:594-601` and call sites `:256,:1245,:2114,:2529`; `src/ai-client.ts:219`; `mobile/src/ChatScreen.tsx:417` |
| C3 | Medium | Replies can describe a card that was stripped. Normalization writes "Review the portions on the card" into `reply`; when a boundary review denies records the meal is nulled but the reply and receipt warnings stay. | `server/ai.ts:314,476,482`, `server/chat-boundaries.ts:65-76` |
| C4 | Medium | Provider auth/quota failures are masked as a generic "retry". The input boundary review runs first and converts every failure to `AI_BOUNDARY_UNAVAILABLE`, so the 401/403/429 branches in `publicError` are unreachable for chat. | `server/chat-boundaries.ts:142-145`, `server/ai.ts:381`, `server/http.ts:37-54` |
| C5 | Medium | Stage budgets (20 + 150 + 12 + 20 s) exceed the 180 s server abort and 185 s client timeout, so a slow but successful generation can be killed during the output review and reported as a timeout. | `server/http.ts:225`, `server/ai.ts:374-483` |
| C6 | Low | Demo scaffolding still lives in the live renderer: any non-AI "Dinner" card shows hard-coded "High confidence on chicken and broccoli" text and the title "Dinner added". Today only the demo flows produce such cards, but the branch is unguarded. | `src/ChatLayer.tsx:570-619` |
| C7 | Low | "Retry this capture" is not gated on AI availability and surfaces developer copy ("check the server and refresh"). | `src/ChatLayer.tsx:544-548`, `src/App.tsx:608-612` |
| C8 | Low | Native never renders server `warnings`, so a Spot Check such as "which date was this meal?" is invisible on the phone; the card is simply absent. Native activity card also contains a literal U+FFFD character. | `mobile/src/ChatScreen.tsx:136`, no `warnings` usage in `ChatMessage` |

### Completeness gaps

- No token streaming; the reply lands all at once after the full pipeline. Progress stage text is the only feedback.
- The thread force-scrolls to the bottom on every message change even when the user has scrolled up; there is no "jump to latest".
- The whole thread, including the welcome, example disclosures and notices, sits inside one `aria-live="polite"` log with nested `status` and `alert` regions, which will produce duplicate screen-reader announcements.
- Timestamps are time-only with no date separators; history is unbounded and stores base64 images in app state; there is no "clear conversation" short of "Start fresh", which wipes all records.
- Composer limits disagree: web input 2000, voice 4000, native 4000, server 4000.
- The `welcome` message and `referenceConversation()` demo data in `src/domain.ts:365-420` are filtered out by both renderers and are effectively dead.
- Chat behaviors without tests: NDJSON parse errors and request-id mismatch in `requestAI`, server 409/429/413 paths, client-disconnect abort, dropped presets while processing (C1), activity proposal card on either platform, scroll anchoring, native warnings rendering.

## 2. Half-baked or inconsistent features

Overall the docs are unusually honest and the code matches them: every client API path has a server route (one exception below), every env-gated provider degrades with an explicit message, and no dead buttons were found. The gaps are prototype residue, one unfinished product promise, and native parity.

| # | Class | Finding | Evidence | Finishing it |
| --- | --- | --- | --- | --- |
| F1 | Dead but reachable | The legacy "Today" demo dashboard still ships. `#today` renders a different app with a "LOCAL DEMO" badge, fabricated steps and sleep ("6,842 steps is sample data"), sample insights, and the old seven-tab nav. | `src/App.tsx:149,199,495,1266,1292-1545,1394,1414`; `src/domain.ts:174`; `src/chat.css:11-14` | Delete the Today branch, the `insights` array and legacy nav; drop `"Today"` from `Page`; redirect `#today` to Chat. Pure removal. |
| F2 | Partially wired | Workouts still lands on fixed starter plans with "example rep targets". Fitness setup collects only a body-weight goal; nothing in Workouts reads equipment, experience or schedule, so the USER_READINESS "one personal training week" promise is unmet. | `src/features/progress/fitness-goal.ts:17-22`; no setup references in `src/WorkoutPage.tsx` or `src/workouts.ts` | Extend FitnessSetup with days/equipment/experience, persist a program, drive the landing from it. Medium, both platforms. |
| F3 | Prototype residue | The production capture modal offers "OR EXPLORE A DEMO" sample dinners and scripted assistant replies, gated only on not being in receipt mode. Sample meals are excluded from totals, so numbers stay honest, but beta users see fake flows. | `src/App.tsx:521-575,2015-2045` | Gate behind a dev flag or remove. Small. |
| F4 | Hosted only | Account deletion POSTs `/api/account/delete`, which exists in the hosted handler but not the local server, so local users get a raw "Not found." Native is explicit about this; web is not. | `src/features/cloud/useAccountSecurity.ts:108`; `server/beta.ts:77-88`; absent from `server/http.ts:120-142` | Add the route when admin config exists, or hide the form when config is local. Small. |
| F5 | Manual step | The agents migration (`20260929_agents.sql`) is applied by no setup or readiness script; hosted `/api/agents/*` returns 503 until someone runs it by hand. | `scripts/setup-supabase.ts:39-43`; `server/readiness-migrations.ts:4-7`; `server/vercel-entry.ts:26` | Add to the readiness list and verify script. Small. |
| F6 | Native parity | Web-only: meal → pantry link suggestions, smart-swap nutrition comparison, receipt-first entry and example. Native agent connections need a hosted account. Native e2e runs on Expo web, not devices. | `src/features/pantry/PantryLinkReview.tsx`, `src/features/planning/SmartSwaps.tsx`, `src/features/receipts/*` have no native counterpart; `mobile/src/Connections.tsx:25`; `mobile/playwright.config.ts` | Decide which are intentional and record it in `docs/context/native.md`. |
| F7 | Low | Nutrition still carries a stock-photo "inspiration" promo card that only opens the planner; You stacks about fifteen rows. With the header-account change, You is two taps on web but one on native. | `src/NutritionPage.tsx:428-447`; `src/FuelNavigation.tsx:98-104`; `mobile/App.tsx:111` | Design decision, not a defect. |

Verified complete with no action: onboarding (all five steps plus recovery), Kitchen first week, pantry, recipes, planner, shopping, scanner, label capture, voice, automatic account sync, recovery, hosted deletion, maintenance cron, native preview-gate bypass, and plan-ingredient reconciliation.

## 3. Code quality

What is good: `strict` everywhere, zero `@ts-ignore`/`@ts-expect-error`, zero `as unknown as`, one `any`; contracts are genuinely shared (native imports `../../src` 120 times, the agents tsconfig includes the real contracts file); no empty catches; every listener is removed; AI requests abort on timeout and on client disconnect; the server is small with origin checks, bearer auth on every hosted write, admission leases, bounded bodies and zod on both request and provider output; persistence is serialized and journals at the action boundary. The debt is concentration and missing gates, not sloppiness.

| # | Severity | Finding | Evidence | Fix |
| --- | --- | --- | --- | --- |
| Q1 | High (data loss) | `readState` swallows any parse failure and returns `initialState()`, and `useBrowserRecords` persists on mount to the same key. A corrupt blob, or one written by a newer app version (schema is `version: z.literal(1)` with no migration chain), is overwritten with an empty account on first render. Native correctly throws instead. Signed-in users have account archives; guests have no second copy. | `src/domain.ts:372-379,111`; `src/platform/useBrowserRecords.ts:18`; `src/platform/snapshot.ts:7` | Return `{ok:false, raw}` from `readState`, copy the raw blob to a `corrupt-<ts>` key before any write, add a version-keyed migration table. |
| Q2 | High (maintainability) | `src/App.tsx` is one 2,750-line function with 50 `useState`, 11 `useRef`, 10 `useEffect`, 0 memoization; fourteen booleans are dialog flags; `ChatLayer` takes 47 props, `YouPage` 20, `NutritionPage` 14. AI lifecycle, account switching, hash routing, capture, meal editing and workout capture all share one scope. | `src/App.tsx:189-2940,1575-1718`; `src/ChatLayer.tsx:47` | Extract `useAIRequest`, an `activeDialog` reducer, `useAccountSession`, a `MealEditor`, and a `ChatContext`. `mobile/App.tsx` is already fine at 292 lines. |
| Q3 | Medium | CSS is one global namespace: 29 files, 12,658 lines, no modules. `readability.css` re-declares all 81 of its selectors from `styles.css` as a cascade-order override; `.edit-form` is defined in three files; `--text`, `--green`, `--serif`, `--avatar-size`, `--spot-size` have different values in different files; 650+ literal hex colors. | `src/readability.css`, `src/styles.css`, `src/features/pantry/pantry.css` | Merge `readability.css` into `styles.css`, hoist tokens to one `:root`, prefix feature classes. |
| Q4 | Medium | No root lint or format script, prettier unused, no CI. Style is visibly mixed: minified one-liners in `server/beta.ts:88-93`, `server/vercel-entry.ts:15-16`, `src/features/cloud/sync.ts`, `src/platform/browser-records.ts` next to Prettier-formatted files. | `package.json`; no `.github/workflows` | Root `eslint.config.js`, `lint` and `format:check` scripts, one workflow running tsc, lint, vitest, `agents:check`, `mobile:check`. |
| Q5 | Medium | Zero component or hook tests. Untested modules over 150 lines include `App.tsx`, `mobile/src/KitchenTools.tsx` (1,791), `WorkoutPage.tsx`, `YouPage.tsx`, `ShoppingDialog.tsx`, `ChatLayer.tsx`, `useOnboarding.ts`, `mobile/src/store.tsx`, `server/http.ts` (rate limit, dedupe, abort, 413), `src/ai-client.ts`. 24 of 74 Playwright specs mock no routes and rely on the provider being unconfigured. | `find src server mobile/src -name "*.test.tsx"` is empty | Add `server/http.test.ts` for `createApi` branches and hook-level tests for `useBrowserRecords`, `useOnboarding`, `store.tsx`. |
| Q6 | Medium | Hosted and local pipelines drift. `beta.ts` parses the body, mutates it, re-serializes, and `http.ts` parses it again (double parse up to 4 MB); four hand-maintained body limits; two route tables kept in sync by hand; `/api/cloud/config` can be unavailable locally but is always available hosted. | `server/beta.ts:27-37,106,150`; `server/http.ts:120-135`; `server/agents/http.ts:67` | Let `createApi` accept a pre-parsed body and export one `ROUTES` table. |
| Q7 | Low | Native store exposes `state: AppState \| null` and screens assert `h.state!` 49 times across 13 files. | `mobile/src/store.tsx:72`, e.g. `ChatScreen.tsx:28`, `Cloud.tsx:101` | A `useLoadedHealth()` that guards once at the screen boundary. |
| Q8 | Low | Non-null assertions in arithmetic can yield NaN totals: `item.nutrition!.calories * item.servingsPurchased!` four times. | `src/AICards.tsx:185-188`; also `App.tsx:618,963,2397` | Filter before reducing. |
| Q9 | Low | The only `any` in the codebase is the three-way merge used for persisted account state conflicts. | `src/features/cloud/sync.ts:17` | Type as recursive `JsonValue`; output already passes through `stateSchema.safeParse`. |
| Q10 | Low | Twelve native specs import `../../tests/profile-navigation`, so the native e2e suite cannot run standalone; `setup`/`send`/`seed` helpers are each defined in three specs. | `mobile/e2e/*.spec.ts` | Move shared helpers to a root `e2e-shared/`. |
| Q11 | Low | `tsconfig.tsbuildinfo` is committed although the root config is `noEmit` and not incremental; no `.gitattributes` so 33 files warn LF→CRLF on every diff; `engines.node` is 24.x while README says 22.14+ and the local runtime is 22.14; `agent-browser` devDep is unused by code. | `package.json`, `README.md:39` | Remove the build-info file, add `.gitattributes`, align the Node statement. |

## 4. Repository hygiene

| Finding | Evidence | Effect |
| --- | --- | --- |
| `/docs` is git-ignored since 2026-09-30, so every `docs/audits/*` folder, `docs/AGENT_CONNECTIONS.md`, `docs/context/chat-boundaries.md`, `onboarding.md`, `receipt-journey.md` and `agent-meal.example.json` are untracked. The README links to three of them. | `.gitignore:31`; `git check-ignore -v docs/AGENT_CONNECTIONS.md` | A fresh clone has broken README links and none of the audit evidence the error ledger cites. This report is ignored too. |
| README still says the four tabs are Chat, Nutrition, Workouts and You. The live bottom bar is Chat, Nutrition, Scan, Workouts, Kitchen, with You behind the header icon. | `README.md`, `src/FuelNavigation.tsx` | Onboarding copy and docs disagree with the shell. |
| No CI workflow; `npm test` does not run the browser suites or the native checks. | no `.github/workflows` | All green today only because they were run by hand. |
| Native lint has 9 warnings (unused imports, missing effect deps, duplicate React imports). | `mobile/src/Capture.tsx:2,382,426`, `KitchenTools.tsx:55`, `Shopping.tsx:2`, `tools.tsx:1-6` | Low; the `exhaustive-deps` ones around the recorder deserve a look. |
| Uncommitted header-account work is coherent and tested (web + native) and awaits acceptance; it is not a mid-change break. | `git status`, `tests/header-account.spec.ts`, `mobile/e2e/header-account.spec.ts` | Commit or discard; the error ledger already records it. |
