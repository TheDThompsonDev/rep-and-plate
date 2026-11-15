import { AgentError } from './service.ts';
import { bareKey, CONNECTION_KEY } from './key-format.ts';

/**
 * Read a connection key from a request.
 *
 * It arrives as `Authorization: Bearer <key>` from command-line tools, or alone in `x-api-key`.
 * The second form exists because Claude chat reserves `Authorization` on a custom connector unless
 * its Authentication is set to "No sign-in", and pre-selects sign-in for a server that answers 401.
 * `x-api-key` is one of the header names Claude lets every connector send, so it always works there.
 * When both are present `x-api-key` wins: on a sign-in connector `Authorization` belongs to Claude.
 */
export function connectionKey(headers: { authorization?: string; 'x-api-key'?: string | string[] }): string {
  const apiKey = headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.length <= 256 && CONNECTION_KEY.test(bareKey(apiKey))) return bareKey(apiKey);
  const authorization = headers.authorization;
  if (authorization?.startsWith('Bearer ') && authorization.length <= 256) return authorization.slice(7);
  throw new AgentError(401, 'INVALID_TOKEN', 'Supply your connection key as "Authorization: Bearer <key>", or on its own in an "x-api-key" header.');
}

/** A signed-in assistant's access token: three base64url parts, and longer than any connection key. */
const ACCESS_TOKEN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export type McpCredential = { kind: 'key'; token: string } | { kind: 'access-token'; token: string } | { kind: 'none' };
/**
 * What an MCP request presents when sign-in is switched on. A connection key keeps winning exactly as
 * in `connectionKey`; only a bearer value that is not a key and has the shape of a JWT is treated as a
 * sign-in. A request with neither gets the sign-in challenge instead of the key error.
 */
export function mcpCredential(headers: { authorization?: string; 'x-api-key'?: string | string[] }): McpCredential {
  const apiKey = headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.length <= 256 && CONNECTION_KEY.test(bareKey(apiKey))) return { kind: 'key', token: bareKey(apiKey) };
  const authorization = headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return { kind: 'none' };
  const value = authorization.slice(7);
  if (CONNECTION_KEY.test(value)) return { kind: 'key', token: value };
  if (value.length > 256 && value.length <= 8192 && ACCESS_TOKEN.test(value)) return { kind: 'access-token', token: value };
  // Anything else short is a mistyped key: keep the key error people already get.
  if (value.length <= 256) return { kind: 'key', token: value };
  return { kind: 'none' };
}
