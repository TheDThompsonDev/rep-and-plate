# Rep & Plate: from capable prototype to a product people can rely on

September 26, 2026. This is an audit and proposed direction, not a claim of production readiness or approval to ship. It follows inspection of the current source and clean mobile Nutrition/You screens. The previous implementation passed 196 unit tests and 150 browser checks; those checks do not establish real-world nutrition accuracy, user retention, or deployed security.

## Current visual direction — September 26 revision

The user rejected the first journal concept as plain and forgettable. Their chosen direction is **the original design, with more finesse and a more inviting scroll**. Preserve the white/mint/emerald palette, sans-serif type, rounded shapes, food photography and friendly leaf/avatar details. Refine hierarchy and continuity rather than replacing the personality. This supersedes the journal recommendation below; the readiness findings remain applicable.

The revised [interactive concept](design/nutrition-you-concept.html) follows Nutrition from daily summary to meals, planning and a specific review prompt. You moves from personal progress into the week, reviews and settings. Mobile uses one document scroll with persistent navigation. The HTML study's example and new-user states are explicitly fictional and do not save data. See [refinement notes](design/REFINEMENT.md) and subsequent implementation status below.

**Subsequent approval and implementation:** The user approved the refined concept and asked to implement it. Nutrition and You now adopt this direction using personal records, existing actions, and one scroll container per surface. You uses recorded activity in place of the concept's fictional weight graph. See [implementation decisions](context/nutrition.md). The remaining release gaps in this audit still apply; visual refinement alone does not establish production readiness.

## The product promise

**Tell us what happened. Understand what to do next. See whether your habits are helping.**

Assumed first cohort: adults who want to record food and strength training, with weight change as an optional goal. Do not assume everyone wants weight loss. First test a complete seven-day experience with a small invited cohort, rather than requiring every possible tracker, retailer and wearable integration.

The app has useful parts. Its missing connection is a continuous loop: understand this person → establish their plan → capture real activity → review uncertainty → show changes over time → adjust the plan together. Chat should connect those steps, while the tabs provide durable records and controls.

## What is actually static?

| Area | Working in the current code | Preset, missing, or unproven |
| --- | --- | --- |
| Chat | AI conversation, image/receipt proposals, confirmations, edits, source information, voice capture, linked actions | Representative accuracy evaluation, durable request recovery, long-term user memory, production cost/reliability monitoring |
| Nutrition | Personal daily totals, date rollover, editable diary, seven-day logs, pantry, meal planning, recipes and record-based insights | Starter targets are generic; no onboarding to establish appropriate targets; no meaningful longer-range outcome tracking. Repeated empty sections look like placeholders even when their counts are real. |
| Workouts | Actual set logging, conversational session, history, substitutions, AI workout proposals informed by completed sessions | Landing selection leads with fixed plans and example weights. No complete weekly progression program, stable exercise identity, per-set weight model, or equipment/experience-led first session. |
| You | Personal name/targets, pending and completed reviews, history counts, account/backup controls | Default name/targets, generic profile copy, no personal goal/weight trajectory. Too many unrelated tools have accumulated here. |
| Barcode / groceries | USDA lookup, label fallback, serving confirmation, purchase distinct from intake, inventory reconciliation | Physical-camera/device coverage, representative package-match coverage, robust raw/cooked/package conversions, operational catalog refresh |
| Account / storage | Supabase sign-in and private snapshot save/restore with revision checks; migration includes RLS | Manual backup is not automatic sync. Photos live in a bounded local snapshot. Shared-device account separation, continuous saves, media storage, migration/recovery and conflict handling need a production design and tests. |
| Hosting | Working local web app and bounded API routes | Server binds to loopback and API allows local hosts only. Public deployment, authenticated API authorization, per-user budgets and operational ownership are release work. Do not simply remove the localhost checks. |

Evidence locations: `src/domain.ts` (starter state and schema); `src/workouts.ts` (`workoutPlans`); `src/WorkoutPage.tsx` (sample target disclosure); `src/features/workout-planning/WorkoutBuilder.tsx` (generated proposals); `src/NutritionPage.tsx`; `src/YouPage.tsx`; `src/features/cloud/client.ts` (manual snapshots and 4.8 MB limit); `src/App.tsx` (whole-state localStorage persistence); `server/http.ts`; `server/index.ts`; `supabase/migrations/20260925_fuel.sql`.

## Why the UI feels generic

Observed on a clean 390 × 844 browser viewport:

- **You repeats the same message.** “Your space, your pace,” a profile reassurance, a weekly empty summary, “You’re all caught up,” and another empty review card precede useful settings. Reassurance has become content filler.
- **Nutrition repeats the same request.** Scan, next-step copy, an empty meal card, empty insights and empty swaps all ask for data. A new user gets several incomplete sections rather than one confident beginning.
- **Hierarchy is too flat.** Rounded pale cards, colored icon circles and chevrons make unrelated actions look equally important. A saved meal, a suggestion and an account setting should not have the same visual treatment.
- **The app is organized around accumulated features.** Pantry/recipes/plans appear across surfaces while You combines reviews, archives, goals, account management and marketing copy.
- **Density and flow need deliberate rules.** Some support text is 8–12px; important destinations open modal after modal. “Fluid” should mean fewer decisions, predictable back behavior, retained scroll/drafts, and continuity from a Chat action into its record.

