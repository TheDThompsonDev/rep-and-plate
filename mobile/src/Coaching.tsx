import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { ZodError } from 'zod';
import type { CoachingController } from '../../src/features/coaching/useCoaching';
import { coachingCommandSchema, type CoachingCommand, type CoachingContent, type CoachingMemory, type CoachingOutcome, type CoachingProfile, type CoachingProposal, type CoachingSession, type CoachingState } from '../../src/features/coaching/contracts';
import { coachingSourceLabel } from '../../src/features/coaching/model';
import { Button, Card, Choice, Field, Sheet, colors, s } from './ui';
import { shareCoachingRecord } from './coaching-export';

const sportLabels = { run: 'Running', strength: 'Strength', recovery: 'Recovery', other: 'Other' };
const sports = ['run', 'strength', 'recovery', 'other'];
const memoryLabels = { preference: 'Preference', constraint: 'Constraint', context: 'Context', other: 'Other' };
const sections = ['Today', 'Week', 'Setup', 'Schedule', 'Feedback', 'Memories', 'Decisions'];
const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (day: string, amount: number) => { const d = new Date(`${day}T12:00:00Z`); if (!Number.isFinite(d.getTime())) return day; d.setUTCDate(d.getUTCDate() + amount); return d.toISOString().slice(0, 10); };
const lines = (text: string) => text.split('\n').map(value => value.trim()).filter(Boolean);
const errorText = (error: unknown) => error instanceof ZodError ? error.issues[0]?.message ?? 'Check your details.' : error instanceof Error ? error.message : 'Your change could not be saved. Try again.';
type Propose = (command: CoachingCommand) => Promise<void>;

