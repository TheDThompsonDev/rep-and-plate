import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, StreamableHTTPClientTransport, UnauthorizedError, type OAuthClientProvider, type StoredOAuthClientInformation, type StoredOAuthTokens } from '@modelcontextprotocol/client';
import { createAgentHandler, type AgentDependencies } from './http.ts';
import { AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import { mcpOAuth, supabaseGrantVerifier, supabaseIssuer } from './oauth.ts';
import { mcpCredential } from './token.ts';
import { previewGate } from '../preview-gate.ts';
import { consentConnection } from '../../src/features/connections/oauth-consent.ts';
import { defaultConnectionScopes } from '../../src/features/connections/permissions.ts';

// Connect in Claude, with Supabase Auth as the sign-in server. Supabase itself cannot run here (its
// local stack needs Docker), so these tests stand in for it with tokens shaped like the ones its OAuth
// server issues and, for the full sign-in, a small server that applies the same rules as Supabase
// Auth v2.197.0 (internal/api/oauthserver): exact redirect_uri match, scopes limited to openid,
// profile, email, phone and offline_access, PKCE required, form-encoded token requests.

const USER = '6f1c2a9e-3b7d-4c51-9a8e-2d4f6b8c0e11';
const SESSION = 'app-session-token';
const cleanup: (() => Promise<unknown> | void)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

const b64 = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const SIGNED = 'signed-by-test-supabase';
/** Shaped like a Supabase OAuth access token: longer than any key, three base64url parts. */
function accessToken(claims: Record<string, unknown>, signature = SIGNED) {
  return `${b64({ alg: 'ES256', kid: 'test-key', typ: 'JWT' })}.${b64(claims)}.${Buffer.from(signature.padEnd(320, '.')).toString('base64url')}`;
}
/** Stands in for `auth.getClaims`: rejects a bad signature or an expired token, as auth-js does. */
async function getClaims(token: string) {
  const [, payload, signature] = token.split('.');
  if (!Buffer.from(signature ?? '', 'base64url').toString().startsWith(SIGNED)) return { data: null, error: new Error('Invalid JWT signature') };
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as Record<string, unknown>;
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= Date.now()) return { data: null, error: new Error('JWT has expired') };
  return { data: { claims }, error: null };
}

