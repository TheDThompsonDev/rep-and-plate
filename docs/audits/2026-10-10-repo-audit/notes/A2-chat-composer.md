# A2-chat-composer — findings C1, C2, C7

## Plan (written before editing)

Goal: the web composer never loses text while a reply is processing, the user can stop an in-flight reply, and the capture retry is gated and user-facing.
Done when: (1) a preset or voice transcript submitted during processing stays in the composer with a notice; (2) "Stop response" aborts the fetch, marks the capture stopped with a retry, frees the composer, and the held reply never renders; (3) with chat unavailable the error block offers reconnect/sign-in instead of "Retry this capture" and no developer copy is shown.
Approach: repair + extend. Reuse the grocery draft pattern (`src/App.tsx:364-374`), the existing `cancelPendingAI` generation guard (`src/App.tsx:594-601`), native's stop copy (`mobile/src/store.tsx:343`), and the receipt retry gating (`src/ChatLayer.tsx:487`).
Context: ledger line 25 records the grocery draft repair (same defect class, same fix shape); VERIFY-SWARM-001 governs server use. No failed approaches recorded for cancel or retry gating.
Change:
- `src/ai-client.ts` → pure helpers `retainComposerDraft`, `markCaptureStopped`, `STOPPED_CAPTURE_MESSAGE`, `PROCESSING_DRAFT_NOTICE`.
- `src/App.tsx` → `submitText` retains + notifies while processing; `sendAI` remembers the pending message id; new `stopResponse()`; user-facing unavailable copy; `onStop` passed to ChatLayer.
- `src/ChatLayer.tsx` → `onStop` prop and "Stop response" button beside `SpotProcessing`; retry block gated like the receipt action.
- `src/chat.css` → `.fuel-processing`, `.fuel-stop-response`.
- `src/ai.test.ts`, `tests/chat-composer.spec.ts` → red tests first.
Keep consistent: `App.tsx:1575` is the only `<ChatLayer` consumer; `cancelPendingAI` callers at `App.tsx:256,1245,2114,2529` keep their no-marking semantics (reset/restore/account change); `tests/ai-flows.spec.ts:190` relies on the "Retry this capture" label when AI is available (kept).
Test: Vitest for the helpers and `requestAI` abort/mismatch; Playwright `tests/chat-composer.spec.ts` (preset retained, voice retained, stop + late result + retry, gated retry x2).
Open: mic during processing → allow, transcript retained (recording is independent of the request; the review step means the user decides when it lands). Native voice drops transcripts while busy (`mobile/src/Capture.tsx:490` → `store.tsx:283`) — follow-up, not edited here.

## Reproduction (red first)

- `src/ai.test.ts` "composer retention and stop helpers": 2 failed before the change (`retainComposerDraft is not a function`, `markCaptureStopped is not a function`). The two "requestAI transport guards" cases (caller abort rejects with `AbortError`; mismatched `requestId` rejects) passed on first run: they are regression coverage for behaviour the audit listed as untested, not reproductions.
- `tests/chat-composer.spec.ts` on the original source: 10/10 failed (desktop + mobile).
  - Voice: composer value was `""` after sending the transcript during processing — the transcript was dropped (C1).
  - Preset: first run failed on a locator ambiguity (two "Today's nutrition" buttons); scoped to the menu dialog, then failed on the composer being empty.
  - Stop: `getByRole('button', { name: 'Stop response' })` never resolved (C2).
  - Gated retry (both access cases): "Retry this capture" resolved to 1 element while `/api/status` returned `available:false` (C7).

## Change and mechanism

- C1 `src/App.tsx` `submitText`: the early return `if (!text || processing) return;` became `if (!text) return;` plus a processing branch that does `setComposer(current => retainComposerDraft(current, text))` and `notify(PROCESSING_DRAFT_NOTICE)`. Voice (`App.tsx` VoiceCapture `onSend`) and menu presets (`ChatLayer.sendFromMenu`) both enter through `submitText`, so one branch covers both. `retainComposerDraft` joins an incoming preset/transcript onto any existing draft with a space so no words are lost; identical text is not duplicated. Decision: the Mic button stays enabled while processing; the transcript is retained in the composer with the notice (recording is independent of the request, and the review step already requires an explicit send).
- C2 `src/App.tsx`: new `aiRequestMessageId` ref set in `sendAI` next to the controller and cleared in `finally`/`cancelPendingAI`. New `stopResponse()` calls `cancelPendingAI()` (bumps `aiGeneration`, aborts the `AbortController` passed to `requestAI`, frees `aiBusy`/`processing`) then `setState(s => markCaptureStopped(s, id))`, which marks only a still-`pending` capture as `aiStatus: "error"` with `"Stopped. Your capture is saved; you can retry."` (native copy). The existing error block then renders the retry affordance. `src/ChatLayer.tsx` takes `onStop` and renders a "Stop response" button beside `SpotProcessing` inside `.fuel-processing`. Reset/restore/account-change callers of `cancelPendingAI` are unchanged (they intentionally do not mark the message).
  - Late results: the fetch abort rejects at the network layer; independently, the `generation !== aiGeneration.current` checks in `sendAI` drop any result or error from a superseded generation. Verified both: with `abort()` temporarily disabled inside `cancelPendingAI` the Stop test still passed (the held reply never rendered), then the file was restored byte-identical (cmp) and the spec re-run.