export default function NativeCoaching({ model, onClose }: { model: CoachingController; onClose: () => void }) {
  const [section, setSection] = useState('Today');
  const [error, setError] = useState('');
  const [editingSession, setEditingSession] = useState<CoachingSession | null>(null);
  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const sharing = useRef(false);
  const state = model.state;
  const day = model.brief?.day ?? localDay();
  const blocked = model.busy || model.loading || exporting;
  const run = async (action: () => Promise<void>) => {
    setError('');
    try { await action(); } catch (cause) { setError(errorText(cause)); }
  };
  const propose: Propose = async command => {
    setError('');
    try {
      const parsed = coachingCommandSchema.parse(command);
      if (parsed.type === 'record_outcome' && parsed.outcome.day > day) throw Error('Choose today or an earlier date for what happened.');
      if (state?.proposals.some(item => item.status === 'pending' && JSON.stringify(item.command) === JSON.stringify(parsed))) throw Error('This change is already waiting for your review above.');
      await model.propose(parsed);
    }
    catch (cause) { setError(errorText(cause)); throw cause; }
  };
  const pending = state?.proposals.filter(item => item.status === 'pending') ?? [];
  return <Sheet title="Your coaching plan" onClose={onClose}>
    <Text style={s.text}>Your goals, approved schedule, and feedback in one place. Changes are proposed first so you can review them.</Text>
    {model.loading ? <Text accessibilityRole="text" style={s.muted}>Loading the latest saved plan…</Text> : null}
    {(error || model.error) ? <Text accessibilityRole="alert" style={{ color: colors.red }}>{error || model.error}</Text> : null}
    {model.notice ? <Text style={s.text}>{model.notice}</Text> : null}
    <Button label={model.loading ? 'Refreshing plan…' : 'Refresh saved plan'} secondary disabled={blocked} onPress={() => { void run(() => model.refresh()); }} />
    {!state ? <Card><Text style={s.h3}>{model.loading ? 'Getting your plan' : 'Plan unavailable'}</Text><Text style={s.text}>{model.loading ? 'Your saved account plan will appear here.' : 'A connected account is needed to load and save your coaching plan. Check your connection and refresh. Your regular tracking remains available.'}</Text></Card> : <>
      {model.error ? <Text style={s.muted}>The last loaded plan is shown. Refresh to check for newer decisions. Saving changes requires an account connection.</Text> : null}
      <Text style={s.tiny}>Saved plan revision {state.revision}. External assistant proposals appear when you refresh.</Text>
      <Card><Text style={s.h3}>Keep a copy of your coaching record</Text><Text style={s.muted}>Includes the goals, sessions, feedback, memories, proposals, and decision history currently retained in your coaching record. This JSON archive is separate from your food and workout backup.</Text><Button label={exporting ? 'Preparing coaching record…' : 'Share coaching record'} secondary disabled={blocked || !model.state} onPress={() => {
        if (sharing.current || blocked || !model.state) return;
        const current = model.state;
        sharing.current = true; setExporting(true); setError('');
        void shareCoachingRecord(current).catch(cause => setError(errorText(cause))).finally(() => { sharing.current = false; setExporting(false); });
      }} /></Card>
      {model.freshness ? <Text style={s.muted}>{model.freshness.dataUpdatedAt === null ? 'No saved food or workout context is available yet. Your coaching plan contains the details you approve here.' : model.freshness.stale ? 'Food and workout context may be older than your latest records. Check account saving before relying on those details.' : `Food and workout context last updated ${new Date(model.freshness.dataUpdatedAt).toLocaleString()}.`}</Text> : null}
      {pending.length ? <View style={{ gap: 14 }}><Text accessibilityRole="header" style={s.h2}>Needs your review ({pending.length})</Text>{pending.map(proposal => <ProposalReview key={proposal.id} proposal={proposal} revision={state.revision} busy={blocked} onResolve={status => { void run(() => model.resolve(proposal.id, status)); }} />)}</View> : null}
      <Choice values={sections} value={section} onChange={value => { setSection(value); setEditingSession(null); setFeedbackSessionId(null); }} />
      {section === 'Today' ? <>
        <Card mint><Text accessibilityRole="header" style={s.h2}>{day}</Text><Text style={s.text}>{state.profile.primaryGoal || 'Choose a goal to give your plan direction.'}</Text>{!state.profile.primaryGoal ? <Button label="Set up my coaching" secondary onPress={() => setSection('Setup')} /> : null}</Card>
        <Text accessibilityRole="header" style={s.h2}>Today’s approved sessions</Text>
        {(model.brief?.today ?? state.sessions.filter(item => item.day === day)).length ? (model.brief?.today ?? state.sessions.filter(item => item.day === day)).map(session => <SessionCard key={session.id} session={session} outcomes={state.outcomes.filter(item => item.sessionId === session.id)} onEdit={() => { setEditingSession(session); setSection('Schedule'); }} onFeedback={() => { setFeedbackSessionId(session.id); setSection('Feedback'); }} />) : <Card><Text style={s.text}>No session is scheduled for today.</Text><Text style={s.muted}>An empty day is simply an unscheduled day. Your next session may be later in the week.</Text><Button label="Review my schedule" secondary onPress={() => setSection('Schedule')} /></Card>}
        {model.brief?.missingData.length ? <Card><Text style={s.h3}>What would help your plan</Text>{model.brief.missingData.map(item => <Text key={item} style={s.muted}>{item}</Text>)}</Card> : null}
        <Text accessibilityRole="header" style={s.h2}>Coming up</Text>
        {(model.brief?.upcoming ?? state.sessions.filter(item => item.day > day)).slice(0, 4).map(session => <SessionCard key={session.id} session={session} outcomes={state.outcomes.filter(item => item.sessionId === session.id)} onEdit={() => { setEditingSession(session); setSection('Schedule'); }} onFeedback={() => { setFeedbackSessionId(session.id); setSection('Feedback'); }} />)}
        {!state.sessions.some(item => item.day > day) ? <Text style={s.muted}>No upcoming sessions saved yet.</Text> : null}
      </> : null}
      {section === 'Week' ? <WeekView state={state} day={day} model={model} /> : null}
      {section === 'Setup' ? <SetupForm profile={state.profile} busy={blocked} onPropose={propose} /> : null}
      {section === 'Schedule' ? editingSession ? <EditSessionForm key={editingSession.id} session={editingSession} busy={blocked} onPropose={propose} onCancel={() => setEditingSession(null)} /> : <ScheduleForm state={state} day={day} busy={blocked} onPropose={propose} /> : null}
      {section === 'Feedback' ? <FeedbackForm key={feedbackSessionId ?? 'choose-session'} state={state} day={day} initialSessionId={feedbackSessionId} busy={blocked} onPropose={propose} /> : null}
      {section === 'Memories' ? <Memories state={state} busy={blocked} onPropose={propose} /> : null}
      {section === 'Decisions' ? <DecisionHistory state={state} busy={blocked} onUndo={entryId => { void run(() => model.undo(entryId)); }} /> : null}
    </>}
  </Sheet>;
}

