# Meta glasses capture — ticket 20

Checked 2026-09-25. Feasibility research; no glasses integration has been built or tested on hardware.

Meta now documents a [Wearables Device Access Toolkit](https://developers.meta.com/wearables/device-access-toolkit/) that extends iOS and Android apps to AI glasses, with camera and speech/audio capabilities. The [preview announcement](https://developers.meta.com/wearables/notify/) links iOS/Android preview access. Meta's [April 2026 developer article](https://developers.meta.com/blog/explore-whats-possible-with-wearables-device-access-toolkit/) describes mobile applications using glasses camera/audio inputs.

This is a credible official route for a future Rep & Plate companion. It does not mean this React browser app can connect directly to every Ray-Ban model, nor does it establish that camera access is available from every display-glasses web-app environment.

The [detailed developer documentation](https://wearables.developer.meta.com/docs/develop/) required login during this review. Exact supported generation, firmware, developer-mode enrollment, feature availability, and public distribution permissions have not been verified for the user's device. The owner has not specified their glasses model or companion phone platform. These are explicit external prerequisites, not assumed support.

## Follow-up 20A — user-initiated photo into Chat

First test the simplest available workflow on the actual device: capture a meal/receipt photo, export/share it to the phone's media library, then upload that photo through Rep & Plate's existing Chat attachment flow. Do not promise an OS share-extension destination until a native extension exists. Acceptance: photo arrives upright and legible; original capture context can be entered; no meal or purchase is confirmed automatically; retry is idempotent.

## Follow-up 20B — native toolkit proof

Once device model, iOS/Android target, developer access, and applicable preview distribution rules are known:

1. Build a small native companion using the official SDK/sample and supported device pairing.
2. Require an explicit capture action and camera permission. Receive one photo; show it on the phone for review.
3. Send the confirmed photo and caption to the same authenticated capture endpoint used by Chat. Return an editable proposal, not an automatic health-record write.
4. Optionally read a short acknowledgment through an explicitly enabled audio path after the photo flow works.

Acceptance: permission denied/revoked, glasses disconnected, blurry capture, cancellation, upload failure, and retry all have clear outcomes; no background or always-on recording; one capture yields one pending record. Hardware test evidence must name model, firmware, phone OS, SDK version, access mode, and tested distribution channel.

Development approval is not a guarantee of public distribution approval. Keep the current upload path available when direct integration is unavailable. No retailer credentials, unrestricted camera streams, or health history should be shared with the glasses integration merely to log a meal.
