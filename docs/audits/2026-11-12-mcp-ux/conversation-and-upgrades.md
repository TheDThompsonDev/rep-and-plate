# Card, conversation and upgrades

The user confirmed that the compact card now renders in Claude. Their new screenshot exposed a separate failure: Claude copied the complete joke, repeated the empty state and question, then added unrequested zero counts and default nutrition targets. Reconnecting during delivery was also an unacceptable recurring upgrade step.

## Responsibilities

| Surface | Responsibility |
| --- | --- |
| Coaching card | Small Spot illustration and one line; relevant saved plan or review |
| Claude reply | Useful information absent from the card, or one short follow-up |
| Text-only client | Complete concise answer, with Spot's line at most once |
| Basic Spot card | Character line only; Claude still answers the records question |

Card-capable clients receive character copy in tool-result `_meta.repAndPlateView`, which MCP Apps delivers to the view without exposing it as model content. Model-visible text and structured results retain bounded saved facts and a fresh `presentation.instruction`, but omit `spot`. This makes copying the exact joke harder and refreshes the response policy even when initialization instructions are cached. Setup cards use a statement and omit the chat question. The pending-review suggestion takes priority over setup. Imports retain their receipt and the explanation that a record import does not change the agreed plan, outcomes or food diary. Errors cannot inherit a successful-write explanation.

This is a response contract, not control over Claude's final generated prose. Live Claude wording still needs confirmation. Saved facts remain available for explicit questions, planning and accessible text fallbacks; this change does not hide data from the assistant.

The real hosted HTTP regression also exposed a stateless transport detail: each request creates a fresh MCP registry, so later requests may have no saved initialization capabilities. Treating that as a negotiated text-only client would expose the joke again. Unknown capabilities now use `presentation.mode: auto` with conditional instructions: let a displayed card carry its answer, otherwise answer fully from the saved facts. The character line stays UI-only in that case; a text-only host still has the facts and Spot's voice. Explicitly negotiated text-only SDK clients retain the complete character line too. No process-local capability cache, protocol session, credential change or schema migration was introduced.

## Upgrade delivery

The previous hash-per-template repair fixed the stale dashboard, but required hosts to rediscover tool metadata each time the HTML changed. Reconnecting was a cache-refresh workaround; our stateless MCP endpoint does not require a new credential for a UI release. Its existing authorization, expiration and revocation rules remain in place.

The new stable `coaching-shell-v1.html` and `spot-shell-v1.html` resources are small bridges. Each new card instance fetches the public static renderer at `https://repandplate.com/mcp/coaching.html` or `/mcp/spot.html`, with `no-store` and a random load nonce. The same cached shell and the same MCP connection can therefore load a newly deployed renderer. Ordinary presentation changes must keep these shell identities and their bridge contract stable. Changes to the bridge contract itself still need an intentional version/migration plan.

`scripts/build-mcp-ui.ts` generates those two pages for dev/build. Only those exact static GET/HEAD paths bypass the private-preview invitation gate; unknown paths and all private APIs remain protected. No account data, credentials or account identifiers enter these files or URLs. Projected results continue through the authorized MCP message channel. Shell CSP permits only our exact view origin; inner view CSP prohibits network requests and nested frames. Both documents hash their own scripts/styles. The bridge checks source windows, child origin and the pinned host origin, forwards host capabilities and review calls, validates heights, and relays teardown. A failed view load shows a chat fallback.

Legacy unversioned and the previously deployed hashed resource URIs remain readable as aliases. A host that never rereads its already cached old HTML cannot be remotely forced to replace it. The new shell needs to be discovered once; after that, renderer upgrades are tested without reconnecting. Existing rendered cards are not retroactively replaced. Deployment alone does not prove Claude has discovered this shell.

## Verification and maintenance

- `scripts/agents/coaching-mcp.test.ts`: actual SDK registration, seeded legacy cache, UI-only joke and fresh response contract.
- `server/agents/presentation.test.ts` and `spot-in-results.test.ts`: facts retained, text fallback, basic-card answer and pending-review priority.
- `server/preview-gate.test.ts`: exact public page admission, private API/unknown path rejection, and write rejection.
- `tests/mcp-cards.spec.ts`: actual SDK + SQLite through the nested bridge; cached-shell release one to release two on the same connection, fresh fetch URLs, foreign-window/origin rejection, offline notice, narrow/wide layout, host theme, reviewed write exactly once, stale-write rejection and card shrinking.
- `conversation-card.png`: actual browser card screenshot; any sample assistant question is proposed copy, not a captured Claude response.

The first release fixture changed inline script text without updating its hash; CSP correctly blocked it. The fixture now marks the static body instead. The build also caught an SDK unknown-object spread and an inferred metadata-view type, both repaired. A full unit check caught the omitted import-status explanation; it was restored while adding a truthful error status. The new actual HTTP regression caught absent capability state, leading to the explicit auto presentation contract rather than an in-memory-only fix. These failures and the known CYC source-fingerprint ceiling are retained in the error ledger. Direct configured project checks establish verification; no managed CYC completion or live Claude validation is claimed.

Protocol basis: [MCP Apps stable specification](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/specification/2026-01-26/apps.mdx) documents cached UI resources, UI-only result metadata and the explicit `frameDomains` policy. [Claude's connector documentation](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) describes sandboxed inline cards and fresh-conversation/app-refresh troubleshooting. Neither source establishes Claude's exact internal cache state.