function SessionLine({ session }: { session: CoachingSession }) {
  return <View style={{ gap: 4 }}><Text style={s.h3}>{session.title}</Text><Text style={s.muted}>{session.day} · {sportLabels[session.sport]} · {session.minutes} planned minutes</Text>{session.details ? <Text style={s.text}>{session.details}</Text> : null}</View>;
}
function OutcomeLine({ outcome }: { outcome: CoachingOutcome }) {
  return <View style={{ gap: 4 }}><Text style={s.text}>{outcome.day} · {outcome.status === 'completed' ? 'Completed' : 'Skipped'}{outcome.actualMinutes === undefined ? '' : ` · ${outcome.actualMinutes} actual minutes`}{outcome.effort === undefined ? '' : ` · effort ${outcome.effort}/10`}</Text>{outcome.note ? <Text style={s.muted}>{outcome.note}</Text> : null}</View>;
}
function SessionCard({ session, outcomes, onEdit, onFeedback }: { session: CoachingSession; outcomes: CoachingOutcome[]; onEdit: () => void; onFeedback: () => void }) {
  return <Card><SessionLine session={session} />{outcomes.length ? outcomes.map(outcome => <OutcomeLine key={outcome.id} outcome={outcome} />) : <Text style={s.muted}>No outcome has been recorded.</Text>}<Button label={`Adjust ${session.title}`} secondary onPress={onEdit} /><Button label="Record session feedback" secondary onPress={onFeedback} /></Card>;
}
function ProfileSummary({ profile }: { profile: CoachingProfile }) {
  return <View style={{ gap: 5 }}><Text style={s.text}>{profile.primaryGoal || 'No goal saved.'}</Text>{profile.priorities.map(value => <Text key={value} style={s.muted}>Priority: {value}</Text>)}{profile.constraints.map(value => <Text key={value} style={s.muted}>Constraint: {value}</Text>)}{profile.notes ? <Text style={s.text}>{profile.notes}</Text> : null}</View>;
}
function ChangeSnapshot({ content, command }: { content: CoachingContent; command: CoachingCommand }) {
  if (command.type === 'setup') return <ProfileSummary profile={content.profile} />;
  if (command.type === 'replace_week' || command.type === 'update_session') {
    const sessions = command.type === 'replace_week' ? content.sessions.filter(item => item.day >= command.startDay && item.day <= addDays(command.startDay, 6)) : content.sessions.filter(item => item.id === command.sessionId);
    return <View style={{ gap: 12 }}>{sessions.length ? [...sessions].sort((a, b) => a.day.localeCompare(b.day)).map(item => <SessionLine key={item.id} session={item} />) : <Text style={s.muted}>No session in this part of the plan.</Text>}</View>;
  }
  if (command.type === 'record_outcome') {
    const outcome = content.outcomes.find(item => item.id === command.outcome.id);
    return outcome ? <OutcomeLine outcome={outcome} /> : <Text style={s.muted}>No feedback saved for this entry.</Text>;
  }
  const memoryId = command.type === 'remember' ? command.memory.id : command.memoryId;
  const memory = content.memories.find(item => item.id === memoryId);
  return memory ? <View><Text style={s.text}>{memory.text}</Text><Text style={s.muted}>{memoryLabels[memory.category]}</Text></View> : <Text style={s.muted}>No saved memory for this entry.</Text>;
}
function ProposalReview({ proposal, revision, busy, onResolve }: { proposal: CoachingProposal; revision: number; busy: boolean; onResolve: (status: 'accepted' | 'dismissed') => void }) {
  const [reviewing, setReviewing] = useState(false);
  const titles: Record<CoachingCommand['type'], string> = { setup: 'Goal and priorities', replace_week: 'Weekly schedule', update_session: 'Session adjustment', record_outcome: 'Session feedback', remember: 'Remember this', forget_memory: 'Remove a memory' };
  const stale = proposal.baseRevision !== revision;
  return <Card><Text style={s.h3}>{titles[proposal.command.type]}</Text><Text style={s.text}>{proposal.command.reason}</Text><Text style={s.muted}>Proposed by {proposal.actor}</Text>{stale ? <Text style={{ color: colors.red }}>Your saved plan changed after this proposal. Dismiss it and create a fresh proposal.</Text> : null}<Button label={reviewing ? 'Hide proposed changes' : 'Review proposed changes'} secondary onPress={() => setReviewing(value => !value)} />{reviewing ? <><Text style={s.eyebrow}>CURRENTLY SAVED</Text><ChangeSnapshot content={proposal.before} command={proposal.command} /><View style={s.divider} /><Text style={s.eyebrow}>IF APPLIED</Text><ChangeSnapshot content={proposal.after} command={proposal.command} /><Button label="Apply reviewed change" disabled={busy || stale} onPress={() => onResolve('accepted')} /></> : null}<Button label="Dismiss proposal" secondary disabled={busy} onPress={() => onResolve('dismissed')} /></Card>;
}

