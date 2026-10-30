# A1-data-loss — Q1: unreadable web snapshots were overwritten with an empty account

Finding: Q1 (README section 3). Playbook: bug-fix (high risk: data loss). Managed `cyc run` cannot start here (CYC-ASSETS-001), so checks are run directly.

## Plan (written before editing)

Goal: a web snapshot that cannot be parsed, or carries an unrecognized `version`, is never replaced by `initialState()`; its raw bytes are copied aside before any write and the app says so.
Done when: (1) corrupt JSON in `fuel.prototype.v1` survives first render and a sibling `fuel.prototype.v1.corrupt-<ts>` copy exists; (2) a `version: 2` blob is treated the same; (3) an empty device still gets its first durable snapshot on mount; (4) a valid v1 blob loads byte-for-byte as before; (5) a visible `role="status"` notice appears.

Approach: repair + extend.
- `src/domain.ts` (readState area only): add `STATE_VERSION`, a version-keyed `stateMigrations` table (`1: identity`, with the documented slot for 2), `parseStoredState(raw)` that routes every schema parse through the table, `readStoredState()` returning `fresh | loaded | unreadable`, and keep `readState()` as `readStoredState().state` so Onboarding and `day.test.ts` keep their contract. Keep `upgradeChat`.
- `src/platform/browser-records.ts`: `preserveUnreadableBrowserRecords(raw, reason)` queues a copy to `fuel.prototype.v1.corrupt-<Date.now()>` through the same `browserRecordTransaction` queue (so it is ordered before any later save), bounded to 3 copies, idempotent per raw; `persistBrowserRecords` gains a guard: while the stored active blob is still the unreadable one, it awaits the copy and refuses to overwrite if the copy failed. Notice state + listeners (`unreadableBrowserRecords()`, `onBrowserRecordNotice()`, `unreadableRecordsMessage()`), mirroring the `sync-control.ts` listener pattern.
- `src/platform/useBrowserRecords.ts`: read through `readStoredState()`; the passive mount write is skipped when the snapshot was unreadable (`persistOpenedRecords`). Fresh and loaded keep today's behavior.
- `src/platform/snapshot.ts` (native): `restoreDeviceSnapshot` parses through `parseStoredState` so native gets the same migration chain and still throws.
- `src/platform/BrowserRecordsNotice.tsx` + `src/main.tsx`: a root-level `<div className="toast" role="status">` reusing the existing toast class/markup, shown once the copy settles. Root-level because `src/App.tsx` is owned by another agent and because Onboarding also calls `readState()` before App mounts.

Keep consistent (found by search):
- `src/features/onboarding/Onboarding.tsx:50,66,77` — calls `readState()` and `persistBrowserRecords()`; contract unchanged, writer guard protects its `complete()` write.
- `src/features/cloud/account-storage.ts:23-31` — writes the active key with `browserSet` directly inside `browserRecordTransaction`; eager, queued preservation runs before it.
- `src/App.tsx:191,1238,2064` — hook tuple shape unchanged; restore paths go through the guarded writer.
- `src/day.test.ts:103` — `readState()` returns `AppState`, no `setItem` on a valid blob.
- `tests/record-fixture.ts`, `tests/app-fixture.ts` — seed through the writer / a valid blob; unchanged.
- `mobile/src/storage.ts:123-300` — `restoreDeviceSnapshot` keeps throwing on bad data.

Context/history: `docs/context/error-ledger.md` has no entry for records overwrite; related entries cover journal-before-IndexedDB ordering (line 320) and corrupt onboarding drafts (line 339), which this change does not touch. `src/platform/snapshot.ts:4` already documents the native rule ("A bad saved file must not be replaced with an empty account").

Tests first: `src/platform/browser-records.test.ts` (corrupt preserved not overwritten; future version preserved; fresh device initializes; valid v1 unchanged; bounded copies; idempotent per raw; writer refuses when the copy failed), `src/domain.test.ts` (migration table and `parseStoredState`), one assertion in `src/platform/snapshot.test.ts`, optional `tests/unreadable-records.spec.ts` for the browser journey.

Open: none that change the solution. Residual risk recorded below under limits.

## Reproduction (red first)

`npx vitest run src/platform/browser-records.test.ts src/domain.test.ts src/platform/snapshot.test.ts` against the unchanged code: 10 failed. The defect itself was reproduced by the one test that uses only pre-existing entry points (`readState()` then `persistBrowserRecords()`, the sequence the hook ran on mount): with `fuel.prototype.v1 = '{broken'` it failed with `expected [] to have a length of 1 but got +0` — no copy existed and the active key had been replaced by an empty account. The other nine failed on the missing `readStoredState`/`parseStoredState`/`persistOpenedRecords` exports.

## Change and mechanism