Keep the green identity, clean background, conversational home and central scanner. Refine the composition instead of replacing the brand with a fashionable template.

## Three directions considered

| Direction | Good for | Tradeoff | Cheapest useful experiment |
| --- | --- | --- | --- |
| Personal journal — original proposal, visual direction rejected | A chronological food record and a recognizable personal progress page; quiet, readable, works with little data | Lost too much of the original personality in the first concept | Superseded by the original-design refinement above |
| Coach-led feed | A single prioritized prompt: finish review, plan dinner, resume workout | Can duplicate Chat and make users feel managed; ranking must be trustworthy | Compare a one-task feed with journal navigation using the same five tasks |
| Athlete dashboard | Dense macro/training analysis for experienced users | More complexity, less useful for beginners, exposes missing measurements | Test only if the first cohort explicitly asks for detailed trend analysis |

Predicted advantages are design judgments, not observed usability results. Only the journal direction is prototyped here; the other two are conceptual alternatives.

| Shared criterion | Personal journal | Coach-led feed | Athlete dashboard |
| --- | --- | --- | --- |
| Find and correct a record | Chronological list; direct correction | Record may move down the feed | Direct table/list access, more controls |
| Understand progress with sparse data | Can show honest single entries | Risks filling gaps with generic advice | Many charts remain empty |
| Preserve Chat as the action home | Clear record/action separation | Competes with Chat for attention | Complements Chat, but increases interpretation work |
| Scope before a beta | Consolidate existing records and add goal model | Needs a trustworthy recommendation/ranking layer | Needs richer time series and advanced filtering |

Self-review challenge: removing empty cards must not hide real pending reviews; keep a count and a reliable entry point. Progress must work without weight tracking. Fixed templates can remain useful as clearly chosen templates, but must not masquerade as personalized prescriptions. A journal aesthetic alone cannot solve missing account durability or training progression.

## Proposed screen responsibilities

**Chat — do things.** Log, ask, correct, plan and resolve uncertainty. Use compact action receipts; preserve a visible link to the resulting meal/workout. Confirm consequential changes and offer undo.

**Nutrition — understand today.** A date switcher, one clear total with target provenance, quiet macro bars, then a chronological meal list. Keep scan easy to reach, but avoid three competing “log” prompts. Put Pantry, Recipes and Meal plan behind one well-labeled food-tools entry. Show an insight only when there is enough evidence; missing days remain unknown.

**Workouts — know what comes next.** One planned session based on chosen schedule, time and equipment, with alternatives below. “Start” opens the existing conversational logger. A returning lifter sees actual previous work; a beginner sees a setup flow, never an assumed 185 lb bench. Add a coherent week before complex recovery scoring.

**You — understand your direction.** Optional goal and progress, one weekly reflection and one compact “Needs your check” row when needed. Weight is optional and can be hidden; provide strength/consistency goals too. Put account, units, notifications, preferences, data export and deletion behind settings. Move food tools to Nutrition and session archives to Workouts. Preserve existing routes and pending reviews during this reorganization.

Concept: [Nutrition and You interactive study](design/nutrition-you-concept.html). All populated values are labeled fictional examples. New-user mode shows honest empty states. It does not implement weight tracking, persistence, scanning, or account settings.

## Ordered work packages

Each package should ship as a complete user journey with empty, loading, successful, failed, correction and return states. Owners below are suggested responsibilities, not newly dispatched agents.

