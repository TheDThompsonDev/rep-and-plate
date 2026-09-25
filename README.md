# Fuel

A local fitness application with **Chat as the homepage**. Meals, groceries, and questions share the same conversation. The four tabs are **Chat, Nutrition, Workouts, and You**, following the supplied mobile references.

## Run locally

Requires Node.js 22.12+.

```sh
npm install
```

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` and `JEV_API_KEY`. JEV keys come from the TypeSafe console. Optional `OPENAI_MODEL` and `JEV_MODEL` default to `gpt-5-mini` and `jev-latest`. Keys are read by the server only; never use a `VITE_` prefix for secrets. Restart the server after changing `.env`.

```sh
npm run dev
```

Open **http://127.0.0.1:5173**. Without an OpenAI key, the existing manual and sample flows remain available. JEV supplies an additional classification check; a missing or failed check leaves grocery items needing review.

```sh
npm run build      # Type-check and create dist/
npm start          # Serve the build and API on local port 5173
npm run preview    # Alternative build preview, also includes the API
npm test           # Domain, AI state, grounding, and HTTP tests
npx playwright install chromium
npm run test:e2e   # Desktop and mobile interaction tests
```

`PORT` overrides the standalone server port. The browser application is not a native mobile build.

## Try the core loop

1. **Receipt capture:** In Chat, attach a JPG, PNG, or WebP grocery receipt and choose **Send to Fuel**. Add optional context such as the store or an unclear product name. Fuel reads the receipt, searches for product nutrition, and returns a grocery card with sources and uncertainties. Images up to 12 MB are accepted; larger uploads are compressed before sending and must fit the final request limit.
2. **Groceries and pantry:** Open the card, Chat menu → Your groceries, or You → Groceries & pantry. Review quantities, serving sizes, and macros; correct details and mark ingredients used. Cart totals include only items with supported serving counts and details that do not need review. Unknown values stay blank. **Purchases never add calories to daily intake.**
3. **Meal ideas:** Ask “What can I make with these?” for suggestions using available saved ingredients. Suggestions do not log a meal or silently consume pantry stock.
4. **Meal capture:** Describe or photograph food or drinks you consumed, including milk, syrups, oil, and sauces. Fuel may ask about portions or show an estimate. Tap **Add to Breakfast/Lunch/Dinner/Snack** to count it. Saved meals remain editable.
5. **Nutrition:** The calorie ring and macro totals reflect saved meals. Insight cards and smart swaps are still labeled illustrative examples, not learned conclusions about your real history.
6. **Workouts:** Choose Upper Body, Lower Body, or Full Body, then start its workout conversation. Tap reps, type “Got 8,” correct a set, and finish the session. “Bench was 185 for 8, 8, 7” also uses the existing local parser. General AI workout advice does not automatically alter a plan.
7. **You:** Review pending captures, edit targets and profile preferences, and inspect saved meals and workout history. Resetting local data requires confirmation.

Chat opens by default. The sample dinner and takeout conversations remain available in the Chat menu and are distinct from live AI processing.

## AI processing and boundaries

- **OpenAI** reads text/images, researches the web, and returns validated structured data. Retrieved source links are shown in chat and product details. Model-written URLs without retrieval evidence are excluded. A retrieved URL is evidence of a lookup, not a guarantee that the product or nutrition matches; package labels and user corrections take precedence.
- **JEV / TypeSafe** checks whether the current evidence describes groceries, a consumed meal, ordinary conversation, or ambiguity. It receives the message, limited recent context, and extracted item names rather than the image. The integration uses `https://api.typesafe.ai/v1/systemone` with Bearer authentication. Its classification confidence does not verify nutritional accuracy.
- **Application code** validates results, separates purchases from consumption, computes totals, and requires confirmation before adding an AI meal. A confident conversation classification suppresses record creation. Other confident classification conflicts hold records for clarification.
- Nutrition is per serving. Whole-purchase totals require a known number of servings. Nonfood lines have no nutrition. Generic estimates and uncertain matches need review; missing values are never replaced with zero.
- Receipt and website text are treated as untrusted data. The AI has no account, device, filesystem, or arbitrary execution tools.

