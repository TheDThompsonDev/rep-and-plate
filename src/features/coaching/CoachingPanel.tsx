import { useRef, useState } from 'react';
import type { CoachingCommand, CoachingState, CoachingWeeklyReview } from './contracts';
import { coachingSourceLabel } from './model';
import type { ImportedRecordRef } from './useCoaching';
import './coaching.css';

type PlannedSession = Extract<CoachingCommand, { type: 'replace_week' }>['sessions'][number];
type CoachingProfile = Extract<CoachingCommand, { type: 'setup' }>['profile'];
type CoachingContent = { profile: CoachingProfile | null; sessions: PlannedSession[]; outcomes: unknown[]; memories: unknown[] };
type CoachingBriefView = {
  day: string;
  today: PlannedSession[];
  upcoming: PlannedSession[];
  missingData: string[];
};
export type CoachingPanelProps = {
  state: CoachingState | null;
  brief: CoachingBriefView | null;
  weekly?: CoachingWeeklyReview | null;
  loading: boolean;
  busy: boolean;
  error: string;
  notice: string;
  onRefresh: () => void;
  onPropose: (command: CoachingCommand) => Promise<unknown>;
  onResolve: (proposalId: string, status: 'accepted' | 'dismissed') => Promise<unknown>;
  onUndo: (entryId: string) => Promise<unknown>;
  onRemoveRecord?: (record: ImportedRecordRef) => Promise<unknown>;
  onClose?: () => void;
  compact?: boolean;
};

