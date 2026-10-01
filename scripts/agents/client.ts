import { agentRequestSchema, type AgentErrorBody, type AgentRequest } from '../../src/features/connections/contracts';

export class AgentClientError extends Error {
  constructor(public code: string, message: string, public retryable = false) { super(message); }
  toJSON(): AgentErrorBody { return { error: { code: this.code, message: this.message, retryable: this.retryable } }; }
}

export function safeError(error: unknown): AgentErrorBody {
  return error instanceof AgentClientError ? error.toJSON() : new AgentClientError('CLIENT_ERROR', 'The request could not be completed. Check the connection and try again.').toJSON();
}

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!env.REP_PLATE_URL || !env.REP_PLATE_TOKEN) throw new AgentClientError('CONFIG_REQUIRED', 'Set REP_PLATE_URL to your app origin and REP_PLATE_TOKEN to a connection token from the app.');
  let url: URL;
  try { url = new URL(env.REP_PLATE_URL); } catch { throw new AgentClientError('INVALID_URL', 'REP_PLATE_URL must be an HTTPS app origin.'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new AgentClientError('INVALID_URL', 'Use an HTTPS app origin without credentials, path, query, or fragment. HTTP is allowed only on localhost, 127.0.0.1, or [::1].');
  }
  const token = env.REP_PLATE_TOKEN.trim();
  if (!token || /\s/.test(token)) throw new AgentClientError('INVALID_TOKEN', 'REP_PLATE_TOKEN must contain a single connection token.');
  return { endpoint: new URL('/api/agents/v1', url).href, token };
}

export type AgentClient = ReturnType<typeof createAgentClient>;
export function createAgentClient(config = readConfig(), fetcher: typeof fetch = fetch) {
  return {
    async request(input: AgentRequest): Promise<Record<string, unknown>> {
      const parsed = agentRequestSchema.safeParse(input);
      if (!parsed.success) throw new AgentClientError('INVALID_REQUEST', parsed.error.issues.map(issue => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; '));
      let response: Response;
      try {
        response = await fetcher(config.endpoint, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(parsed.data),
        });
      } catch {
        throw new AgentClientError('CONNECTION_FAILED', 'The request failed or exceeded 15 seconds. Check the app URL and availability. Redirects are refused. For a proposal, retry with the same requestId and unchanged meal.', true);
      }
      let body: unknown;
      try { body = await response.json(); } catch { throw new AgentClientError('INVALID_RESPONSE', 'The app returned a non-JSON response. Check the app URL and server setup.', response.status >= 500); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AgentClientError('INVALID_RESPONSE', 'The app returned an unexpected response.');
      const result = body as Record<string, unknown>;
      if (!response.ok || 'error' in result) {
        const error = result.error as Partial<AgentErrorBody['error']> | undefined;
        // Never echo an upstream error that contains the credential, including proxy diagnostics.
        const message = typeof error?.message === 'string' ? error.message.split(config.token).join('[redacted]') : `The app rejected the request (HTTP ${response.status}).`;
        throw new AgentClientError(typeof error?.code === 'string' ? error.code.replaceAll(config.token, '[redacted]') : 'REQUEST_FAILED', message, error?.retryable === true);
      }
      return result;
    },
  };
}
