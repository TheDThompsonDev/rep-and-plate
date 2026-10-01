import { useEffect, useState } from 'react';
import { Link2, ShieldCheck, Unplug } from 'lucide-react';
import { Modal } from '../../components';
import type { AppState } from '../../domain';
import { browserConnections } from './browser';
import { useConnections, type ApplyAgentAction } from './useConnections';
import type { AgentScope } from './contracts';
import './connections.css';

const access: { scope: AgentScope; title: string; detail: string }[] = [
  { scope: 'nutrition:read', title: 'Nutrition & goals', detail: 'Seven days of recorded totals and your daily targets.' },
  { scope: 'pantry:read', title: 'Pantry', detail: 'Available ingredients, serving sizes, and quantities.' },
  { scope: 'preferences:read', title: 'Food preferences', detail: 'Restrictions, favorites, household size, and cooking needs.' },
  { scope: 'workouts:read', title: 'Workout history', detail: 'Your ten most recent completed sessions.' },
  { scope: 'meals:propose', title: 'Suggest meal records', detail: 'Send estimates for you to review before logging.' },
];
export default function ConnectionsHub({ state, onApply, open, onClose }: { state: AppState; onApply: ApplyAgentAction; open: boolean; onClose: () => void }) {
  const model = useConnections(state, onApply, browserConnections, open);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<AgentScope[]>(['nutrition:read', 'pantry:read', 'preferences:read', 'meals:propose']);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  useEffect(() => { if (model.credential) { setAdding(false); setCopied(false); } }, [model.credential]);
  if (!open) return null;
  const { overview, busy, credential } = model;
  const pending = overview.actions.filter(a => a.status === 'pending' && !state.agentResolutions?.some(r => r.actionId === a.id));
  const connected = overview.connections.filter(c => !c.revokedAt && Date.parse(c.expiresAt) > Date.now());
  const previous = overview.actions.filter(a => a.status !== 'pending' || state.agentResolutions?.some(r => r.actionId === a.id));
  return <Modal title="Connections" onClose={onClose} wide><div className="connections-content">
    <section className="connections-intro"><span className="connections-mark"><Link2 size={27} /></span><div><small>YOUR TOOLS, WORKING TOGETHER</small><h3>Bring your own assistant.</h3><p>Keep your food and fitness in one place, wherever the conversation starts.</p></div></section>
    <div className="connections-note"><ShieldCheck size={19} /><p>You choose what each tool can access. Photos and private chat stay out of these connections.</p></div>
    <p className="connections-caption">{model.session?.mode === 'local' ? 'Local connection · for agents on this computer. Open Connections after restarting the app to refresh shared context. Remote agents need the hosted account service.' : 'Account connection · agents read the latest records saved to your account. Unsynced device changes may not appear yet.'}</p>
    {model.error && <p className="connections-error" role="alert">{model.error}</p>}
    {copyError && <p className="connections-error" role="alert">{copyError}</p>}
    <div className="connections-heading"><h3>Your connections <span>{connected.length}</span></h3><button className="text-button" disabled={busy} onClick={() => void model.refresh()}>{model.loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {!connected.length && !model.loading && <div className="connections-empty"><Link2 size={22} /><div><strong>A little less copy and paste.</strong><p>Connect a CLI or MCP-compatible assistant to read context and send meal estimates back here.</p></div></div>}
    {connected.map(c => <article className="connection-row" key={c.id}><div><strong>{c.name}</strong><p>{access.filter(a => c.scopes.includes(a.scope)).map(a => a.title).join(' · ')}</p><small>Expires {new Date(c.expiresAt).toLocaleDateString()}</small></div><button className="connection-disconnect" aria-label={`Disconnect ${c.name}`} disabled={busy} onClick={() => void model.revoke(c.id)}><Unplug size={17} />Disconnect</button></article>)}
    {credential && <section className="connection-credential" aria-label="Connection credentials"><h3>{credential.connection.name} is ready</h3><p>Save this access key in your agent’s secret settings. It is shown once and expires in 30 days.</p>
      <label>Access key<textarea aria-label="Access key" readOnly value={credential.token} spellCheck={false} /></label>
      <button className="button" onClick={() => void navigator.clipboard.writeText(credential.token).then(() => { setCopied(true); setCopyError(''); }).catch(() => setCopyError('Copy is unavailable. Select the access key above and copy it manually.'))}>{copied ? 'Key copied' : 'Copy access key'}</button>
      <label>App address<input aria-label="App address" readOnly value={model.session?.url ?? ''} /></label>
      <details><summary>Set up a CLI or MCP client</summary><p>Set <code>REP_PLATE_URL</code> to the app address and <code>REP_PLATE_TOKEN</code> to your access key in your agent’s environment.</p><p>From this project, check the connection:</p><pre>npm --silent run health -- doctor --json</pre><p>For MCP clients, start the included adapter:</p><pre>npm --silent run agents:mcp</pre><p>The adapter uses standard input and output. An agent on another computer needs a reachable HTTPS app address.</p></details>
      <button className="text-button" onClick={model.clearCredential}>I’ve saved the key</button>
    </section>}
    {adding ? <form className="connection-form" onSubmit={e => { e.preventDefault(); void model.create(name, scopes); }}><h3>Connect an assistant</h3><label>Connection name<input autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="For example, my daily assistant" required /></label>
      <fieldset><legend>Allow this connection to…</legend>{access.map(a => <label className="connection-permission" key={a.scope}><input type="checkbox" checked={scopes.includes(a.scope)} onChange={e => setScopes(s => e.target.checked ? [...s, a.scope] : s.filter(v => v !== a.scope))} /><span><strong>{a.title}</strong><small>{a.detail}</small></span></label>)}</fieldset>
      <p className="connections-caption">Access lasts 30 days. You can disconnect at any time. Meal suggestions always need your review.</p><div className="connections-actions"><button type="submit" className="button primary" disabled={busy || !name.trim() || !scopes.length}>{busy ? 'Connecting…' : 'Create connection'}</button><button type="button" className="text-button" onClick={() => setAdding(false)}>Cancel</button></div>
    </form> : <button className="button primary connection-add" disabled={busy || !model.session} onClick={() => { setAdding(true); setCopied(false); }}>Connect an assistant</button>}
    <section aria-label="Agent proposals"><div className="connections-heading"><h3>From your assistants <span>{pending.length}</span></h3></div><p className="connections-caption">Only log meals you actually ate. These estimates do not deduct pantry ingredients.</p>
      {!pending.length && <p className="connections-empty-line">You’re all caught up. New meal proposals will appear here.</p>}
      {pending.map(action => <article key={action.id} className="connection-proposal" aria-label={action.meal.title}><small>FROM {action.connectionName} · NEEDS YOUR REVIEW</small><h4>{action.meal.title}</h4><p>{action.meal.day} · {action.meal.category} · {action.meal.time} · {action.meal.portion}</p><div className="connection-macros"><strong>~{action.meal.calories} <small>cal</small></strong><span>{action.meal.protein}g protein</span><span>{action.meal.carbs}g carbs</span><span>{action.meal.fat}g fat</span></div><p className="connection-agent-note">{action.meal.note}</p><div className="connections-actions"><button className="button primary" disabled={busy} onClick={() => void model.resolve(action, 'accepted')}>Log this meal</button><button className="text-button" disabled={busy} onClick={() => void model.resolve(action, 'dismissed')}>Dismiss</button></div></article>)}
    </section>
    {!!previous.length && <details className="connections-history"><summary>Recent outcomes ({previous.length})</summary>{previous.slice().reverse().slice(0, 20).map(action => { const receipt = state.agentResolutions?.find(r => r.actionId === action.id); const status = receipt?.status ?? action.status; return <div key={action.id}><strong>{action.meal.title}</strong><p>{action.connectionName} · {status === 'accepted' ? 'Logged on reviewing device' : status === 'dismissed' ? 'Dismissed' : status === 'revoked' ? 'Connection removed' : status === 'expired' ? 'Expired' : 'Pending'}{receipt && action.status === 'pending' ? ' · outcome waiting to send' : ''}{receipt && action.status !== 'pending' && receipt.status !== action.status ? ` · server outcome: ${action.status}` : ''}</p></div>; })}</details>}
  </div></Modal>;
}