The current capture limit is 40 receipt items, with a notice when additional extracted lines are omitted. The model is instructed to flag unreadable or additional lines; check long receipts for completeness and split them into sections. Research is limited to eight tool calls per request. Context includes up to 12 preceding AI messages and the five most recent grocery captures, with used items excluded from meal ideas. These limits mean a large pantry or receipt may require a follow-up.

Requests show progress, time out after approximately three minutes, and can be retried explicitly. Completed request IDs are cached in server memory for ten minutes to avoid repeating provider calls on a retry. Client updates and meal acceptance are idempotent. Identical uploaded image bytes are fingerprinted to avoid duplicate grocery records; a different photograph of the same receipt is not automatically recognized as a duplicate.

Official references: [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [image inputs](https://developers.openai.com/api/docs/guides/images-vision), and [TypeSafe API](https://docs.typesafe.ai/api).

## Local data and privacy

Saved records and images live in this browser's `localStorage` under `fuel.prototype.v1`, validated by Zod. They do not sync across browsers, ports, or devices. Clearing site data removes them. If storage fills, the app warns that changes may not survive refresh. Existing user records are preserved by the chat migration.

Sending a live AI message transmits its content, optional image, and relevant saved context through the local server to OpenAI, with the limited classification context sent to TypeSafe. OpenAI requests use `store: false`; this is not a claim of zero provider retention. Provider account terms and retention settings still apply. The server keeps completed results in memory for the short retry window, and does not write application conversations to a database.

API keys remain server-side and are excluded from browser bundles and `.env` version control. The server binds to `127.0.0.1`, rejects cross-origin browser API requests, limits request size and concurrency, and returns redacted provider errors. This is a local prototype without user authentication. Public deployment needs authentication, per-user authorization/storage, persistent usage controls, and a deployment-specific privacy design.

Daily totals follow the device's local calendar date. Initial sample meals are seeded on first use; they remain on their original date as the calendar advances. Active workouts persist across refresh; completed sessions are archived when starting another plan.

## What is still a prototype?

Historical nutrition insights, smart swaps, starting meal examples, and suggested workout plans are illustrative. AI estimates are editable and may need clarification. Voice transcription, wearable connections, retailer account imports, cloud synchronization, notifications, native share sheets, and automatic pantry depletion are not connected. Missing meal logs do not imply food was wasted. Future integrations should use supported provider APIs and explicit user connections.

## Validation and code map

Automated browser tests mock AI endpoints so they do not spend API credits or send test data to providers. Live smoke checks used a synthetic grocery receipt to exercise actual OpenAI image reading, web research, TypeSafe classification, browser persistence, and pantry-based meal suggestions. The receipt fixture contains no personal purchase data.

- `server/ai.ts` — provider calls, receipt research, structured output, source filtering, intent checks.
- `server/http.ts`, `server/index.ts`, `vite.config.ts` — local API, limits, retry cache, development/build serving.
- `src/ai-contract.ts`, `src/ai-client.ts` — shared schemas, bounded context, streamed progress, idempotent state updates.
- `src/AICards.tsx`, `src/ai.css` — sources, grocery review and correction, meal confirmation, Markdown rendering.
- `src/domain.ts`, `src/App.tsx` — persisted state, deterministic totals, capture and review workflows.
- `src/ChatLayer.tsx`, `src/chat.css` — chat homepage and composer.
- `src/NutritionPage.tsx`, `src/WorkoutPage.tsx`, `src/YouPage.tsx` — nutrition, workout conversation, profile and history.
- `src/FuelNavigation.tsx`, `src/components.tsx` — shared navigation, dialogs, and cards.
- `src/domain.test.ts`, `src/ai.test.ts`, `server/ai.test.ts`, `tests/*.spec.ts` — domain, provider boundaries, and browser flows.

The working brand name is centralized as `APP_NAME` in the domain module. Display assets and document metadata also contain the current name.

## Assets

Fonts are bundled locally: **DM Sans** and **Lora**, distributed under the SIL Open Font License. Food and gym photographs are illustrative stock photography downloaded from Unsplash; they are not actual meal evidence.

- Bowl: https://images.unsplash.com/photo-1547592180-85f173990554
- Breakfast: https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38
- Gym: https://images.unsplash.com/photo-1534438327276-14e5300c3a48

The server binds only to `127.0.0.1` by default. No deployment has been performed.

### Generated chat photo

The dinner photo is saved at `public/images/chicken-dinner.png` and was generated with the built-in image-generation tool as a replacement for the unrelated stock sample. It is an illustrative demo asset.

Generation prompt: “Use case: photorealistic-natural. Asset type: square food photo embedded in a fitness chat app. Create one realistic, casual smartphone photograph of a home-cooked dinner on a pale ivory ceramic plate: sliced golden grilled chicken breast with char marks on the left half, steamed bright green broccoli florets at the top, a neat serving of white rice on the right bottom, and a very small amount of light sauce. Close three-quarter overhead view, plate fills most of the frame, pale white marble countertop slightly visible at the edges. Natural window light, appetizing warm detail, real food textures. No text, no UI, no icons, no frame, no utensils, no decoration, no watermark. Square composition.”

### Generated smart-swap photos

`public/images/nutrition-swaps.png` is a four-tile photographic atlas created with the built-in image-generation tool. CSS displays each tile directly; the original asset is not edited. The tiles illustrate a blended coffee, iced Americano, ranch dressing, and salsa.

Generation prompt: “Create a perfectly aligned 2 by 2 photographic contact sheet, a square image split into four equal square photo tiles, NO gutters, NO borders, NO text or labels. These are four image thumbnails for a nutrition app, each photographed at a slight three-quarter overhead angle on a warm light neutral stone tabletop. Top left tile: one clear tall takeaway cup of pale caramel iced blended coffee with a generous swirl of whipped cream on top, no logo. Top right tile: one clear short tumbler of black iced americano coffee with visible ice cubes, no logo. Bottom left tile: one small round white ceramic ramekin filled with white creamy ranch dressing, subtle green herb flecks. Bottom right tile: one small round white ceramic ramekin filled with chunky red tomato salsa and tiny green herb pieces. Center each object precisely within its own tile with generous 15% empty margin around it so it fits completely. Soft natural daylight, realistic food photography, warm pale beige-gray background, gentle shadows, consistent camera scale, high detail. No utensils, hands, napkins, extra objects, packaging logos, words, watermarks or typography.”

### Workout selection and conversation

`src/WorkoutPage.tsx`, `src/workouts.ts`, and `src/workouts.css` implement the plan selector and active workout conversation. Upper Body, Lower Body, and Full Body are sample plans. Start a plan to track real set counts, tap reps, send “Got 8,” correct the most recently logged exercise with “Set 2 was 7,” or edit a recorded set. Complete the session to save it; previous sessions remain available from the workout menu. Weight and target adjustments are available before the first set of an exercise is recorded. Voice uses the existing prototype explanation; transcription is not connected.

`public/images/workout-atlas.png` is an illustrative six-tile photographic atlas generated with the built-in image-generation tool. CSS selects individual tiles without editing the image. Prompt: “Create a single photographic contact sheet asset for a polished mobile fitness application. Exactly 2 columns and 3 rows, six equal square tiles touching edge to edge, no gutters, no text or graphics. Overall 2:3 aspect ratio. Muted neutral gym photography, natural daylight, realistic anatomy and equipment, premium editorial style. Top left: close-up black hex dumbbells on a padded bench with towel and blurred water bottle. Top right: adult athletic man doing barbell bench press on flat bench, side view, full arms visible. Middle left: adult athletic man doing incline dumbbell press on inclined bench. Middle right: adult athletic man seated at cable row machine pulling handle toward torso. Bottom left: adult athletic man doing standing cable triceps pushdown. Bottom right: adult athletic woman doing goblet squat holding single dumbbell. Each tile independently composed with subject centrally located to remain readable as small square crop. No logos or text.”

### Your space

The fourth tab opens `#you`, a full page using the same Fuel header, navigation, colors, and card styling. `src/YouPage.tsx` and `src/you.css` bring together pending and completed reviews, editable daily goals, meals and captures, actual workout history, profile preferences, and data/privacy information. Existing `#review` links open the same page. Reviews and meal corrections use the existing shared state; revisiting or refreshing does not duplicate resolved records. Chat remains the default homepage. The history panels include saved records only; no fictional wearable activity is added.
