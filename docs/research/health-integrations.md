# Health and tracker integrations — ticket 19

Checked 2026-09-25. No health connector is implemented or authorized. The current browser app cannot directly call native phone health stores.

| Route | Demonstrated capability | Requirements / limits | Recommendation |
| --- | --- | --- | --- |
| Apple HealthKit | Apple's [authorization guide](https://developer.apple.com/documentation/healthkit/authorizing-access-to-health-data) requires an app HealthKit capability and health-data authorization. | Native Apple app target, per-type user permission, appropriate usage descriptions and distribution review. A browser tab is not a HealthKit client. | Native companion candidate after choosing iOS. Begin read-only workouts and selected daily summaries, not every health type. |
| Android Health Connect | [Availability](https://developer.android.com/health-and-fitness/health-connect/availability) and [raw-data reads](https://developer.android.com/health-and-fitness/health-connect/read-data) document an on-device store with granted read/write access. | Android app, feature checks, per-type permissions. Background and extended historical reads require additional permissions. Default historical access is generally limited to 30 days before first permission; version-specific rules apply. | Recommended first **native** proof because permission denial, duplicate sources, and history windows are explicitly testable. Use aggregation for cumulative steps to avoid double counting. |
| Google Health API / Fitbit | The [current Google Health API](https://developers.google.com/health) documents OAuth, health metrics from Fitbit/Pixel Watch and other sources, and standardized data bundles. | Google project, OAuth client/consent and actual approved scopes are needed. The [legacy Fitbit authorization page](https://dev.fitbit.com/build/reference/web-api/developer-guide/authorization/) announces legacy API deprecation in September 2026. | Do not start a new legacy Fitbit adapter. Evaluate the Google Health API codelab and current access requirements for a browser/server connector. |
| Garmin Connect | [Health API](https://developer.garmin.com/gc-developer-program/health-api/) offers consented synced health summaries; [Activity API](https://developer.garmin.com/gc-developer-program/activity-api/) includes recorded activities and activity files. | Business program approval, evaluation access, real user consent, device synchronization. Some commercial metrics can require fees; confirm current [program terms](https://developer.garmin.com/gc-developer-program/program-faq/). | Defer until user demand justifies the access process. Do not confuse cloud summaries with direct real-time sensor access. |

## Proposed normalized contract

This is an implementation brief, not an existing persisted schema:

`HealthImport { id, ownerId, provider, providerUserId, sourceRecordId, sourceDevice?, kind, startAt, endAt, timezoneOffsetMinutes, value, unit, sourceUpdatedAt, importedAt, deletedAt?, rawReference? }`

Keep source IDs stable. Unique key is owner + provider + sourceRecordId; an updated source record replaces its current observation while preserving an audit entry. Imported activity is separate from manually logged strength sets. Never invent missing reps, loads, sleep, or readiness.

When two sources overlap, retain both observations but select a preferred source for a given metric/day or use the platform's supported aggregation. Do not sum Fitbit steps, phone steps, and an overlapping Health Connect aggregate. Show the source and last sync time. Store UTC boundaries plus original offsets; local-day grouping must pass daylight-saving tests. Revocation stops new imports and offers deletion of existing imported data.

## Follow-up 19A — one read-only bridge

After the owner selects a mobile platform, build a native companion that reads the last seven days of authorized workouts plus daily steps and sends a bounded, reviewed payload to Rep & Plate's authenticated API. No access to unrelated health types. Prerequisite: private per-user persistence from ticket 22.

Acceptance: permission denial leaves manual logging usable; revoke/reconnect works; pagination and updates do not duplicate observations; overlapping sources do not double-count; exercise energy does **not** increase calorie targets; cross-user access is denied. Include device testing for current OS permission/history behavior. No public connector claim until an actual authorized-device round trip succeeds.
