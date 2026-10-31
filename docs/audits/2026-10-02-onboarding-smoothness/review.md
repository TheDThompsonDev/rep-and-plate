# Onboarding smoothness review

Judgment: clearer and more useful, with remaining friction worth addressing before calling it very smooth. This is a review, not implementation approval or a conversion/usability result. No production files were changed.

## Fresh journey evidence

An isolated synthetic guest session at 390 × 844 followed Welcome → Spot introduction → interaction example → account choice → name/focus → goals/weight → personal details → target review. The extra four Spot slides are optional through More about Spot; the main route does not force all five. Direct account entry can also bypass the introduction. An initial commentary assumption about the five slides was corrected after inspecting routing.

The target review rendered the expected estimate from supplied example inputs. Refreshing there returned to Welcome and discarded unfinished setup. Screenshots and headings/actions are retained in evidence/walkthrough.json, details.png and targets.png. No account was created, paid AI invoked or existing user records touched.

The previous implementation verification reports 428 unit tests, 326 browser journeys and seven Expo-web journeys passing. Those checks establish functional behavior, not usability or conversion. This review adds a fresh routing/recovery walkthrough and source inspection; it does not claim a new full-suite run.

## Priority findings

- src/features/onboarding/InteractionGuide.tsx:12 — “Try with something from today” invokes the account/setup transition through Onboarding.tsx:271; the label suggests a real entry sooner than it occurs. Make the label accurately describe setup, or provide the promised manual first action at that point while retaining account requirements for connected AI.
- src/features/progress/NutritionSetup.tsx:25 — personal-details view exposes Estimate, Own targets, Details only, Skip and Back. Review likewise offers five actions. Keep one primary action and one clear deferral path; place manual/advanced alternatives under a subordinate expansion. Preserve the requested data collection and adult-estimate scope.
- src/features/onboarding/Onboarding.tsx:41 — name, goals and nutrition drafts live in component state; durable completion occurs at line 75. The fresh refresh check confirmed loss of unfinished setup. Save/resume an identity-scoped draft and keep completed records unchanged.
- src/features/onboarding/Onboarding.tsx:527 — completion presents targets and first-step copy, then routes most focuses to Chat. A guided first real meal/workout is a stronger next interaction to evaluate. This is a product recommendation, not an experimentally measured retention claim.

## Interface guideline findings

Reviewed the current [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) against the onboarding, guide and setup components.

- src/features/progress/NutritionSetup.tsx:11 — target inputs lack meaningful name/autocomplete attributes; the personal-detail fields likewise omit them.
- src/features/progress/useNutritionSetup.ts:15 — validation sets a form-level alert but does not focus or associate the invalid field. Long-form recovery deserves a field-specific error/focus pass.
- src/features/progress/NutritionSetup.tsx:9 — switching to target review replaces the focused estimate button without a deliberate focus destination. Check keyboard/screen-reader transition behavior in the next polish pass.
- src/features/onboarding/Onboarding.tsx:109 — scene image lacks intrinsic width/height attributes. Existing CSS may reserve its layout; this is a source guideline finding, not a measured layout-shift claim.

Visible labels, semantic form controls, explicit record review and optional/manual paths are present. The mobile target screenshot shows reachable controls and no horizontal clipping. Guideline/source review does not replace assistive-technology or physical-device testing.

## Recommended next scope

Keep goal/body information. Tighten action hierarchy and expectations, preserve unfinished progress, and finish with one guided real action. Then observe several first-time users without coaching; measure where they hesitate, abandon or misunderstand targets. No invented completion rate or duration is provided.

## Limits and review disposition

No human usability study, physical-device check, live AI session or conversion measurement. Findings remain recommendations awaiting a request to implement. No context lesson was promoted or production error ledger changed during this advisory review. CYC managed startup still hits the existing source-fingerprint limit; this is direct review evidence, not managed completion. The local server was initially unavailable and was started for the isolated walkthrough.
