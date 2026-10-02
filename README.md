# Rep & Plate

## Private preview

[repandplate.com](https://repandplate.com) is behind a server-side invitation-code
gate. Visitors see a coming-soon page; app assets and hosted API access require
the preview cookie. Existing account and beta-membership checks still apply.
See [private preview setup and access](docs/PRIVATE_PREVIEW.md) for code rotation,
local testing, and the explicit public-launch switch.

## Agent connections

Open **You → Connections** to create scoped, expiring access for an external assistant. A shared API, CLI and MCP stdio adapter support permitted nutrition/pantry/preferences/workout context, reviewed meal-log proposals, and proposal status. Meal proposals never count as eaten until you choose **Log this meal**. Connection revocation and duplicate-request protection are built in.

See the [agent setup guide](docs/AGENT_CONNECTIONS.md) for CLI/MCP examples, permissions and deployment requirements. Local agents work with the local web app; native agent management uses a hosted account. The hosted agent migration and deployment must be installed before remote connections work. Individual Muse/Grok Bot integrations are not yet verified.

## Spot

Spot is the shared food-and-training companion in the web and native apps.
The **Chat** tab uses Spot's icon; the central **Scan** button opens barcode scanning directly. Text, photos, screenshots,
voice, and barcode tools remain available. Reviewed meal/workout proposals use
**Spot Check**, and successful saves use a quiet **Logged.** confirmation.

The integration includes a skippable character introduction, Plate/Rep poses,
comeback greeting, empty states, weekly summaries, reduced motion, and optional
illustrations. Workout captures are confirmed into history without replacing an
active session. Past meal dates are preserved when explicitly reviewed. Catch-up
currently handles one capture at a time, not bulk historical reconstruction.

See the [implementation and verification notes](docs/design/SPOT.md) and
[six-pose asset library with its generation prompt](public/images/spot/README.md).

A local fitness application with **Chat as the homepage**. Meals, groceries, planning, questions and workout logging share the same conversation. The four tabs are **Chat, Nutrition, Workouts, and You**, following the supplied mobile references.

See [Agent execution status](docs/AGENT_EXECUTION_STATUS.md) for the honest, per-ticket implementation record and remaining work from the [24-ticket backlog](docs/AGENT_BACKLOG.md).

## Run locally

Requires Node.js 22.14+ (the catalog uses built-in SQLite).

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env` first and configure:

- `QWEN_API_KEY` for chat, images and planning; the default model is `qwen3.5-flash`.
- `QWEN_BASE_URL` defaults to `https://maas.qwencloudapi.com/compatible-mode/v1`. Use the endpoint associated with your key.
- `OPENAI_API_KEY` for voice transcription and one backup generation attempt if Qwen fails. Legacy setups without Qwen also use it for primary generation.
- `AI_FALLBACK_MODEL=gpt-5-mini` selects the backup. Set `AI_FALLBACK_ENABLED=false` to disable automatic recovery. Both attempts share the original time limit and can incur usage charges.
- `JEV_API_KEY` from TypeSafe for the additional intent check.
- `FOODDATA_GOV_API` for USDA live lookup (`USDA_API_KEY` is also accepted).
- Optional `QWEN_MODEL=qwen3.5-flash`, legacy `OPENAI_MODEL=gpt-5-mini`, and `JEV_MODEL=jev-latest`.
- Optional `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for account UI. The publishable key is intentionally public; never substitute a service-role key.
- Optional `SUPABASE_DB_URL` for local database administration scripts only. Use the session-pooler connection on IPv4-only networks.

Provider and database secrets stay server-side. Never give them a `VITE_` prefix. Restart the server after changing `.env`. Open **http://127.0.0.1:5173**.

```sh
npm run build       # Type-check and create dist/
npm start           # Serve build and API on loopback port 5173
npm run preview     # Build preview with API
npm test            # Unit/domain/provider tests
npx playwright install chromium
npm run test:e2e    # Desktop and mobile flows with mocked providers
```

`PORT` overrides the standalone port. The browser app is deployed at [repandplate.com](https://repandplate.com) behind its existing invitation gate. Native builds use the separate mobile project.

## What you can use

1. **Receipt capture:** Attach a grocery receipt in Chat and choose Send to Rep & Plate. The configured AI provider reads it and researches nutrition. Rep & Plate also retrieves USDA candidates for up to three uncertain lines. In purchase details, choose **Review USDA matches** or **Find USDA product**, compare packages and confirm the product, serving and amount. Original receipt text stays intact; suggestions are not exact matches.
2. **Barcode and label capture:** Scan a barcode with the camera, upload a barcode image or enter its digits. Rep & Plate checks a private confirmed correction, its USDA catalog and then the USDA API. Compare matching packages; if needed, photograph the nutrition label and review the extracted values. Choose explicitly whether you bought the item or ate it.
3. **Pantry and consumption:** Review quantities, adjust stock and confirm ingredients used. Package and opened dates are editable; in-app reminders organize recorded dates without determining safety or discarding food. Linked consumption deducts once and supports undo. Unknown amounts stay unknown. **Purchases and plans never count as eaten food.**
4. **Meals and drinks:** Review the estimate and **What's in this estimate** ingredient breakdown before adding intake. Milk, syrups, oil and sauces can appear separately; totals are summed by code. A logged meal offers **Which pantry ingredients did you use?** with possible matches and explicit amounts. Linking changes stock without adding calories again.
5. **Preferences and weekly meals:** Chat proposes preference changes with quoted evidence and explicit Save/Not now. Generate seven days of any selected breakfast/lunch/dinner/snack slots, review shortages, edit meals, and save. Repeat an approved week as a new draft without rewriting history or logging food. Logged portions remain protected against duplicate retries after refresh. There is no background recurring scheduler.
6. **Nutrition and review:** Daily totals, insights and weekly review use saved records. Clearly identified drink/oil/sauce/syrup components support recorded-calorie summaries with meal/portion evidence. Insufficient or inconsistent data is qualified; sample records do not establish personal patterns.
7. **Workouts:** Request an AI proposal using completed recorded history, review previous loads/reps, and edit exercise names, sets and targets. In an active session, logged work is protected: name/weight lock once sets are recorded, and logged sets cannot be truncated. No automatic load increases or unconnected recovery claims.
8. **Voice:** Start recording explicitly, stop within a minute, review/edit the transcript and press Send. The same reviewed text enters Chat or the active workout logger. Rep & Plate does not save the raw audio; transcription sends it to OpenAI.
9. **Account and backup:** After sign-in and explicit linking, both apps automatically save account records, restore a fresh device and expose offline/conflict status. Conflicting copies require review; they are not merged silently. Account switches keep separate device archives. You includes export/import, recovery, verified password changes and account deletion. Guest records remain on the device. Actual confirmation/recovery email delivery is a separate release check.
10. **Recipes and leftovers:** Open **Recipes & leftovers** from Chat or type “recipes.” Confirm ingredients actually used and the batch yield. Preparation moves raw ingredients out of the pantry without logging intake. Record fractional portions when eaten; undo restores prepared portions, and undoing preparation restores raw ingredients only after logged portions are reversed. Nutrition stays tied to preparation snapshots. Tell Chat how many portions of a saved batch you ate to review a confirmation card; acceptance logs once and updates leftovers without deducting raw ingredients again.

Chat opens by default. AI replies can offer buttons to open the pantry, recipes, meal planner, preferences or workout builder. These buttons only open review tools. Resetting or restoring records cancels pending AI so late results cannot repopulate old data or keep Chat waiting. Existing demos remain separate from real processing; camera/voice have permission and unsupported-browser fallbacks.

## Connected tabs

Nutrition shows today’s saved meals inline with editable records, shared calorie/macro totals, and direct pantry, meal-plan, and recipe tools. Pending Chat estimates do not count until accepted. Existing example meals are labeled and can be removed through the meal editor.

Workouts shows recorded prior sets and recent finished sessions instead of sample personal progress claims. Browsing other plans preserves the active session and provides a resume action. Starter plan loads remain explicitly labeled example targets.

You brings together pending meal estimates, preference changes, prepared portions, receipt checks, and saved-note reviews. Review actions open the original Chat message or receipt without accepting it. Confirmed/dismissed reviews, available pantry quantities, and recipes/leftovers remain accessible from the same page.

## USDA catalog

USDA is the only external structured food database. Open Food Facts is not used. Source nutrition retains its per-serving, per-100 g or per-100 mL basis; missing nutrients remain null. Conversions do not invent density. Exact barcode matches can still have multiple package/formulation records requiring review.

The local April 2026 release import processed 455,458 records: 441,554 imported, 13,904 skipped and zero malformed. The SQLite database lives in ignored `.fuel-data/catalog.sqlite`; it is local generated data, not a checked-in asset. A fresh checkout needs an import or API lookup to populate its own catalog.

```sh
npm run catalog:import -- --file /path/to/unzipped-official.json --release 2026-04 --dry-run
npm run catalog:import -- --file /path/to/unzipped-official.json --release 2026-04
npm run catalog:benchmark
```

Download the official Branded Foods JSON from [USDA downloads](https://fdc.nal.usda.gov/download-datasets/) and unzip it first. The importer streams `BrandedFoods`, commits bounded batches, tracks content/release checkpoints and preserves historical versions. Repeating the same input resumes or returns the completed report. `--batch`, `--limit` and `--catalog` are available; `--help` explains them. No API key is needed for import. A limit processes only that many additional rows and leaves the release incomplete.

Lookups use indexed canonical GTIN, bounded candidates, a 30-day fetched-record freshness window, shared in-flight calls and a short miss cache. Stale saved data is labeled when refresh fails. Catalog updates do not change previously saved meal snapshots. A representative target-market coverage study remains outstanding; no coverage percentage is promised.

## AI and data boundaries

Qwen interprets captures and returns proposals that the server validates; JEV checks grocery/meal/conversation intent, not nutritional accuracy. Application code validates records, calculates quantities/totals and controls confirmation. Retrieved sources are evidence, not guaranteed product matches. Image, receipt and website text are untrusted data and cannot authorize writes by themselves. See [provider configuration and verification](docs/context/ai-providers.md) for Qwen API differences and limits.

Receipt extraction is bounded to 40 items with an omission notice; check long receipts for completeness. Research uses at most eight tool calls. Chat sends bounded recent conversation and useful available pantry context, not every stored image. Whole-pantry retrieval improves on the original last-five-receipts approach, but context remains bounded. Exact-image deduplication does not recognize every different photograph of the same receipt.

Provider calls show errors/progress and require explicit retries. Completed chat request IDs have a ten-minute in-memory retry cache; confirmed record actions are idempotent. Audio transcription has separate size, rate, concurrency and timeout limits. Browser recording stops at 60 seconds.

Browser histories and photos use IndexedDB, with a small-record refresh journal and best-effort localStorage compatibility mirror. Linked account records save automatically with revision checks; saved photos use immutable private storage. Check account-saving status before switching devices. Clearing site data removes the device copy. Storage exhaustion is reported. Preferences, product corrections and pantry events persist with records. The shared USDA SQLite catalog contains no private label corrections or user photos.

Live messages/images and relevant context are sent through the server to QwenCloud when Qwen is configured, or OpenAI in legacy setups; limited extracted classification context is sent to TypeSafe. Voice transcription uses OpenAI separately. Responses requests use `store: false`, which is not a guarantee of zero provider retention. Transcription/provider account retention terms still apply. Secrets are excluded from browser bundles and version control. Loopback request boundaries, body/rate/concurrency limits and redacted errors do not replace hosted authentication and per-user budgets.

Official references: [USDA API guide](https://fdc.nal.usda.gov/api-guide/), [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search), [OpenAI transcription](https://developers.openai.com/api/docs/guides/speech-to-text), [TypeSafe API](https://docs.typesafe.ai/api).

## Cloud setup status

Automatic account continuity, private saved media, optimistic revision checks and account lifecycle are implemented. Historical hosted checks and migration ordering are documented in [readiness repairs](docs/READINESS_REPAIRS_2026-09-29.md) and [account lifecycle](docs/context/account-lifecycle.md). Those results do not verify a newly changed deployment. Real confirmation/recovery email delivery remains a release prerequisite.

Once a working administration connection is configured:

```sh
npm run db:setup
npm run db:verify
```

The original setup script applies `supabase/migrations/20260925_fuel.sql`; current deployments also need the additive readiness/account/sync/operations migrations and any enabled assistant-connection migration. Follow the linked readiness and feature runbooks rather than treating the original setup as the entire schema. Recurring account UI tests mock Supabase. Historical live scripts use temporary or cleaned-up synthetic data. Individual-record conflict merging is not implemented: the user reviews which complete copy to keep. Older [storage research](docs/research/storage-architecture.md) describes design history, not current operating instructions.

## Verification and remaining scope

Dated results, failures and limits are retained in the [five-persona audit](docs/audits/2026-09-30-personas/report.md) and [remediation evidence](docs/audits/2026-09-30-remediation/). Run the commands above on the current checkout; historical test counts do not certify a changed tree. Browser tests use controlled providers and isolated records. Physical-device behavior, real email delivery, representative receipt accuracy and provider operating costs require separate release evidence.

External retailer histories, trackers, native health stores, Meta glasses and Muse/grokbot connections are **not implemented**. Their [research reports](docs/research/) identify supported directions, access requirements and unanswered questions. Remaining food work includes measured receipt/USDA coverage, richer ingredient matching and raw/cooked conversions, background reminders and unattended recurring schedules. Missing meal logs never imply waste.

## Code map

- `server/ai.ts`, `src/ai-contract.ts`, `src/ai-client.ts`: AI capture, grounding and validated state transitions.
- `server/products/`, `scripts/import-usda.ts`: USDA adapter, versioned SQLite catalog, resolver and import.
- `src/features/scanner/`, `labels/`, `products/`: barcode, label review and explicit purchase/meal actions.
- `src/features/pantry/`, `meals/`: quantities, events, components and reconciliation.
- `src/features/preferences/`, `planning/`, `insights/`, `reviews/`: preferences, full-day/repeated plans, comparisons and real-record summaries.
- `src/features/workout-planning/`, `voice/`, `server/plans.ts`, `server/voice.ts`: proposed workouts, planning and reviewed transcription.
- `src/features/cloud/`, `src/platform/`, `supabase/migrations/`: automatic linked-account saving, local archives, private media, conflict review and account lifecycle.
- `src/App.tsx`, `ChatLayer.tsx`, `NutritionPage.tsx`, `WorkoutPage.tsx`, `YouPage.tsx`: existing UI and feature integration.

## Assets

Fonts are bundled locally: **DM Sans** and **Lora**, distributed under the SIL Open Font License. Food and gym photographs are illustrative stock photography downloaded from Unsplash; they are not actual meal evidence.

- Bowl: https://images.unsplash.com/photo-1547592180-85f173990554
- Breakfast: https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38
- Gym: https://images.unsplash.com/photo-1534438327276-14e5300c3a48

The local server binds only to `127.0.0.1` by default. The latest hosted release and verification are recorded in the [deployment report](docs/audits/2026-09-30-round-2-remediation/deployment/report.md).

### Generated chat photo

The dinner photo is saved at `public/images/chicken-dinner.png` and was generated with the built-in image-generation tool as a replacement for the unrelated stock sample. It is an illustrative demo asset.

Generation prompt: “Use case: photorealistic-natural. Asset type: square food photo embedded in a fitness chat app. Create one realistic, casual smartphone photograph of a home-cooked dinner on a pale ivory ceramic plate: sliced golden grilled chicken breast with char marks on the left half, steamed bright green broccoli florets at the top, a neat serving of white rice on the right bottom, and a very small amount of light sauce. Close three-quarter overhead view, plate fills most of the frame, pale white marble countertop slightly visible at the edges. Natural window light, appetizing warm detail, real food textures. No text, no UI, no icons, no frame, no utensils, no decoration, no watermark. Square composition.”

### Generated smart-swap photos

`public/images/nutrition-swaps.png` is a four-tile photographic atlas created with the built-in image-generation tool. CSS displays each tile directly; the original asset is not edited. The tiles illustrate a blended coffee, iced Americano, ranch dressing, and salsa.

Generation prompt: “Create a perfectly aligned 2 by 2 photographic contact sheet, a square image split into four equal square photo tiles, NO gutters, NO borders, NO text or labels. These are four image thumbnails for a nutrition app, each photographed at a slight three-quarter overhead angle on a warm light neutral stone tabletop. Top left tile: one clear tall takeaway cup of pale caramel iced blended coffee with a generous swirl of whipped cream on top, no logo. Top right tile: one clear short tumbler of black iced americano coffee with visible ice cubes, no logo. Bottom left tile: one small round white ceramic ramekin filled with white creamy ranch dressing, subtle green herb flecks. Bottom right tile: one small round white ceramic ramekin filled with chunky red tomato salsa and tiny green herb pieces. Center each object precisely within its own tile with generous 15% empty margin around it so it fits completely. Soft natural daylight, realistic food photography, warm pale beige-gray background, gentle shadows, consistent camera scale, high detail. No utensils, hands, napkins, extra objects, packaging logos, words, watermarks or typography.”

### Workout selection and conversation

`src/WorkoutPage.tsx`, `src/workouts.ts`, and `src/workouts.css` implement the plan selector and active workout conversation. Upper Body, Lower Body, and Full Body are sample plans. Start a plan to track real set counts, tap reps, send “Got 8,” correct the most recently logged exercise with “Set 2 was 7,” or edit a recorded set. Complete the session to save it; previous sessions remain available from the workout menu. Weight and target adjustments are available before the first set of an exercise is recorded. Voice opens the reviewed transcription flow and applies confirmed text to the active workout logger.

`public/images/workout-atlas.png` is an illustrative six-tile photographic atlas generated with the built-in image-generation tool. CSS selects individual tiles without editing the image. Prompt: “Create a single photographic contact sheet asset for a polished mobile fitness application. Exactly 2 columns and 3 rows, six equal square tiles touching edge to edge, no gutters, no text or graphics. Overall 2:3 aspect ratio. Muted neutral gym photography, natural daylight, realistic anatomy and equipment, premium editorial style. Top left: close-up black hex dumbbells on a padded bench with towel and blurred water bottle. Top right: adult athletic man doing barbell bench press on flat bench, side view, full arms visible. Middle left: adult athletic man doing incline dumbbell press on inclined bench. Middle right: adult athletic man seated at cable row machine pulling handle toward torso. Bottom left: adult athletic man doing standing cable triceps pushdown. Bottom right: adult athletic woman doing goblet squat holding single dumbbell. Each tile independently composed with subject centrally located to remain readable as small square crop. No logos or text.”

### Your space

The fourth tab opens `#you`, a full page using the same Rep & Plate header, navigation, colors, and card styling. `src/YouPage.tsx` and `src/you.css` bring together pending and completed reviews, editable daily goals, meals and captures, actual workout history, profile preferences, and data/privacy information. Existing `#review` links open the same page. Reviews and meal corrections use the existing shared state; revisiting or refreshing does not duplicate resolved records. Chat remains the default homepage. The history panels include saved records only; no fictional wearable activity is added.
