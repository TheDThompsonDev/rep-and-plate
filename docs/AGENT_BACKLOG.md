# Rep & Plate: agent execution backlog

Prepared September 25, 2026. Revised to USDA-only food-data scope. Status: dispatched. See [the execution status](AGENT_EXECUTION_STATUS.md) for delivered increments, partial tickets, verification, and remaining work.

## Outcome

Make Rep & Plate a chat-first assistant that connects what someone buys, what they eat, what remains in their kitchen, and what they should consider cooking or doing next. Preserve the accepted mobile design, Chat as the homepage, and the Nutrition, Workouts, and You tabs.

This backlog includes the feature requests in the screenshots and the pasted barcode/database conversation. The pasted conversation is a proposal to evaluate, not an implementation specification to follow unquestioningly. “Macros and colors” is interpreted as “macros and calories.”

## Existing foundation — extend, do not rebuild

- OpenAI image/text processing, web research, structured responses, and JEV intent classification work.
- Grocery receipts create editable purchase records with sources. Purchases do not affect daily intake.
- Meal estimates require an Add action. Ingredients can be marked used manually. Chat can suggest meals from recent available groceries.
- Nutrition totals, workout set tracking, profile/review screens, and local browser persistence work.
- Current gaps: no barcode resolver, component-level meal records, quantity ledger, automatic meal-to-pantry linking, weekly plan, persistent preferences, derived insights, generated workout plans, or external integrations.
- Current technical constraints: `src/App.tsx` owns shared state; `src/domain.ts` and `src/ai-contract.ts` define persisted and AI schemas. Grocery quantities are text, pantry availability is binary, meals contain aggregate macros, and AI context is bounded to recent records. These are migration targets, not adequate final models.

## Food-data decision

