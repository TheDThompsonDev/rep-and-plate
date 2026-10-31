# Five-persona friction remediation

September 30, 2026. Implementation in the current working tree; awaiting user review. The original [31-entry friction log](../2026-09-30-personas/friction-log.md) remains unchanged as the before-state record.

All 31 findings have a corresponding implemented remedy. This means the observed product behavior or identified setup gap has been addressed; it does not establish that real participants will adopt the features, or certify public launch. Physical phones, real email delivery, representative receipt accuracy, operating cost and human usability evidence remain separate release checks. Nothing was committed, deployed or published in this task.

The user supplied `dthompsondev@gmail.com` for support. Both clients and server configuration use that owned destination by default, with a validated environment override. No email was sent.

## What changed

| Area | Before | Now |
| --- | --- | --- |
| Food records | Decimal edits could fail or alter digits; correction relied on another AI call | Decimal-safe editing, direct proposal correction, manual/offline meals, reviewed meal dates and repeat-meal flow |
| Trust in capture | Reply and card totals could disagree; selected diary day could be ignored | Canonical totals, persisted capture date, bounded date clarification and explicit unknown-portion questions |
| Training | Heavy starter examples, sequential logging, closed sessions without correction | Explicit chosen loads, kg/lb, flexible order, rest timer, optional effort, technique links, historical correction with preserved dates |
| Getting started | Guest account-saving promise and generic targets appeared personal | Accurate guest storage copy, clearly identified sample targets and optional target guidance |
| Kitchen | Setup dead ends and lost generated drafts | Manual ingredient prerequisite, preserved recipe setup during navigation, automatic plan drafts, purchase-date labels, prioritized review queue |
| Release support | No public help destination; outdated storage instructions | Owned support link, minimized diagnostics and updated web/native runbooks |

## Finding-by-finding acceptance map

All rows below are implemented. “Native” verification refers to the fresh Expo-web export unless explicitly stated otherwise. The [native notes](native.md), [shared notes](shared.md), and [Kitchen notes](kitchen.md) provide implementation details and narrower test evidence. Aggregate results are in [verification](verification.md).

