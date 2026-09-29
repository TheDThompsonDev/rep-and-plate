# Retailer imports — ticket 18

Checked 2026-09-25. Research only; Rep & Plate has no connected retailer account or purchase-history connector. USDA remains the structured nutrition provider.

| Candidate | Official evidence | Purchase history / nutrition conclusion | Access and next action |
| --- | --- | --- | --- |
| Kroger | The [developer reference](https://developer.kroger.com/reference/) exists, but its documentation did not render in the research fetch. | Product, account, nutrition, and transaction endpoints are **unverified in this run**. Earlier assumptions about public product lookup must not become a claim that personal receipts can be read. | Owner/developer needs to review the authenticated console, register a test application, and capture the actual scopes/response schema. No credentials or retailer session cookies were requested or inspected. |
| Instacart Developer Platform | The [official overview](https://docs.instacart.com/developer_platform_api/) documents product discovery, recipe pages, shopping lists, cart creation, and nearby retailers. | Supports a promising **outbound shopping-list** path. The overview does not establish access to a user's historical orders or complete nutrition fields. [Instacart Connect](https://docs.instacart.com/connect/) is a separate retailer fulfillment product. | API key and relevant terms/access are required. Do not substitute a retailer integration for a consumer purchase-history authorization. |
| Walmart Marketplace | The [official orders endpoint](https://developer.walmart.com/cl-marketplace/reference/getallorders) is in Marketplace APIs and returns seller/order fulfillment structures. | This is not evidence of arbitrary shoppers authorizing Rep & Plate to read their personal Walmart purchase history. US consumer account scope remains unverified. | Do not implement against Marketplace seller credentials for this purpose. Ask the official developer program about a consumer-authorized route only if Walmart is a target retailer. |

No reviewed source establishes universal consumer grocery-history access. Unknown access, quotas, reuse terms, and coverage remain unknown; do not reverse-engineer private authenticated store endpoints. Receipt images already supplied by users remain the available ingestion route. Products can be researched by visible store/name/GTIN with separate nutrition evidence.

## Buildable follow-ups

**18A — Receipt/export adapters without account access.** Accept user-selected CSV/JSON exports only after a real permitted export format is supplied. Map merchant, transaction ID/date, line identifier, original description, quantity/unit, and optional GTIN into a review screen. Import into purchase lots, not consumed meals. Deduplicate by merchant + transaction ID + line ID; hash the uploaded file when IDs are absent and surface that weaker guarantee. Acceptance: repeat import changes nothing; refunds/negative quantities need explicit review; ambiguous units stay unknown; the file is not sent to a retailer.

**18B — Kroger capability proof.** Once registered-app access is available, document exact scopes, example redacted product response, quotas, and whether a supported user-consented transaction endpoint exists. Acceptance: one authorized test account read succeeds, or a clearly documented unsupported answer. No production connector until that proof exists.

**18C — Instacart shopping-list handoff.** After obtaining a key and confirming permitted use, send only the user-confirmed shortage list to create a shopping destination. Opening or buying from that list must not add pantry inventory until a purchase is confirmed. Acceptance: per-item quantities survive the handoff, cancellations do not create purchases, and no historical-order access is claimed.

Retailer selection and platform keys are external inputs. These research notes do not imply those accounts or commercial agreements have been created.
