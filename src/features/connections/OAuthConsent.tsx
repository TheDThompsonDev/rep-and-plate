import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link2, ShieldCheck } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getCloudClient } from '../cloud/client';
import { isolatedAccountClient } from '../cloud/account-client';
import { connectionAccess, defaultConnectionScopes } from './permissions';
import { consentAuthorizationId, consentConnection, redirectTarget, safeClientRedirect } from './oauth-consent';
import './connections.css';

type Details = { id: string; clientId: string; clientName: string; redirectUri: string; email: string };
type Phase =
  | { step: 'loading' }
  | { step: 'signin'; error?: string }
  | { step: 'consent'; details: Details; client: SupabaseClient; token: string; error?: string }
  | { step: 'leaving' }
  | { step: 'stopped'; message: string };

const expired = 'This sign-in request has expired or was already used. Go back to your assistant and press Connect again.';
// The coach default, the same permissions a new key gets unless the person changes them.
const allowed = connectionAccess.filter(item => defaultConnectionScopes.includes(item.scope));

/**
 * `/oauth/consent`: where Supabase Auth sends a person who pressed Connect in Claude.
 * Allow first records an ordinary connection in Rep & Plate, then approves with Supabase, so a token
 * never exists for a client the person has not allowed here. Disconnect in Connections ends it.
 */
export default function OAuthConsent() {
  const [phase, setPhase] = useState<Phase>({ step: 'loading' });
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const authorizationId = consentAuthorizationId(location.search);

  const leave = (url: string | undefined) => {
    const target = url ? safeClientRedirect(url) : null;
    if (!target) { setPhase({ step: 'stopped', message: 'Rep & Plate could not send you back to your assistant. Go back to it and press Connect again.' }); return; }
    setPhase({ step: 'leaving' });
    location.assign(target);
  };
  const load = async (client: SupabaseClient, token: string) => {
    if (!authorizationId) return;
    const { data, error } = await client.auth.oauth.getAuthorizationDetails(authorizationId);
    if (error || !data) { setPhase({ step: 'stopped', message: expired }); return; }
    // Already allowed earlier for these permissions: Supabase answers with the way back straight away.
    if (!('authorization_id' in data)) { leave(data.redirect_url); return; }
    if (!redirectTarget(data.redirect_uri)) { setPhase({ step: 'stopped', message: 'This assistant asked to be sent somewhere Rep & Plate does not allow. Nothing was shared.' }); return; }
    setPhase({ step: 'consent', client, token, details: { id: data.authorization_id, clientId: data.client.id, clientName: data.client.name, redirectUri: data.redirect_uri, email: data.user.email } });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!authorizationId) { setPhase({ step: 'stopped', message: expired }); return; }
    void (async () => {
      try {
        const client = await getCloudClient();
        if (!client) { setPhase({ step: 'stopped', message: 'Signing in assistants is not available on this server.' }); return; }
        const { data } = await client.auth.getSession();
        if (data.session) await load(client, data.session.access_token);
        else setPhase({ step: 'signin' });
      } catch {
        setPhase({ step: 'stopped', message: 'Rep & Plate could not be reached. Check your connection and reload this page.' });
      }
    })();
    // Runs once per page: the authorization ID is fixed by the address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signing in here keeps the session in this page only, so it never changes which account the app uses.
  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const shared = await getCloudClient();
      if (!shared) throw Error('unavailable');
      const isolated = isolatedAccountClient(shared);
      const { data, error } = await isolated.auth.signInWithPassword({ email: String(form.get('email') ?? '').trim(), password: String(form.get('password') ?? '') });
      if (error || !data.session) { setPhase({ step: 'signin', error: 'That email and password did not match an account. Try again.' }); return; }
      await load(isolated, data.session.access_token);
    } catch {
      setPhase({ step: 'signin', error: 'Rep & Plate could not sign you in right now. Try again.' });
    } finally { setBusy(false); }
  };

  const decide = async (allow: boolean) => {
    if (phase.step !== 'consent') return;
    const { client, token, details } = phase;
    setBusy(true);
    try {
      if (allow) {
        const response = await fetch('/api/agents/manage', {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
          headers: { 'Content-Type': 'application/json', 'X-RP-Client': 'web', Authorization: `Bearer ${token}` },
          body: JSON.stringify(consentConnection({ id: details.clientId, name: details.clientName })),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
          setPhase({ ...phase, error: body?.error?.message ?? 'Rep & Plate could not save this connection. Nothing was shared. Try again.' });
          return;
        }
      }
      const { data, error } = allow
        ? await client.auth.oauth.approveAuthorization(details.id, { skipBrowserRedirect: true })
        : await client.auth.oauth.denyAuthorization(details.id, { skipBrowserRedirect: true });
      if (error || !data) { setPhase({ step: 'stopped', message: expired }); return; }
      leave(data.redirect_url);
    } catch {
      setPhase({ ...phase, error: 'Rep & Plate could not be reached. Nothing was shared. Try again.' });
    } finally { setBusy(false); }
  };

  const target = phase.step === 'consent' ? redirectTarget(phase.details.redirectUri) : null;
  return (
    <main className="connections-content oauth-consent" aria-busy={busy || phase.step === 'loading' || phase.step === 'leaving'}>
      <section className="connections-intro">
        <span className="connections-mark" aria-hidden="true"><Link2 /></span>
        <div>
          <small>REP &amp; PLATE</small>
          <h3>{phase.step === 'consent' ? `${phase.details.clientName || 'An assistant'} wants to be your coach` : 'Connect your assistant'}</h3>
          {phase.step === 'consent' && <p>Signed in as {phase.details.email}.</p>}
        </div>
      </section>

      {phase.step === 'loading' && <p className="connections-caption">Checking this request…</p>}
      {phase.step === 'leaving' && <p className="connections-caption">Taking you back to your assistant…</p>}
      {phase.step === 'stopped' && <p className="connections-error" role="alert">{phase.message}</p>}

      {phase.step === 'signin' && (
        <form className="connection-form" onSubmit={event => void signIn(event)}>
          <h3>Sign in to Rep &amp; Plate</h3>
          <p className="connections-caption">Use the account your records are in. Your assistant never sees your password.</p>
          {phase.error && <p className="connections-error" role="alert">{phase.error}</p>}
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          <div className="connections-actions"><button type="submit" className="button primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></div>
        </form>
      )}

      {phase.step === 'consent' && (
        <section className="connection-form">
          <p className="connection-form-summary">It will be able to:</p>
          {allowed.map(item => (
            <div className="connection-permission" key={item.scope}>
              <ShieldCheck aria-hidden="true" size={17} />
              <span><strong>{item.title}</strong><small>{item.detail}</small></span>
            </div>
          ))}
          <p className="connections-caption">
            Allowing sends you back to <strong>{target?.host}</strong>.{' '}
            {target?.local && 'That is a program on this computer. Allow only if you just pressed Connect in an app here. '}
            Meals and plan changes still wait for you to say yes. You can disconnect it any time in Connections.
          </p>
          {phase.error && <p className="connections-error" role="alert">{phase.error}</p>}
          <div className="connections-actions">
            <button type="button" className="button primary" disabled={busy} onClick={() => void decide(true)}>{busy ? 'Working…' : 'Allow'}</button>
            <button type="button" className="button secondary" disabled={busy} onClick={() => void decide(false)}>Deny</button>
          </div>
        </section>
      )}
    </main>
  );
}
