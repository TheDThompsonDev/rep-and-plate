import type { IncomingMessage, ServerResponse } from 'node:http';
import { createMcpHandler } from '@modelcontextprotocol/server';
import type { AgentDependencies } from './http.ts';
import { AgentError, AgentService, type AgentCredential } from './service.ts';
import { createAgentMcpServer } from './mcp-server.ts';
import { connectionKey, mcpCredential } from './token.ts';
import { bearerChallenge } from './oauth.ts';
import { BODY_LIMITS, readJsonBody } from '../routes.ts';

/** Stateless MCP with the same token authorization, quotas and persistence as the agent API. */
export function createAgentMcpHandler(deps: AgentDependencies) {
  const service = new AgentService(deps.store, deps.now, deps.snapshot);
  return async (req: IncomingMessage, res: ServerResponse) => {
    let lease: string | undefined;
    let endpoint: ReturnType<typeof createMcpHandler> | undefined;
    const json = (status: number, body: unknown) => {
      res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body));
    };
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      let origin = deps.origin;
      if (!origin) {
        const local = new URL(`http://${req.headers.host}`);
        if (!['localhost', '127.0.0.1', '[::1]'].includes(local.hostname) || local.username || local.password || local.pathname !== '/') throw new AgentError(403, 'ORIGIN', 'This server accepts local requests only.');
        origin = local.origin;
      }
      if (req.headers.origin && req.headers.origin !== origin) throw new AgentError(403, 'ORIGIN', 'Request origin is not allowed.');
      let credential: AgentCredential;
      let owner: string;
      if (!deps.oauth) {
        credential = connectionKey(req.headers);
        owner = await service.tokenOwner(credential);
      } else {
        const oauth = deps.oauth;
        const presented = mcpCredential(req.headers);
        if (presented.kind === 'key') {
          // Keys behave exactly as without sign-in, including their own 401 for a bad key.
          credential = presented.token;
          owner = await service.tokenOwner(presented.token);
        } else {
          // Claude starts Connect only on a 401 that says where the sign-in details are.
          const refuse = (error?: 'invalid_token') => { res.setHeader('WWW-Authenticate', bearerChallenge(oauth, error)); };
          if (presented.kind === 'none') { refuse(); throw new AgentError(401, 'SIGN_IN', 'Connect Rep & Plate to sign in, or supply your connection key.'); }
          const grant = await oauth.verify(presented.token);
          if (!grant) { refuse('invalid_token'); throw new AgentError(401, 'INVALID_TOKEN', 'This sign-in expired or is not valid. Connect again.'); }
          try { owner = await service.grantOwner(grant.owner, grant.clientId); }
          catch (cause) { if (cause instanceof AgentError && cause.status === 401) refuse('invalid_token'); throw cause; }
          credential = { oauthClientId: grant.clientId };
        }
      }
      if (deps.active && !await deps.active(owner)) throw new AgentError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
      if (deps.admit) {
        const admission = await deps.admit(owner, false);
        if (!admission.allowed) { res.setHeader('Retry-After', '60'); throw new AgentError(429, 'ACCESS_LIMIT', 'Connection request limit reached. Try later.', true); }
        lease = admission.lease;
      }
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new AgentError(405, 'METHOD', 'This stateless MCP endpoint uses POST.'); }
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new AgentError(415, 'CONTENT_TYPE', 'Send application/json.');
      const parsed = await readJsonBody(req, BODY_LIMITS.agents);
      if (!parsed.ok) throw new AgentError(parsed.reason === 'too-large' ? 413 : 400, parsed.reason === 'too-large' ? 'TOO_LARGE' : 'INVALID_JSON', 'Send a JSON MCP request under 1 MB.');
      endpoint = createMcpHandler(() => createAgentMcpServer({
        request: async request => {
          if (deps.active && !await deps.active(owner)) throw new AgentError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
          return await service.execute(owner, credential, request) as Record<string, unknown>;
        },
      }), { legacy: 'stateless' });
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) if (typeof value === 'string' && name !== 'content-length') headers.set(name, value);
      const response = await endpoint.fetch(new Request(`${origin}/api/agents/mcp`, { method: 'POST', headers, body: JSON.stringify(parsed.body) }), { parsedBody: parsed.body });
      res.statusCode = response.status;
      response.headers.forEach((value, name) => res.setHeader(name, value));
      // MCP tool calls complete within this request. No long-lived sessions or subscriptions.
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (cause) {
      const error = cause instanceof AgentError ? cause : new AgentError(503, 'UNAVAILABLE', 'The coaching connector could not complete this request. Retry the same request.', true);
      if (!res.headersSent) json(error.status, { error: { code: error.code, message: error.message, retryable: error.retryable } });
      else res.end();
    } finally {
      await endpoint?.close().catch(() => {});
      if (lease) await deps.release?.(lease).catch(() => {});
    }
  };
}