- C7 `src/ChatLayer.tsx:544-562`: the retry button is now `disabled={processing || connectionChecking}` and branches like the receipt action: `aiAvailable` → "Retry this capture" → `onRetry`; `chatAccess` signin/setup → "Sign in to retry this capture" → `onChatAccount`; otherwise "Reconnect to retry this capture" → `onReconnect`. `src/App.tsx` `sendAI` unavailable copy changed from "check the server and refresh" to "Connected chat isn't available right now. Your capture is saved; reconnect and try again."
- `src/chat.css`: `.fuel-processing` (flex, wrap) and `.fuel-stop-response` (pill, 40px min height). Appended with CRLF to match the file.

## Consumers checked

- `src/App.tsx:1575` is the only `<ChatLayer` consumer; `onStop={stopResponse}` added there.
- `cancelPendingAI` callers (`App.tsx` unmount effect, reset, restore, account change) unchanged in behaviour.
- `tests/ai-flows.spec.ts` "Failed AI capture can be retried after refresh" still clicks "Retry this capture" with AI available: passed.
- `tests/ai-cancellation.spec.ts` (reset cancellation and discarded late receipt): passed.
- `tests/voice-flows.spec.ts` (6 cases): passed.
- Native: not edited. Typed draft is retained on native (`mobile/src/ChatScreen.tsx:460-466` only sends/clears when `!h.busy`) but with no notice. Native voice is NOT retained: `mobile/src/Capture.tsx:490` calls `h.send(text)` and `store.send` (`mobile/src/store.tsx:283-288`) returns silently when `controller.current` is set, so a transcript sent during a reply is dropped. Follow-up for the mobile owner.

## Commands and results (final file state)

- `npx tsc --noEmit` → 3 errors, all in `server/ai.ts` (`REVIEW_BUDGET_MS`, `boundaryTimeout`; the C5 budget work in progress by another agent). `npx tsc --noEmit | grep -v '^server/'` → empty.
- `npx vitest run src server` → 462 tests: 451 passed, 11 failed in `src/platform/browser-records.test.ts` (untracked, Q1 work in progress) and `server/readiness-migrations.test.ts` (F5 work in progress). `npx vitest run src/ai.test.ts` → 12/12 passed.
- Browser: the shared server on 5173 was not running (nothing listening; HTTP probe refused from both shells, terminal idle). Per VERIFY-SWARM-001 I did not start or stop anything on 5173. I ran a private `npx vite --port 5199 --strictPort --host 127.0.0.1` with a temporary `playwright.a2-private.config.ts` (same two projects, baseURL 5199, output to my scratchpad), then stopped that process and deleted the config.
  - `tests/chat-composer.spec.ts` → 10 passed (desktop + mobile), twice on final source.
  - `ai-flows`, `ai-cancellation`, `voice-flows` → 22 passed.
  - Screenshot `stop-response.png` (mobile 390px) inspected: Stop pill below the processing line, above a usable composer, mic visible.

## Not checked

- Full browser suite (orchestrator runs it). Native Expo suite. 320px layout of the Stop pill (only 390px and 1440px captured). Live provider cancellation on the hosted path (`apiFetch` combines the caller signal with the session-change signal; only the local loopback path was exercised).

## Ledger-ready paragraph

CHAT-COMPOSER-001 — Dropped text while processing, no web cancel, ungated retry (audit C1, C2, C7). `submitText` returned early on `processing`, discarding voice transcripts and menu presets; `cancelPendingAI` existed but had no user control; "Retry this capture" rendered regardless of `aiAvailable` with developer copy. Red tests: Vitest helpers in `src/ai.test.ts` and `tests/chat-composer.spec.ts` (10 browser failures on the original source: empty composer after a transcript, no Stop button, retry visible while unavailable). Fix: `submitText` keeps the text via `retainComposerDraft` and notifies (grocery-path pattern); `stopResponse` aborts through `cancelPendingAI` and marks the pending capture with native's "Stopped." copy via `markCaptureStopped`; ChatLayer renders "Stop response" beside the processing indicator and gates retry like the receipt action (sign-in / reconnect fallbacks). Late results are rejected by the fetch abort and, independently, by the `aiGeneration` guard (verified by temporarily disabling the abort). Mic stays enabled during processing by decision; the transcript is retained. Native keeps typed drafts but drops voice transcripts while busy (`mobile/src/Capture.tsx:490` → `store.tsx:283`); follow-up. Verification used a private Vite on 5199 because 5173 was not running; no shared server was started or stopped.
