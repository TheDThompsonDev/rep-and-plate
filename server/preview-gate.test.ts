import { describe, expect, it } from 'vitest';
import { hasPreviewAccess, previewEnabled, previewGate } from './preview-gate.ts';

const env = { VERCEL: '1', PREVIEW_ACCESS_CODE: 'test-invitation-code-123456789' };
const origin = 'https://repandplate.com';
let ip = 0;
const request = (path: string, init?: RequestInit) => new Request(origin + path, init);
const submit = (code: string, extra: Record<string, string> = {}) => request('/preview/access', {
  method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded', 'x-vercel-forwarded-for': String(++ip), ...extra }, body: new URLSearchParams({ code }),
});
async function unlock(now = Date.now()) {
  const response = await previewGate(submit(env.PREVIEW_ACCESS_CODE), env, now);
  expect(response?.status).toBe(303);
  return response!.headers.get('set-cookie')!;
}
describe('private preview boundary', () => {
  it('locks hosted deployments by default, allows unconfigured local development, and supports explicit launch', () => {
    expect(previewEnabled({ VERCEL: '1' })).toBe(true);
    expect(previewEnabled({})).toBe(false);
    expect(previewEnabled({ ...env, PRIVATE_PREVIEW: 'off' })).toBe(false);
    expect(previewEnabled({ PRIVATE_PREVIEW: 'on' })).toBe(true);
  });
  it('serves a no-index splash without any app scripts or the secret', async () => {
    const response = await previewGate(request('/'), env);
    const page = await response!.text();
    expect(page).toContain('Coming soon');
    expect(page).not.toContain('<script');
    expect(page).not.toContain(env.PREVIEW_ACCESS_CODE);
    expect(response!.headers.get('cache-control')).toContain('no-store');
    expect(response!.headers.get('x-robots-tag')).toContain('noindex');
  });
  it.each(['/api/chat', '/api/health?endpoint=chat', '/assets/index.js', '/index.html', '/src/main.tsx'])('blocks direct access to %s', async path => {
    expect((await previewGate(request(path), env))?.status).toBe(401);
  });
  it('blocks API posts and forged middleware headers', async () => {
    const response = await previewGate(request('/api/chat', { method: 'POST', headers: { 'x-middleware-subrequest': 'middleware:middleware:middleware', cookie: 'rp_preview=true' } }), env);
    expect(response?.status).toBe(401);
  });
  it('shows the splash for deep document links', async () => {
    expect(await (await previewGate(request('/workouts', { headers: { accept: 'text/html' } }), env))!.text()).toContain('Coming soon');
  });
  it('allows only exact public font/favicon files', async () => {
    expect(await previewGate(request('/fonts/fonts.css'), env)).toBeNull();
    expect(await previewGate(request('/fonts/font-6.ttf'), env)).toBeNull();
    expect(await previewGate(request('/favicon.svg'), env)).toBeNull();
    expect((await previewGate(request('/fonts/secret.js'), env))?.status).toBe(401);
    expect(await (await previewGate(request('/robots.txt'), env))!.text()).toContain('Disallow: /');
  });
  it('fails closed for missing or short secrets', async () => {
    for (const code of [undefined, '', 'short']) {
      const config = { VERCEL: '1', PREVIEW_ACCESS_CODE: code };
      expect((await previewGate(submit('anything'), config))?.status).toBe(503);
      expect(await hasPreviewAccess(await unlock(), config)).toBe(false);
    }
  });
  it('rejects wrong codes, foreign origins, and oversized submissions', async () => {
    expect((await previewGate(submit('wrong-code'), env))?.status).toBe(401);
    expect((await previewGate(submit(env.PREVIEW_ACCESS_CODE, { origin: 'https://other.example' }), env))?.status).toBe(403);
    expect((await previewGate(submit('x'.repeat(3000)), env))?.status).toBe(413);
  });
  it('issues a secure, HttpOnly cookie and unlocks both app assets and API', async () => {
    const cookie = await unlock();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).not.toContain(env.PREVIEW_ACCESS_CODE);
    for (const path of ['/', '/assets/index.js', '/api/cloud/config']) expect(await previewGate(request(path, { headers: { cookie } }), env)).toBeNull();
  });
  it('rejects tampering, expiration, and cookies signed by a previous code', async () => {
    const now = Date.now();
    const cookie = await unlock(now);
    expect(await hasPreviewAccess(cookie, env, now + 7 * 86400000)).toBe(false);
    expect(await hasPreviewAccess(cookie.replace(/=\d/, '=0'), env, now)).toBe(false);
    expect(await hasPreviewAccess(cookie, { ...env, PREVIEW_ACCESS_CODE: 'a-new-random-invitation-code-12345' }, now)).toBe(false);
  });
  it('provides a logout that expires access and returns to the splash', async () => {
    const response = await previewGate(request('/preview/lock', { method: 'POST', headers: { origin } }), env);
    expect(response?.status).toBe(303);
    expect(response?.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(response?.headers.get('location')).toBe('/');
  });
  it('throttles repeated incorrect codes', async () => {
    const address = 'throttle-test';
    for (let i = 0; i < 8; i++) expect((await previewGate(submit('wrong', { 'x-vercel-forwarded-for': address }), env))?.status).toBe(401);
    const blocked = await previewGate(submit('wrong', { 'x-vercel-forwarded-for': address }), env);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get('retry-after')).toBe('60');
  });
});
