# Swarm brief — 2026-10-10 remediation

You are one agent in a swarm fixing findings from [README.md](README.md) (the audit). Read the finding rows assigned to you there first; they carry file:line evidence.

## Use the CYC flow

Read `.claude/skills/cyc/SKILL.md`, then `.cyc/engine/methods/cyc-scout/SKILL.md` and `.cyc/engine/methods/cyc-verify/SKILL.md`, and follow **scout → build → verify ⟲ fix → deliver** with that rigor.

The managed controller cannot start in this repository: `cyc run start` fails with `CYC-ASSETS-001` (tracked `public/` assets exceed the 128 MiB source fingerprint). This is a known, documented limit in `docs/context/error-ledger.md`. Do **not** edit `.cyc/config.json`, `.cyc/engine`, or `.gitignore` to work around it. Instead run the configured checks directly, exactly as every prior session in this repo did.

### Scout
- Search `docs/context/error-ledger.md` and the relevant `docs/context/*.md` for your component before changing code. Check freshness against the working tree.
- Reproduce each defect with a failing test first (unit in Vitest or a focused Playwright spec). Do not change code for a bug you have not reproduced.
- Write a short plan (what changes, which consumers, what must stay intact) into your note file (below) before editing.

### Build
- Small slices: red test → minimal fix → green. Keep every named consumer consistent (web, native, server, tests).
- Stay inside your assigned file scope. If a fix genuinely needs a file outside scope, make the smallest possible edit and record it in your note. Never edit files another agent owns (listed in your assignment).
- No commits, no pushes, no `git stash`, no `git checkout --`, no reformatting of files you did not otherwise change, no `eslint --fix` across the tree.

### Verify (run directly)
- `npx tsc --noEmit` (web) and, if you touched `mobile/`, `npm --prefix mobile run check` and `npm --prefix mobile run lint`.
- `npx vitest run src server` (and `npx vitest run scripts/agents` if you touched contracts or server routes).
- Focused browser checks only: `npx playwright test <your specs> --workers 2`. A dev server is already running on http://127.0.0.1:5173 and Playwright reuses it. Do **not** run the full browser suite and do **not** start or stop servers; other agents share that server (see ledger entry VERIFY-SWARM-001). The orchestrator runs the full suite after each wave.
- Native browser specs (`mobile/e2e`) need Metro; only run them if the orchestrator's assignment says so.
- Reread your whole diff before declaring done: intent, consumers, conventions, leftover debug code.

### Deliver
- Write your note file at `docs/audits/2026-10-10-repo-audit/notes/<id>.md` with: finding ids, reproduction (the red test and how it failed), the change and the mechanism, consumers checked, exact commands run with results, what you did not check, and a ledger-ready paragraph. Do **not** edit `docs/context/error-ledger.md` yourself; the orchestrator consolidates notes into the ledger to avoid concurrent edits.
- Your final message: result first, then criteria evidence, then limits. Include file:line pointers. Under ~400 words.

## Shared facts
- Node 22.14 locally; `tsx` runs the server; Vitest 5; Playwright config at `playwright.config.ts` (desktop + mobile projects, `fullyParallel`, 3 workers).
- Line endings: files are a mix; preserve each file's existing endings.
- Prior remediation evidence lives in `docs/audits/` (git-ignored but present on disk).