| Order / package | Concrete scope | Dependency | Done when |
| --- | --- | --- | --- |
| **P0 · Personal setup** | Name, units, timezone, optional goal, equipment, experience, available days/time, food preferences; explicit review of target source and ability to skip sensitive questions | Product decisions on first cohort and goal types | A new user sees their own plan; no seeded identity, invented history or template weight is presented as personal. Setup can be resumed and edited. |
| **P0 · Account and durable records** | Authenticated ownership, automatic saves, separate record IDs/revisions, migration from local snapshots, secure photo storage, offline queue, conflict/retry states, visible save status | Stable schemas and identity boundary | Two devices converge without duplicate/lost meals; sign-out/account switch cannot expose the prior account’s local data; interrupted writes and migration preserve edits. |
| **P0 · Public service boundary** | Staging/prod separation, HTTPS deployment, token validation for paid/private routes, per-user usage controls, durable idempotency, provider timeouts, secret handling, sanitized logs, backup/restore practice | Account identity; selected hosting | Anonymous/other-user requests fail; replay never double-logs or repeats a billed action unnecessarily; quota/outage leaves a recoverable draft. Hosted smoke and restore checks pass. |
| **P0 · One personal training week** | Persisted chosen program/schedule; editable generated session; exercise IDs; weight/reps per performed set, warm-up vs working sets, rest timer, units, skip/substitute; grounded last-time comparison | Personal setup; durable records | Beginner can complete a first session without assumed loads; returning user can log different weights across sets, resume after interruption and review accurate history. Adaptations never rewrite performed work. |
| **P0 · Reliable food capture** | Representative real receipts/barcodes/photos/drinks; portion and package identity; unit/raw-cooked handling; correction/undo; unknown nutrition visible | Existing USDA/capture workflows; durable records | Proposed evaluation set of at least 50 locally relevant packaged foods and 20 varied receipts is reviewed; exact product/serving errors are categorized; uncertain matches cannot silently become confirmed intake. Set acceptable accuracy thresholds before evaluating. |
| **P0 · Optional outcome tracking** | Goal type, dated weight entries or strength/habit outcomes, unit conversion, edit/delete, trend with data coverage, weekly reflection | Personal setup; durable records | User can see a real change across weeks and correct an entry. Sparse data produces no invented trend, prediction or deadline. No weight-loss messaging for users who choose another goal. |
| **P0 · Screen consolidation** | Implement the chosen Nutrition/You structure, move duplicate tools, preserve deep links, contextual reviews, readable type, keyboard/focus/back behavior and reduced motion | Chosen direction; shared records | Five first-time testers can log/correct a meal, find yesterday, resume a workout, find a review and change targets without developer instructions. Record failures and revise; a polished screenshot alone does not pass. |
| **P0 · Beta operations** | Error/cost/latency monitoring without logging sensitive content by default; feedback with optional diagnostic attachment; privacy/data-use explanation; export/delete; support contact; accessibility and physical-device checks | Public service; all core journeys | Selected iPhone/Android devices pass camera/mic/keyboard/permission tests; account recovery, export and deletion exercised; operator can identify failures and pause costly features. Policy review matched to chosen markets before release. |
| **P1 · Helpful adaptation** | Week-to-week training adjustments, user-approved food suggestions, pantry meal reuse, reminders with preference controls, richer provenance and explanations | Several weeks of trustworthy records; evaluated rules | Suggestions cite actual records and uncertainty, can be declined, and produce reversible changes. Missing logs do not become claims of skipped meals, waste or poor recovery. |
| **P2 · Integrations and breadth** | Health platforms, wearables, retailer accounts, glasses, authorized agent connections | Demonstrated user demand, official access and consent model | Start with one integration requested by the cohort; show sync freshness, source and duplicate handling. Broad integrations are not prerequisites for a useful first release. |

Parallelization: screen components and evaluation fixtures can proceed alongside service work once the record/action contracts are agreed. Keep schema/migration/auth ownership coordinated; do not send agents to independently reinvent each tab’s state. Integrate one complete journey at a time.

## Release gates

**Ready for facilitated usability testing:** a coherent preview and task script are enough. Tell participants which data and actions are simulated. The concept attached to this document qualifies only as a design test artifact.

**Ready for an invited product beta:** a new account can establish a plan, log/correct real food, finish/resume a workout, return the next day, retain records across devices, inspect a week, and get help during an error. All P0 journeys above must have measured evidence. Physical scanning and real-provider behavior must be checked separately from mocked browser tests.

**Ready for a wider launch:** beta task failures and support issues are addressed; reliability and cost are measured over real usage; recovery/deletion procedures work; compatibility/accessibility/privacy checks cover the chosen audience. There is no meaningful single “percent complete” before those gates are defined.

The next implementation slice I recommend is **personal setup → one personal training week**, while durable accounts/service deployment proceed against the same identity model. Refine Nutrition and You around this shared person/goal model; otherwise a visual rewrite will still sit on generic defaults.

## Test the design before adopting it

Use five adults with varied experience as an exploratory usability group, not a statistically representative outcome study. Give tasks without naming the controls: “Correct your breakfast,” “Find what you logged yesterday,” “See whether this week differs,” “Find something needing clarification,” and “Change a goal without changing today’s food.” Observe completion, wrong turns, help needed and confidence. Ask what each number means. Compare with the current app before choosing the final direction.

Concept checks can prove interactions render and fit, not that people find the experience natural. Keep design preference separate from task success.

Executed for this exploration: the isolated study passed browser checks at 320px, 390px and 1100px for horizontal fit, example meal correction, date/week navigation, weight/strength switching, review opening and new-user states. No API calls, storage changes or page errors were observed. Desktop and 320px screenshots were inspected. No production application code was changed; its full regression suite was not rerun for these document/concept files. No participant usability test or live service/camera test was performed.

## Reference constraints

- Database ownership and production configuration need explicit review even with a managed backend. Supabase’s [production checklist](https://supabase.com/docs/guides/deployment/going-into-prod) and [RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) support authorization testing; existing RLS code is not evidence of a verified current deployment.
- Use comfortably sized primary touch controls (44px is our design target), readable text and visible focus. WCAG 2.2’s AA target-size criterion is 24 CSS pixels with specified exceptions; do not mislabel 44px as that requirement. See [W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum). Full accessibility conformance needs more than target-size checks.

No medical target formula, clinical efficacy claim or legal compliance certification is established by this audit. The numeric examples in the concept demonstrate layout only.
