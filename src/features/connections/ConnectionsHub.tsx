import { useEffect, useState } from 'react';
import { Link2, ShieldCheck, Unplug } from 'lucide-react';
import { Modal } from '../../components';
import type { AppState } from '../../domain';
import { browserConnections } from './browser';
import { useConnections, type ApplyAgentAction } from './useConnections';
import type { AgentScope } from './contracts';
import { defaultConnectionScopes, toggleConnectionScope } from './permissions';
import { connectionLifetimes, defaultLifetimeDays, expiryNotice, setupGuides, type SetupGuide } from './setup';
import './connections.css';

const access: { scope: AgentScope; title: string; detail: string }[] = [
  { scope: 'nutrition:read', title: 'Nutrition & goals', detail: 'Seven days of recorded totals and your daily targets.' },
  { scope: 'pantry:read', title: 'Pantry', detail: 'Available ingredients, serving sizes, and quantities.' },
  { scope: 'preferences:read', title: 'Food preferences', detail: 'Restrictions, favorites, household size, and cooking needs.' },
  { scope: 'workouts:read', title: 'Workout history', detail: 'Your ten most recent completed sessions.' },
  { scope: 'activities:read', title: 'Recorded activities', detail: 'Recorded activity dates, durations and your notes. Missing activity stays unknown.' },
  { scope: 'coaching:read', title: 'Coaching plan & memory', detail: 'Your agreed plan, priorities, feedback, explicit memories and decision history.' },
  { scope: 'coaching:write', title: 'Change your coaching plan', detail: 'Prepare plan changes and save records from your other apps, each only after you say yes in your assistant. Includes feedback and memory changes.' },
  { scope: 'meals:propose', title: 'Suggest meal records', detail: 'Send estimates for you to review before logging.' },
];
export default function ConnectionsHub({ state, onApply, open, onClose, onAccount }: { state: AppState; onApply: ApplyAgentAction; open: boolean; onClose: () => void; onAccount?: () => void }) {
  const model = useConnections(state, onApply, browserConnections, open);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('My assistant');
  const [scopes, setScopes] = useState<AgentScope[]>(() => [...defaultConnectionScopes]);
  const [copied, setCopied] = useState('');
  const [days, setDays] = useState<number>(defaultLifetimeDays);
  const [guideId, setGuideId] = useState<SetupGuide['id']>('claude-code');
  const [copyError, setCopyError] = useState('');
  useEffect(() => { if (model.credential) { setAdding(false); setCopied(''); } }, [model.credential]);
  if (!open) return null;
  const { overview, busy, credential } = model;
  const pending = overview.actions.filter(a => a.status === 'pending' && !state.agentResolutions?.some(r => r.actionId === a.id));
  const now = Date.now();
  const connected = overview.connections.filter(c => !c.revokedAt && Date.parse(c.expiresAt) > now);
  // A key that ran out recently can be kept going, so it stays listed instead of vanishing.
  const listed = overview.connections.filter(c => !c.revokedAt).map(c => ({ c, notice: expiryNotice(c.expiresAt, now) })).filter(row => row.notice.renewable);
  const copy = (text: string, id: string) => void navigator.clipboard.writeText(text).then(() => { setCopied(id); setCopyError(''); }).catch(() => setCopyError('Copy is unavailable. Select the text and copy it manually.'));
  const guides = credential && model.session ? setupGuides(model.session.url, credential.token) : [];
  const guide = guides.find(g => g.id === guideId) ?? guides[0];
  const previous = overview.actions.filter(a => a.status !== 'pending' || state.agentResolutions?.some(r => r.actionId === a.id));
  return <Modal title="Connections" onClose={onClose} wide><div className="connections-content" aria-busy={busy || model.loading}>
    <section className="connections-intro"><span className="connections-mark"><Link2 size={27} /></span><div><small>YOUR TOOLS, WORKING TOGETHER</small><h3>Bring your own assistant.</h3><p>Keep your food and fitness in one place, wherever the conversation starts.</p></div></section>
    <div className="connections-note"><ShieldCheck size={19} /><p>You choose what each tool can access. Photos and private chat stay out of these connections.</p></div>
    <p className="connections-caption">{model.session?.mode === 'local' ? 'Local connection · for agents on this computer. Open Connections after restarting the app to refresh shared context. Remote agents need the hosted account service.' : 'Account connection · agents read the latest records saved to your account. Unsynced device changes may not appear yet.'}</p>
    {model.access && onAccount
      // Connections cannot start until the account is ready. Saying so without a way to act left
      // its owner stuck on a button that would not press.
      ? <div className="connections-error connections-blocked" role="alert">
          <p>{model.access === 'signin' ? 'Sign in to your Rep & Plate account to connect an assistant.' : 'One step first: confirm that the records on this device belong to your account. Then come back here to connect an assistant.'}</p>
          <button type="button" className="button primary" onClick={() => { onClose(); onAccount(); }}>{model.access === 'signin' ? 'Sign in' : 'Open your account'}</button>
        </div>
      : model.error && <p className="connections-error" role="alert">{model.error}</p>}
    {copyError && <p className="connections-error" role="alert">{copyError}</p>}
    <div className="connections-heading"><h3>Your connections <span>{connected.length}</span></h3><button className="text-button" disabled={busy} onClick={() => void model.refresh()}>{model.loading ? 'Refreshing…' : 'Refresh'}</button></div>
    {!connected.length && !model.loading && <div className="connections-empty"><Link2 size={22} /><div><strong>Your coach, with the full picture.</strong><p>Connect Claude Code, Codex or another assistant. It can check in on your plan, bring in records from your other apps and send meal estimates back here.</p></div></div>}
    {listed.map(({ c, notice }) => <article className="connection-row" key={c.id}><div><strong>{c.name}</strong><p>{access.filter(a => c.scopes.includes(a.scope)).map(a => a.title).join(' · ')}</p><small className={notice.state === 'active' ? undefined : 'connection-expiring'}>{notice.label}{notice.state === 'expired' ? '' : ` · until ${new Date(c.expiresAt).toLocaleDateString()}`}</small></div><div className="connection-row-actions">{notice.state !== 'active' && <button className="button secondary" aria-label={`Keep ${c.name} connected`} disabled={busy} onClick={() => void model.renew(c.id)}>Keep connected</button>}<button className="connection-disconnect" aria-label={`Disconnect ${c.name}`} disabled={busy} onClick={() => void model.revoke(c.id)}><Unplug size={17} />Disconnect</button></div></article>)}
    {listed.some(row => row.notice.state !== 'active') && <p className="connections-caption">Keep connected adds {defaultLifetimeDays} days to the same access key, so your assistant keeps working without being set up again.</p>}
    {credential && <section className="connection-credential" aria-label="Connection credentials"><h3>{credential.connection.name} is ready</h3><p>Save this access key now. It is shown once and works until {new Date(credential.connection.expiresAt).toLocaleDateString()}. You can keep it going from this screen later without setting anything up again.</p>
      <label>Access key<textarea aria-label="Access key" readOnly value={credential.token} spellCheck={false} /></label>
      <button className="button" onClick={() => copy(credential.token, 'key')}>{copied === 'key' ? 'Key copied' : 'Copy access key'}</button>
      {guide && <div className="connection-setup"><h4>Set up your assistant</h4>
        <div className="connection-guides" role="group" aria-label="Choose your assistant">{guides.map(g => <button key={g.id} type="button" aria-pressed={g.id === guide.id} onClick={() => setGuideId(g.id)}>{g.name}</button>)}</div>
        <p className="connection-guide-summary">{guide.status !== 'ready' && <strong>{guide.status === 'limited' ? 'Limited · ' : 'Not available yet · '}</strong>}{guide.summary}</p>
        <ol className="connection-steps" aria-label={`Steps for ${guide.name}`}>{guide.steps.map((step, index) => { const id = `${guide.id}-${index}`; return <li key={id} className={step.important ? 'connection-step-important' : undefined}><span>{step.important && <strong>Easy to miss. </strong>}{step.text}</span>{step.copy && <><pre>{step.copy}</pre><button type="button" className="text-button" onClick={() => copy(step.copy!, id)}>{copied === id ? 'Copied' : step.copyLabel ?? 'Copy'}</button></>}</li>; })}</ol>
        {model.session?.mode === 'local' && <p className="connections-caption">This address is on this computer, so only an assistant running here can reach it.</p>}
        <p className="connections-caption">The commands above contain your access key. Keep them out of chats and shared files.</p>
      </div>}
      <button className="text-button" onClick={model.clearCredential}>I’ve saved the key</button>
    </section>}
    {adding ? <form className="connection-form" onSubmit={e => { e.preventDefault(); void model.create(name, scopes, days); }}><h3>Connect an assistant</h3><label>Connection name<input autoFocus value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder="For example, my daily assistant" required /></label>
      <p className="connection-form-summary">Your assistant becomes your coach. It can read your records and plan, bring in records from your other apps, draft meals for you to review, and propose plan changes that apply only after your yes.</p>
      <details className="connection-advanced"><summary>Change what it can do</summary><fieldset><legend>Allow this connection to…</legend>{access.map(a => <label className="connection-permission" key={a.scope}><input type="checkbox" checked={scopes.includes(a.scope)} onChange={e => setScopes(s => toggleConnectionScope(s, a.scope, e.target.checked))} /><span><strong>{a.title}</strong><small>{a.detail}</small></span></label>)}</fieldset>
      <label>Keep this connection working for<select aria-label="Keep this connection working for" value={days} onChange={e => setDays(Number(e.target.value))}>{connectionLifetimes.map(option => <option key={option.days} value={option.days}>{option.label}</option>)}</select></label></details><p className="connections-caption">It works for {connectionLifetimes.find(option => option.days === days)?.label ?? `${days} days`}. You can keep it going or disconnect at any time.</p><div className="connections-actions"><button type="submit" className="button primary" disabled={busy || !name.trim() || !scopes.length}>{busy ? 'Connecting…' : 'Create connection'}</button><button type="button" className="text-button" onClick={() => setAdding(false)}>Cancel</button></div>
    </form> : <button className="button primary connection-add" disabled={busy || !model.session} onClick={() => { setAdding(true); setCopied(''); }}>Connect an assistant</button>}
    <section aria-label="Agent proposals"><div className="connections-heading"><h3>From your assistants <span>{pending.length}</span></h3></div><p className="connections-caption">Only log meals you actually ate. These estimates do not deduct pantry ingredients.</p>
      {!pending.length && <p className="connections-empty-line">You’re all caught up. New meal proposals will appear here.</p>}
      {pending.map(action => <article key={action.id} className="connection-proposal" aria-label={action.meal.title}><small>FROM {action.connectionName} · NEEDS YOUR REVIEW</small><h4>{action.meal.title}</h4><p>{action.meal.day} · {action.meal.category} · {action.meal.time} · {action.meal.portion}</p><div className="connection-macros"><strong>~{action.meal.calories} <small>cal</small></strong><span>{action.meal.protein}g protein</span><span>{action.meal.carbs}g carbs</span><span>{action.meal.fat}g fat</span></div><p className="connection-agent-note">{action.meal.note}</p><div className="connections-actions"><button className="button primary" disabled={busy} onClick={() => void model.resolve(action, 'accepted')}>Log this meal</button><button className="text-button" disabled={busy} onClick={() => void model.resolve(action, 'dismissed')}>Dismiss</button></div></article>)}
    </section>
    {!!previous.length && <details className="connections-history"><summary>Recent outcomes ({previous.length})</summary>{previous.slice().reverse().slice(0, 20).map(action => { const receipt = state.agentResolutions?.find(r => r.actionId === action.id); const status = receipt?.status ?? action.status; return <div key={action.id}><strong>{action.meal.title}</strong><p>{action.connectionName} · {status === 'accepted' ? 'Logged on reviewing device' : status === 'dismissed' ? 'Dismissed' : status === 'revoked' ? 'Connection removed' : status === 'expired' ? 'Expired' : 'Pending'}{receipt && action.status === 'pending' ? ' · outcome waiting to send' : ''}{receipt && action.status !== 'pending' && receipt.status !== action.status ? ` · server outcome: ${action.status}` : ''}</p></div>; })}</details>}
  </div></Modal>;
}