| ID | Implemented remedy | Acceptance evidence / scope |
| --- | --- | --- |
| F01 | Web meal editor accepts decimal macros even for name-only edits | `tests/persona-remediation.spec.ts` decimal correction and persisted exact values |
| F02 | Native editor keeps raw strings until submission | Native sequential-keystroke decimal regression; physical keyboards remain unverified |
| F03 | Guest setup explicitly says records stay on the device | Both onboarding implementations; fresh five-persona setup snapshots |
| F04 | Profile activity counts the union of meal, strength and timed-movement dates | Workout-only and walk-only browser checks; duplicate dates count once |
| F05 | Profile workout history shows actual load with each recorded rep count | Root history regression, using the selected unit |
| F06 | Reply and review card share normalized totals; corrections replace stale linked prose | Server regression, live decimal-label check and proposal-edit UI journey |
| F07 | Walking/cardio has manual entry, reviewed AI proposals and saved dated minutes | Live 20-minute walk, shared idempotence and native/web journeys; no inferred calorie burn |
| F08 | Sample targets remain labeled until reviewed; target editor explains optional goal setting | Shared metadata and both editors; guidance does not invent a personalized prescription |
| F09 | Starter loads begin unchosen; explicit load required before set recording, including Chat | Shared rejection test, web disabled controls and native atomic set-save test |
| F10 | Starter exercises have concise technique cues and primary-source guide links | Shared technique map reviewed against linked ACE/NASM/Mayo material; no individualized coaching claim |
| F11 | Any exercise can be logged; reorder and jump controls, rest timer and optional effort support flexible sessions | Reorder preserves loads/effort/chat references; web later-exercise and native set journeys. Supersets can be recorded by alternating exercises; no separate programming engine added |
| F12 | Partial finish is reviewed; current and historical sessions reopen for correction | Shared original timestamp regression and web historical correction; active session cannot be silently replaced |
| F13 | Workout input/history uses chosen kg or lb; storage stays in pounds | Conversion boundary tests and native/web kg correction/reload checks |
| F14 | Purchased date and captured date are explicitly distinguished | Receipt heading and pantry date regression; original capture date preserved |
| F15 | Recipe setup keeps entered name/yield while opening actionable offline ingredient setup | Complete recipe → manual ingredient → return → prepare journey on both clients; temporary setup draft survives navigation, not a full app restart |
| F16 | Repeat meal reviews the new date and values without another AI estimate | Exact decimals retained; fresh meal identity; batch/lot links removed so stock is not silently consumed twice |
| F17 | Pending meal estimates open a direct editor; cancel leaves original intact; save still needs logging confirmation | Web/native cancel/edit/accept checks and unchanged meal count before acceptance |
| F18 | Selected diary day travels with capture and retries; both saved-meal editors expose dates | UI request assertion, shared date guards and live historical capture |
| F19 | Planner offers pantry-only vs shopping-supported and varied vs repeat-friendly modes | Shared generation guards reject insufficient/unknown stock or repetitive drafts where disallowed. Provider-written notes are discarded so unverified stock claims cannot contradict the computed pantry check there; user-authored notes remain intact. Generated plans provide ingredient/portion schedules, not cooking directions. Culinary quality still needs real-user evaluation |
| F20 | Generated and edited meal-plan drafts save through existing private persistence; approval remains explicit | Close/reload recovery; unchanged original approved plan, food intake and inventory checks |
| F21 | Native preferences map internal enums to readable labels and grouped controls | Native preferences verification; stored values remain compatible |
| F22 | Native set rows align load/reps/save; guidance and reorder actions follow entry controls | 390px screenshot and measured first-row visibility; real-device timing remains unmeasured |
| F23 | Native interactive dates/targets/Kitchen controls expose roles and state | Native role-based journeys; VoiceOver/TalkBack certification remains external |
| F24 | Confirmed label returns directly to its selected product and retained barcode | Scanner test now asserts the product appears without another lookup, then verifies later reuse after reload |
| F25 | Validated owned support destination works even when configuration is offline | Mailto validation tests and web offline-support link check; no email-delivery claim |
| F26 | Nutrition exposes direct manual meal entry for the selected day | Offline web/native meal creation and reload, independent of AI availability |
| F27 | Pantry prioritizes uncertain food review and explains package-to-serving calculations | Queue excludes nonfood; exact-item routing; numeric calculator and manual ingredient guards |
| F28 | Native history opens load-aware details and supports deliberate correction | Native historical session journey, original date preservation and stored load checks |
| F29 | Optional preferences use progressive groups without losing collapsed values | Kitchen preference journey plus native readable-group checks |
| F30 | Explicit eaten-food intent stays known during a portion clarification | Provider normalization tests and live peanut-butter question; conservative English guard, not a general language parser |
| F31 | Primary web/native READMEs describe automatic linked-account saving, private media, conflicts and current release evidence | Source-to-runbook review; outdated “latest” counts replaced with dated evidence links |

## Coordination and review

The swarm had three implementation agents plus the integrating root: native UI, Kitchen/planning, and shared model/AI. File ownership kept concurrent edits separate. Root integrated the web flows and reran aggregate checks. Existing dirty product and assistant-connection work was retained.

Cross-review identified additional consequences and repaired them: historic workouts changing completion dates, kg display inconsistencies, temporary drafts surviving reset/account changes, legacy Chat set recording bypassing chosen-load guards, and weekly volume ignoring individual set loads. Activities are preserved through cloud backup/conflict handling, while existing external assistant scopes do not silently disclose the new activity data.

New assertions reproduced original failures before repair. Existing fixtures were updated where the intended interaction changed—for example, deliberately choosing a starter load, confirming partial completion, opening a collapsed preference group, and recognizing autosaved drafts. No tests were disabled or failure thresholds reduced. The first integrated browser result is retained as invalid infrastructure evidence because another runner stopped its shared dev server; final runs use a root-owned persistent server after source freeze.

The CYC controller could not create a run because source fingerprint selection exceeded its existing limit (`CYC-ASSETS-001`). Configuration was not weakened. Direct checks and the response/artifact review gate provide the retained evidence; no controller-managed completion is claimed.

## Remaining launch evidence

- Signed iOS and Android hardware journeys: camera/barcode, voice, keyboard, background/resume, accessibility and storage interruption.
- Actual confirmation/recovery email delivery and a human support response check.
- Permissioned representative receipts and meal ground truth, provider cost and latency measurements.
- Human sessions with these five persona groups to observe real avoidance, delight and recurring use. The original persona reactions remain hypotheses.
- Verification of the intended hosted build, migrations and public admission policy before deployment. This task changes the checkout and does not open public access.
