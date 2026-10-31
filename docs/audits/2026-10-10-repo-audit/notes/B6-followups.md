# B6-followups — native voice retention while busy; owner-scoped corrupt copies

Follow-ups recorded by wave A (`A1-data-loss.md` limits, `A2-chat-composer.md` consumers; ledger AUDIT-20261010 RECORDS-OVERWRITE-001 and CHAT-COMPOSER-001 open items). Playbook: bug-fix. Managed `cyc run` cannot start (CYC-ASSETS-001); checks run directly.

## Plan (written before editing)

### 1. Native voice transcript dropped while a reply is processing

Goal: on native, a transcript or typed message submitted while Spot is replying lands in the composer draft with the existing notice instead of vanishing; the mic stays usable.
Done when: (1) `store.send` on the busy path joins the text onto `draft` (web `retainComposerDraft` rule) and sets `notice` to `PROCESSING_DRAFT_NOTICE`; (2) the Voice sheet's "Send message" is not disabled by `h.busy`, and sending while busy closes the sheet onto the Chat composer holding the transcript; (3) the typed composer path no longer clears a draft the store refused; (4) the Expo-web journey proves it end to end.
Approach: extend. Reuse `retainComposerDraft` / `PROCESSING_DRAFT_NOTICE` from `src/ai-client.ts` (web fix, CHAT-COMPOSER-001) and the native notice banner in `mobile/App.tsx:137-158`.
Context: `store.send` (`mobile/src/store.tsx:283-288`) returns silently when `controller.current` is set. `mobile/src/Capture.tsx` Voice "Send message" is `disabled={... || h.busy}`, so the transcript is stuck in the sheet (sheet-local state) and is lost when the sheet closes; the ref/state race (`controller.current` set before `busy` re-renders) still reaches the silent return. `ChatScreen.tsx:471-479` already skips send while busy but gives no notice. Photo/tool sends (`Capture.tsx:120`, `tools.tsx:595`) are disabled by `h.busy` and carry an image, which has no composer home; left as is.
Change:
- `mobile/src/composer.ts` (new, pure; outside the listed scope because every owned file imports react-native and cannot load in Vitest) → `holdWhileReplying(draft, incoming)` returning the joined draft and the notice.
- `mobile/src/store.tsx` → `send` busy path: when text is non-empty, hold it (draft + notice), bring the user to Chat and close the tool; still no request.
- `mobile/src/Capture.tsx` → Voice "Send message" no longer disabled by `h.busy`.
- `mobile/src/ChatScreen.tsx` → composer send clears the draft only when the store will take it (`!h.busy`); otherwise the store's hold keeps it and shows the notice.
- `mobile/e2e/chat-composer.spec.ts` (new) → held first reply; voice-sheet transcript and a typed draft submitted while busy stay in the composer with the notice; the retained text sends after release.
Keep consistent: `ChatScreen.tsx:74` retry (`disabled={h.busy}`, unchanged); `Capture.tsx:120` and `tools.tsx:595` image sends (disabled while busy, unchanged); `mobile/App.tsx:137` notice banner (unchanged, now reused); web `submitText` (`src/App.tsx`) is the reference behavior.
Test: Vitest `mobile/src/composer.test.ts` (red: module missing); native Playwright with Metro started `CI=1 npx expo start --web --port 8081 --clear`, warmed once, stopped afterwards (NATIVE-WARNINGS-001 lesson).

### 2. Corrupt-snapshot copies are not owner-scoped

Goal: a preserved copy of an unreadable snapshot belongs to the archive it was taken from (guest or one account); clearing a browser account removes only that account's copies.
Done when: (1) copying while `health.records.owner` is set produces a key that names the owner; guest copies keep the existing `fuel.prototype.v1.corrupt-<ts>` form (existing web spec and on-device copies unchanged); (2) the 3-copy bound and content dedupe apply per archive, so one archive's copies never rotate another's out; (3) `clearBrowserAccount(userId)` and `clearBrowserAccount()` remove that owner's copies and leave a guest's and another account's; (4) `tests/unreadable-records.spec.ts` and `tests/account-storage.spec.ts` pass against the shared server.
Approach: extend `preserveUnreadableBrowserRecords` with the owner read the same way `hydrateBrowserRecords`/`persistBrowserRecords` read it; extend `clearBrowserAccount`'s existing key sweep.
Rule (docs/context/account-lifecycle.md deletion boundary step 5: "remove only that account's active/local archived records ... other accounts and unowned guest data are preserved"): the copy is part of the owner's local archive. Key form `fuel.prototype.v1.corrupt-<ts>.<encodeURIComponent(owner)>` puts the owner last, exactly like `health.account.<owner>`, so the existing `endsWith(encodeURIComponent(':userId'))` sweep in `clearBrowserAccount(expectedUserId)` covers it once the prefix is added; the selected-owner branch removes `corruptRecordsOwner(key) === owner`. A guest copy has no suffix and never matches an account id. The owner is never decoded from the key for trust decisions; the exact encoded suffix is compared.
Change:
- `src/platform/browser-records.ts` → `corruptRecordsKey(owner, stamp)`, `corruptRecordsOwner(key)`, owner-scoped listing/dedupe/bound inside `preserveUnreadableBrowserRecords`.
- `src/features/cloud/account-storage.ts` → both branches of `clearBrowserAccount` remove the owner's copies.
- `src/platform/browser-records.test.ts`, `src/features/cloud/account-storage.test.ts` (new) → red first.
- `tests/account-storage.spec.ts` → the deletion journey also seeds a copy for the deleted account, another account and the guest (IndexedDB-only path).
- `docs/context/account-lifecycle.md` → one paragraph on unreadable-snapshot copies.
Keep consistent: `src/domain.ts:418` caller (signature unchanged); `guardUnreadableRecords` (compares raw, not keys); `tests/unreadable-records.spec.ts` (guest form unchanged); `src/platform/BrowserRecordsNotice.tsx` (message API unchanged); `switchBrowserAccount` (no copies involved).
Open: none that change the solution.

