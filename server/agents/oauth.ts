import { MCP_PATH, RESOURCE_METADATA_PATH } from './oauth-paths.ts';

/** Who signed in, and which registered client (Claude, MCP Inspector, …) they signed in for. */
export type OAuthGrant = { owner: string; clientId: string };

/**
 * Sign-in for remote assistants, with Supabase Auth as the authorization server.
 * Supabase runs authorize, token, registration, PKCE and refresh rotation; Rep & Plate serves the
 * discovery document, the consent page, and maps each grant onto an ordinary connection.
 */
export type McpOAuth = {
  /** The MCP address exactly as people paste it into Claude. Claude requires an exact match. */
  resource: string;
  /** Where the `WWW-Authenticate` challenge points. */
  metadataUrl: string;
  /** Supabase Auth's issuer. Claude uses only the first `authorization_servers` entry. */
  issuer: string;
  /** Verifies a Supabase-issued access token. Null means it is not a usable sign-in. */
  verify: (token: string) => Promise<OAuthGrant | null>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mcpOAuth(origin: string, supabaseUrl: string, verify: McpOAuth['verify']): McpOAuth {
  return { resource: `${origin}${MCP_PATH}`, metadataUrl: `${origin}${RESOURCE_METADATA_PATH}`, issuer: supabaseIssuer(supabaseUrl), verify };
}
export const supabaseIssuer = (supabaseUrl: string) => `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;

/** RFC 9728 protected resource metadata. */
export function protectedResourceMetadata(oauth: McpOAuth) {
  return {
    resource: oauth.resource,
    authorization_servers: [oauth.issuer],
    bearer_methods_supported: ['header'],
    // Claude requests what is listed here. Supabase refuses any scope outside openid, profile, email,
    // phone and offline_access, so Rep & Plate's own permissions (coaching, meals, …) are chosen on the
    // consent page and stored on the connection instead. `email` is Supabase's own default scope.
    scopes_supported: ['email'],
    resource_name: 'Rep & Plate',
  };
}

/** The 401 challenge that starts sign-in. `invalid_token` tells the client to refresh or sign in again. */
export function bearerChallenge(oauth: McpOAuth, error?: 'invalid_token') {
  return `Bearer resource_metadata="${oauth.metadataUrl}"${error ? `, error="${error}"` : ''}`;
}

type ClaimsResult = { data: { claims: Record<string, unknown> } | null; error: unknown };

/**
 * Accepts only tokens Supabase issued through its OAuth server for one of its registered clients.
 *
 * `getClaims` checks the signature against the project's published keys (or asks Supabase when the
 * project still signs with a shared secret) and rejects expired tokens. The checks below then refuse
 * an ordinary app session, which has no `client_id`, and a token from another issuer. Supabase sets
 * `aud` to "authenticated" rather than this resource, so the binding to Rep & Plate is the connection
 * lookup that follows: a token is only useful for a client the person approved on our consent page.
 * Network failures throw, so a Supabase outage reads as "retry", not as "sign in again".
 */
export function supabaseGrantVerifier(getClaims: (token: string) => Promise<ClaimsResult>, issuer: string) {
  return async (token: string): Promise<OAuthGrant | null> => {
    const { data, error } = await getClaims(token);
    if (error || !data) return null;
    const { iss, role, sub, client_id: clientId } = data.claims;
    if (iss !== issuer || role !== 'authenticated') return null;
    if (typeof sub !== 'string' || !UUID.test(sub) || typeof clientId !== 'string' || !UUID.test(clientId)) return null;
    return { owner: sub, clientId: clientId.toLowerCase() };
  };
}
