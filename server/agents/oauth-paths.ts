// No imports: the private-preview gate runs at the edge and must not pull in the agent service.

/** Sign-in for remote assistants ("Connect" in Claude) is off until this is set, so nothing changes before Supabase is ready. */
export const mcpOAuthEnabled = (env: Record<string, string | undefined>) => env.MCP_OAUTH === 'on';

export const MCP_PATH = '/api/agents/mcp';
/**
 * Where the protected resource metadata (RFC 9728) is served. `WWW-Authenticate` points here, under
 * `/api/` because that is what the hosted function is routed for. The two `/.well-known/` forms below
 * are rewritten to it for clients that probe instead of reading the header.
 */
export const RESOURCE_METADATA_PATH = '/api/agents/oauth-protected-resource';
export const WELL_KNOWN_RESOURCE_PATHS = ['/.well-known/oauth-protected-resource', `/.well-known/oauth-protected-resource${MCP_PATH}`] as const;
/** Supabase sends the person here (Site URL + Authorization Path) with `?authorization_id=`. */
export const CONSENT_PATH = '/oauth/consent';
