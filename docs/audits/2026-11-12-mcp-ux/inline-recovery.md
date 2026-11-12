# Restore the self-contained Claude card

The user’s next Claude screenshot showed a tool header with no card body and only a plain empty-day sentence. This is a different failure from missing character data: the external-frame shell can fail before the app initializes at all.

## Platform mismatch and reproduction

[Anthropic’s MCP app builder guidance](https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/plugins/mcp-server-dev/skills/build-mcp-app/SKILL.md) explicitly describes `frameDomains` as restricted in Claude. The earlier delivery design assumed the general MCP Apps nested-frame declaration would be honored. Its standalone browser host allowed that frame, so its successful tests did not establish compatibility with Claude’s policy. The actual user’s CSP/console was not inspected; the unsupported dependency and matching reproduction establish the repair target.

The new failing regression applies host HTTP CSP `frame-src 'none'`. It starts the outer view at zero height until the app initializes and sends a size notification. The retired shell cannot load its child, cannot initialize, and leaves the card collapsed. Its delayed fallback is trapped in the same collapsed view. The exact retired shell is frozen and hash-guarded in `tests/fixtures/mcp/coaching-shell-v1.html`. The regression failed before the repair.

## Repair

Serve the complete coaching and basic Spot HTML directly as MCP UI resources, with inline hashed scripts/styles, built-in pose images and no nested frames or external requests. Use content-hashed resource identities to distinguish corrected HTML from cached broken shells. Both older hashed/unversioned resource identities and shell identities remain readable aliases returning the current self-contained HTML. Structured result fields, UI metadata and the previously repaired Spot contract stay intact.

The core card already has the host handshake and sizing logic. Removing the extra shell restores that handshake directly, so the app can become visible under the restrictive host policy. Known text-only results remain complete. Stateless auto-mode guidance now explicitly includes a useful next-step question when no usable card is displayed, rather than relying on hidden UI to carry it.

| Upgrade | Supported behavior |
| --- | --- |
| Spot copy, jokes and saved-plan data | Fresh tool results; same compatible cached renderer and credential |
| Renderer HTML changes | New resource hash; host must discover/read that resource |
| Old resource URI read again | Alias returns corrected self-contained HTML |
| Already cached broken shell never reread | Cannot be remotely replaced; reload Claude and retry the same connector |

No new connector, credential, OAuth grant, scope, schema migration or account-state change is required by this repair. The hosted public renderer pages remain available for previously cached clients that can embed them, but new cards do not depend on those pages. Do not promise automatic template replacement in a host that retains old HTML indefinitely. Existing assistant paragraphs cannot be rewritten.

## Verification

All card journeys now run with nested frames blocked and collapsed initial height. They cover positive inline rendering, the negative frozen-shell collapse, preserved frozen pre-shell Spot recovery, narrow widths, host themes, outbound-request blocking, foreign-source/origin rejection, same-connection data refresh, approval exactly once, stale revision refusal and shrinking after review. The resource tests assert no iframe or external script in both cards and verify inline script/style hashes. SDK resource discovery is seeded with old cached shell identities and confirms a new self-contained resource and working aliases.

This verification proves the restrictive-policy behavior locally; it is not a substitute for observing the corrected resource in the user’s actual Claude client. Final release and user-validation boundaries are recorded in `.local-checks/mcp-inline-release.json`. CYC startup still fails before a run at the existing source-fingerprint ceiling; direct project checks are used without changing the engine or its policy.