function SetupForm({ profile, busy, onPropose }: { profile: CoachingProfile; busy: boolean; onPropose: Propose }) {
  const [goal, setGoal] = useState(profile.primaryGoal);
  const [priorities, setPriorities] = useState(profile.priorities.join('\n'));
  const [constraints, setConstraints] = useState(profile.constraints.join('\n'));
  const [notes, setNotes] = useState(profile.notes);
  const [reason, setReason] = useState('I chose these goals and priorities for my coaching.');
  return <Card><Text accessibilityRole="header" style={s.h2}>What matters to you?</Text><Field label="Primary goal" value={goal} onChangeText={setGoal} maxLength={300} multiline /><Field label="Priorities (one per line)" value={priorities} onChangeText={setPriorities} multiline /><Field label="Constraints (one per line)" value={constraints} onChangeText={setConstraints} multiline /><Field label="Other context (optional)" value={notes} onChangeText={setNotes} maxLength={2000} multiline /><Field label="Why this change?" value={reason} onChangeText={setReason} maxLength={1000} multiline /><Button label="Propose coaching setup" disabled={busy || !goal.trim() || !reason.trim()} onPress={() => { void onPropose({ type: 'setup', profile: { primaryGoal: goal.trim(), priorities: lines(priorities), constraints: lines(constraints), notes: notes.trim() }, reason: reason.trim() }).catch(() => undefined); }} /></Card>;
}
function newSession(day: string): CoachingSession { return { id: Crypto.randomUUID(), day, sport: 'run', title: '', minutes: 30, details: '' }; }
function SessionFields({ session, onChange }: { session: CoachingSession; onChange: (changes: Partial<CoachingSession>) => void }) {
  return <><Field label="Session date (YYYY-MM-DD)" value={session.day} onChangeText={day => onChange({ day })} /><Text style={s.muted}>Session type</Text><Choice values={sports} labels={sportLabels} value={session.sport} onChange={sport => onChange({ sport: sport as CoachingSession['sport'] })} /><Field label="Session title" value={session.title} onChangeText={title => onChange({ title })} maxLength={160} /><Field label="Planned minutes" value={Number.isNaN(session.minutes) ? '' : String(session.minutes)} onChangeText={value => onChange({ minutes: value.trim() ? Number(value) : Number.NaN })} keyboardType="number-pad" /><Field label="Session details (optional)" value={session.details} onChangeText={details => onChange({ details })} maxLength={2000} multiline /></>;
}
function ScheduleForm({ state, day, busy, onPropose }: { state: CoachingState; day: string; busy: boolean; onPropose: Propose }) {
  const [startDay, setStartDay] = useState(day);
  const loadSessions = (start: string) => state.sessions.filter(item => item.day >= start && item.day <= addDays(start, 6)).map(item => ({ ...item }));
  const [sessions, setSessions] = useState<CoachingSession[]>(() => { const saved = loadSessions(day); return saved.length ? saved : [newSession(day)]; });
  const [reason, setReason] = useState('I chose this schedule for the next seven days.');
  return <View style={{ gap: 16 }}><Card><Text accessibilityRole="header" style={s.h2}>Plan seven days</Text><Text style={s.text}>Review the full window before applying. Sessions outside these dates remain in your plan.</Text><Field label="Window starts (YYYY-MM-DD)" value={startDay} onChangeText={setStartDay} /><Text style={s.muted}>Through {addDays(startDay, 6)}</Text><Button label="Load approved sessions for these dates" secondary disabled={busy} onPress={() => setSessions(loadSessions(startDay))} /></Card>{sessions.map((session, index) => <Card key={session.id}><Text style={s.h3}>Session {index + 1}</Text><SessionFields session={session} onChange={changes => setSessions(current => current.map(item => item.id === session.id ? { ...item, ...changes } : item))} /><Button label={`Remove session ${index + 1} from draft`} secondary disabled={busy} onPress={() => setSessions(current => current.filter(item => item.id !== session.id))} /></Card>)}<Card><Button label="Add another session" secondary disabled={busy || sessions.length >= 21} onPress={() => setSessions(current => [...current, newSession(startDay)])} />{!sessions.length ? <Text style={s.muted}>This proposal clears the schedule in these seven dates. Review existing sessions before applying.</Text> : null}<Field label="Why this schedule?" value={reason} onChangeText={setReason} maxLength={1000} multiline /><Button label="Propose this seven-day schedule" disabled={busy || !reason.trim()} onPress={() => { void onPropose({ type: 'replace_week', startDay, sessions, reason: reason.trim() }).catch(() => undefined); }} /></Card></View>;
}
function EditSessionForm({ session, busy, onPropose, onCancel }: { session: CoachingSession; busy: boolean; onPropose: Propose; onCancel: () => void }) {
  const [draft, setDraft] = useState({ ...session });
  const [reason, setReason] = useState('I need to adjust this session.');
  return <Card><Text style={s.h2}>Adjust {session.title}</Text><SessionFields session={draft} onChange={changes => setDraft(current => ({ ...current, ...changes }))} /><Field label="Why this adjustment?" value={reason} onChangeText={setReason} maxLength={1000} multiline /><Button label="Propose session adjustment" disabled={busy || !reason.trim()} onPress={() => { const { id: _id, ...changes } = draft; void _id; void onPropose({ type: 'update_session', sessionId: session.id, changes, reason: reason.trim() }).then(onCancel).catch(() => undefined); }} /><Button label="Back to weekly schedule" secondary disabled={busy} onPress={onCancel} /></Card>;
}

