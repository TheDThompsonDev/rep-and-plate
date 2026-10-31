# C1-chat-ux — Chat home completeness gaps (README §1)

## Plan (written before editing)

Goal: the Chat thread behaves like a standard chat: it follows new messages only when the reader is at the bottom, announces only conversation messages, shares the server composer limit, shows date dividers across days, and has no non-null assertion in the card rendering.
Done when: (1) a reply arriving while the user has scrolled up does not move the thread and a "Jump to latest" control appears, works and disappears; (2) at the bottom the thread follows; (3) `[role=log]` contains only messages (and day separators) — welcome, examples, receipt entry, connection notice and processing status live outside it; (4) the composer `maxlength` equals the server limit (4000) and a 4000-character message is accepted end to end, with a remaining-characters status only near the limit; (5) two messages whose `at` fall on different local days render a divider; old records without `at` render none.
Approach: repair (scroll effect, live-region structure, `!`) + extend (shared limit constant, optional `at`). Reuse `window.matchMedia("(prefers-reduced-motion: reduce)")` as `src/YouPage.tsx:300` does; Spot has no stored motion preference — only `spot.visuals` (illustrations) and CSS `prefers-reduced-motion` blocks in `spot.css:592` / `chat.css:1009` — so the media query is the setting to honor.
Context: ledger has no scroll/live-region history for Chat; CHAT-COMPOSER-001 (wave A) owns Stop/retry gating in the same file and must stay intact; B1 removed demo text from the meal card. Line 44 of the ledger warns that fixtures must wait for Chat readiness before seeding/reloading.
Change:
- `src/chat-thread.ts` (new, pure) → `isNearBottom`, `dayKey`, `dayDividerLabel`, `remainingCharacters`, `showRemaining`, `scrollBehavior`.
- `src/chat-thread.test.ts` (new) → unit tests for the helpers.
- `src/ai-contract.ts` → `export const CHAT_INPUT_LIMIT = 4000` used by `aiRequestSchema.text` (smallest out-of-scope edit; recorded).
- `src/domain.ts` → `at: z.string().optional()` on `messageSchema`; `export const timestamp = () => new Date().toISOString()`.
- `src/App.tsx` → `at: timestamp()` added only where messages are constructed (sendAI user message/reread, chatGuidance pair, local command user/assistant replies, saved-image pair).
- `src/ai-client.ts` → `at: timestamp()` on the assistant answer in `applyAIResult`.
- `src/ChatLayer.tsx` → scroll container loses `role=log`; a `.fuel-messages` `role=log aria-live=polite` wraps only messages; processing/stop and all discovery content move outside; near-bottom tracking + unseen count + "Jump to latest" button; `maxLength={CHAT_INPUT_LIMIT}` + `.fuel-composer-count` status near the limit; day separators; `suggestedAction` narrowed; `previous` computed from the filtered list (latent off-by-one when a stored `welcome` exists).
- `src/features/voice/VoiceCapture.tsx` → both 4000 literals become `CHAT_INPUT_LIMIT`.
- `src/chat.css` → `.fuel-messages`, `.fuel-day-divider`, `.fuel-jump-latest`, `.fuel-composer-count`.
- `tests/record-fixture.ts` → additive `seedConversation(page, messages)`.
- `tests/chat-thread.spec.ts` (new) → the five browser checks above.
Keep consistent: `src/App.tsx:1575` only `<ChatLayer` consumer; `tests/flows.spec.ts:49`, `tests/no-demo.spec.ts:17` select `role=status` (SpotProcessing keeps its role, moves outside the log); `tests/chat-composer.spec.ts:159,210`, `tests/ai-flows.spec.ts:185` select `getByRole("alert")` for the capture error (kept, inside the message); `server/ai.ts`, `server/beta*.ts` import `aiRequestSchema` (value unchanged at 4000); `mobile/src/chat-warnings.ts`, `mobile/src/storage.ts` import `Message`/`stateSchema` (optional field is additive; `npm --prefix mobile run check`); other message factories (`src/workouts.ts`, `src/features/{pantry,products,receipts,recipes}`) are out of scope and simply carry no `at` (dividers are skipped for them).
Test: Vitest `src/chat-thread.test.ts`; Playwright `tests/chat-thread.spec.ts`; existing `chat-composer`, `spot`, `no-demo`, `voice-flows`.
Open: error block stays `role="alert"` nested in the log — ARIA scopes a change to the nearest live ancestor, so the alert (assertive) governs it rather than the polite log; the duplicates the audit named came from `role=status` notices and the processing indicator inside the log, which are moved out. Dividers: a message with `at` whose predecessor has no `at` gets a divider only when it is the first visible message (its own day); otherwise unknown ⇒ none.

## Reproduction (red first)

