import type { ManageRequest } from './contracts';
import { defaultConnectionScopes } from './permissions';

// The consent page for Connect in Claude. Supabase Auth runs the sign-in itself and sends the person
// here with `?authorization_id=`; Allow records an ordinary connection, then approves with Supabase.

/** Supabase issues 32 random letters and digits. Anything else never reaches Supabase. */
export function consentAuthorizationId(search: string): string | null {
  const id = new URLSearchParams(search).get('authorization_id');
  return id && /^[A-Za-z0-9]{16,128}$/.test(id) ? id : null;
}

const LOOPBACK = ['localhost', '127.0.0.1', '[::1]'];

/** Where the assistant asked to be sent back, for the page to name plainly. Null when it is not a usable address. */
export function redirectTarget(value: string): { host: string; local: boolean } | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  const local = LOOPBACK.includes(url.hostname);
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) return null;
  return { host: url.host, local };
}

/** Supabase's answer is followed only to an https address, or plain http on this computer (Claude Code). */
export function safeClientRedirect(value: string): string | null {
  return redirectTarget(value) ? value : null;
}

/** The connection Allow records: named after the assistant, with everything a coach needs. */
export function consentConnection(client: { id: string; name?: string | null }): Extract<ManageRequest, { operation: 'oauth.connect' }> {
  const name = (client.name ?? '').trim().slice(0, 80) || 'Signed-in assistant';
  return { operation: 'oauth.connect', clientId: client.id, name, scopes: [...defaultConnectionScopes] };
}
