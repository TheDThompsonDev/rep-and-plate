# Other-agent interoperability — ticket 21

Checked 2026-09-25. The names **Muse** and **grokbot** in the supplied conversation do not uniquely identify developer products or official endpoints. No connector, protocol compatibility, pricing, or account permissions can be asserted from those names. Exact official URLs and intended read/write capabilities remain required inputs. No similarly named service has been substituted.

## Proposed interface

Start with a provider-neutral boundary around Rep & Plate's typed actions. It should not expose the entire chat store or accept arbitrary database operations.

| Capability | Proposed scope | Required result |
| --- | --- | --- |
| Read summary | `summary:read` | Requested date range, actual totals, uncertainty, source dates; omit photos and unrelated chat |
| Read pantry | `pantry:read` | Available quantities and units, unknown quantities explicitly null, source/product version |
| Propose a meal/plan | `proposal:write` | Validated draft with source agent ID and stable action ID; user reviews it in Rep & Plate |
| Confirm consumption | Separate user-authorized action | Explicit record/quantity and confirmation, idempotency, reversible pantry effects; never inferred from a suggestion |

For a compatible remote MCP client, [MCP's HTTP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization) supplies an OAuth-based transport model with protected-resource discovery and audience-bound access tokens. That is one possible transport; it is **not evidence that Muse or grokbot supports MCP**. An ordinary documented REST integration may be more appropriate after product identification.

Use typed, versioned JSON proposals with `{ actionId, actor, ownerId, kind, payload, createdAt, expiresAt, status }`. The authenticated session determines ownerId; never trust an agent-supplied user ID. Scopes control permitted fields and operations. Token revocation, expiry, per-user quotas, and audit IDs belong at the API boundary. Tool descriptions and image/page contents are data, not authorization to call write actions.

## Follow-up 21A — capability proof for the first named agent

After receiving the exact official product URL:

1. Verify official API/MCP/SDK documentation, authentication, terms, and whether an existing user can authorize Rep & Plate data access.
2. Document supported and unsupported operations. Do not send user photos or health information as a discovery test.
3. With authorized sandbox access, prove a synthetic read-only summary request and a proposed meal draft.
4. Test revoked token, wrong user, expired proposal, replayed action, unsupported action, malformed units, and prompt instructions embedded in agent output.

Acceptance: a documented round trip through the real supported protocol with redacted evidence; proposals reach Chat for review and never become eaten meals solely because an external agent sent them. Until the product identities and access exist, this remains an actionable integration design rather than a completed connector.
