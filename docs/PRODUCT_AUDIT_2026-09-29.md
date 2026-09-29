# Rep & Plate functionality audit — September 29, 2026

## Assessment and scope

Rep & Plate has a substantial working private-beta foundation. It is not yet a seamless, self-service product across web, iOS, and Android. The largest gaps are hosted mobile access, data continuity, account recovery, completion of the shopping-to-cooking loop, and operational readiness.

This review examined the working tree based on `ddc8341`, current production access behavior at repandplate.com, shared domain logic, web and native account flows, planning, and deployment notes. Two existing uncommitted presentation edits in `src/ChatLayer.tsx` and `src/features/spot/spot.css` were preserved. No application behavior, accounts, deployment configuration, or user records were changed by this audit.

Historical readiness documents from September 26 describe several gaps that have since been fixed. They must not be used as the current release checklist without reconciling them with source and live evidence.

## What already exists

- A dedicated first-launch experience introduces Spot, offers account creation/sign-in, collects a name and starting focus, and supports replay. Sign-out returns to the welcome flow.
- Qwen3.5-Flash leads generation, with a bounded OpenAI backup for eligible failures. Jev classifies capture intent. Structured validation, source checks, cancellation, retries, and duplicate-chat protection exist.
- Meal logging and corrections, receipt review, barcode/label capture, pantry quantities, recipe batches and portions, seven-day meal drafts, grocery lists, reviewed receipt spending, workout proposals/logging/history, and meal-based insights exist.
- Account ownership checks, private media storage, manual cloud backup/restore, export, request limits, and approved-beta access exist.

These implementations do not establish representative real-receipt accuracy, physical-phone reliability, or a proven per-user operating cost.

## Five findings worth acting on

### 1. Hosted native access is blocked by the browser preview gate — release blocker

Both EAS build profiles point the mobile app at `https://repandplate.com`. Native bootstrap requests `/api/cloud/config` without the website's invitation cookie. The deployed server applies its preview gate before account authentication, and that gate requires the `rp_preview` browser cookie.

**Reproduced:** fresh requests to production `/api/cloud/config` and `/api/status` both returned HTTP 401 with “Enter your invitation code on the website first.” Native source has no invitation-cookie bootstrap flow. This establishes an endpoint/configuration mismatch; it is not a physical-device test.

**User impact:** a fresh hosted mobile installation cannot reach the intended sign-in/API flow through its current bootstrap path. The previously tested local paired gateway is a different path.

**Completion criterion:** install a signed build on a fresh phone, authenticate, and complete chat and receipt capture against production while keeping the intended access controls. Complete iOS/Android signing and distribution and physical camera, microphone, keyboard, background/resume, and expired-session checks.

Evidence: `mobile/eas.json`; `mobile/src/api.ts:60`; `server/vercel-entry.ts:8`; `server/preview-gate.ts:103`; `docs/context/native.md`.

### 2. An account does not yet provide automatic data continuity — release blocker

Records remain on the current device. Cloud storage is an explicitly uploaded snapshot, restored by replacing the current device's records after review. Signing in does not upload, restore, or merge them. Snapshot uploads also have a 4.8 MB limit, which embedded photos can exhaust. Ownership checks protect existing records, but normal account switching on one installation is not supported.

**User impact:** someone signs in on their phone expecting the meals and plans they entered on the website and does not get them automatically. Losing browser storage can lose changes since the last manual upload.

**Completion criterion:** account-scoped storage, visible save/offline status, reliable automatic persistence, safe conflict handling, photo storage independent of a small snapshot, and tested reinstall/new-device recovery. Retain export and reviewed recovery tools.

Evidence: `src/features/cloud/client.ts:5`, `:46`, `:205`; `src/features/cloud/CloudAccount.tsx:186`, `:409`; `src/YouPage.tsx:969`; `mobile/src/Cloud.tsx:213`.

### 3. The account lifecycle still needs recovery and a public-access decision — public-launch blocker

Signup, password sign-in, and sign-out are implemented. The current UI has no password-reset flow or complete account-deletion flow. “Delete my cloud copy” deletes a snapshot, not the authentication account and all associated data. Native Cloud settings offer an email OTP alternative for existing users; that is not a complete recovery experience across both platforms.

Newly registered users also need explicit beta membership to use hosted AI. This is intentional private-preview behavior, but it is not self-service public onboarding. Previously checked auth settings require email confirmation; actual email delivery, production redirects, and a complete real-user confirmation journey remain unverified.

**Completion criterion:** a real new user can receive confirmation, return to the correct app, use the intended access tier, recover a forgotten password, sign out/in, and delete their account through a clear process. If access remains invitation-only, explain and manage approval as part of onboarding.