Build a product resolver, not a manually curated global food database. A barcode identifies a product; nutrition comes from a corresponding data source. GS1 documents this distinction. [GS1 barcode explanation](https://support.gs1.org/support/solutions/articles/43000734095-how-do-gs1-gtins-and-barcodes-work-)

USDA is the only external structured food database in the current scope. Keep a provider-neutral Rep & Plate catalog, populated from USDA and supplemented by private user-confirmed labels. Other food-data providers and paid adapters are deferred. This decision changes the backlog; it does not mean the catalog or importer already exists.

Initial path for US packaged foods:

`scan or type barcode → validate identifier → user's confirmed correction / Rep & Plate catalog seeded from USDA → USDA API on a miss or refresh → nutrition-label photo + review`

Ticket 02 measures USDA coverage, freshness, and lookup latency. Ticket 04 imports USDA releases into the catalog so ordinary scans do not require a live external call. Incomplete or conflicting data leads to review or label capture. Loose ingredients and restaurant dishes need separate search/estimation paths. Keep the existing web-search fallback for receipt abbreviations and restaurants, with visible uncertainty; web estimates do not become verified catalog records automatically.

- **USDA FoodData Central:** offers search/details APIs, requires a data.gov key, and publishes data under CC0. The branded dataset includes GTIN/UPC, ingredients, serving information, and nutrients. Search candidates must be checked for exact identifier equality; a keyword hit is not a barcode match. [API guide](https://fdc.nal.usda.gov/api-guide/), [branded-food documentation](https://fdc.nal.usda.gov/docs/Branded_Foods_Documentation_Apr2024.pdf)
- **USDA downloads:** CSV and JSON releases can seed a server-side catalog. Import the chosen Branded Foods release in bounded batches, record its release metadata, and apply subsequent updates without changing historical meal snapshots. Bulk-release availability and API freshness must be measured separately; do not assume every API update has a matching downloadable release. [Official downloads](https://fdc.nal.usda.gov/download-datasets/)
- **Future providers:** retain an extension interface, but do not build additional adapters or run a commercial-provider comparison now. Reconsider only if measured USDA misses and label-capture burden justify a later decision.
- **Retailer APIs:** useful candidates for store identity, availability, and purchase imports, but access and returned fields must be demonstrated. A retailer website having nutrition data does not establish public API access or permission to import purchase history. Ticket 18 investigates supported access, starting with the [Kroger developer reference](https://developer.kroger.com/reference).

Do not promise 99% coverage, universal retailer access, zero operating cost, or permanent product correctness. A database record is not automatically a verified package label. A corrected label belongs to that user's product/version until a separate, explicitly designed shared-catalog review process exists.

## Shared rules for every agent

1. Keep Chat as home. New flows use the established bubbles, cards, source links, and review patterns. Do not redesign unrelated screens.
2. Separate catalog products, purchase lots, meal consumption, and future plans. Scanning, buying, or planning food does not mean eating it.
3. Preserve nutrition basis: per 100 g, per 100 mL, per labeled serving, and per package are different. Missing is null, not zero. Never convert volume to mass without a supported density.
4. Store evidence and product/version context. Do not combine macros from incompatible packages or serving bases into one apparently verified result. JEV intent confidence is not nutrition confidence.
5. Make additions, consumption links, corrections, deletions, and retries idempotent and reversible. Historical meals retain their nutrition snapshot when a catalog record changes.
6. Keep secrets on the server. Use synthetic fixtures in automated tests. Do not publish user photos or corrections to external food databases automatically.
7. Preserve existing browser data through tested migrations. Do not reset user state to make a new schema work.
8. Mark uncertainty honestly. Missing logs do not prove waste, consumption, expiry, or a health condition. User-confirmed restrictions are hard planning constraints; unknown ingredient/allergen data is not proof of safety.
9. Each ticket ships one coherent increment, its relevant tests, setup notes, and a handoff listing limitations. Prototype examples must remain distinguishable from personal history.
10. Do not claim unsupported hardware or account integrations work. Feasibility tickets return evidence and the next build ticket, not a pretend connection screen.

## Coordination and ownership

Use **one integrator and up to three implementation agents** at a time. A swarm means independent bounded assignments, not every agent editing the same screen.

The integrator owns edits to `src/App.tsx`, `src/domain.ts`, `src/ai-contract.ts`, shared navigation, server route registration, `package.json`, and the lockfile. Module agents own their new feature folders and tests; they supply an integration patch or coordinate a short exclusive ownership window. The same rule applies to shared CSS. When shared types must change, update the contract first and notify consumers.

There is currently no Git repository in this workspace. Before concurrent implementation, create a recoverable baseline and establish version control or another explicit change-isolation workflow. Do not assume worktrees already exist. Make sure `.env` and personal captures remain excluded.

Ticket 01 produces small shared interfaces and fixtures before dependent implementation begins. Once those interfaces are merged, agents can build against fixtures while upstream adapters are still being completed. Runtime dependencies below must be integrated before a ticket is accepted as complete.

Recommended boundaries:

- `src/features/products/` and `server/products/`: catalog, normalization, resolver, providers.
- `src/features/scanner/`: camera and barcode decoding.
- `src/features/labels/`: label extraction review.
- `src/features/pantry/`: purchase lots, quantity events, reconciliation.
- `src/features/meals/`, `src/features/planning/`: consumed components and future plans.
- `src/features/preferences/`, `src/features/insights/`: explicit preferences and evidence-backed patterns.
- `src/features/workout-planning/`, `src/features/voice/`: generated workouts and transcription.
- `server/integrations/`: future authorized external adapters.
- `docs/research/`: evidence-based provider and platform investigations.

These are proposed folders, not claims that the modules already exist.

## Dispatch order

| Wave                   | Assignments                                                                           | Exit condition                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Foundation             | 01 contracts/migration plan, 02 USDA coverage/import evaluation, 24 baseline fixtures | Shared contracts accepted; existing app baseline recorded                              |
| Identification         | 03 USDA API, 04 USDA importer/catalog, 06 scanner; then 05 resolver and 07 labels     | A scan resolves to a sourced product or an editable label fallback                     |
| Connected food records | 08 receipts, 09 pantry, 10 meals/drinks; then 11 reconciliation                       | A confirmed meal can deduct explicit ingredient quantities and undo them               |
| Personalized planning  | 12 preferences; then 13 weekly plans, 14 use-up suggestions, 15 insights              | Plans use real availability; insights cite actual records                              |
| Broader assistant      | 16 workouts, 17 voice; 18–21 investigations fill free slots                           | Workouts and voice use the same chat actions; integration feasibility documented       |
| Shared beta            | 22 accounts/storage, 23 final chat integration, 24 release checks                     | Per-user persistence, permissions, and complete journeys verified before public access |

Ticket 23 starts its routing design after 01 and integrates each wave incrementally. Ticket 24 runs at each wave, not only at the end. Ticket 22 can start architecture and provider selection after 01; the rest of the local MVP does not wait for cloud deployment. Research tickets 18–21 can run earlier when a slot is available.

## Task briefs

### 01 — Shared records, action contracts, and migration plan

**Priority:** P0. **Depends on:** none. **Owner:** integrator/contracts agent.

Deliver versioned schemas and fixtures for product identity, nutrition snapshots, purchase lots, pantry events, meal components, recipes, plans, preferences, and typed chat actions. Define provider-neutral `FoodProduct` and `ProductSource` records; USDA payload types stay inside its adapter/importer. Preserve original barcode strings, canonical GTIN, market, package/variant, source ID/URL, fetch date, source update/release date, evidence type, nutrition basis, nullable amounts, and field provenance. A label-photo assertion and a user-confirmed value need distinct statuses. Define provider outcomes as found, not-found, ambiguous, unavailable, or rate-limited; do not hide outages as absent products. Keep image extraction separate from barcode lookup.

**Accept when:** consumers compile against fixtures; old persisted state migrates without losing meals or edits; action retries use stable IDs; no change silently reinterprets purchased food as consumed. Document unit conversions and which unstructured legacy quantities remain unknown.

### 02 — USDA coverage, freshness, and import evaluation

**Priority:** P0. **Depends on:** none. **Owns:** `docs/research/food-data.md`, synthetic benchmark fixtures.

Evaluate USDA against a documented, permission-safe sample of 50–100 target-market items: store brands, drinks, supplements, international foods, multipacks, and missing products. Track exact identity, macro completeness, serving basis, freshness, response time, and conflicts separately. Compare a selected Branded Foods download with API results; record release dates, archive size, local storage/index requirements, update strategy, API quotas, and source attribution. Measure the expected need for label capture. Other databases are outside this evaluation.

**Accept when:** results distinguish product hits, usable nutrition hits, and resolution without user intervention; findings have official references and a checked date. If the API key is unavailable, evaluate downloaded data where feasible and deliver a runnable API harness with unavailable measurements labeled. Recommend the initial dataset, catalog storage/index design, refresh policy, and API fallback limits; do not invent a coverage percentage.

### 03 — USDA adapter

**Priority:** P0. **Depends on:** 01; consult 02. **Owns:** `server/products/providers/usda.*` and tests.

Implement server-side branded candidate search and food-detail retrieval using a new `USDA_API_KEY` setting. Match normalized GTIN exactly after search; distinguish duplicates, product variants, and missing identifiers. Normalize nutrients by documented units and basis, preserving raw source references. Support cancellation, bounded timeouts, quota errors, and absent configuration.

**Accept when:** tests cover leading-zero identifiers, wrong candidate rejection, stale/conflicting versions, missing macros, and 100 g versus serving conversion. Keys never reach client bundles or logs. Provide an opt-in live smoke command; absent keys do not block mocked tests, imported catalog lookups, or label capture. The API adapter and importer use the same normalization rules.

### 04 — USDA bulk importer and versioned Rep & Plate catalog

**Priority:** P0. **Depends on:** 01, 02. **Owns:** `server/products/importers/usda.*`, catalog repository/indexes, fixtures, and tests. Coordinate shared USDA normalization with 03.

Implement a repeatable importer for the selected official USDA Branded Foods download. Stream or batch records into a persistent server-side catalog with canonical product IDs and an indexed normalized GTIN. Preserve FDC IDs, original identifiers, brand, ingredients, serving basis, nutrient units, source dates, release metadata, and source observations. Handle multiple versions/candidates without silently merging different packages. Keep large archives and the catalog out of the browser bundle and version control. Expose an explicit import/update command with dry-run, progress, checkpoint/restart, and an import summary; define the later refresh schedule without creating a recurring job now.

**Accept when:** reimporting a release is idempotent; an interrupted import resumes or rolls back safely; malformed rows are counted and reported; updates create source versions and never overwrite private corrections or historical meals. A fixture catalog serves an exact barcode lookup with network disabled. Record observed import memory/disk use and lookup latency against the agreed sample, and document how release/discontinued status affects current lookup eligibility. Storage is locally runnable and does not depend on ticket 22's hosted account decision.

### 05 — Catalog-first product resolver and conflict handling

**Priority:** P0. **Depends on:** 01–04. **Owns:** `server/products/resolver.*`, cache module, product-result UI model.

Implement the provider interface and a lookup policy that checks private confirmed corrections and the imported Rep & Plate catalog before calling USDA's API on a miss or needed refresh. Persist successful USDA resolutions as versioned catalog observations. Add deduplicated in-flight lookups, freshness rules, and short negative caching; keep private user corrections separate. Unresolved or conflicting matches go to label capture/review, not a second external database. Ask for clarification on incompatible brand, market, package, or serving evidence; a confident identity does not make incomplete macros complete. Version nutrition snapshots instead of overwriting history.

**Accept when:** catalog hits and repeated valid scans require no AI or external API; refresh failure can show a dated catalog result; USDA outages are not permanently cached as misses; conflicting records are inspectable. Freshness behavior follows 02. Changing a current product never changes yesterday's logged meal. All capture channels use the same canonical product identity, and private label corrections cannot silently become shared catalog truth.

### 06 — Barcode capture inside Chat

**Priority:** P0. **Depends on:** 01; 05 for acceptance. **Owns:** `src/features/scanner/` and focused styles/tests.

Add a Scan action to the existing camera/composer flow, with live camera, image upload, and manual barcode entry. Validate supported UPC/EAN/GTIN forms and checksums without losing leading zeros. Use feature detection and a maintained decoding fallback; unsupported/store-specific variable-weight codes get a clear fallback. Stop camera tracks on close. A result card offers separate “Add to groceries” and “Log what I ate” actions with quantity selection.

**Accept when:** duplicate frames cause one lookup; cancel/permission denial/no camera work; unknown codes lead to label capture; scanning alone changes no intake or inventory. Automated image/manual tests pass, and actual iOS Safari/Android Chrome camera checks are reported separately from browser emulation. External QR URLs are not opened automatically.

### 07 — Nutrition-label photo fallback and correction memory

**Priority:** P0. **Depends on:** 01; 05 for saving a resolution. **Owns:** label extraction service and `src/features/labels/`.

Reuse OpenAI for label transcription into strict fields. Handle serving size, servings per package, per-serving/per-100-unit columns, kJ versus kcal, decimal values, and unreadable numbers. Show the image beside editable extracted values. Associate a label with a specific barcode/variant only after confirmation; keep it private to the user by default.

**Accept when:** ambiguous columns and unreadable digits request review; unknown does not become zero; an approved label can resolve a later scan without another AI call. OCR output is never automatically labeled verified or contributed publicly. Deleting a private correction restores provider resolution without rewriting old meals.

### 08 — Receipt extraction connected to the product resolver

**Priority:** P1. **Depends on:** 05, 07, 09 purchase contract. **Owns:** receipt enrichment module; coordinate changes to `server/ai.ts`.

Separate receipt transcription from product matching. Preserve original lines, counts, weights, prices, store, and ambiguity. Use exact printed identifiers where present; otherwise search candidates, use official web evidence, or ask for a barcode/package photo. Keep coupons, subtotal lines, deposits, and nonfood purchases out of nutrition. Surface all unreadable/truncated lines. Improve duplicate receipt review beyond identical image bytes without blocking genuine repeat purchases.

**Accept when:** a mixed receipt creates inspectable purchase lots, never meals; ambiguous abbreviations do not invent exact products; duplicate confirmation preserves corrections. A second photograph is flagged as a possible duplicate with user choice, and equal items purchased on different dates remain distinct.

### 09 — Pantry quantities and purchase-event ledger

**Priority:** P1. **Depends on:** 01. **Owns:** `src/features/pantry/ledger.*`, selectors, pantry detail UI.

Replace binary availability with purchase lots and reversible events: acquired, consumed, adjusted, discarded, and restored. Track count/mass/volume with explicit units and unknown quantities; retain a simple available/used UI for legacy records. Distinguish purchase date, user-entered expiry, and estimated use-up hints. Provide selectors for the full pantry so planning is not limited to the last five receipts.

**Accept when:** partial use, multiple packages, repeated purchases, edits, undo, and refresh produce consistent balances; no silent negative stock or unsupported conversion. Old receipts migrate without invented quantities. A purchase correction reconciles existing linked events or asks for review.

### 10 — Structured meals, recipes, drinks, and additions

**Priority:** P1. **Depends on:** 01, 05. **Owns:** `src/features/meals/` and nutrition arithmetic.

Add meal components and portion-aware recipe math while retaining aggregate legacy meals. Model drinks, milk, cream, syrups, cooking oils, sauces, and toppings explicitly when supplied. Ask only for materially missing quantities. Scale known nutrition deterministically; distinguish raw/cooked weights, recipe yield, individual portions, leftovers, and optional ingredients. Save a snapshot when the user confirms consumption.

**Accept when:** chai with whole milk, coffee with syrup, oil used across several portions, and a half-bottle drink calculate correctly; incomplete ingredients show partial estimates. A saved recipe or proposed dinner adds no intake. Editing/deleting consumption adjusts daily totals once and emits a reconciliation action for 11.

### 11 — Link eaten meals to groceries, with confirmation and undo

**Priority:** P1. **Depends on:** 09, 10. **Owns:** `src/features/pantry/reconciliation.*` and confirmation card.

Suggest ingredient-to-purchase-lot links from confirmed meal components, using product identity and compatible quantities. Ask “Did you use your milk and oats?” when the source is inferred; explicit meal-plan ingredient selection can supply that evidence directly. Track the amount eaten versus the amount cooked into leftovers. Confirm uncertain deductions and allow changes to which lot was used.

**Accept when:** confirmed oats-and-milk consumption reduces the correct amounts once; retries do not double deduct; editing, deleting, or undoing the meal reverses/replaces its events. Unmatched food and unknown quantities remain unresolved rather than guessed. Missing meal logs never consume pantry stock.

### 12 — Persistent preferences and constraints

**Priority:** P1. **Depends on:** 01. **Owns:** `src/features/preferences/`, You settings card.

Store explicitly supplied dietary restrictions, disliked foods, favorite meals, cooking time, equipment, budget preference, household/portion count, and workout preferences. Let chat propose a preference update and let users inspect, correct, forget, or confirm it in You. Keep inferred preferences separate from explicit instructions.

**Accept when:** a rejected meal does not silently become a permanent dislike; explicit exclusions are respected across plans and swaps; unknown budget/equipment remain unknown. Users can understand why a preference was remembered and remove it without resetting the app.

### 13 — Weekly meal plans and missing-ingredient shopping list

**Priority:** P1. **Depends on:** 09, 10, 12. **Owns:** `src/features/planning/meal-plans.*` and chat plan cards.

Generate an editable seven-day draft from quantities on hand, confirmed constraints, cooking time, portion count, and goals. Account for shared ingredients across the entire plan, batch recipes, and leftovers. Recompute approximate nutrition from components. Produce a shopping list for the actual shortages with compatible unit aggregation. Allow swapping one meal without rebuilding the whole week.

**Accept when:** the same bottle of milk is not allocated repeatedly beyond availability; missing ingredients are clearly separated; excluded ingredients do not appear; planned meals change no actual intake or stock. Users can approve a plan, log a portion later, and reconcile its ingredients via 11.

### 14 — Use-up suggestions and personalized swaps

**Priority:** P1. **Depends on:** 11–13. **Owns:** recommendation module and chat suggestion cards.

Suggest meals using remaining ingredients and user-confirmed dates, and offer compatible substitutions tied to a stated goal such as more protein or fewer drink calories. Compare equivalent portions with visible macro differences. Explain the specific ingredient or preference behind each suggestion. Keep notifications outside this ticket; surface suggestions in the app.

**Accept when:** no suggestion claims food is spoiled or wasted from inactivity alone; optional additions are disclosed; swaps respect restrictions, availability, and serving units. A dismissal can be respected without inventing a reason. Stale balances prompt a pantry check rather than false certainty.

### 15 — Replace example nutrition insights with evidence

**Priority:** P1. **Depends on:** 10, 11. **Owns:** `src/features/insights/`, integration patch for Nutrition and You.

Implement deterministic weekly aggregations for drinks, additions such as oil, protein distribution, goal progress, and grocery-to-meal usage. Define minimum evidence and denominators for each insight. Show the date range and underlying records. Use OpenAI only to explain calculated facts, not to fabricate trends or causal claims.

**Accept when:** insufficient history produces an honest empty state; imported/sample records are excluded or explicitly labeled; edits and local date boundaries refresh results. Claims such as breakfast being associated with higher daily protein show supporting days and do not assert causation. You includes a useful weekly review of actual records.

### 16 — Personalized workout generation and progression

**Priority:** P1. **Depends on:** 01, 12, existing workout history. **Owns:** `src/features/workout-planning/`; integration patch for Workouts.

Generate a structured proposal using goals, experience, available equipment, time, explicit constraints, and actual recorded performance. Users choose/approve a plan; starting it enters the existing conversational set logger. Provide exercise substitutions and explain proposed progression using completed sets. Missing recovery/sleep data stays unknown.

**Accept when:** generated plans validate into the current workout flow; users can replace exercises and adjust targets; completed sessions persist. Progression does not invent prior achievements, increase loads blindly, or claim wearable-based readiness without a source. Keep presets as a usable fallback.

### 17 — Voice input for Chat and active workouts

**Priority:** P2. **Depends on:** 01, 23 action envelope. **Owns:** `src/features/voice/`, server transcription adapter.

Implement microphone capture, transcription, and an editable transcript routed through the same meal/workout/chat actions as typed text. Show recording and processing states, cancellation, failure recovery, and keyboard fallback. Define recording limits and temporary-audio deletion behavior. Keep voice synthesis outside this ticket.

**Accept when:** “Got seven” in an active set maps to the same action as typed input; accidental double submit creates one event; cancel releases the microphone. Unsupported browsers and denied permissions remain usable. Confirm ambiguous weights/units rather than silently recording them.

### 18 — Retailer purchase-history/import feasibility

**Priority:** P2 research. **Depends on:** 02. **Owns:** `docs/research/retailer-imports.md`.

Investigate official access for a short list of target retailers: catalog, nutrition fields, authenticated purchase history, digital receipts, exports, permissions, quotas, terms, and partner eligibility. Prove which capabilities exist rather than inferring them from a website. Compare a supported connection with user-uploaded receipts/exports. Do not reverse-engineer private authenticated endpoints.

**Accept when:** each retailer has documented supported/unsupported/unknown capabilities, official links, access requirements, and a smallest buildable follow-up ticket. Public catalog access must not be described as purchase-history access. No integration is marked complete without an authorized working path.

### 19 — Fitness tracker and health-app feasibility

**Priority:** P2 research. **Depends on:** none. **Owns:** `docs/research/health-integrations.md`.

Evaluate official routes for Apple Health/HealthKit, Android Health Connect, and selected tracker services. Record which require a native mobile application, supported read/write metrics, permissions, history windows, review/access requirements, and event identifiers. Design a normalized import contract and duplicate-source policy. Do not assume the current browser app can access native health stores.

**Accept when:** provide a capability matrix and one recommended first integration with a concrete prototype/build ticket. The proposal handles revocation, time zones, duplicate workouts/steps, and source provenance. Exercise calories must not automatically increase food targets without an explicit product decision.

### 20 — Meta Ray-Ban capture feasibility

**Priority:** P2 research. **Depends on:** none. **Owns:** `docs/research/meta-glasses.md`.

Verify current official developer support for the relevant device generation, camera/photo/audio capture, phone companion requirements, supported platforms, developer access, and distribution restrictions. Investigate user-initiated photo sharing as a fallback if direct capture is unavailable. No unsupported always-on recording claims.

**Accept when:** document what is demonstrably possible, what requires access/hardware, and what is blocked. Provide a minimal “capture → phone → Rep & Plate chat” prototype plan or a clearly stated unsupported conclusion with official evidence.

### 21 — Other-agent interoperability: Muse and grokbot

**Priority:** P2 research. **Depends on:** 01; 22 before multi-user writes. **Owns:** `docs/research/agent-integrations.md`, proposed action adapter contract.

First establish the exact products/repositories meant by Muse and grokbot; do not substitute similarly named services. Investigate their supported APIs/protocols. Independently define scoped read access and explicit write actions for Rep & Plate, with authentication, consent, idempotency, audit events, and minimal data sharing. Consider MCP only if it fits verified capabilities.

**Accept when:** supported operations are documented per identified agent, ambiguities are listed for the owner, and a follow-up connector ticket is ready. Demonstration fixtures must show a proposed meal or workout cannot bypass Rep & Plate's confirmation and validation rules. Research can progress without guessing product identity.

### 22 — Accounts, durable storage, export, and deletion

**Priority:** P1 before a shared beta; not a blocker for local feature development. **Depends on:** 01, 02 catalog/refresh policy. **Owns:** persistence/auth adapters and migration tooling.

Begin with a short architecture decision proposing a concrete auth/storage provider and deployment model, including cost and data lifecycle. Implement the selected setup once the owner supplies any necessary account/configuration decision. Keep per-user meals, photos, purchase lots, preferences, and corrections separate from reusable permitted catalog data. Migrate local state through an explicit import with a recoverable backup.

**Accept when:** two users cannot read or mutate each other's records; refresh/device sync, duplicate imports, concurrent edits, logout, export, deletion, and reconnect are tested. Deletion includes relevant media and private caches. Catalog reuse follows its source terms. Public access stays disabled until authentication and authorization are verified.

### 23 — Unified chat actions and feature integration

**Priority:** P0 throughout implementation. **Depends on:** 01; each feature's accepted module before its action is enabled. **Owner:** integrator.

Extend the existing OpenAI/JEV pipeline with a typed action registry for product lookup, purchase review, consumption, preferences, planning, workouts, and reviews. Define pending clarification state and cancellation so replies such as “half a cup” resolve the correct unfinished action. Retrieve relevant full-pantry/history summaries instead of blindly sending all records or only recent receipts. Keep deterministic commands working and expose clear progress/retry states.

**Accept when:** scanning, receipts, text, and voice produce the same validated actions; unsupported actions remain unavailable; instructions embedded in images/pages cannot invoke writes. Each feature is reachable through Chat and its relevant tab. An unrelated question does not overwrite a pending capture, and retries/refresh do not duplicate records.

### 24 — Release verification, quality measurements, and operating limits

**Priority:** P0 throughout implementation. **Depends on:** baseline immediately; accepted features for each milestone. **Owns:** cross-feature tests, `docs/verification/`, release report.

Build reusable fixtures and end-to-end journeys for scan → groceries → meal → deduction → undo; receipt → label correction → rescan; weekly plan → shopping list → portion log; generated workout → conversational sets → review. Test real arithmetic, uncertainty, migrations, injection attempts, missing keys, network failures, provider limits, and isolation when accounts arrive. Record provider latency/calls and AI cost estimates without logging secrets or unnecessary user content. Have the integrator add bounded retry/concurrency/budget controls where evidence shows a gap.

**Accept when:** every released ticket has reproducible checks and evidence; desktop/mobile layouts preserve the references; actual camera/microphone device checks are distinguished from simulation. Live smoke tests are opt-in and use synthetic/authorized data. Measure barcode identity coverage and usable nutrition coverage separately; publish observed results, not a promised 99% rate.

## First three release milestones

### Milestone 1: identify food reliably

Tickets 01–07, plus the relevant parts of 23–24. A user scans a package, sees the product, serving and source, fixes a missing label if needed, and chooses whether it was purchased or eaten. Scans first use the USDA-seeded Rep & Plate catalog; unresolved products use USDA API fallback or label capture. All existing chat behavior still works.

### Milestone 2: connect purchases and eating

Tickets 08–12, plus 23–24. Receipts populate quantities, a meal includes explicit ingredients and drinks, and confirmed links adjust pantry stock with undo. Corrections propagate without changing unrelated history. This is the first complete version of the core product promise.

### Milestone 3: plan and learn from real records

Tickets 13–16, plus 23–24. A weekly plan respects pantry quantities and preferences, proposes a shopping list, and logs portions later. Nutrition insights and workout proposals use actual records. Voice and external connections follow their own readiness gates; 22 is required before inviting users into a shared hosted application.

## Copyable dispatch template

```text
Implement ticket [ID] in docs/AGENT_BACKLOG.md.

Read its dependencies, shared rules, current code, and applicable repository instructions first.
Use the accepted UI and shared contracts. Preserve existing records and Chat as the homepage.
Own only [files/folders]. Coordinate shared-file edits with the integrator before changing them.
Use mocks for routine tests; do not expose keys, publish user data, create paid accounts, or deploy.

Deliver:
1. The working increment described by the ticket.
2. Relevant unit/contract/browser checks with results.
3. A handoff listing changed files, integration points, migration steps, and remaining limitations.
4. Any unresolved dependency with the concrete decision or credential needed.

Do not expand into adjacent tickets. Do not claim completion until the ticket's acceptance criteria pass.
```

## Owner inputs that may be needed later

- USDA key for live API tests. Bulk import, fixture tests, and imported catalog lookups do not require that key.
- Target countries and a representative product sample for the coverage benchmark. Initial working assumption: US first, globally extensible.
- Exact Muse/grokbot links, target retailers, tracker platforms, and glasses model.
- Auth/storage account and hosting choice before shared beta work.
- Whether the software and/or any derived product catalog will be distributed openly; dataset permissions must be evaluated separately from the code license.

These inputs do not block contract design, mocked adapters, the scanner, local pantry work, or research. They are not requests to paste secrets into chat.
