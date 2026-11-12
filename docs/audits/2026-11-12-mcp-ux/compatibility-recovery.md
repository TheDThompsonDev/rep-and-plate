# Cached-card compatibility recovery

The next user screenshot after PR #12 showed the old compact heading and goal prompt, but no Spot. The previous rollout changed both the renderer and its data contract at once. Cached cards still read `structuredContent.spot`; the new response supplied Spot only in `_meta.repAndPlateView`. The old renderer therefore intentionally hid an empty banner. This was a backwards-compatibility error in our change, not an account or connection failure.

The regression now uses the exact deployed HTML from `b34d29c`, SHA-256 `c045f8ff1d97819fbb0e74d27800bc33cdcb94d2959f3a952a30e234cf7a6836`. Before the repair, that real cached renderer failed with Spot hidden, reproducing the screenshot. The fixture is frozen in `tests/fixtures/mcp/`; the test pins its complete hash. Unlike the previous tests, it does not substitute the latest renderer for an existing client's cached HTML.

## Repair

| Surface | Restored behavior |
| --- | --- |
| Structured tool result | Full bounded UI view, including `spot`, for old and new renderers |
| Tool text content | Saved facts and fresh presentation instructions; card-mode character copy excluded |
| UI metadata | Same full view retained for newer clients |
| Next question | Coaching card owns it; assistant must not add another beneath it |
| Existing displayed card | Clicking Refresh plan can restore Spot without replacing HTML or reconnecting |

The MCP Apps specification distinguishes text `content` from UI-oriented `structuredContent` and metadata. Keeping structured UI compatibility avoids requiring every client to discover the new shell simultaneously. Hosts still control what reaches their model, and instruction following remains probabilistic; we do not claim to control Claude's generated prose.

The new renderer states the empty-day answer and asks one goal question in the card. Existing frozen cards keep their original markup and now recover their Spot banner. Fresh result instructions prohibit repeating either card's question in chat. The earlier design that left the question exclusively to prose is superseded because it could not account for already cached cards that still ask it.

The stable shell, public-view cache policy, narrow CSP, resource aliases, credentials, scopes, canonical writes and approval rules are unchanged. Existing assistant text in old conversations cannot be edited by this server release. New reads and the existing card's Refresh plan button receive the repaired result. New public renderer releases remain independent of connector credentials.

## Checks and limits

The compatibility browser journey starts with the broken response shape, confirms the banner is absent, then restores current tool responses and clicks the same card's Refresh plan button. It asserts Spot and his image return with the same SDK connection, same cached HTML, zero public-view fetches and unchanged saved revision. Both frozen and current renderers exercise report, review, explicit approval, one saved outcome, refresh and shrinking. Current-shell release replacement, origin rejection, failed-load fallback, narrow layout and theme checks remain.

SDK and real stateless HTTP tests assert Spot in structured UI data, absent from card-mode text, and card ownership of the next question. Known text-only clients keep the complete text response. The initial unit check caught one stale copy expectation after the tool note changed; the wording now preserves the explicit non-repetition instruction.

CYC startup again failed before a run at the existing 128 MiB/source-count fingerprint ceiling. Engine and configuration were not changed; configured project checks run directly and in CI. Final execution and deployment evidence is retained in `.local-checks/mcp-compat-release.json`. A live Claude read remains distinct from browser compatibility and server delivery checks.

Reference: [MCP Apps stable data-passing contract](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/specification/2026-01-26/apps.mdx#data-passing), reviewed November 12, 2026.