async function listen(handle: (req: IncomingMessage, res: ServerResponse) => void) {
  const server = createServer(handle);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  cleanup.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

async function fixture(options: { oauth?: boolean; supabase?: string; deps?: Partial<AgentDependencies> } = {}) {
  const store = new SqliteAgentStore(':memory:'); cleanup.push(() => store.close());
  const service = new AgentService(store);
  // The handler needs the address it is listening on, so it is attached after listening.
  const bound: { handler?: ReturnType<typeof createAgentHandler> } = {};
  const origin = await listen((req, res) => { void bound.handler!(req, res); });
  const supabase = options.supabase ?? 'https://test-project.supabase.co';
  const issuer = supabaseIssuer(supabase);
  bound.handler = createAgentHandler({
    store, origin,
    authenticate: async token => token === SESSION ? USER : null,
    oauth: options.oauth === false ? undefined : mcpOAuth(origin, supabase, supabaseGrantVerifier(getClaims, issuer)),
    ...options.deps,
  });
  const mcp = `${origin}/api/agents/mcp`;
  const grant = (clientId: string, overrides: Record<string, unknown> = {}) =>
    accessToken({ iss: issuer, sub: USER, aud: 'authenticated', role: 'authenticated', client_id: clientId, session_id: randomUUID(), exp: Math.floor(Date.now() / 1000) + 3600, ...overrides });
  // What the consent page sends on Allow, signed in as the person.
  const allow = async (clientId: string, name = 'Claude') => {
    const response = await fetch(`${origin}/api/agents/manage`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RP-Client': 'web', Authorization: `Bearer ${SESSION}` }, body: JSON.stringify(consentConnection({ id: clientId, name })) });
    expect(response.status).toBe(200);
    return await response.json() as { connection: { id: string; name: string; scopes: string[] }; replaced: boolean };
  };
  const post = (headers: Record<string, string>, body: unknown = {}) =>
    fetch(mcp, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });
  const connect = async (headers: Record<string, string>) => {
    const client = new Client({ name: 'oauth-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(mcp), { requestInit: { headers } }));
    cleanup.push(() => client.close());
    return client;
  };
  return { origin, mcp, issuer, service, grant, allow, post, connect };
}

describe('sign-in discovery for Connect in Claude', () => {
  it('answers an MCP request without credentials with 401 and where to find sign-in details', async () => {
    const f = await fixture();
    for (const response of [await f.post({}), await fetch(f.mcp)]) {
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe(`Bearer resource_metadata="${f.origin}/api/agents/oauth-protected-resource"`);
      expect(await response.json()).toMatchObject({ error: { code: 'SIGN_IN' } });
    }
  });

  it('serves RFC 9728 metadata naming the exact MCP address and Supabase Auth first', async () => {
    const f = await fixture();
    for (const path of ['/api/agents/oauth-protected-resource', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/agents/mcp']) {
      const response = await fetch(f.origin + path);
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      const metadata = await response.json() as Record<string, unknown>;
      expect(metadata.resource).toBe(f.mcp);
      expect((metadata.authorization_servers as string[])[0]).toBe('https://test-project.supabase.co/auth/v1');
      // Supabase refuses scopes outside its own list, so ours must never be requested from it.
      for (const scope of metadata.scopes_supported as string[]) expect(['openid', 'profile', 'email', 'phone', 'offline_access']).toContain(scope);
    }
    expect((await fetch(`${f.origin}/api/agents/oauth-protected-resource`, { method: 'POST' })).status).toBe(405);
  });

  it('changes nothing while sign-in is switched off', async () => {
    const f = await fixture({ oauth: false });
    const response = await f.post({});
    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBeNull();
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_TOKEN', message: expect.stringContaining('x-api-key') } });
    expect((await fetch(`${f.origin}/api/agents/oauth-protected-resource`)).status).toBe(404);
    expect((await f.post({ Authorization: `Bearer ${f.grant(randomUUID())}` })).status).toBe(401);
  });
});

describe('a signed-in assistant reaches exactly the connection approved on the consent page', () => {
  it('maps a Supabase token to the coach-default connection for that client and serves coaching', async () => {
    const f = await fixture();
    const clientId = randomUUID();
    const approved = await f.allow(clientId);
    expect(approved).toMatchObject({ replaced: false, connection: { name: 'Claude', scopes: defaultConnectionScopes } });
    const client = await f.connect({ Authorization: `Bearer ${f.grant(clientId)}` });
    const tools = (await client.listTools()).tools.map(tool => tool.name);
    expect(tools).toEqual(expect.arrayContaining(['get_coaching_day', 'propose_coaching_change', 'propose_meal']));
    const day = await client.callTool({ name: 'get_coaching_day', arguments: {} });
    expect(day.isError).not.toBe(true);
    // Writes stay reviewed: a proposal waits for the person, and is recorded as this connection's.
    const requestId = randomUUID();
    const proposal = await client.callTool({ name: 'propose_coaching_change', arguments: { requestId, baseRevision: 0, command: { type: 'setup', profile: { primaryGoal: 'Lift twice a week', priorities: ['strength'], constraints: [], notes: '' }, reason: 'Agreed in chat.' } } });
    expect(proposal.structuredContent).toMatchObject({ state: { revision: 0 }, proposal: { status: 'pending', id: requestId } });
    const listed = await f.service.manage(USER, { operation: 'list' }) as { connections: Record<string, unknown>[] };
    expect(listed.connections).toHaveLength(1);
    expect(listed.connections[0]).not.toHaveProperty('oauthClientId');
    expect(listed.connections[0]).not.toHaveProperty('tokenHash');
  });

  it('refuses expired, forged, foreign and plain app-session tokens with an invalid_token challenge', async () => {
    const f = await fixture();
    const clientId = randomUUID();
    await f.allow(clientId);
    const refused = [
      f.grant(clientId, { exp: Math.floor(Date.now() / 1000) - 5 }),
      accessToken({ iss: f.issuer, sub: USER, role: 'authenticated', client_id: clientId, exp: Math.floor(Date.now() / 1000) + 3600 }, 'forged'),
      f.grant(clientId, { iss: 'https://other-project.supabase.co/auth/v1' }),
      f.grant(clientId, { client_id: undefined }),
      f.grant(clientId, { role: 'anon' }),
    ];
    for (const token of refused) {
      const response = await f.post({ Authorization: `Bearer ${token}` });
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe(`Bearer resource_metadata="${f.origin}/api/agents/oauth-protected-resource", error="invalid_token"`);
    }
  });

  it('refuses a valid token for a client nobody allowed here, and one for a disconnected connection', async () => {
    const f = await fixture();
    const unknown = await f.post({ Authorization: `Bearer ${f.grant(randomUUID())}` });
    expect(unknown.status).toBe(401);
    expect(unknown.headers.get('www-authenticate')).toContain('error="invalid_token"');

    const clientId = randomUUID();
    const { connection } = await f.allow(clientId);
    const token = f.grant(clientId);
    const client = await f.connect({ Authorization: `Bearer ${token}` });
    await f.service.manage(USER, { operation: 'revoke', connectionId: connection.id });
    await expect(client.listTools()).rejects.toThrow();
    const after = await f.post({ Authorization: `Bearer ${token}` });
    expect(after.status).toBe(401);
    expect(after.headers.get('www-authenticate')).toContain('error="invalid_token"');

    // Connecting again records a new connection; the old one stays disconnected.
    expect((await f.allow(clientId)).connection.id).not.toBe(connection.id);
    expect((await f.connect({ Authorization: `Bearer ${f.grant(clientId)}` })).getInstructions()).toContain('Spot');
  });

  it('updates the same connection when the same client is allowed twice', async () => {
    const f = await fixture();
    const clientId = randomUUID();
    const first = await f.allow(clientId, 'Claude');
    const second = await f.allow(clientId, 'Claude (work)');
    expect(second).toMatchObject({ replaced: true, connection: { id: first.connection.id, name: 'Claude (work)' } });
    expect(((await f.service.manage(USER, { operation: 'list' })) as { connections: unknown[] }).connections).toHaveLength(1);
  });

  it('keeps the account check, the agent quota and scopes for signed-in assistants', async () => {
    const admitted: string[] = [];
    const blocked = await fixture({ deps: { active: async () => false } });
    const clientId = randomUUID();
    // An unavailable account cannot use the consent page either; the connection predates it here.
    await blocked.service.manage(USER, consentConnection({ id: clientId }));
    const unavailable = await blocked.post({ Authorization: `Bearer ${blocked.grant(clientId)}` });
    expect(unavailable.status).toBe(403);
    expect(await unavailable.json()).toMatchObject({ error: { code: 'ACCOUNT_UNAVAILABLE' } });

    const limited = await fixture({ deps: { admit: async owner => { admitted.push(owner); return { allowed: false, lease: '' }; } } });
    await limited.service.manage(USER, consentConnection({ id: clientId }));
    const response = await limited.post({ Authorization: `Bearer ${limited.grant(clientId)}` });
    expect(response.status).toBe(429);
    expect(admitted).toEqual([USER]);

    const readOnly = await fixture();
    await readOnly.service.manage(USER, { operation: 'oauth.connect', clientId, name: 'Claude', scopes: ['coaching:read'] });
    const tools = (await (await readOnly.connect({ Authorization: `Bearer ${readOnly.grant(clientId)}` })).listTools()).tools.map(tool => tool.name);
    expect(tools).toContain('get_coaching_day');
    expect(tools).not.toContain('propose_coaching_change');
  });

  it('keeps connection keys working unchanged beside sign-in, including their own error', async () => {
    const f = await fixture();
    const { token } = await f.service.manage(USER, { operation: 'create', name: 'Claude Code', scopes: ['coaching:read'], expiresInDays: 30 }) as { token: string };
    expect((await (await f.connect({ Authorization: `Bearer ${token}` })).listTools()).tools.length).toBeGreaterThan(0);
    expect((await (await f.connect({ 'x-api-key': token })).listTools()).tools.length).toBeGreaterThan(0);
    // x-api-key still wins over a sign-in token, as on a Claude connector with request headers.
    expect((await (await f.connect({ 'x-api-key': token, Authorization: `Bearer ${f.grant(randomUUID())}` })).listTools()).tools.length).toBeGreaterThan(0);
    const wrong = await f.post({ Authorization: `Bearer rpagent.${randomUUID()}.${'a'.repeat(43)}` });
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get('www-authenticate')).toBeNull();
  });

  it('records sign-in connections only for hosted accounts', async () => {
    const f = await fixture();
    await expect(f.service.manage('local:abc', consentConnection({ id: randomUUID() }))).rejects.toMatchObject({ status: 409, code: 'HOSTED_ONLY' });
  });
});

describe('reading what an MCP request presents', () => {
  const key = `rpagent.11111111-1111-4111-8111-111111111111.${'a'.repeat(43)}`;
  const jwt = accessToken({ sub: USER });
  it('treats keys exactly as before and only a long JWT-shaped bearer value as a sign-in', () => {
    expect(mcpCredential({ authorization: `Bearer ${key}` })).toEqual({ kind: 'key', token: key });
    expect(mcpCredential({ 'x-api-key': key, authorization: `Bearer ${jwt}` })).toEqual({ kind: 'key', token: key });
    expect(mcpCredential({ authorization: `Bearer ${jwt}` })).toEqual({ kind: 'access-token', token: jwt });
    expect(mcpCredential({ authorization: 'Bearer typo' })).toEqual({ kind: 'key', token: 'typo' });
    expect(mcpCredential({})).toEqual({ kind: 'none' });
    expect(mcpCredential({ authorization: jwt })).toEqual({ kind: 'none' });
    expect(mcpCredential({ authorization: `Bearer ${'x'.repeat(9000)}` })).toEqual({ kind: 'none' });
  });
});

/** A sign-in server applying Supabase Auth's rules (see the note at the top of this file). */
async function supabaseLike(consent: (client: { id: string; name: string }) => Promise<void>) {
  const SCOPES = ['openid', 'profile', 'email', 'phone', 'offline_access'];
  const clients = new Map<string, { name: string; redirectUris: string[] }>();
  const codes = new Map<string, { clientId: string; redirectUri: string; challenge: string; resource: string | null }>();
  const seen: string[] = [];
  let issuer = '';
  const json = (res: ServerResponse, status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body)); };
  const read = async (req: IncomingMessage) => { let body = ''; for await (const part of req) body += part; return body; };
  const origin = await listen((req, res) => void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    seen.push(`${req.method} ${url.pathname}`);
    if (url.pathname === '/.well-known/oauth-authorization-server/auth/v1') return json(res, 200, {
      issuer, authorization_endpoint: `${issuer}/oauth/authorize`, token_endpoint: `${issuer}/oauth/token`, jwks_uri: `${issuer}/.well-known/jwks.json`,
      registration_endpoint: `${issuer}/oauth/clients/register`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'], code_challenge_methods_supported: ['S256', 'plain'], scopes_supported: SCOPES,
    });
    if (url.pathname === '/auth/v1/oauth/clients/register' && req.method === 'POST') {
      const body = JSON.parse(await read(req)) as { client_name?: string; redirect_uris?: string[] };
      const uris = body.redirect_uris ?? [];
      // validateRedirectURI: http only for loopback hosts, no fragments.
      if (!uris.length || uris.some(uri => { const u = new URL(uri); return u.hash || (u.protocol === 'http:' ? !['localhost', '127.0.0.1', '::1'].includes(u.hostname) : u.protocol !== 'https:'); }))
        return json(res, 400, { error: 'invalid_redirect_uri' });
      const id = randomUUID();
      clients.set(id, { name: body.client_name ?? '', redirectUris: uris });
      return json(res, 201, { client_id: id, client_name: body.client_name, redirect_uris: uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] });
    }
    if (url.pathname === '/auth/v1/oauth/authorize') {
      const q = url.searchParams;
      const client = clients.get(q.get('client_id') ?? '');
      // isValidRedirectURI: exact string match against what was registered.
      if (!client || !client.redirectUris.includes(q.get('redirect_uri') ?? '')) return json(res, 400, { error: 'invalid redirect_uri' });
      const scope = q.get('scope') || 'email';
      if (scope.split(' ').some(s => !SCOPES.includes(s))) return json(res, 400, { error: `unsupported scope: ${scope}` });
      if (q.get('code_challenge_method') !== 'S256' || (q.get('code_challenge') ?? '').length < 43) return json(res, 400, { error: 'PKCE required' });
      // Supabase now sends the person to /oauth/consent; Allow there records the connection first.
      await consent({ id: q.get('client_id')!, name: client.name });
      const code = randomUUID();
      codes.set(code, { clientId: q.get('client_id')!, redirectUri: q.get('redirect_uri')!, challenge: q.get('code_challenge')!, resource: q.get('resource') });
      const back = new URL(q.get('redirect_uri')!); back.searchParams.set('code', code); if (q.get('state')) back.searchParams.set('state', q.get('state')!);
      res.writeHead(302, { Location: back.href }).end(); return;
    }
    if (url.pathname === '/auth/v1/oauth/token' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded')) return json(res, 415, { error: 'form encoding required' });
      const form = new URLSearchParams(await read(req));
      const code = codes.get(form.get('code') ?? ''); codes.delete(form.get('code') ?? '');
      const verifier = createHash('sha256').update(form.get('code_verifier') ?? '').digest('base64url');
      if (!code || code.clientId !== form.get('client_id') || code.redirectUri !== form.get('redirect_uri') || code.challenge !== verifier || (form.get('resource') && form.get('resource') !== code.resource))
        return json(res, 400, { error: 'invalid_grant' });
      return json(res, 200, { access_token: accessToken({ iss: issuer, sub: USER, aud: 'authenticated', role: 'authenticated', client_id: code.clientId, exp: Math.floor(Date.now() / 1000) + 3600 }), token_type: 'bearer', expires_in: 3600, refresh_token: randomUUID() });
    }
    json(res, 404, { error: 'not found' });
  })());
  issuer = supabaseIssuer(origin);
  return { origin, seen };
}

