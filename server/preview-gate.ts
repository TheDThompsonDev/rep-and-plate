import { previewPage } from './preview-page.ts';

type Environment = Record<string, string | undefined>;
const COOKIE = 'rp_preview';
const LIFETIME = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();
const attempts = new Map<string, { count: number; until: number }>();
const headers = {
  'Cache-Control': 'private, no-store, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};
export function previewEnabled(env: Environment) {
  if (env.PRIVATE_PREVIEW === 'off') return false;
  return env.VERCEL === '1' || env.PRIVATE_PREVIEW === 'on' || !!env.PREVIEW_ACCESS_CODE;
}
function secret(env: Environment) {
  // Fail closed if someone configures an empty or easily guessed code.
  const code = env.PREVIEW_ACCESS_CODE;
  return code && code.length >= 20 && code.length <= 256 ? code : null;
}
async function key(code: string) {
  return crypto.subtle.importKey('raw', encoder.encode(code), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
async function signature(code: string, payload: string) {
  return hex(await crypto.subtle.sign('HMAC', await key(code), encoder.encode(`rep-and-plate-preview:${payload}`)));
}
export async function hasPreviewAccess(cookie: string | null | undefined, env: Environment, now = Date.now()) {
  if (!previewEnabled(env)) return true;
  const code = secret(env);
  if (!code || !cookie || cookie.length > 16384) return false;
  const token = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || !/^\d{13}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, mac] = token.split('.');
  if (Number(expires) <= now || Number(expires) > now + LIFETIME * 1000) return false;
  const bytes = Uint8Array.from(mac.match(/../g)!, pair => parseInt(pair, 16));
  return crypto.subtle.verify('HMAC', await key(code), bytes, encoder.encode(`rep-and-plate-preview:${expires}`));
}
const html = (message = '', status = 200, unlocked = false) => new Response(previewPage(message, unlocked), {
  status, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
});
function cookie(value: string, secure: boolean, age = LIFETIME) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
}
/** null means continue to the app. All other responses stop before static files/API. */
export async function previewGate(request: Request, env: Environment, now = Date.now()): Promise<Response | null> {
  if (!previewEnabled(env)) return null;
  const url = new URL(request.url);
  const path = url.pathname;
  const read = request.method === 'GET' || request.method === 'HEAD';
  // Native clients do not share a browser cookie jar. Only delegate API requests:
  // betaHandler still verifies the bearer token, origin, membership and quotas.
  const endpoint = path === '/api/health' ? `/api/${url.searchParams.get('endpoint') ?? ''}` : path;
  if (path.startsWith('/api/') && (
    (endpoint === '/api/cloud/config' && request.method === 'GET') ||
    request.method === 'OPTIONS' ||
    /^Bearer [^\s]{1,8185}$/.test(request.headers.get('authorization') ?? '')
  )) return null;
  if (read && (path === '/favicon.svg' || /^\/fonts\/(fonts\.css|font-[0-7]\.ttf)$/.test(path))) return null;
  if (path === '/robots.txt' && read) return new Response('User-agent: *\nDisallow: /\n', { headers: { ...headers, 'Content-Type': 'text/plain' } });
  const secure = url.protocol === 'https:';
  if (path === '/preview/access' || path === '/preview/lock') {
    if (request.method !== 'POST') return html();
    if (request.headers.get('origin') !== url.origin) return html('Please enter your code from this page.', 403);
    if (path === '/preview/lock') return new Response(null, { status: 303, headers: { ...headers, Location: '/', 'Set-Cookie': cookie('', secure, 0) } });
    const code = secret(env);
    if (!code) return html('Invitations aren’t available just yet. Please check back soon.', 503);
    // Best-effort per-instance throttling. The code must also have high entropy.
    const ip = request.headers.get('x-vercel-forwarded-for') || 'local';
    for (const [id, entry] of attempts) if (entry.until <= now) attempts.delete(id);
    const attempt = attempts.get(ip) ?? { count: 0, until: now + 60_000 };
    if (attempt.count >= 8) {
      const response = html('Too many tries. Please wait a minute and try again.', 429);
      response.headers.set('Retry-After', '60');
      return response;
    }
    if (attempts.size >= 10000 && !attempts.has(ip)) return html('Please wait a minute and try again.', 429);
    attempt.count++;
    attempts.set(ip, attempt);
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return html('Please use the access-code form.', 415);
    if (Number(request.headers.get('content-length')) > 2048) return html('That access code is too long.', 413);
    let body = '';
    if (request.body) {
      const reader = request.body.getReader();
      let size = 0;
      const decoder = new TextDecoder();
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > 2048) { await reader.cancel(); return html('That access code is too long.', 413); }
          body += decoder.decode(part.value, { stream: true });
        }
        body += decoder.decode();
      } catch { return html('Please try entering your code again.', 400); }
    }
    const candidate = new URLSearchParams(body).get('code') ?? '';
    // Verify fixed-size HMACs instead of comparing submitted secrets directly.
    const candidateMac = await signature(candidate || 'invalid', 'access-code');
    const matches = await crypto.subtle.verify('HMAC', await key(code), Uint8Array.from(candidateMac.match(/../g)!, pair => parseInt(pair, 16)), encoder.encode('rep-and-plate-preview:access-code'));
    if (!matches) return html('That code doesn’t match. Check your invitation and try again.', 401);
    attempts.delete(ip);
    const expires = String(now + LIFETIME * 1000);
    return new Response(null, { status: 303, headers: { ...headers, Location: '/', 'Set-Cookie': cookie(`${expires}.${await signature(code, expires)}`, secure) } });
  }
  const unlocked = await hasPreviewAccess(request.headers.get('cookie'), env, now);
  if (path === '/preview' && read) return html('', 200, unlocked);
  if (unlocked) return null;
  if (path === '/api' || path.startsWith('/api/')) return Response.json({ error: 'This app is in private preview. Enter your invitation code on the website first.' }, { status: 401, headers });
  if (!read) return new Response('Private preview', { status: 403, headers });
  // Only document requests get the splash; blocked scripts never execute app code.
  if (path === '/' || request.headers.get('accept')?.includes('text/html')) return html();
  return new Response('Private preview', { status: 401, headers });
}
