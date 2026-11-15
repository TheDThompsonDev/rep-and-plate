import { describe, expect, it } from 'vitest';
import { manageRequestSchema } from './contracts';
import { consentAuthorizationId, consentConnection, redirectTarget, safeClientRedirect } from './oauth-consent';
import { defaultConnectionScopes } from './permissions';

describe('the Connect consent page', () => {
  it('accepts only the authorization IDs Supabase issues', () => {
    expect(consentAuthorizationId('?authorization_id=abcDEF0123456789abcDEF0123456789')).toBe('abcDEF0123456789abcDEF0123456789');
    for (const search of ['', '?authorization_id=', '?authorization_id=../../admin', '?authorization_id=short', `?authorization_id=${'a'.repeat(200)}`])
      expect(consentAuthorizationId(search)).toBeNull();
  });
  it('names where Allow sends the person, and follows only https or this computer', () => {
    expect(redirectTarget('https://claude.ai/api/mcp/auth_callback?code=x')).toEqual({ host: 'claude.ai', local: false });
    expect(redirectTarget('http://localhost:3118/callback')).toEqual({ host: 'localhost:3118', local: true });
    expect(redirectTarget('http://127.0.0.1:9000/callback')).toEqual({ host: '127.0.0.1:9000', local: true });
    for (const value of ['http://claude.ai/api/mcp/auth_callback', 'javascript:alert(1)', 'https://user:pass@claude.ai/', 'not a url'])
      expect(safeClientRedirect(value)).toBeNull();
  });
  it('records an ordinary connection named after the assistant with the coach default', () => {
    const request = consentConnection({ id: '3f2b8c1d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: '  Claude  ' });
    expect(request).toEqual({ operation: 'oauth.connect', clientId: '3f2b8c1d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Claude', scopes: defaultConnectionScopes });
    expect(manageRequestSchema.safeParse(request).success).toBe(true);
    expect(consentConnection({ id: '3f2b8c1d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: '' }).name).toBe('Signed-in assistant');
    expect(consentConnection({ id: '3f2b8c1d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'x'.repeat(120) }).name).toHaveLength(80);
  });
});
