import { getCloudClient, requireBrowserOwner } from '../cloud/client';
import { cloudEpoch, cloudPaused } from '../cloud/sync-control';
import type { ConnectionsPlatform } from './useConnections';

export const browserConnections: ConnectionsPlatform = {
  foreground: () => document.visibilityState === 'visible',
  session: async () => {
    const epoch = cloudEpoch();
    const owner = localStorage.getItem('health.records.owner');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'X-RP-Client': 'web' };
    let identity = owner || 'device';
    if (local) {
      let device = localStorage.getItem('health.connections.device');
      if (!device) { device = crypto.randomUUID(); localStorage.setItem('health.connections.device', device); }
      identity = `${owner || 'guest'}:${device}`;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
      headers['X-RP-Profile'] = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    } else {
      if (cloudPaused()) throw Error('Reconnect your account before opening Connections.');
      const client = await getCloudClient();
      if (!client) throw Error('Sign in to your account before connecting an agent.');
      const session = await requireBrowserOwner(client);
      headers.Authorization = `Bearer ${session.access_token}`;
      identity = session.user.id;
    }
    const active = () => epoch === cloudEpoch() && owner === localStorage.getItem('health.records.owner') && (local || !cloudPaused());
    return {
      identity, active, mode: local ? 'local' : 'account', url: location.origin,
      request: async body => {
        if (!active()) throw Error('Your account changed. Reopen Connections.');
        const response = await fetch('/api/agents/manage', { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(15000), redirect: 'error' });
        if (!active()) throw Error('Your account changed. Reopen Connections.');
        let value: unknown;
        try { value = await response.json(); } catch { throw Error('Connections are unavailable on this server.'); }
        if (!response.ok) {
          const error = (value as { error?: { message?: string } }).error;
          throw Error(typeof error?.message === 'string' ? error.message : 'Connections could not connect. Check your account and try again.');
        }
        return value;
      },
    };
  },
};
