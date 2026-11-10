# Everyday experience implementation

This change connects the first capture, familiar meals, daily guidance, food decisions,
temporary life context, training continuity, shared household cooking, and optional
local usability evidence. Food suggestions and purchases remain separate from intake.

## Delivered behavior

| Area | User experience | Main implementation |
| --- | --- | --- |
| First value | Start with one meal, then personalize later; movement remains an alternative. | Web/native onboarding |
| Daily return | One dismissible next step based on actual records; recent meals and explicitly pinned usuals. | `src/features/daily`, native `DailyCompanion` |
| Repeat meals | Review a saved nutrition snapshot and portion before adding a separate intake entry. Repeating does not reuse pantry or household reservations. | `MealEditor`, daily models |
| Food decisions | Find meal options around time, appetite and cost; compare menu/order photos or text. Choices never mutate the diary or inventory. | `src/features/decisions`, native `FoodDecisions`, AI request purpose |
| Imperfect capture | Choose a reviewed rough estimate or ask the most useful clarification. Estimates retain their confidence and assumptions. | AI normalization and decision tools |
| Capture inbox | Save text, links and photos without submitting or logging; review, send, retry or remove later. Failed sends retain the source and request identity. | `src/features/capture-inbox`, native `IncomingShareInbox` |
| Temporary context | Date-bounded conference, travel, busy-week, limited-kitchen or custom mode; duration and equipment can guide a workout. Ended/expired modes do not replace enduring preferences. | `src/features/life-context`, web/native panels, AI context |
| Small experiments | Set a limited action/frequency/date range, record effort/enjoyment/helpfulness, then repeat or finish. | Life context panels |
| Weekly value | Observations use actual recorded evidence; a practical next action can reopen a familiar meal for review. Sparse history produces appropriately limited observations. | `weekly-actions`, weekly review, nutrition insights |
| Training continuity | Explicitly reuse previous exact loads for remaining sets; shorten sessions; substitute unstarted exercises with an optional future-program change. Completed sets survive adjustments. | `continuity`, web/native training panels |
| Household cooking | Share selected prepared portions, allocate safely and save each person's reviewed intake privately. Source portions transfer once; recovery does not duplicate the diary. | `src/features/household`, native `HouseholdMeals`, SQL migration |
| Pantry burden | On web, enter ingredients needed now to prioritize possible review matches; remaining checks stay available behind an expandable list. | `PantryPriorities` |
| Usage evidence | Optional visit, capture timing/failure, correction, meal, usual and guidance counts. Turning it off clears the event history. No capture text/photos are put in these events or sent as research context to AI. | Life context models and web/native instrumentation |

The web and native entry points use the same domain models. Native presentations
are adapted to existing sheets/cards. Browser tests emulate a mobile viewport;
they do not verify a physical Expo build.

## Reliability boundaries

- All intake still requires the existing review/save action. Suggestions, saved
  captures, recipe preparation, purchases and household transfers are not intake.
- Menu/decision purpose is enforced in both client application and server
  normalization. Even an unexpected model proposal cannot write intake through
  that route.
- Sources are saved before native provider requests. Web saved captures persist
  before sending, and unavailable AI leaves a retryable source instead of claiming
  completion. Stable IDs prevent replay from duplicating a completed capture.
- Async capture and shared-meal results are scoped to the current account epoch.
  An account switch discards the old account's result.
- Experimental usage evidence is opt-in, bounded to 300 events and stored with
  account records. There is no new remote analytics collector or automated claim
  that the features improve retention. Actual adoption needs a measured pilot.

## Validation

Baseline before implementation: TypeScript passed and 578 unit tests passed.
After integration, the full domain/server/native unit run passed 645 tests and
the separate CLI/MCP integration run passed 8 tests. Targeted checks were rerun
after final refinements.

The 70-test desktop/mobile-browser regression run passed and covers onboarding, chat,
photo capture, all five new experience journeys, recipe portions, training,
weekly review and account sync. All 14 additional pantry/plan-purchase browser
tests passed after preserving the ingredient filter across product corrections,
for 84 distinct passing browser cases. Mobile daily and food-help screenshots
were visually reviewed.

Web and native TypeScript checks, web/native lint, the web production build and
the hosted API bundle pass. Lint/build retain existing warnings, including large
web chunks. AI browser fixtures are controlled responses; this is not an
evaluation of live provider accuracy. Household tests use pure-domain and mocked
RPC boundaries, not a live PostgreSQL concurrency test.

## Rollout requirements

This implementation changes local source only. Nothing is deployed and no hosted
database migration has been applied.

1. Apply `supabase/migrations/20261108_household_meals.sql` to the intended
   environment, then exercise the two-account and concurrency cases in
   [household verification notes](household.md). Shared raw groceries are outside
   this feature; the shared object is a prepared meal batch.
2. Rebuild the native app with the updated `expo-sharing` plugin configuration.
   Verify iOS text/link/photo and Android single/multiple-image shares, account
   switching and interrupted imports on real devices. An OTA update alone cannot
   install the native share extension.
3. Browser share-target metadata accepts text/links in supporting installed PWAs.
   OS photo POST sharing is not implemented for the browser; use upload, paste or
   drop there. Native incoming photo sharing is configured separately.
4. Pilot the complete capture/review/return flows against the intended AI provider
   and collect explicit feedback before interpreting opt-in usage counts as
   retention evidence.
