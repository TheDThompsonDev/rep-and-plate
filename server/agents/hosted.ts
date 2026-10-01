import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { stateSchema } from '../../src/domain.ts';
import { buildAgentContext } from '../../src/features/connections/context.ts';
import { betaServices } from '../beta-services.ts';
import { createAgentHandler } from './http.ts';
import { emptyDocument, type AgentStore, type Document } from './store.ts';

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
  return createAgentHandler({
    store, origin: beta.origin, authenticate: beta.authenticate, admit: agentAdmission(admin),
    snapshot: async owner => {
      const { data, error } = await admin.from('fuel_snapshots').select('state,revision,updated_at').eq('user_id', owner).maybeSingle();
      if (error) throw Error('AGENT_SNAPSHOT');
      if (!data) return null;
      const state = stateSchema.parse(data.state);
      const stored = await store.read(owner);
      let timezone = stored.document.context?.timezone ?? 'UTC';
      let day: string;
      try { day = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
      catch { timezone = 'UTC'; day = new Date().toISOString().slice(0, 10); }
      return { context: buildAgentContext(state, day, timezone), revision: Number(data.revision), updatedAt: String(data.updated_at) };
    },
  });
}