- `src/chat-thread.test.ts` (10 cases): failed to resolve `./chat-thread` before the helper module existed.
- `tests/chat-thread.spec.ts` on the original ChatLayer, 12 runs (desktop + mobile), all failed for the audited reasons:
  - scrolled-up reader: `getByRole('button', { name: /Jump to latest/ })` never resolved (no control existed).
  - at-bottom follow: after reload the thread opened at `scrollTop 0` (gap 2039 / 2255 px) because the old mount rule only scrolled when a message had `ai: true`.
  - live region: `[role=log] .spot-welcome` resolved to 1 element (welcome, examples, receipt entry and the processing `role=status` were all inside the polite log).
  - composer: `maxlength="2000"` where the server accepts 4000.
  - dividers: `getByRole('separator', { name: 'Yesterday' })` resolved to 0 elements.
- The processing locator I first copied ("Rep & Plate is responding") matches nothing in the source; `tests/flows.spec.ts:49` and `tests/no-demo.spec.ts:17` assert `toHaveCount(0)` on that phrase, which is vacuous. Not edited (other owners); flagged for the orchestrator. My spec uses the real status text "Got it. Tiny plate. Big thinking."

## Change and mechanism

- Scroll anchoring (`src/ChatLayer.tsx`): the scroll container tracks `isNearBottom` (48 px threshold, `src/chat-thread.ts`) on every scroll event into a ref (`stickToBottom`) plus state (`nearBottom`). The follow effect keys on `visibleCount` / `latestRole` / `processing`: it opens at the latest message once a conversation exists (instant), then follows only when the reader is near the bottom or the newest message is their own; otherwise it leaves `scrollTop` alone and the composer shows "Jump to latest · N new" (N = `visibleCount - seenCount`; `seenCount` is state written from the scroll handler and inside the rAF after a follow, never synchronously in the effect body). Smooth vs instant comes from `scrollBehavior(prefersReducedMotion())`, i.e. `matchMedia('(prefers-reduced-motion: reduce)')` (the pattern at `src/YouPage.tsx:300`); the header home button honours it too, and `chat.css` sets `scroll-behavior: auto` on the thread under the same media query. Spot stores no motion preference (`src/features/spot/contracts.ts` has `visuals`, `introSeen`, `lastVisit` only), so the media query is the setting respected.
  - StrictMode: the first open scrolls synchronously inside the effect and schedules a rAF follow-up; StrictMode's effect replay cancels the frame but cannot undo the synchronous scroll. Found through the red "at the bottom" run on the new code (thread stayed at top in dev because the replayed effect saw `opened` already true).
- Live regions: `role="log" aria-live="polite" aria-label="Capture conversation"` now wraps only `.fuel-messages` (messages and `role="separator"` dividers). The welcome, examples `<details>` (which carries its own `aria-live` preview), receipt entry, connection notice (`role=status`), catch-up card, capture-day line and the processing indicator + Stop button are outside it. The capture error keeps `role="alert"` inside its message: ARIA scopes a mutation to the nearest live ancestor, so the assertive alert governs that subtree rather than the polite log. Verified with `locator('[role=log]').ariaSnapshot()` (no `status` node) and child-class checks in the spec.
- Composer limit: `CHAT_INPUT_LIMIT = 4000` exported from `src/ai-contract.ts` and used by `aiRequestSchema.text`; the web input uses it for `maxLength`, `VoiceCapture.tsx` for both transcript checks. A `role="status"` countdown ("N characters left") renders only within the last 200 characters (`showRemaining`).
- Date dividers: `messageSchema.at` (optional ISO string, snapshot version stays 1) and `timestamp()` in `src/domain.ts`; stamped at every message factory in `src/App.tsx` (sendAI user/reread message, chat-guidance pair, local-command user/summary/workout/review/default replies, saved-image pair) and the assistant answer in `src/ai-client.ts` `applyAIResult`. `dayDividerLabel(previous, current)` renders "Today" / "Yesterday" / "Saturday, Oct 3" (year added when it differs) above a stamped message that opens the list or changes local day from a stamped predecessor; an unstamped predecessor means unknown, so none. Old records render exactly as before.
- `!` removal: `message.suggestedAction!` narrowed via `const action = message.suggestedAction` and `{action && ...}`. While there, `previous` is now taken from the filtered list (`visibleMessages[index - 1]`), fixing a latent off-by-one for records that still carry a stored `welcome` message.

## Consumers checked