- `src/domain.ts:372-422` — `STATE_VERSION`, `stateMigrations` (`1 → identity`, with the documented slot for version 2), `parseStoredState(raw)` (JSON → version lookup in the table → `stateSchema.safeParse` → `upgradeChat`), `readStoredState()` returning `fresh | loaded | unreadable`, and `readState()` kept as `readStoredState().state`. `src/domain.ts:606` imports `preserveUnreadableBrowserRecords`.
- `src/platform/browser-records.ts:60-98` — on detection the raw blob is queued on the shared write queue to `fuel.prototype.v1.corrupt-<Date.now()>` (bounded to 3, oldest removed; a blob identical to an existing copy reuses it, so repeated starts add nothing). `guardUnreadableRecords()` runs inside `persistBrowserRecords`'s transaction: while the stored active blob is still the unreadable one, it awaits the copy and refuses to overwrite if the copy failed. Notice state is exposed through `unreadableBrowserRecords()`, `onBrowserRecordNotice()` and `unreadableRecordsMessage()`.
- `src/platform/useBrowserRecords.ts:9-12,27` — `persistOpenedRecords()` skips the passive mount write for `unreadable`; `fresh` and `loaded` behave exactly as before.
- `src/platform/snapshot.ts:6-9` — native `restoreDeviceSnapshot` parses through `parseStoredState`; still throws on bad data (now also on an unknown version).
- `src/platform/BrowserRecordsNotice.tsx` + `src/main.tsx:4,11` — root-level `<div className="toast" role="status">` (App's own toast class and markup) driven by `useSyncExternalStore`, shown once the copy settles, auto-dismissed after 12 s. No App.tsx change is needed; nothing for the orchestrator to wire.

Why root-level rather than App's `notify`: `src/App.tsx` is owned by another agent, and `Onboarding.tsx:50` calls `readState()` before App mounts, so a notice inside App could not cover that path.

## Consumers checked

- `src/features/onboarding/Onboarding.tsx:50,66,77` — unchanged contract; its `complete()` write passes through the guarded writer.
- `src/features/cloud/account-storage.ts:19-39` — `switchBrowserAccount` writes the active key via `browserSet` inside `browserRecordTransaction`; the eager copy is queued ahead of it.
- `src/App.tsx:191,1238,2064` — hook tuple unchanged; restore paths use the guarded writer. `src/day.test.ts:103` still passes (`readState()` returns `AppState`, no `setItem` on a valid blob).
- `tests/record-fixture.ts`, `tests/app-fixture.ts`, `tests/account-storage.spec.ts` — seed valid blobs or write raw strings only after load without re-reading; unaffected.
- `mobile/src/storage.ts:123-300` — `npm --prefix mobile run check` passed.
- Not changed, noted: `account-storage.ts:28` and `features/cloud/client.ts:118,205` still call `stateSchema.parse/safeParse` directly for account archives and cloud payloads (hosted copies, not the device snapshot this finding covers).

## Commands run (final file state)

- `npx tsc --noEmit` — exit 0.
- `npx vitest run src server` — 71 files, 472 tests passed (audit baseline 69 / 432; +8 in `browser-records.test.ts`, +2 in `domain.test.ts`, others from parallel agents).
- `npx vitest run src/platform/browser-records.test.ts src/domain.test.ts src/platform/snapshot.test.ts src/day.test.ts` — 25 passed.
- `npm --prefix mobile run check` — exit 0 (native consumer of `snapshot.ts`).
- `tests/unreadable-records.spec.ts` — **not run**: `http://127.0.0.1:5173` was not listening at any point during this session (PowerShell `Invoke-WebRequest` and `netstat` both confirmed), and the brief forbids starting a server. Another agent's private Vite on 5199 was observed but had already exited. Run with `npx playwright test tests/unreadable-records.spec.ts --workers 2` once the shared server is up.

## Not checked / limits

- The browser journey (hook mount skip + root toast visible + copy in IndexedDB) is covered only by the unrun Playwright spec; the mechanism is unit-tested with `indexedDB` undefined (localStorage path of `browserSet/Get/Keys`).
- If the aside copy itself fails (device storage full), every save on that device is refused with "Your earlier records could not be opened or copied…" until storage is freed or site data cleared. This is the literal "never overwrite" rule and matches native; it is a deliberate trade-off.
- Corrupt copies are not owner-scoped; `clearBrowserAccount` does not remove them. If a signed-in account's snapshot was the corrupt one, its copy survives account deletion on that device (bounded to 3). Follow-up candidate for the account-storage owner.
- `src/domain.test.ts` was briefly overwritten by a tooling mistake and restored byte-for-byte from HEAD before my tests were appended; `git diff` shows only the appended block.

## Ledger-ready paragraph

RECORDS-OVERWRITE-001 — unreadable web snapshots were replaced by an empty account. `readState` swallowed every parse failure and returned `initialState()`, and `useBrowserRecords` persisted that on mount to the same key, so a corrupt blob or one written by a newer schema version was silently destroyed on first render (native already threw). Fix: schema parsing goes through a version-keyed migration table (`stateMigrations`, `parseStoredState`); `readStoredState()` distinguishes `fresh` (persist allowed) from `unreadable` (mount write skipped); the raw blob is copied to `fuel.prototype.v1.corrupt-<ts>` on the shared write queue before anything can overwrite it (3 copies, content-deduplicated), and the writer refuses to replace the blob if that copy failed. A root-level toast (`BrowserRecordsNotice`) tells the user records could not be opened and a copy was kept. Gotcha: `account-storage.ts` writes the active key with `browserSet` directly, which is why preservation must be eager at detection and queued, not lazy at `persistBrowserRecords`.