## Reproduction (red first)

- `npx vitest run src/platform/browser-records.test.ts src/features/cloud/account-storage.test.ts mobile/src/composer.test.ts` on the unchanged sources: 6 failed, and `mobile/src/composer.test.ts` could not load (`Cannot find module './composer'`). The defect itself reproduced through pre-existing entry points in "bounds and deduplicates copies per archive": with three guest copies present and an account selected, `readStoredState()` on a corrupt blob rotated a guest copy out (`expected [ …(2) ] to deeply equal [ …(3) ]`). The other five failed on the missing `corruptRecordsKey`/`corruptRecordsOwner` exports, which the owner-scoped sweep in `clearBrowserAccount` needs.
- `mobile/e2e/chat-composer.spec.ts` against the unchanged native code (Metro `CI=1 … --clear`, bundle warmed once): 1 failed at the Voice sheet's "Send message" (`element is not enabled`, 168 retries): the transcript sat in sheet-local state and could not reach the composer while `h.busy` was true; closing the sheet lost it. Metro was stopped before editing and restarted on the fixed code.

## Change and mechanism

1. Native composer while a reply is processing
- `mobile/src/composer.ts` (new, pure) `holdWhileReplying(draft, incoming)` returns `{ draft: retainComposerDraft(draft, incoming), notice: PROCESSING_DRAFT_NOTICE }` from `src/ai-client.ts`. It lives outside the listed scope because every owned native file imports react-native and cannot load in Vitest; it has no react-native import.
- `mobile/src/store.tsx` `send`: the `controller.current` branch now holds a non-empty text (no retry, no image) in the draft via a functional `setDraft`, sets the shared notice, and brings the user to Chat with the tool closed; still no request. Retries and image captures keep their own disabled-while-busy buttons (`ChatScreen.tsx:74`, `Capture.tsx:120`, `tools.tsx:595`), unchanged.
- `mobile/src/Capture.tsx` Voice "Send message": no longer gated on `h.busy` (still gated on empty text, transcribing, recording). The mic ("Start recording") was never gated on `h.busy`.
- `mobile/src/ChatScreen.tsx` composer send: reads the draft, clears it only when `!h.busy`, then calls `send`. If the ref/state race lands on the busy branch after a clear, the functional update restores the text (`retainComposerDraft("", text)`).

