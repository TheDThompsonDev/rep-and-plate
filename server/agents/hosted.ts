import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { stateSchema, type AppState } from '../../src/domain.ts';
import { buildAgentContext } from '../../src/features/connections/context.ts';
import { betaServices } from '../beta-services.ts';
import { createAgentHandler } from './http.ts';
import { emptyDocument, type AgentStore, type Document } from './store.ts';
import { mcpOAuth, supabaseGrantVerifier, supabaseIssuer } from './oauth.ts';
import { mcpOAuthEnabled } from './oauth-paths.ts';

export class SupabaseAgentStore implements AgentStore {
  constructor(private admin: SupabaseClient) {}
  async read(owner: string) {
    const { data, error } = await this.admin.from('health_agent_documents').select('version,document').eq('user_id', owner).maybeSingle();
    if (error) throw Error('AGENT_STORAGE');
    return data ? { version: Number(data.version), document: data.document as Document } : { version: 0, document: emptyDocument() };
  }
  async owner(connectionId: string) {
    const { data, error } = await this.admin.from('health_agent_connection_owners').select('user_id').eq('connection_id', connectionId).maybeSingle();
    if (error) throw Error('AGENT_STORAGE');
    return (data?.user_id as string | undefined) ?? null;
  }
  async compareAndSet(owner: string, version: number, document: Document) {
    const { data, error } = await this.admin.rpc('health_agent_compare_set', { p_user: owner, p_version: version, p_document: document });
    if (error) throw Error('AGENT_STORAGE');
    return data === true;
  }
}
/** Agent traffic has its own quota and never claims the app's AI admission lease. */
export function agentAdmission(admin: SupabaseClient) {
  return async (owner: string) => {
    const { data, error } = await admin.rpc('health_agent_admit', { p_user: owner });
    if (error || typeof data?.allowed !== 'boolean' || data.lease !== '') throw Error('AGENT_ADMISSION');
    return { allowed: data.allowed as boolean, lease: '' };
  };
}
export function hostedAgentHandler(env: Record<string, string | undefined>) {
  const beta = betaServices(env);
  const admin = createClient(beta.publicConfig.url, (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY)!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  const store = new SupabaseAgentStore(admin);
  // Connect in Claude: off until Supabase's OAuth server and dynamic registration are switched on.
  const oauth = mcpOAuthEnabled(env)
    ? mcpOAuth(beta.origin, beta.publicConfig.url, supabaseGrantVerifier(token => admin.auth.getClaims(token), supabaseIssuer(beta.publicConfig.url)))
    : undefined;
  return createAgentHandler({
    store, origin: beta.origin, authenticate: beta.authenticate, admit: agentAdmission(admin), oauth,
    snapshot: async owner => {
      const { data, error } = await admin.from('fuel_snapshots').select('state,revision,updated_at').eq('user_id', owner).maybeSingle();
      if (error) throw Error('AGENT_SNAPSHOT');
      if (!data) return null;
      const state = stateSchema.parse(data.state);
      const stored = await store.read(owner);
      const updatedAt = String(data.updated_at);
      return { context: snapshotContext(state, updatedAt, stored.document.context?.timezone, new Date()), revision: Number(data.revision), updatedAt };
    },
  });
}

const localDay = (at: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);

/**
 * Today's context from the latest saved app snapshot. The window ends today, but the snapshot ends
 * when it was saved: days after that are left out, not reported as zero meals.
 */
export function snapshotContext(state: AppState, updatedAt: string, storedTimezone: string | undefined, now: Date) {
  let timezone = storedTimezone ?? 'UTC';
  let day: string;
  try { day = localDay(now, timezone); }
  catch { timezone = 'UTC'; day = now.toISOString().slice(0, 10); }
  const saved = new Date(updatedAt);
  const recordedThrough = Number.isFinite(saved.getTime()) ? localDay(saved, timezone) : undefined;
  return buildAgentContext(state, day, timezone, recordedThrough);
}