- `src/App.tsx:1575` is the only `<ChatLayer` consumer; props unchanged.
- `tests/chat-composer.spec.ts` (Stop/retry/alert), `tests/no-demo.spec.ts`, `tests/spot.spec.ts`, `tests/voice-flows.spec.ts`: 46 passed on the final source.
- Thread-adjacent journeys (`chat-conversation`, `chat-actions`, `ai-flows`, `ai-cancellation`, `flows`, `onboarding-first-log` (first-week card above the log), `interaction-guide`, `spot-personality`, `meal-breakdown`, `chat-signin`): 72 passed.
- `server/ai.ts`, `server/beta*.ts` import `aiRequestSchema`; limit value unchanged (4000). `server` Vitest green.
- `mobile/src/chat-warnings.ts`, `mobile/src/storage.ts` import `Message` / `stateSchema`; `npm --prefix mobile run check` exit 0. Native composer not edited (another owner).
- Message factories outside my scope (`src/workouts.ts:154,212`, `src/features/pantry/ledger.ts:153`, `src/features/products/actions.ts:17`, `src/features/receipts/journey.ts:63,90`, `src/features/recipes/batches.ts:117,207`) carry no `at`; those messages render without dividers, by design of the optional field. Follow-up for their owners if dividers are wanted there.
- Out-of-scope edit recorded: `src/ai-contract.ts` (+2 lines: the constant and its use in the schema). No other file outside the assigned scope was touched. `src/styles.css`, `src/readability.css`, `server/**`, `mobile/**` untouched.

## Commands and results (final file state)

- `npx tsc --noEmit` → exit 0.
- `npx vitest run src server mobile/src` → 80 files, 536 passed.
- `npm run lint` → 0 errors, 71 warnings; none in touched files (`npx eslint` on the touched set reports only pre-existing `src/App.tsx:351,355` and `src/domain.ts:371-372`). One `react-hooks/refs` warning I introduced (ref read during render) was fixed by making `seenCount` state.
- `npm --prefix mobile run check` → exit 0.
- `npx playwright test tests/chat-thread.spec.ts tests/chat-composer.spec.ts tests/spot.spec.ts tests/no-demo.spec.ts tests/voice-flows.spec.ts --workers 2` → 46 passed (twice: before and after the `seenCount` refactor).
- `npx playwright test tests/chat-thread.spec.ts --repeat-each 3` → 35/36; the one failure was a blank page after reload on the shared server (bundle never rendered; screenshot fully white). `-g "date divider" --repeat-each 5` → 10/10 afterwards. Treated as a shared-server transient (VERIFY-SWARM-001), not a product defect.
- Screenshot: `notes/C1-chat-ux-jump-390.png` (mobile project, 390 px): reader at the top of a 30-message thread, "Jump to latest · 1 new" pill above the composer.

## Not checked

- Real screen readers (NVDA/JAWS/VoiceOver): the live-region claim rests on the accessibility tree and the ARIA scoping rule, not on spoken output.
- Full browser suite and native Expo suite (orchestrator). 320 px layout of the pill (390 and 1440 only). Live provider path (only the loopback route mock). Timezone edge: `at` is stamped in UTC and keyed by the viewer's local day; a record viewed in another timezone can shift divider placement, which is the intended "local day".

## Ledger-ready paragraph

CHAT-THREAD-001 — Thread yanked on every message, duplicate live announcements, composer limit mismatch, no date dividers (audit §1 completeness gaps). The scroll effect set `scrollTop = scrollHeight` on every count change regardless of the reader's position; the whole scroll surface (welcome, examples with their own `aria-live`, receipt entry, `role=status` notices, processing indicator) was one `role=log aria-live=polite`; the web input capped at 2000 while voice, native and `aiRequestSchema` accepted 4000; messages carried a clock `time` only. Red tests: `src/chat-thread.test.ts` and `tests/chat-thread.spec.ts` (12 browser failures on the original source: no Jump control, thread opened at top, welcome inside the log, `maxlength=2000`, no separators). Fix: pure helpers in `src/chat-thread.ts` (`isNearBottom`, `dayDividerLabel`, `showRemaining`); ChatLayer follows only when near the bottom or on the reader's own message, otherwise shows "Jump to latest · N new", honouring `prefers-reduced-motion` (Spot has no stored motion setting); the polite log wraps messages only, with the capture error's `role=alert` the sole nested live role; `CHAT_INPUT_LIMIT` in `src/ai-contract.ts` feeds the schema, web input and voice; `messageSchema.at` (optional ISO, version 1) is stamped by `timestamp()` at the App/ai-client factories and drives `role=separator` day dividers; `suggestedAction!` narrowed. Lesson: in dev StrictMode replays effects and cancels their rAF cleanup, so a one-time "open at latest" must scroll synchronously inside the effect. Also noted: `tests/flows.spec.ts:49` and `tests/no-demo.spec.ts:17` assert `toHaveCount(0)` on a status phrase that does not exist in the source ("Rep & Plate is responding"), so those assertions are vacuous.
