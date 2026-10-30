# Round-two audit protocol

September 30, 2026. Repeat evaluation of the remediated working tree using the same five simulated personas: experienced gym enthusiast, complete beginner, six-month gym/calorie tracker, fit person new to calorie tracking, and software developer. This is agent-led usability inspection, not research with human participants. No quotes, feelings, adoption rates or genuine wishes are asserted.

## Questions and evidence

For each journey, record the intended task, expectation, actual actions and result, friction/workaround, and evidence. Separately assess a possible wish for something missing or easier. Classify wishes as absent capability, existing but difficult to find, cumbersome existing workflow, or an untested hypothesis. Check the UI and source before calling a feature missing. No minimum finding count; successful paths and no observed friction are valid results.

Record likely regular-use essentials versus occasional/nice-to-have features, and possible avoidance, as persona hypotheses with reasons. Opening a dialog is browsing coverage, not proof of completing its workflow. A single exploratory failure must be reproduced or retained as unresolved. Distinguish harness errors from product failures. Provider fixtures, live provider requests, source inspection, Expo-web and physical-device evidence remain distinct.

## Execution

- Root: fresh onboarding and all primary surfaces for each persona, unmocked local requests for four representative captures, consolidation and source-freeze verification.
- Kitchen agent: expert and six-month personas, deeper training, food and Kitchen tasks with populated data and return use.
- Shared agent: beginner and fit/new-tracker personas, learning, portion uncertainty, manual/offline food, activity, starter training and returning use.
- Native agent: developer persona, durability, recovery, privacy/accessibility, and Expo-web parity.

Use isolated Playwright contexts and synthetic records only. Do not alter the user's browser, send email, sign into a real account, or deploy. Keep app source unchanged; record recommendations rather than implementing them in this pass. Retain scripts, timestamped results, accessible snapshots and relevant screenshots under this directory.

## Boundaries

Real human wishes, long-term retention, physical iOS/Android behavior, actual account email/support delivery, representative food accuracy and the intended hosted release remain unverified. The CYC controller run could not start because its source fingerprint selection exceeded the existing asset limit (`CYC-ASSETS-001`); configuration was not changed. Direct evidence and the response review gate are used, with no controller-managed completion claim.
