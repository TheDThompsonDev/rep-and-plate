# Personal details and target review during onboarding

Implemented locally on web and native; user acceptance pending. The follow-up was interpreted as collecting the inputs needed for calorie/macro targets, after offering clarification between that and mandatory weight setup.

## Experience

Onboarding now asks for age, height with cm/inches, usual activity and an optional equation sex choice after goals/current weight. This step appears even when weight setup is deferred. Real current weight is reused rather than asked for twice. Users can estimate and edit daily targets, enter targets they already follow, save personal details without targets, or explicitly defer the step. Required-name and combined-focus ordering remain intact.

Target previews do not write records or activate targets. The final onboarding completion saves name, selected goals, the real dated weight, personal baseline and explicitly selected targets together using the existing durable save. A details-only save preserves existing daily targets; skipping preserves existing baseline and targets. Legacy profiles have no new forced setup or migration.

The profile provides Calorie starting point to revisit age/height/activity and target review. The selected calorie approach is saved, so reopening does not re-derive it from a different weight goal. Existing daily target editing remains available. A later weight entry does not silently recalculate targets. Validated conversational context now carries the saved baseline alongside goals, target-configuration state and real weight measurements; the server describes it as self-reported rather than medically validated.

## Estimate and source decisions

The estimate uses the simplified [Mifflin–St Jeor resting-energy equation](https://pubmed.ncbi.nlm.nih.gov/2305711/) with kg/cm/years and the chosen sex coefficient. Activity multipliers 1.4/1.6/1.8/2.0 are broad product assumptions, consistent with the activity scale described by the [NIDDK planner](https://www.niddk.nih.gov/bwp%C2%A0); this implementation is not its dynamic model. Maintenance has zero adjustment; lose/gain choices explicitly show a 250-calorie daily adjustment. These are editable starting assumptions, not guaranteed outcomes or weight-goal deadlines.

Macros start at 20% protein, 50% carbohydrate and 30% fat, within the published adult distribution ranges in the [Dietary Reference Intakes](https://www.ncbi.nlm.nih.gov/books/NBK221374/?report=reader). Rounded grams remain separately editable. This is a general starting split, not individualized sports nutrition or clinical guidance.

The standard estimate requires all real inputs, an equation sex choice, age 18 or older and explicit applicability confirmation. The [NIDDK adult planner](https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner) likewise excludes pregnancy, breastfeeding and younger users. Details-only and manual routes remain available. The estimator rejects results outside the product's 1,200–6,000 range rather than silently clamping them; those support bounds do not establish suitability for everyone. Existing manually entered targets keep the existing schema bounds.

## Evidence and recovery

- Shared feature pin failed when the module was absent, then passed known literal calorie/macro outputs, both unit systems, missing/invalid/out-of-scope inputs, unchanged original records and validated conversational context.
- Initial native types failed because a type import from the web renderer pulled in its CSS. The props type now lives in the shared data module.
- First focused web run passed 20/22. A preview assertion incorrectly expected a fresh device to already have a durable profile; the correct pre-completion snapshot is null. The check now asserts no saved record before completion and preserves exact completed/reloaded target and measurement assertions.
- The expanded focused web run passed 38 journeys, including account restore, required-name validation, interaction previews and both new target paths. Final configured and native outcomes are retained in evidence/verification.json and logs.
- Initial native journeys passed 6/7; the new reload assertion expected a persistent profile tab, but the app intentionally reopens Chat. The fixture now reopens the profile after reload, as existing native journeys do. Two new duplicate-import warnings were removed without changing lint rules.

## Semantic review and retained learning

Self-review covered schema compatibility, parsed baseline/target bounds, explicit applicability, unit conversions, absence of defaults for age/activity/height/weight, atomic completion, retries without duplicate weight measurements, details-only preservation, skip behavior, account-record comparison, future measurement exclusion, profile editing and AI contract retention. The account fresh-device check compares all profile fields, so collected body details cannot be mistaken for an untouched device. Shared state logic stays independent of web/native presentation; native lint/type checks remain intact.

No destructive reset, account-policy change, push notification or target recalculation on a weight entry was introduced. Error history is retained as NUTRITION-SETUP-001 in docs/context/error-ledger.md. Candidate learning pending user acceptance: collect body data where the first target review happens, then preserve deliberate target selection separately from raw measurements.

## Limits

Native journeys run through Expo web, not physical devices. No live AI personalization or clinical accuracy claim is made. CYC managed startup hit the existing 20,000-file/128-MiB fingerprint limit; configured commands run directly, without engine/config changes or a managed-completion claim. Existing lint/bundle warnings are retained. No deployment or commit was requested.