2. Owner-scoped copies of unreadable snapshots
- `src/platform/browser-records.ts`: `corruptRecordsKey(owner, stamp)` (`<prefix><stamp>` for a guest, `<prefix><stamp>.<encodeURIComponent(owner)>` for an account) and `corruptRecordsOwner(key)` (`null` guest, owner string, `undefined` not a copy). `preserveUnreadableBrowserRecords` reads `health.records.owner` at detection, the same marker `hydrateBrowserRecords` loaded the blob under, and lists, dedupes and bounds (3) only copies of that archive.
- `src/features/cloud/account-storage.ts` `clearBrowserAccount`: the `expectedUserId` sweep also matches `corruptRecordsPrefix` keys ending with `encodeURIComponent(':userId')` (the owner is the key's suffix, exactly like `health.account.<owner>`); the selected-owner branch removes keys whose `corruptRecordsOwner` equals the owner. A guest copy has no suffix and cannot match an account id.
- `tests/account-storage.spec.ts`: the IndexedDB deletion journey also seeds a copy for the deleted account, another account and the guest.
- `docs/context/account-lifecycle.md`: one paragraph under the deletion boundary.

## Consumers checked

- `src/domain.ts:418` `preserveUnreadableBrowserRecords(saved, reason)` signature unchanged. `guardUnreadableRecords` compares raw blobs, not keys. `src/platform/BrowserRecordsNotice.tsx` uses `unreadableBrowserRecords`/`unreadableRecordsMessage`, unchanged.
- `tests/unreadable-records.spec.ts` (guest journey, key form `corrupt-<13 digits>`): passes, 2 tests on desktop and mobile.
- `switchBrowserAccount` and `AccountSecurity.tsx:14` (the only `clearBrowserAccount` caller): no signature change.
- Native: `mobile/e2e/spot.spec.ts` (typed send, preserved draft, Spot Check warning) passed with the new spec on the fixed bundle.
- Native image/retry sends while busy are untouched and still disabled by their buttons.

## Commands run (final file state)

- `npx vitest run src/platform/browser-records.test.ts src/features/cloud/account-storage.test.ts mobile/src/composer.test.ts` → 17 passed.
- `npx vitest run src server mobile/src` → 79 files, 526 tests passed.
- `npx tsc --noEmit` → exit 1; every error is in `src/features/progress/fitness-goal.test.ts` (`equipment: readonly []` vs `FitnessSetupDraft`, another agent's fitness-setup work). None in files I touched (grep for browser-records, account-storage, domain, ai-client: empty).
- `npm --prefix mobile run check` → exit 1; errors only in `mobile/src/Onboarding.tsx` (B5) and the untracked `mobile/src/store.test.ts` (another agent; `Mock` not callable, `onError` children). None in `store.tsx`, `Capture.tsx`, `ChatScreen.tsx`, `composer.ts`.
- `npm --prefix mobile run lint` → 0 errors, 3 warnings, all in `mobile/src/store.test.ts` (not mine). `npm run lint` → 0 errors, 73 pre-existing `no-explicit-any` warnings in `tests/*.spec.ts`.
- `npx playwright test tests/unreadable-records.spec.ts tests/account-storage.spec.ts --workers 2` on the shared 5173 server → 8 passed, three consecutive runs. Two earlier runs failed transiently while 5173 was mid-reload from other agents' edits (page error `/src/domain.ts does not provide an export named 'makeMeal'` from `src/App.tsx:136`, blank page); it cleared on its own. No shared server was started or stopped.
- Native: `CI=1 npx expo start --web --port 8081 --clear` (from `mobile/`), warmed with one `GET /index.ts.bundle?platform=web…` (9.5 MB, about 11 s), then `npx playwright test e2e/chat-composer.spec.ts` → 1 failed on old code, 1 passed on fixed code; `e2e/spot.spec.ts e2e/chat-composer.spec.ts` → 4 passed. Metro was killed afterwards (8081 free).

## Not checked / limits

- Real microphone transcription on a phone: the Expo-web journey types into the Voice sheet's "Review your message" field, which is where a transcript lands before sending; `/api/voice` and `expo-audio` recording were not exercised (release check, as before).
- The native join case (a transcript joining a non-empty typed draft) is covered only by the pure test: the native mic button is replaced by Send while a draft is non-empty, so the UI cannot reach it.
- Existing on-device copies made while signed in before this change have the guest form and stay unowned; they are bounded with the guest's copies and never removed by account cleanup (never harmful, just not scoped). No migration was added.
- The in-memory `unreadable` notice state is not reset by `clearBrowserAccount`; the page reloads after sign-out/deletion in practice.

## Ledger-ready paragraph

B6-FOLLOWUPS — native voice transcript dropped while busy; corrupt copies not owner-scoped. (1) `store.send` returned silently while `controller.current` was set and the Voice sheet's "Send message" was disabled on `h.busy`, so a transcript stayed in sheet-local state and was lost when the sheet closed (`mobile/e2e/chat-composer.spec.ts` red: "element is not enabled"). Fix mirrors CHAT-COMPOSER-001: pure `holdWhileReplying` (`mobile/src/composer.ts`, Vitest) joins the text onto the draft with `retainComposerDraft` and the shared `PROCESSING_DRAFT_NOTICE`; the store's busy branch holds text, shows the notice and returns to Chat; the sheet send is no longer gated on `h.busy`; `ChatScreen` clears the draft only when the send is taken. Retries and image sends keep their disabled buttons. (2) `preserveUnreadableBrowserRecords` listed every `fuel.prototype.v1.corrupt-*` key regardless of owner, so an account's copy rotated a guest's out (Vitest red on pre-existing entry points) and `clearBrowserAccount` left the deleted account's copy behind. Rule: a copy belongs to the archive it was taken from; an account's copies carry the encoded owner as the key suffix (`corruptRecordsKey`/`corruptRecordsOwner`), bound and dedupe are per archive, and both `clearBrowserAccount` branches remove only that owner's copies (`src/features/cloud/account-storage.test.ts`, `tests/account-storage.spec.ts`). Gotcha for native browser verification: a `CI=1` Metro bundle is frozen at warm time, so a red-then-green journey needs one Metro cycle per code state; kill the 8081 listener between them.
