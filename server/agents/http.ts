import type { IncomingMessage, ServerResponse } from 'node:http';
import { agentRequestSchema, manageRequestSchema, type AgentContext } from '../../src/features/connections/contracts.ts';
import { AgentError, AgentService } from './service.ts';
import type { AgentStore } from './store.ts';

export type AgentDependencies = {
  store: AgentStore;
  origin?: string;
  authenticate?: (token: string) => Promise<string | null>;
  admit?: (owner: string, expensive: boolean) => Promise<{ allowed: boolean; lease: string }>;
  release?: (lease: string) => Promise<unknown>;
  active?: (owner: string) => Promise<boolean>;
  snapshot?: (owner: string) => Promise<{ context: AgentContext; updatedAt: string; revision: number } | null>;
  now?: () => number;
};
export function createAgentHandler(deps: AgentDependencies) {
  const service = new AgentService(deps.store, deps.now, deps.snapshot);
  return async (req: IncomingMessage, res: ServerResponse) => {
    let lease: string | undefined;
    const json = (status: number, body: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Vary', 'Origin');
    try {
      let origin = deps.origin;
      if (!origin) {
        let host: URL;
        try { host = new URL(`http://${req.headers.host}`); } catch { throw new AgentError(403, 'ORIGIN', 'Invalid host.'); }
        if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname) || host.username || host.password || host.pathname !== '/') throw new AgentError(403, 'ORIGIN', 'This server accepts local requests only.');
        origin = host.origin;
      }
      if (req.headers.origin && req.headers.origin !== origin) throw new AgentError(403, 'ORIGIN', 'Request origin is not allowed.');
      if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); throw new AgentError(405, 'METHOD', 'Use POST.'); }
      const path = (req.url ?? '').split('?')[0];
      const managing = path === '/api/agents/manage';
      if (!managing && path !== '/api/agents/v1') throw new AgentError(404, 'NOT_FOUND', 'Endpoint not found.');
      let owner: string;
      let token = '';
      if (managing) {
        if (req.headers['x-rp-client'] !== 'web') throw new AgentError(403, 'CLIENT_REQUIRED', 'Use the Connections screen in Rep & Plate.');
        if (deps.origin) {
          const authorization = req.headers.authorization;
          if (!authorization?.startsWith('Bearer ') || authorization.length > 8192) throw new AgentError(401, 'SIGN_IN', 'Sign in to manage connections.');
          const user = await deps.authenticate?.(authorization.slice(7));
          if (!user) throw new AgentError(401, 'SIGN_IN', 'Your session expired. Sign in again.');
          owner = user;
        } else {
          if (req.headers.authorization) throw new AgentError(403, 'LOCAL_PROFILE', 'Local connections use the local device profile, not a cloud session.');
          const profile = req.headers['x-rp-profile'];
          if (typeof profile !== 'string' || !/^[a-f0-9]{64}$/.test(profile)) throw new AgentError(400, 'PROFILE_REQUIRED', 'A local device profile is required.');
          owner = `local:${profile}`;
        }
      } else {
        const authorization = req.headers.authorization;
        if (!authorization?.startsWith('Bearer ') || authorization.length > 256) throw new AgentError(401, 'INVALID_TOKEN', 'Supply your connection token as a Bearer credential.');
        token = authorization.slice(7);
        owner = await service.tokenOwner(token);
      }
      if (deps.active && !await deps.active(owner)) throw new AgentError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
      if (deps.admit) {
        const admission = await deps.admit(owner, false);
        if (!admission.allowed) { res.setHeader('Retry-After', '60'); throw new AgentError(429, 'ACCESS_LIMIT', 'Access is unavailable or the usage limit was reached. Try later.', true); }
        lease = admission.lease;
      }
      if (!req.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new AgentError(415, 'CONTENT_TYPE', 'Send application/json.');
      const chunks: Buffer[] = []; let size = 0;
      for await (const part of req) { const chunk = Buffer.from(part); size += chunk.length; if (size > 1_000_000) throw new AgentError(413, 'TOO_LARGE', 'This request exceeds 1 MB.'); chunks.push(chunk); }
      let body: unknown;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AgentError(400, 'INVALID_JSON', 'Send a valid JSON object.'); }
      if (managing) {
        const parsed = manageRequestSchema.safeParse(body);
        if (!parsed.success) throw new AgentError(400, 'INVALID_REQUEST', 'Management request does not match its schema.');
        json(200, await service.manage(owner, parsed.data));
      } else {
        const parsed = agentRequestSchema.safeParse(body);
        if (!parsed.success) throw new AgentError(400, 'INVALID_REQUEST', 'Request does not match its operation schema. Check dates, units, and required fields.');
        const result = await service.execute(owner, token, parsed.data);
        json(200, result && typeof result === 'object' && 'action' in result ? { ...result, reviewUrl: `${origin}/#connections` } : result);
      }
    } catch (cause) {
      const error = cause instanceof AgentError ? cause : new AgentError(503, 'UNAVAILABLE', 'Connections are temporarily unavailable. Retry the same request.', true);
      json(error.status, { error: { code: error.code, message: error.message, retryable: error.retryable } });
    } finally { if (lease) await deps.release?.(lease).catch(() => {}); }
  };
}