function FeedbackForm({ state, day, initialSessionId, busy, onPropose }: { state: CoachingState; day: string; initialSessionId?: string | null; busy: boolean; onPropose: Propose }) {
  const sessions = [...state.sessions].sort((a, b) => b.day.localeCompare(a.day));
  const initialId = initialSessionId && sessions.some(item => item.id === initialSessionId) ? initialSessionId : sessions.find(item => item.day === day)?.id ?? sessions[0]?.id ?? '';
  const initialSession = sessions.find(item => item.id === initialId);
  const initialDay = initialSession && initialSession.day <= day ? initialSession.day : day;
  const initialOutcome = state.outcomes.find(item => item.sessionId === initialId && item.day === initialDay);
  const [sessionId, setSessionId] = useState(initialId);
  const [feedbackDay, setFeedbackDay] = useState(initialDay);
  const [status, setStatus] = useState<'completed' | 'skipped'>(initialOutcome?.status ?? 'completed');
  const [minutes, setMinutes] = useState(initialOutcome?.actualMinutes === undefined ? '' : String(initialOutcome.actualMinutes));
  const [effort, setEffort] = useState(initialOutcome?.effort === undefined ? '' : String(initialOutcome.effort));
  const [note, setNote] = useState(initialOutcome?.note ?? '');
  const [reason, setReason] = useState('I recorded how this session went.');
  const draftIds = useRef(new Map<string, string>());
  const labels = Object.fromEntries(sessions.map(item => [item.id, `${item.day} · ${item.title}`]));
  const existing = state.outcomes.find(item => item.sessionId === sessionId && item.day === feedbackDay);
  const loadOutcome = (outcome?: CoachingOutcome) => { setStatus(outcome?.status ?? 'completed'); setMinutes(outcome?.actualMinutes === undefined ? '' : String(outcome.actualMinutes)); setEffort(outcome?.effort === undefined ? '' : String(outcome.effort)); setNote(outcome?.note ?? ''); };
  return <Card><Text accessibilityRole="header" style={s.h2}>How did it go?</Text>{!sessions.length ? <Text style={s.text}>Approve a scheduled session before recording feedback.</Text> : <><Text style={s.muted}>Choose a saved session</Text><Choice values={sessions.map(item => item.id)} labels={labels} value={sessionId} onChange={value => { setSessionId(value); const selected = sessions.find(item => item.id === value); const selectedDay = selected && selected.day <= day ? selected.day : day; setFeedbackDay(selectedDay); loadOutcome(state.outcomes.find(item => item.sessionId === value && item.day === selectedDay)); }} /><Field label="Actual date (YYYY-MM-DD; today or earlier)" value={feedbackDay} onChangeText={setFeedbackDay} />{existing ? <Button label="Load existing feedback for this session and date" secondary disabled={busy} onPress={() => loadOutcome(existing)} /> : null}<Choice values={['completed', 'skipped']} labels={{ completed: 'Completed', skipped: 'Skipped' }} value={status} onChange={value => setStatus(value as 'completed' | 'skipped')} /><Field label="Actual minutes (optional)" value={minutes} onChangeText={setMinutes} keyboardType="number-pad" /><Field label="Effort from 1–10 (optional)" value={effort} onChangeText={setEffort} keyboardType="number-pad" /><Field label="How did it feel? (optional)" value={note} onChangeText={setNote} maxLength={2000} multiline /><Field label="Why this feedback?" value={reason} onChangeText={setReason} maxLength={1000} multiline />{existing ? <Text style={s.muted}>Feedback already exists for this session and date. Review the proposed update carefully.</Text> : null}<Button label="Propose session feedback" disabled={busy || !sessionId || !reason.trim()} onPress={() => {
    const key = `${sessionId}:${feedbackDay}`;
    if (!draftIds.current.has(key)) draftIds.current.set(key, existing?.id ?? Crypto.randomUUID());
    const outcome: CoachingOutcome = { id: draftIds.current.get(key)!, sessionId, day: feedbackDay, status, note: note.trim(), ...(minutes.trim() ? { actualMinutes: Number(minutes) } : {}), ...(effort.trim() ? { effort: Number(effort) } : {}) };
    void onPropose({ type: 'record_outcome', outcome, reason: reason.trim() }).then(() => { setNote(''); setMinutes(''); setEffort(''); }).catch(() => undefined);
  }} /></>}</Card>;
}
function Memories({ state, busy, onPropose }: { state: CoachingState; busy: boolean; onPropose: Propose }) {
  const [memoryId, setMemoryId] = useState(() => Crypto.randomUUID());
  const [text, setText] = useState('');
  const [category, setCategory] = useState<CoachingMemory['category']>('preference');
  const [reason, setReason] = useState('I explicitly want Spot to remember this.');
  const clear = () => { setMemoryId(Crypto.randomUUID()); setText(''); setCategory('preference'); };
  return <View style={{ gap: 16 }}><Card><Text accessibilityRole="header" style={s.h2}>What should Spot remember?</Text><Text style={s.text}>Add or edit a preference, constraint, or useful context. Every change goes through your review.</Text><Field label="Memory" value={text} onChangeText={setText} maxLength={1200} multiline /><Choice values={['preference', 'constraint', 'context', 'other']} labels={memoryLabels} value={category} onChange={value => setCategory(value as CoachingMemory['category'])} /><Field label="Why remember this?" value={reason} onChangeText={setReason} maxLength={1000} multiline /><Button label="Propose saved memory" disabled={busy || !text.trim() || !reason.trim()} onPress={() => { void onPropose({ type: 'remember', memory: { id: memoryId, text: text.trim(), category }, reason: reason.trim() }).then(clear).catch(() => undefined); }} /><Button label="Start a different memory" secondary disabled={busy} onPress={clear} /></Card>{state.memories.length ? state.memories.map(memory => <Card key={memory.id}><Text style={s.text}>{memory.text}</Text><Text style={s.muted}>{memoryLabels[memory.category]} · Saved by {memory.actor}</Text><Button label="Edit this memory" secondary disabled={busy} onPress={() => { setMemoryId(memory.id); setText(memory.text); setCategory(memory.category); }} /><Button label="Propose removing this memory" secondary disabled={busy} onPress={() => { void onPropose({ type: 'forget_memory', memoryId: memory.id, reason: 'I asked Spot to remove this saved memory.' }).catch(() => undefined); }} /></Card>) : <Text style={s.muted}>No explicit memories saved yet.</Text>}</View>;
}
function WeekView({ state, day, model }: { state: CoachingState; day: string; model: CoachingController }) {
  const week = model.weekly;
  const startDay = week?.startDay ?? day;
  const endDay = week?.endDay ?? addDays(day, 6);
  const sessions = week?.planned ?? state.sessions.filter(item => item.day >= startDay && item.day <= endDay);
  const outcomes = week?.outcomes ?? state.outcomes.filter(item => item.day >= startDay && item.day <= endDay);
  // Records an assistant brought in from other apps. Shown for context; they never count as outcomes.
  const activities = state.evidence.activities.filter(item => item.day >= startDay && item.day <= endDay);
  const nutrition = state.evidence.nutritionDays.filter(item => item.day >= startDay && item.day <= endDay);
  return <View style={{ gap: 16 }}><Card mint><Text accessibilityRole="header" style={s.h2}>{startDay} through {endDay}</Text><Text style={s.text}>{sessions.length} planned sessions · {outcomes.filter(item => item.status === 'completed').length} recorded completions · {outcomes.filter(item => item.status === 'skipped').length} recorded skips</Text><Text style={s.muted}>An unreported session has an unknown outcome. Scheduled sessions do not count as completed work.</Text>{week?.observations.map(item => <Text key={item} style={s.text}>{item}</Text>)}</Card>{sessions.map(session => <Card key={session.id}><SessionLine session={session} />{outcomes.filter(item => item.sessionId === session.id).map(item => <OutcomeLine key={item.id} outcome={item} />)}{!outcomes.some(item => item.sessionId === session.id) ? <Text style={s.muted}>No outcome reported.</Text> : null}</Card>)}{!sessions.length ? <Card><Text style={s.text}>No approved sessions in this window.</Text></Card> : null}<Text accessibilityRole="header" style={s.h2}>Recorded outcomes</Text>{outcomes.length ? outcomes.map(outcome => <Card key={outcome.id}><OutcomeLine outcome={outcome} /></Card>) : <Text style={s.muted}>No outcomes recorded in this window.</Text>}<Text accessibilityRole="header" style={s.h2}>From your other apps</Text>{activities.length || nutrition.length ? <Card>{activities.map(item => <Text key={`${item.source}:${item.externalId}`} style={s.text}>{[item.day, coachingSourceLabel(item.source), item.title, `${Math.round(item.minutes)} min`, item.distanceKm !== undefined ? `${item.distanceKm} km` : ''].filter(Boolean).join(' · ')}</Text>)}{nutrition.map(item => <Text key={`${item.source}:${item.day}`} style={s.text}>{[item.day, coachingSourceLabel(item.source), item.calories !== undefined ? `${Math.round(item.calories)} kcal` : '', item.protein !== undefined ? `${Math.round(item.protein)} g protein` : ''].filter(Boolean).join(' · ')}</Text>)}<Text style={s.muted}>These inform coaching. They do not mark a session done or add to your food diary.</Text></Card> : <Text style={s.muted}>Nothing was brought in for this window. Ask your connected assistant to bring in recent runs, lifts or nutrition days.</Text>}</View>;
}
function DecisionHistory({ state, busy, onUndo }: { state: CoachingState; busy: boolean; onUndo: (id: string) => void }) {
  const entries = [...state.journal].sort((a, b) => b.revision - a.revision);
  const [reviewingUndo, setReviewingUndo] = useState(false);
  const latest = entries[0];
  const proposal = latest?.proposalId ? state.proposals.find(item => item.id === latest.proposalId) : undefined;
  return <View style={{ gap: 16 }}><Text accessibilityRole="header" style={s.h2}>Saved decisions</Text>{latest?.kind === 'apply' && latest.revision === state.revision ? <Card><Text style={s.h3}>Latest decision</Text><Text style={s.text}>{latest.reason}</Text><Button label={reviewingUndo ? 'Hide undo review' : 'Review undo of latest decision'} secondary disabled={busy} onPress={() => setReviewingUndo(value => !value)} />{reviewingUndo ? <><Text style={s.muted}>Undo restores the coaching details from before this decision. It creates a new decision in your history.</Text>{proposal ? <><Text style={s.eyebrow}>CURRENTLY SAVED</Text><ChangeSnapshot content={latest.after} command={proposal.command} /><Text style={s.eyebrow}>AFTER UNDO</Text><ChangeSnapshot content={latest.before} command={proposal.command} /></> : <Text style={s.muted}>The saved snapshot contains {latest.before.sessions.length} sessions, {latest.before.outcomes.length} outcomes, and {latest.before.memories.length} explicit memories.</Text>}<Button label="Undo this latest decision" disabled={busy} onPress={() => onUndo(latest.id)} /></> : null}</Card> : null}{entries.length ? entries.map(entry => <Card key={entry.id}><Text style={s.h3}>{entry.kind === 'undo' ? 'Undo recorded' : 'Change applied'}</Text><Text style={s.text}>{entry.reason}</Text><Text style={s.muted}>{entry.actor} · {entry.at}</Text><Text style={s.tiny}>Saved revision {entry.revision}</Text></Card>) : <Card><Text style={s.text}>No decisions have been applied yet. Reviewed changes will appear here.</Text></Card>}</View>;
}
