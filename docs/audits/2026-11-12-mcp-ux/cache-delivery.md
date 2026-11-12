# Claude still displayed the old card after the merge

November 12, 2026. Follow-up to the compact response implementation. The user reported the original dashboard and removed freshness warning after asking Claude about today's plan.

## Evidence and diagnosis

- The user confirmed the connector URL is `https://repandplate.com/api/agents/mcp`.
- Scoped Vercel CLI inspection resolved `repandplate.com` to production deployment `dpl_DQCkuMxjcjbME7TBhAbDkqryCcM2`, Ready, created at 09:20:26 America/Chicago. Its build logs identify branch `main`, commit `90b696a`, and successful API bundling. Production aliases include the custom domain and the main-branch Vercel alias. This rules out an unassigned or missing main deployment.
- Building the same API entry point locally includes the compact question and 56px illustration, and excludes the old warning. This checks the packaging path; it is not an authenticated production resource read.
- Read-only inspection of the user's active Claude connector panel showed the new tool description, including the new instruction against repeating the card's line. The screenshot still showed the old HTML. This is strong evidence that current tool definitions and an older UI template coexist.
- Both UI resources still had the exact identities used before the redesign: `ui://rep-and-plate/coaching.html` and `ui://rep-and-plate/spot.html`. The server's MCP responses already send HTTP `Cache-Control: no-store`; that does not give changed templates a new identity inside a host's resource cache.

The exact internal Claude cache was not observable. Template reuse is the supported working explanation, not a claim about an inspected Claude cache entry. Two failing regressions reproduced the known identity defect: a host cache seeded with old HTML under the legacy URI returned that HTML, and the basic Spot tool still advertised its unversioned URI.

## Repair

`server/agents/ui-resource.ts` derives a UI URI from the first 16 hexadecimal characters of SHA-256 over its static HTML. The same HTML keeps the same URI; changing script, style, artwork or markup changes it. Account data and tool results never enter this hash. Both the structured and legacy flat tool hints advertise the new identity.

The old unversioned paths remain registered and return the current HTML with the requested URI. This keeps clients that reread an old tool definition compatible. It cannot replace a template that a host never rereads. Existing rendered cards may stay as they were, and Claude may need a connector refresh/reconnect and a fresh conversation to rediscover tool metadata. The MCP server version advances from 1.2.0 to 1.3.0. No connection credential, scope, saved plan, or approval mechanism changes.

The fingerprint tests verify a fixed known digest, a changed identity when HTML changes, actual SDK resource discovery through a stale host-cache fixture, and current HTML served through both legacy aliases. The existing browser reporting/approval journeys continue to apply to the unchanged markup.

## Verification boundaries and recovery

The Vercel plugin returned 403/404 for this project. The scoped, already authenticated local CLI could inspect the exact project and aliases. The installed CLI is 48.5.0 and lacks the plugin's suggested `vercel api --method` interface; native `list` and `inspect --logs` supplied the deployment evidence instead. No credentials were read or printed.

Native Claude accessibility exposed the relevant connector metadata. A click could not execute because input geometry was unavailable, and a subsequent screenshot did not represent the bound app. That screenshot was not used as evidence; no messages, permission changes, disconnections, or credential operations were performed. Live user confirmation remains the final check for Claude's rendered result.

CYC managed startup again stopped at the previously recorded source-size ceiling before creating a run. Direct project checks are used without changing engine or verification policy. Final local check and release results are retained separately in the task's ignored verification records; do not treat the original implementation's verification.json as a hash manifest for this follow-up.

## References

[MCP Apps specification](https://raw.githubusercontent.com/modelcontextprotocol/ext-apps/main/specification/2026-01-26/apps.mdx) describes URI-based resource discovery and host preloading/caching of static templates. [The MCP SDK caching example](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/examples/caching/README.md) demonstrates resource reads served from a host cache. These establish the cache model, not Claude's particular implementation.

[Claude's interactive-connector troubleshooting](https://support.claude.com/en/articles/13454812-use-interactive-connectors-in-claude) recommends a fresh conversation, page/app refresh, and reconnecting when interactions remain stuck. This is the supported client-side recovery if the existing connection retains the old template.