describe('a standard MCP client completes Connect end to end', () => {
  it('discovers sign-in from the 401, registers, consents, exchanges the code and calls a tool', async () => {
    // The consent page needs the Rep & Plate server, which needs the sign-in server's address first.
    const consent: { allow?: (client: { id: string; name: string }) => Promise<void> } = {};
    const supabase = await supabaseLike(client => consent.allow!(client));
    const f = await fixture({ supabase: supabase.origin });
    consent.allow = async client => { await f.allow(client.id, client.name); };

    const redirectUrl = 'https://claude.ai/api/mcp/auth_callback';
    let information: StoredOAuthClientInformation | undefined;
    let tokens: StoredOAuthTokens | undefined;
    let verifier = '';
    let authorizationUrl: URL | undefined;
    const provider: OAuthClientProvider = {
      get redirectUrl() { return redirectUrl; },
      get clientMetadata() { return { client_name: 'Claude', redirect_uris: [redirectUrl], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }; },
      clientInformation: () => information,
      saveClientInformation: value => { information = value; },
      tokens: () => tokens,
      saveTokens: value => { tokens = value; },
      redirectToAuthorization: url => { authorizationUrl = url; },
      saveCodeVerifier: value => { verifier = value; },
      codeVerifier: () => verifier,
    };
    const transport = new StreamableHTTPClientTransport(new URL(f.mcp), { authProvider: provider });
    await expect(new Client({ name: 'connect-test', version: '1.0.0' }).connect(transport)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(authorizationUrl?.origin).toBe(supabase.origin);
    expect(authorizationUrl?.searchParams.get('resource')).toBe(f.mcp);

    const callback = await fetch(authorizationUrl!, { redirect: 'manual' });
    expect(callback.status).toBe(302);
    const back = new URL(callback.headers.get('location')!);
    expect(back.origin + back.pathname).toBe(redirectUrl);
    await transport.finishAuth(back.searchParams);

    const client = new Client({ name: 'connect-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(f.mcp), { authProvider: provider }));
    cleanup.push(() => client.close());
    expect((await client.callTool({ name: 'get_coaching_day', arguments: {} })).isError).not.toBe(true);
    expect(supabase.seen).toEqual(expect.arrayContaining(['GET /.well-known/oauth-authorization-server/auth/v1', 'POST /auth/v1/oauth/clients/register', 'GET /auth/v1/oauth/authorize', 'POST /auth/v1/oauth/token']));
    const listed = await f.service.manage(USER, { operation: 'list' }) as { connections: { name: string; scopes: string[] }[] };
    expect(listed.connections).toEqual([expect.objectContaining({ name: 'Claude', scopes: defaultConnectionScopes })]);
  });
});

describe('private preview with sign-in switched on', () => {
  const env = { VERCEL: '1', PREVIEW_ACCESS_CODE: 'test-invitation-code-123456789', MCP_OAUTH: 'on' };
  const at = (path: string, init?: RequestInit) => new Request(`https://repandplate.com${path}`, init);
  it('lets Claude reach discovery and the MCP challenge without an invitation cookie', async () => {
    for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/api/agents/mcp', '/api/agents/oauth-protected-resource', '/api/health?endpoint=agents/oauth-protected-resource'])
      expect(await previewGate(at(path), env)).toBeNull();
    expect(await previewGate(at('/api/agents/mcp', { method: 'POST' }), env)).toBeNull();
    expect((await previewGate(at('/api/agents/v1', { method: 'POST' }), env))?.status).toBe(401);
    expect((await previewGate(at('/api/agents/oauth-protected-resource', { method: 'POST' }), env))?.status).toBe(401);
  });
  it('reloads a consent page reached from Supabase once, so the SameSite=Strict invitation cookie is sent', async () => {
    const response = await previewGate(at('/oauth/consent?authorization_id=abcDEF0123456789abcDEF0123456789', { headers: { 'sec-fetch-site': 'cross-site', accept: 'text/html' } }), env);
    const page = await response!.text();
    expect(page).toContain('http-equiv="refresh"');
    expect(page).toContain('/oauth/consent?authorization_id=abcDEF0123456789abcDEF0123456789');
    expect(page).not.toContain('<script');
    // The reload comes from this site: without an invitation it gets the usual splash, never a loop.
    expect(await (await previewGate(at('/oauth/consent?authorization_id=x', { headers: { 'sec-fetch-site': 'same-origin', accept: 'text/html' } }), env))!.text()).toContain('Coming soon');
  });
  it('is unchanged while sign-in is off', async () => {
    const off = { ...env, MCP_OAUTH: undefined };
    expect((await previewGate(at('/api/agents/mcp', { method: 'POST' }), off))?.status).toBe(401);
    expect((await previewGate(at('/.well-known/oauth-protected-resource'), off))?.status).toBe(401);
    expect(await (await previewGate(at('/oauth/consent', { headers: { 'sec-fetch-site': 'cross-site', accept: 'text/html' } }), off))!.text()).toContain('Coming soon');
  });
});

vi.setConfig({ testTimeout: 20_000 });
