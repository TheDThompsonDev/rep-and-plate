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
