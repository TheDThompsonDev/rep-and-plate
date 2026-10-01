import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppState } from '../../domain';
import { today } from '../../domain';
import { agentReviewConflicts, buildAgentContext } from './context';
import { agentActionSchema, connectionSchema, type AgentAction, type AgentConnection, type AgentOverview, type AgentScope, type ManageRequest } from './contracts';
import { z } from 'zod';
import { onAccountChange } from '../cloud/sync-control';

export type ConnectionSession = {
  identity: string;
  mode: 'local' | 'account';
  url: string;
  active: () => boolean;
  request: (body: ManageRequest) => Promise<unknown>;
};
export type ConnectionsPlatform = { session: () => Promise<ConnectionSession>; foreground?: () => boolean };
const overviewSchema = z.object({ connections: z.array(connectionSchema), actions: z.array(agentActionSchema), publishedAt: z.string().nullable() });
export type ApplyAgentAction = (action: AgentAction, status: 'accepted' | 'dismissed') => Promise<void>;

/** One poller for the inbox and context publishing, shared by web and native. */
export function useConnections(state: AppState, apply: ApplyAgentAction, platform: ConnectionsPlatform, open: boolean) {
  const current = useRef(state); current.current = state;
  const applyRef = useRef(apply); applyRef.current = apply;
  const openRef = useRef(open); openRef.current = open;
  const [overview, setOverview] = useState<AgentOverview>({ connections: [], actions: [], publishedAt: null });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<ConnectionSession | null>(null);
  const [credential, setCredential] = useState<{ connection: AgentConnection; token: string } | null>(null);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const ownerRef = useRef('');
  const sessionRef = useRef<ConnectionSession | null>(null);
  const lastPublished = useRef('');
  const dataUpdatedAt = useRef<string | null>(null);
  const lastState = useRef(state);
  const lastPoll = useRef(0);
  const visible = useRef(false);
  useEffect(() => onAccountChange(() => {
    generation.current++;
    ownerRef.current = ''; lastPublished.current = ''; dataUpdatedAt.current = null;
    sessionRef.current = null; setCredential(null); setSession(null); setError('Your account changed. Refresh Connections to continue.');
    setOverview({ connections: [], actions: [], publishedAt: null });
  }), []);
  if (lastState.current !== state) { lastState.current = state; dataUpdatedAt.current = new Date().toISOString(); }
  const checked = useCallback(async () => {
    if (sessionRef.current && !sessionRef.current.active()) {
      generation.current++; sessionRef.current = null;
      setCredential(null); setSession(null); lastPublished.current = '';
      setOverview({ connections: [], actions: [], publishedAt: null });
    }
    const next = await platform.session();
    if (!next.active()) throw Error('Your account changed. Reopen Connections.');
    if (ownerRef.current && ownerRef.current !== next.identity) {
      setCredential(null); lastPublished.current = ''; dataUpdatedAt.current = null;
      setOverview({ connections: [], actions: [], publishedAt: null });
    }
    ownerRef.current = next.identity;
    sessionRef.current = next;
    setSession(next);
    return next;
  }, [platform]);

  const refresh = useCallback(async () => {
    const run = generation.current;
    const active = await checked();
    const value = overviewSchema.parse(await active.request({ operation: 'list' }));
    if (run !== generation.current || !active.active()) return;
    const hasAccess = value.connections.some(c => !c.revokedAt && Date.parse(c.expiresAt) > Date.now());
    if (hasAccess) {
      const context = buildAgentContext(current.current, today(), Intl.DateTimeFormat().resolvedOptions().timeZone);
      const encoded = JSON.stringify(context);
      if (lastPublished.current !== encoded) {
        await active.request({ operation: 'publish', context, dataUpdatedAt: dataUpdatedAt.current });
        if (run !== generation.current || !active.active()) return;
        lastPublished.current = encoded;
      }
      // A receipt exists only after the reviewing device persisted the action.
      for (const action of value.actions.filter(a => a.status === 'pending')) {
        const receipt = current.current.agentResolutions?.find(r => r.actionId === action.id);
        if (!receipt) continue;
        const result = z.object({ action: agentActionSchema }).parse(await active.request({ operation: 'resolve', actionId: action.id, status: receipt.status }));
        if (run !== generation.current || !active.active()) return;
        value.actions = value.actions.map(a => a.id === action.id ? result.action : a);
      }
    }
    setOverview(value);
    const conflicts = agentReviewConflicts(current.current, value.actions);
    setError(conflicts.length ? 'A review saved on this device differs from its agent proposal’s outcome on the server. Your local meals have been kept. Check Recent outcomes before making another change.' : '');
  }, [checked]);

  useEffect(() => {
    visible.current = open;
    if (!open) setCredential(null);
  }, [open]);
  useEffect(() => {
    // No account lookup or background transfer until Connections is opened once.
    if (!open && !session) return;
    let alive = true, running = false;
    const poll = async () => {
      if (!alive || running || busyRef.current || (!openRef.current && !overview.connections.some(c => !c.revokedAt && Date.parse(c.expiresAt) > Date.now()))) return;
      if (platform.foreground && !platform.foreground()) return;
      if (!openRef.current && Date.now() - lastPoll.current < 300000) return;
      running = true;
      lastPoll.current = Date.now();
      if (openRef.current) setLoading(true);
      try { await refresh(); } catch (e) { if (alive && visible.current) setError(e instanceof Error ? e.message : 'Connections could not refresh.'); }
      finally { running = false; if (alive) setLoading(false); }
    };
    void poll();
    const timer = setInterval(() => void poll(), 60000);
    return () => { alive = false; generation.current++; clearInterval(timer); };
  }, [open, session?.identity, overview.connections.length, refresh, platform]); // stable identity avoids restarting on each refresh

  async function perform(task: (active: ConnectionSession) => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try { const active = await checked(); await task(active); if (active.active()) await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'That change could not be saved.'); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return {
    overview, error, loading, busy, session, credential,
    clearCredential: () => setCredential(null),
    refresh: () => perform(async () => {}),
    create: (name: string, scopes: AgentScope[]) => perform(async active => {
      const result = z.object({ connection: connectionSchema, token: z.string() }).parse(await active.request({ operation: 'create', name, scopes, expiresInDays: 30 }));
      if (active.active()) { lastPublished.current = ''; if (visible.current) setCredential(result); }
    }),
    revoke: (id: string) => perform(async active => { await active.request({ operation: 'revoke', connectionId: id }); if (credential?.connection.id === id) setCredential(null); }),
    resolve: (action: AgentAction, status: 'accepted' | 'dismissed') => perform(async active => {
      // Re-read before applying: another device may have resolved or revoked it.
      const latest = overviewSchema.parse(await active.request({ operation: 'list' }));
      const proposal = latest.actions.find(a => a.id === action.id);
      if (!proposal || !active.active()) throw Error('This proposal is no longer available. Refresh Connections.');
      await applyRef.current(proposal, status);
      if (!active.active()) throw Error('Saved on this device. Reopen Connections to check the account status.');
      try { await active.request({ operation: 'resolve', actionId: action.id, status }); }
      catch { throw Error('Your review is saved on this device. Refresh Connections to send the outcome to your agent.'); }
    }),
  };
}
export type ConnectionsController = ReturnType<typeof useConnections>;