const priorities = ['running', 'strength', 'nutrition', 'custom'] as const;
const priorityLabels: Record<string, string> = { running: 'Running', strength: 'Strength', nutrition: 'Nutrition', custom: 'Something else' };
const sports = ['run', 'strength', 'recovery', 'other'] as const;
const sportLabels: Record<PlannedSession['sport'], string> = { run: 'Running', strength: 'Strength', recovery: 'Recovery', other: 'Other' };
const newId = () => crypto.randomUUID();
const localDay = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
function weekStart(day: string) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function dateLabel(day: string) {
  const date = new Date(`${day}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : day;
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'None set';
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join('; ') : 'None';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const item = object(value);
  if (typeof item.title === 'string') return `${item.title}${typeof item.day === 'string' ? ` · ${dateLabel(item.day)}` : ''}${typeof item.sport === 'string' ? ` · ${sportLabels[item.sport as PlannedSession['sport']] ?? item.sport}` : ''}${typeof item.minutes === 'number' ? ` · ${item.minutes} min` : ''}${typeof item.details === 'string' && item.details ? ` · ${item.details}` : ''}`;
  if (typeof item.text === 'string') return item.text;
  if (typeof item.status === 'string') return `${item.status}${typeof item.actualMinutes === 'number' ? ` · ${item.actualMinutes} min recorded` : ''}${typeof item.note === 'string' && item.note ? ` · ${item.note}` : ''}${typeof item.effort === 'number' ? ` · effort ${item.effort}/10` : ''}`;
  return 'Saved details';
}
function Snapshot({ content, comparedTo }: { content: CoachingContent; comparedTo: CoachingContent }) {
  const different = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);
  const changedItems = (items: unknown[], others: unknown[]) => items.filter(item => {
    const id = object(item).id;
    const other = others.find(value => object(value).id === id);
    return !other || different(item, other);
  });
  const rows: [string, unknown][] = [];
  if (different(content.profile?.primaryGoal, comparedTo.profile?.primaryGoal)) rows.push(['Goal', content.profile?.primaryGoal]);
  if (different(content.profile?.priorities, comparedTo.profile?.priorities)) rows.push(['Priorities', content.profile?.priorities]);
  if (different(content.profile?.constraints, comparedTo.profile?.constraints)) rows.push(['Constraints', content.profile?.constraints]);
  if (different(content.profile?.notes, comparedTo.profile?.notes)) rows.push(['Notes', content.profile?.notes]);
  if (different(content.sessions, comparedTo.sessions)) rows.push(['Sessions affected', changedItems(content.sessions, comparedTo.sessions)]);
  if (different(content.outcomes, comparedTo.outcomes)) rows.push(['Feedback affected', changedItems(content.outcomes, comparedTo.outcomes)]);
  if (different(content.memories, comparedTo.memories)) rows.push(['Memory affected', changedItems(content.memories, comparedTo.memories)]);
  return rows.length ? <dl className="coaching-change-list">{rows.map(([label, value]) => <div className="coaching-change-line" key={label}><dt>{label}</dt><dd>{displayValue(value)}</dd></div>)}</dl> : <p className="coaching-subtle">No differences in these details.</p>;
}

export default function CoachingPanel({ state, brief, weekly, loading, busy, error, notice, onRefresh, onPropose, onResolve, onUndo, onRemoveRecord, onClose, compact = false }: CoachingPanelProps) {
  const today = brief?.day ?? localDay();
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<'setup' | 'session' | 'outcome' | 'memory' | null>(null);
  const [primary, setPrimary] = useState<string>('running');
  const [goal, setGoal] = useState('');
  const [supporting, setSupporting] = useState('');
  const [constraints, setConstraints] = useState('');
  const [profileNotes, setProfileNotes] = useState('');
  const [sessionId, setSessionId] = useState<string>(newId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [sessionDay, setSessionDay] = useState(today);
  const [sport, setSport] = useState<PlannedSession['sport']>('run');
  const [minutes, setMinutes] = useState('30');
  const [details, setDetails] = useState('');
  const [weekDay, setWeekDay] = useState(today);
  const [feedbackSession, setFeedbackSession] = useState('');
  const [outcomeId, setOutcomeId] = useState<string>(newId);
  const [outcomeStatus, setOutcomeStatus] = useState<'completed' | 'skipped'>('completed');
  const [outcomeDay, setOutcomeDay] = useState(today);
  const [actualMinutes, setActualMinutes] = useState('');
  const [effort, setEffort] = useState('');
  const [outcomeNote, setOutcomeNote] = useState('');
  const [memoryId, setMemoryId] = useState<string>(newId);
  const [memory, setMemory] = useState('');
  const [memoryCategory, setMemoryCategory] = useState<'preference' | 'constraint' | 'context' | 'other'>('preference');
  const proposalHeading = useRef<HTMLHeadingElement>(null);
  const actionRunning = useRef(false);
  const draftGeneration = useRef(0);

  async function run(action: () => Promise<unknown>, done?: () => void) {
    if (busy || actionRunning.current) return;
    actionRunning.current = true;
    const generation = draftGeneration.current;
    setSubmitting(true);
    setLocalError('');
    try { await action(); if (generation === draftGeneration.current) done?.(); }
    catch (reason) { setLocalError(reason instanceof Error ? reason.message : 'This change could not finish. Your draft is still here.'); }
    finally { actionRunning.current = false; setSubmitting(false); }
  }
  function openSession(session?: PlannedSession) {
    draftGeneration.current++;
    setEditingId(session?.id ?? null); setSessionId(session?.id ?? newId());
    setTitle(session?.title ?? ''); setSessionDay(session?.day ?? today);
    setSport(session?.sport ?? 'run'); setMinutes(String(session?.minutes ?? 30));
    setDetails(session?.details ?? ''); setForm('session');
  }
  function openSetup() {
    draftGeneration.current++;
    const profile = state?.profile;
    setGoal(profile?.primaryGoal ?? '');
    const first = profile?.priorities[0];
    setPrimary(first && priorities.includes(first as typeof priorities[number]) ? first : profile?.primaryGoal ? 'custom' : 'running');
    setSupporting(profile?.priorities.slice(1).join(', ') ?? '');
    setConstraints(profile?.constraints.join('\n') ?? '');
    setProfileNotes(profile?.notes ?? '');
    setForm('setup');
  }
  function openOutcome(session: PlannedSession) {
    draftGeneration.current++;
    const existing = state?.outcomes.find(outcome => outcome.sessionId === session.id);
    setFeedbackSession(session.id); setOutcomeId(existing?.id ?? newId()); setOutcomeStatus(existing?.status ?? 'completed');
    setOutcomeDay(existing?.day ?? (session.day > today ? today : session.day));
    setActualMinutes(existing?.actualMinutes !== undefined ? String(existing.actualMinutes) : '');
    setEffort(existing?.effort !== undefined ? String(existing.effort) : '');
    setOutcomeNote(existing?.note ?? ''); setForm('outcome');
  }
  function proposed() { draftGeneration.current++; setForm(null); requestAnimationFrame(() => proposalHeading.current?.focus()); }

  // The canonical server state is rendered below; local form values never masquerade as saved records.
  const sessions = state?.sessions ?? [];
  const outcomes = state?.outcomes ?? [];
  const memories = state?.memories ?? [];
  const proposals = state?.proposals.filter(proposal => proposal.status === 'pending') ?? [];
  const journal = state?.journal ?? [];
  // Newest first. These come from other apps and stay separate from the plan, outcomes and food diary.
  const importedActivities = [...(state?.evidence.activities ?? [])].reverse().slice(0, 20);
  const importedNutrition = [...(state?.evidence.nutritionDays ?? [])].reverse().slice(0, 14);
  const importedTotal = (state?.evidence.activities.length ?? 0) + (state?.evidence.nutritionDays.length ?? 0);
  const latestDecision = journal.at(-1);
  const canUndoLatest = latestDecision?.kind === 'apply' && latestDecision.revision === state?.revision;
  const week = weekStart(weekDay);
  const thisWeek = sessions.filter(session => session.day >= week && session.day < addDays(week, 7)).sort((a, b) => a.day.localeCompare(b.day));
  const feedbackTarget = sessions.find(session => session.id === feedbackSession);
  const visibleToday = brief?.today ?? sessions.filter(session => session.day === today);
  const upcoming = brief?.upcoming ?? sessions.filter(session => session.day > today).sort((a, b) => a.day.localeCompare(b.day)).slice(0, 3);
  const canWrite = !!state && !loading && !busy && !submitting;
  const hasProfile = !!state?.profile?.primaryGoal.trim();

  function renderSession(session: PlannedSession) {
    const outcome = [...outcomes].reverse().find(item => item.sessionId === session.id);
    const status = outcome?.status === 'completed' ? 'completed' : outcome?.status === 'skipped' ? 'skipped' : session.day < today ? 'unknown' : 'planned';
    const statusText = status === 'completed' ? 'Completed' : status === 'skipped' ? 'Skipped · you confirmed' : status === 'unknown' ? 'Outcome unknown' : 'Planned';
    return <article className="coaching-session" key={session.id}>
      <div className="coaching-session-top">
        <div className="coaching-session-name"><strong>{session.title}</strong><span className="coaching-session-date">{dateLabel(session.day)} · {sportLabels[session.sport]} · {session.minutes} min planned</span></div>
        <span className={`coaching-status coaching-status-${status}`}>{statusText}</span>
      </div>
      {!!session.details && <p className="coaching-subtle">{session.details}</p>}
      {outcome && <p className="coaching-subtle">{outcome.actualMinutes !== undefined ? `${outcome.actualMinutes} min recorded. ` : ''}{outcome.effort !== undefined ? `Effort ${outcome.effort}/10. ` : ''}{outcome.note}</p>}
      <div className="coaching-actions">
        <button className="button secondary" disabled={!canWrite} onClick={() => openSession(session)} aria-label={`Change ${session.title}`}>Change session</button>
        <button className="button secondary" disabled={!canWrite} onClick={() => openOutcome(session)} aria-label={`Record outcome for ${session.title}`}>Record what happened</button>
      </div>
    </article>;
  }

  return <div className={`coaching-panel${compact ? ' coaching-panel-compact' : ''}`}>
    <div className="coaching-heading"><div><span className="coaching-eyebrow">YOUR NEXT STEP</span><h2>{compact ? 'Today with Spot' : 'Your coaching plan'}</h2><p className="coaching-subtle">Your priorities, a practical plan, and changes you choose.</p></div>
      <div className="coaching-actions"><button className="button secondary" disabled={loading || busy} onClick={onRefresh}>{loading ? 'Refreshing…' : 'Refresh'}</button>{onClose && <button className="button secondary" onClick={onClose}>Close</button>}</div>
    </div>
    {(error || localError) && <p className="coaching-error" role="alert">{localError || error} <button className="button secondary" disabled={busy || loading} onClick={onRefresh}>Retry connection</button></p>}
    {!!notice && <p className="coaching-notice" role="status">{notice}</p>}
    {loading && !state && <p className="coaching-empty" role="status">Opening your saved coaching plan…</p>}
    {!state && !loading && <p className="coaching-empty">Connect to your account to load your coaching plan. Use Refresh to try again.</p>}
    {state && <>
      <section className="coaching-card coaching-today" aria-label="Today's coaching plan">
        <div className="coaching-today-intro"><span className="coaching-eyebrow">{dateLabel(today)}</span><h3>{state.profile?.primaryGoal || 'Start with a goal that matters to you.'}</h3>
          {hasProfile ? <p className="coaching-subtle">Priority: {(state.profile?.priorities ?? []).map(value => priorityLabels[value] ?? value).join(' · ') || 'Choose your priorities'}</p> : <p className="coaching-subtle">Confirm your focus first. Then add the sessions that fit your week.</p>}
        </div>
        {visibleToday.length ? <div className="coaching-session-list">{visibleToday.map(renderSession)}</div> : <p className="coaching-empty">No session is planned for today. Add one when it fits, or leave the day open.</p>}
        <div className="coaching-actions"><button className="button primary" disabled={!canWrite} onClick={() => hasProfile ? openSession() : openSetup()}>{hasProfile ? 'Add a session' : 'Confirm my priorities'}</button>{hasProfile && form !== 'setup' && <button className="button secondary" disabled={!canWrite} onClick={openSetup}>Review priorities</button>}</div>
        {!!upcoming.length && <div><h4>Coming up</h4><div className="coaching-session-list">{upcoming.slice(0, compact ? 1 : 3).map(renderSession)}</div></div>}
        {!!brief?.missingData.length && <p className="coaching-subtle">{brief.missingData.join(' ')}</p>}
      </section>

      {form === 'setup' && <section className="coaching-card" aria-label="Confirm coaching priorities">
        <h3>What should your plan support?</h3>
        <form className="coaching-form" onSubmit={event => { event.preventDefault(); void run(() => onPropose({ type: 'setup', profile: { primaryGoal: goal.trim(), priorities: [primary, ...supporting.split(',').map(value => value.trim()).filter(value => value && value !== primary)], constraints: constraints.split('\n').map(value => value.trim()).filter(Boolean), notes: profileNotes.trim() }, reason: `Set ${priorityLabels[primary] ?? primary} as the primary focus and confirm the goal and constraints you entered.` }), proposed); }}>
          <label>Primary priority<select value={primary} onChange={event => setPrimary(event.target.value)}>{priorities.map(value => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select></label>
          <label>Primary goal<input value={goal} required maxLength={300} onChange={event => setGoal(event.target.value)} placeholder="What would you like to work toward?" /></label>
          <label>Other priorities, optional<input value={supporting} maxLength={500} onChange={event => setSupporting(event.target.value)} placeholder="For example: strength, nutrition" /></label>
          <label>Constraints, one per line<textarea value={constraints} maxLength={1500} onChange={event => setConstraints(event.target.value)} placeholder="What should the plan account for?" /></label>
          <label>Anything else, optional<textarea value={profileNotes} maxLength={1500} onChange={event => setProfileNotes(event.target.value)} /></label>
          <p className="coaching-subtle">This creates a draft. You will review the change before applying it.</p>
          <div className="coaching-actions"><button className="button primary" disabled={!canWrite || !goal.trim()}>Review priorities</button><button type="button" className="button secondary" disabled={busy} onClick={() => setForm(null)}>Keep current plan</button></div>
        </form>
      </section>}

      {form === 'session' && <section className="coaching-card" aria-label={editingId ? 'Change a planned session' : 'Add a planned session'}>
        <h3>{editingId ? 'Adjust this session' : 'Add something that fits your week'}</h3>
        <form className="coaching-form" onSubmit={event => { event.preventDefault();
          const value = Number(minutes);
          const session: PlannedSession = { id: sessionId, day: sessionDay, sport, title: title.trim(), minutes: value, details: details.trim() };
          const startDay = weekStart(sessionDay);
          const command: CoachingCommand = editingId ? { type: 'update_session', sessionId: editingId, changes: { day: session.day, sport: session.sport, title: session.title, minutes: session.minutes, details: session.details }, reason: `Adjust ${session.title} to the date and duration you chose.` } : { type: 'replace_week', startDay, sessions: [...sessions.filter(item => item.day >= startDay && item.day < addDays(startDay, 7) && item.id !== sessionId), session], reason: `Add ${session.title} on ${dateLabel(sessionDay)}, preserving the other sessions in that week.` };
          void run(() => onPropose(command), () => { proposed(); setSessionId(newId()); });
        }}>
          <label>Session title<input value={title} required maxLength={160} onChange={event => setTitle(event.target.value)} placeholder="For example: easy run or upper body" /></label>
          <div className="coaching-form-grid"><label>Session date<input type="date" value={sessionDay} required onChange={event => setSessionDay(event.target.value)} /></label><label>Minutes<input type="number" min="1" max="480" step="1" value={minutes} required onChange={event => setMinutes(event.target.value)} /></label></div>
          <label>Session type<select value={sport} onChange={event => setSport(event.target.value as PlannedSession['sport'])}>{sports.map(value => <option key={value} value={value}>{sportLabels[value]}</option>)}</select></label>
          <label>Details, optional<textarea value={details} maxLength={1500} onChange={event => setDetails(event.target.value)} placeholder="What do you want this session to include?" /></label>
          <p className="coaching-subtle">A planned session becomes completed only when you record what happened.</p>
          <div className="coaching-actions"><button className="button primary" disabled={!canWrite || !title.trim()}>Review session</button><button type="button" className="button secondary" disabled={busy} onClick={() => setForm(null)}>Keep current plan</button></div>
        </form>
      </section>}

      {form === 'outcome' && feedbackTarget && <section className="coaching-card" aria-label="Record session feedback">
        <h3>What happened with {feedbackTarget.title}?</h3>
        <form className="coaching-form" onSubmit={event => { event.preventDefault(); void run(() => onPropose({ type: 'record_outcome', outcome: { id: outcomeId, sessionId: feedbackTarget.id, day: outcomeDay, status: outcomeStatus, ...(actualMinutes ? { actualMinutes: Number(actualMinutes) } : {}), ...(effort ? { effort: Number(effort) } : {}), note: outcomeNote.trim() }, reason: `Record the outcome and feedback you supplied for ${feedbackTarget.title}.` }), () => { proposed(); setOutcomeId(newId()); }); }}>
          <label>Session outcome<select value={outcomeStatus} onChange={event => setOutcomeStatus(event.target.value as 'completed' | 'skipped')}><option value="completed">I completed it</option><option value="skipped">I skipped it</option></select></label>
          <label>Date this happened<input type="date" value={outcomeDay} max={today} required onChange={event => setOutcomeDay(event.target.value)} /></label>
          <div className="coaching-form-grid"><label>Actual minutes, optional<input type="number" min="0" max="1440" step="1" value={actualMinutes} onChange={event => setActualMinutes(event.target.value)} /></label><label>Effort, optional · 1 to 10<input type="number" min="1" max="10" step="1" value={effort} onChange={event => setEffort(event.target.value)} /></label></div>
          <label>Your note, optional<textarea value={outcomeNote} maxLength={1500} onChange={event => setOutcomeNote(event.target.value)} placeholder="How did it feel? What should your next plan consider?" /></label>
          <div className="coaching-actions"><button className="button primary" disabled={!canWrite}>Review feedback</button><button type="button" className="button secondary" disabled={busy} onClick={() => setForm(null)}>Leave outcome unknown</button></div>
        </form>
      </section>}

      {(proposals.length > 0 || !compact) && <section className="coaching-pending-list" aria-label="Changes awaiting your review">
        <h3 ref={proposalHeading} tabIndex={-1}>Review changes{proposals.length ? ` · ${proposals.length}` : ''}</h3>
        {!proposals.length && !compact && <p className="coaching-subtle">Changes you draft will appear here before anything is applied.</p>}
        {proposals.map(proposal => <article className="coaching-review" key={proposal.id}>
          <div className="coaching-review-head"><span className="coaching-eyebrow">DRAFT · NOT APPLIED</span><strong className="coaching-review-title">{proposal.command.reason}</strong></div>
          <p className="coaching-subtle">This review shows the details affected by the draft.</p>
          {proposal.baseRevision !== state.revision && <p className="coaching-subtle">Your plan changed after this draft was created. Dismiss this draft and review the update again from your current plan.</p>}
          <div className="coaching-comparison"><div><span className="coaching-comparison-label">Current</span><Snapshot content={proposal.before} comparedTo={proposal.after} /></div><div><span className="coaching-comparison-label">After this change</span><Snapshot content={proposal.after} comparedTo={proposal.before} /></div></div>
          <div className="coaching-actions"><button className="button primary" disabled={!canWrite || proposal.baseRevision !== state.revision} onClick={() => void run(() => onResolve(proposal.id, 'accepted'))}>Apply reviewed change</button><button className="button secondary" disabled={!canWrite} onClick={() => void run(() => onResolve(proposal.id, 'dismissed'))}>Dismiss draft</button></div>
        </article>)}
      </section>}

      {!compact && <details className="coaching-disclosure"><summary>Your calendar · {thisWeek.length} {thisWeek.length === 1 ? 'session' : 'sessions'} in this week</summary><div className="coaching-form"><label>Week containing<input type="date" value={weekDay} required onChange={event => { if (event.target.value) setWeekDay(event.target.value); }} /></label><p className="coaching-subtle">{dateLabel(week)} to {dateLabel(addDays(week, 6))}. Past sessions without feedback have an unknown outcome.</p><div className="coaching-session-list">{thisWeek.length ? thisWeek.map(renderSession) : <p className="coaching-empty">This week is open. Add a session with a date and duration when you are ready.</p>}</div><button className="button secondary" disabled={!canWrite} onClick={() => { openSession(); setSessionDay(weekDay); }}>Add a session this week</button></div></details>}
      {!compact && weekly && <details className="coaching-disclosure"><summary>Weekly check-in</summary><div className="coaching-form">
        <p className="coaching-subtle">{dateLabel(weekly.startDay)} to {dateLabel(weekly.endDay)}</p>
        <table className="coaching-week-table"><tbody>
          <tr><th scope="row">Sessions planned</th><td>{weekly.planned.length} · {weekly.plannedMinutes} min planned</td></tr>
          <tr><th scope="row">Completed · you recorded</th><td>{weekly.completed.length}</td></tr>
          <tr><th scope="row">Skipped · you recorded</th><td>{weekly.skipped.length}</td></tr>
          <tr><th scope="row">Outcome unknown</th><td>{weekly.unreported.length}</td></tr>
          <tr><th scope="row">Known completed minutes</th><td>{weekly.completedActualMinutes}</td></tr>
        </tbody></table>
        {weekly.completedWithoutMinutes > 0 && <p className="coaching-subtle">{weekly.completedWithoutMinutes} completed {weekly.completedWithoutMinutes === 1 ? 'session has' : 'sessions have'} no recorded duration.</p>}
        <p className="coaching-subtle">Planned sessions use their scheduled dates. Completed and skipped feedback uses the date you recorded for the activity. An unreported outcome stays unknown.</p>
        {!!weekly.observations.length && <ul className="coaching-observations">{weekly.observations.map((observation, index) => <li key={index}>{observation}</li>)}</ul>}
      </div></details>}
      {!compact && <details className="coaching-disclosure"><summary>Preferences and memory · {memories.length}</summary><div className="coaching-form">
        <p className="coaching-subtle">These are details you explicitly chose to keep for planning.</p>
        {memories.length ? <ul className="coaching-memory-list">{memories.map(item => <li key={item.id}><div><strong>{item.text}</strong><span className="coaching-subtle">{item.category}</span></div><button className="button secondary" disabled={!canWrite} onClick={() => void run(() => onPropose({ type: 'forget_memory', memoryId: item.id, reason: `Remove the saved planning ${item.category} you chose.` }))}>Review removal</button></li>)}</ul> : <p className="coaching-empty">No planning memories have been saved.</p>}
        <button className="button secondary" disabled={!canWrite} onClick={() => { setMemory(''); setMemoryId(newId()); setForm('memory'); }}>Add a planning detail</button>
      </div></details>}

      {!compact && <details className="coaching-disclosure"><summary>From your other apps · {importedTotal}</summary><div className="coaching-form">
        <p className="coaching-subtle">Records an assistant brought in for you from apps like Strava or MacroFactor. They inform coaching but never mark a session done or add to your food diary.</p>
        {importedTotal === 0 && <p className="coaching-empty">Nothing has been brought in yet. Ask your connected assistant to bring in your recent runs, lifts or nutrition days.</p>}
        {importedActivities.length > 0 && <ul className="coaching-memory-list" aria-label="Activities from other apps">{importedActivities.map(item => <li key={`${item.source}:${item.externalId}`}><div><strong>{item.title}</strong><span className="coaching-subtle">{[coachingSourceLabel(item.source), dateLabel(item.day), item.sport, `${Math.round(item.minutes)} min`, item.distanceKm !== undefined ? `${item.distanceKm} km` : '', item.avgHeartRate !== undefined ? `${item.avgHeartRate} bpm avg` : ''].filter(Boolean).join(' · ')}</span></div>{onRemoveRecord && <button className="button secondary" disabled={!canWrite} aria-label={`Remove ${item.title} from ${coachingSourceLabel(item.source)}`} onClick={() => void run(() => onRemoveRecord({ kind: 'activity', source: item.source, externalId: item.externalId }))}>Remove</button>}</li>)}</ul>}
        {importedNutrition.length > 0 && <ul className="coaching-memory-list" aria-label="Nutrition days from other apps">{importedNutrition.map(item => <li key={`${item.source}:${item.day}`}><div><strong>{dateLabel(item.day)}</strong><span className="coaching-subtle">{[coachingSourceLabel(item.source), item.calories !== undefined ? `${Math.round(item.calories)} kcal` : '', item.protein !== undefined ? `${Math.round(item.protein)} g protein` : '', item.carbs !== undefined ? `${Math.round(item.carbs)} g carbs` : '', item.fat !== undefined ? `${Math.round(item.fat)} g fat` : '', item.complete === false ? 'partly logged' : ''].filter(Boolean).join(' · ')}</span></div>{onRemoveRecord && <button className="button secondary" disabled={!canWrite} aria-label={`Remove ${coachingSourceLabel(item.source)} nutrition for ${dateLabel(item.day)}`} onClick={() => void run(() => onRemoveRecord({ kind: 'nutrition', source: item.source, day: item.day }))}>Remove</button>}</li>)}</ul>}
      </div></details>}

      {form === 'memory' && <section className="coaching-card" aria-label="Add a planning memory"><h3>What should your plan remember?</h3><form className="coaching-form" onSubmit={event => { event.preventDefault(); void run(() => onPropose({ type: 'remember', memory: { id: memoryId, text: memory.trim(), category: memoryCategory }, reason: `Keep the planning detail you entered as ${memoryCategory}.` }), () => { proposed(); setMemoryId(newId()); setMemory(''); }); }}>
        <label>Planning detail<textarea value={memory} required maxLength={1200} onChange={event => setMemory(event.target.value)} placeholder="For example: I prefer longer runs on Saturdays." /></label>
        <label>Type of detail<select value={memoryCategory} onChange={event => setMemoryCategory(event.target.value as typeof memoryCategory)}><option value="preference">Preference</option><option value="constraint">Constraint</option><option value="context">Context</option><option value="other">Other</option></select></label>
        <div className="coaching-actions"><button className="button primary" disabled={!canWrite || !memory.trim()}>Review memory</button><button className="button secondary" type="button" disabled={busy} onClick={() => setForm(null)}>Cancel</button></div>
      </form></section>}

      {latestDecision && <section className="coaching-card" aria-label="Latest coaching decision"><h3>Latest decision</h3><p>{latestDecision.reason}</p>{canUndoLatest ? <button className="button secondary" disabled={!canWrite} onClick={() => void run(() => onUndo(latestDecision.id))}>Undo latest change</button> : <p className="coaching-subtle">{latestDecision.kind === 'undo' ? 'The latest plan change was undone. Your decision history stays available below.' : 'Refresh to check whether this change can still be undone.'}</p>}</section>}
      {!compact && <details className="coaching-disclosure"><summary>Decision history · {journal.length}</summary><div className="coaching-history">{journal.length ? [...journal].reverse().map(entry => <article className="coaching-history-item" key={entry.id}><strong>{entry.reason}</strong><span className="coaching-subtle">{entry.kind === 'undo' ? 'Undo confirmed' : 'Change confirmed'}</span></article>) : <p className="coaching-empty">Confirmed changes and their reasons will appear here.</p>}</div></details>}
    </>}
  </div>;
}