Evidence: `src/features/onboarding/useOnboarding.ts:165`; `src/features/cloud/CloudAccount.tsx:291`, `:433`; `src/features/cloud/client.ts:233`; `mobile/src/Cloud.tsx:130`; `supabase/migrations/20260928_beta.sql:50`; `docs/context/beta-hosting.md:24`.

### 4. The receipt → plan → shop → cook loop is implemented in parts but remains incomplete — core product gap

**Confirmed functional gap:** a planned ingredient with `lotId: null` is not reconciled with groceries subsequently purchased. A focused executable reproduction added a matching rice pantry lot with four servings. The saved plan still requested one serving of rice on its shopping list, had incomplete nutrition, and could not log the planned portion. The plan editor can change quantities and substitute another planned meal, but does not provide a reviewed mapping of the missing ingredient to the new pantry item. The same shared calculations serve both platforms.

The fix should offer explicit, unit-aware ingredient matching rather than silently treating same-name products as equivalent. It should also handle replacement stock when an old pantry lot runs out.

**Other limits within this product promise:** plan nutrition can remain partial when ingredients lack confirmed source data. Budget preferences influence suggestions, but the planner does not calculate and enforce a fully priced weekly basket. Receipt-based spending is real; a claim that a whole week costs less than a meal-plan service is not yet demonstrated. Representative receipt/product recognition accuracy has not been established.

Onboarding introduces Spot well but only collects a name and starting focus. Restrictions, household size, cooking time, budget, equipment, and manually editable nutrition targets live elsewhere. A guided first-receipt-to-first-week experience would connect those existing tools. Nutrition targets start from generic defaults. Workout history and proposals exist, but body-weight trends, per-set load recording, and adaptive multi-week training progression do not.

**Completion criterion:** a new user supplies relevant preferences, uploads a real receipt, reviews uncertain products, approves a useful week, buys missing ingredients, connects that purchase to the existing plan, cooks/logs portions, and sees correct remaining stock and trustworthy cost/nutrition coverage. Evaluate this with representative receipts and actual cooking/portion examples, not fixtures alone.

Evidence: `src/features/planning/meal-plans.ts:53`, `:67`, `:93`; `src/features/planning/MealPlanner.tsx:89`; `src/features/shopping/shopping.ts:71`; `server/plans.ts:90`; `src/features/onboarding/Onboarding.tsx:369`; `src/domain.ts:83`, `:105`, `:304`.

### 5. Broader rollout needs measured quality, costs, and operational support — growth readiness gap

Current controls count requests and concurrent work. The reviewed code does not record actual provider token costs, fallback rates, or per-user generation latency as a durable product-level measurement. Platform/provider dashboards may have additional telemetry; their current settings were not audited. We cannot yet state an observed cost per active user from this implementation.

Media deletion is best effort after processing; interrupted uploads can leave private orphan files. Scheduled storage cleanup remains explicitly outstanding. Database cache pruning happens on new admissions, not on a guaranteed retention schedule. The app has an explanatory privacy panel, but no complete published policy/support/account-resolution flow was found in the reviewed app paths.

**Completion criterion:** measure request success, latency, fallback usage, actual provider cost, and first-receipt/first-plan completion without logging sensitive payloads unnecessarily; configure spending alerts/caps; add scheduled cleanup and test failure recovery; provide a clear support route and documented data handling. Run a small real-user pilot to measure receipt corrections, useful plans, and return usage.

Evidence: `supabase/migrations/20260928_beta.sql:53`, `:62`; `server/generation.ts`; `src/platform/capture-upload.ts`; `src/YouPage.tsx:963`; `docs/context/beta-hosting.md:14`–`:18`.

## Verification

- Current audit: 268 unit tests passed; production web build passed; mobile TypeScript check passed; native lint completed with zero errors and 10 existing warnings.
- Current audit: production's cookie-free API access rejection reproduced; missing-plan-ingredient/purchased-pantry mismatch reproduced using the real shared functions.
- Current audit: all 200 web browser tests passed across desktop and mobile viewport projects (3.6 minutes). These are web tests with fixture-backed provider/account flows, not physical native-device or real email/provider accuracy tests.
- Earlier deployment verification established live primary Qwen chat, eligible-failure backup, and cached replay. Those paid provider checks were not repeated for this audit.
- Not established here: physical iOS/Android release behavior, real email delivery, representative receipt accuracy, measured per-user costs, load capacity, or actual meal savings.
- The CYC run recorder could not initialize because the source fingerprint exceeded its 20,000-file/128 MiB limit. This report records the direct audit evidence; no CYC completion is claimed.

## Recommended sequence

Fix hosted mobile access and account data continuity first. Complete account recovery and the purchased-ingredient reconciliation next. Then guide users through their first useful receipt-based week and measure that journey with a small pilot before opening access broadly.

Wearable integrations, retailer checkout, reminders, automatic workout progression, and additional Spot content can expand the product later. Billing becomes necessary when launching a paid tier; it is not required to validate the core free/private beta.
