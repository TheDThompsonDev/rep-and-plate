import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { ZodError } from 'zod';
import type { AppState } from '../../domain';
import { lifeModeKinds, lifeModeLabels, normalizeLifeContext, type LifeExperiment, type LifeMode } from './contracts';
import { activeLifeMode, addLifeDays, cancelLifeMode, finishExperiment, localLifeDay, repeatExperiment, saveExperiment, saveLifeMode, setResearchEnabled, summarizeLocalEvidence } from './model';
import './life-context.css';

type Update = (change: (state: AppState) => AppState, message: string) => boolean;
export function LifeContextPanel({ state, onChange }: { state: AppState; onChange: Dispatch<SetStateAction<AppState>> }) {
  const context = normalizeLifeContext(state.lifeContext);
  const day = localLifeDay();
  const mode = context.mode;
  const active = activeLifeMode(context, day);
  const [editingMode, setEditingMode] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const update: Update = (change, message) => {
    try {
      change(state);
      onChange(current => change(current));
      setError(''); setNotice(message); return true;
    } catch (cause) { setError(cause instanceof ZodError ? cause.issues[0]?.message ?? 'Check those details and try again.' : cause instanceof Error ? cause.message : 'Check those details and try again.'); return false; }
  };
  const evidence = summarizeLocalEvidence(context);
  const exportEvidence = () => {
    const file = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), summary: evidence, events: context.research.events }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a'); link.href = url; link.download = 'rep-and-plate-usage-evidence.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="life-context-panel">
    <header><p className="eyebrow">MAKE ROOM FOR REAL LIFE</p><h2>Your routine can flex.</h2><p>Tell Spot about a temporary change, or choose one small thing you want to try.</p></header>
    {error && <p className="life-context-error" role="alert">{error}</p>}
    {notice && <p className="life-context-notice" role="status">{notice}</p>}
    <section aria-labelledby="life-mode-title">
      <h3 id="life-mode-title">Life right now</h3>
      <p>Temporary context helps Spot work with your time, kitchen, and equipment. Your saved preferences stay yours.</p>
      {mode && !editingMode && <div className="life-context-card">
        <span className="life-context-status">{active ? 'Active now' : mode.startDay > day ? 'Starts soon' : 'Finished'}</span>
        <h4>{mode.name}</h4><p>{mode.startDay} through {mode.endDay}</p>
        {mode.details && <p>{mode.details}</p>}
        {mode.availableMinutes && <p>{mode.availableMinutes} minutes available</p>}
        {mode.equipment && <p>Available equipment: {mode.equipment}</p>}
        <p>{active ? 'Spot can use this context through the end date. It expires automatically.' : mode.startDay > day ? 'Spot will use this when the start date arrives.' : 'Spot has returned to your normal context.'}</p>
        <div className="life-context-actions"><button className="button secondary" onClick={() => setEditingMode(true)}>Change details</button><button className="button secondary" onClick={() => update(cancelLifeMode, active ? 'Temporary mode ended. Your usual context is back.' : 'Temporary mode removed.')}>{active ? 'End mode now' : 'Remove mode'}</button></div>
      </div>}
      {(!mode || editingMode) && <ModeForm key={mode?.id ?? 'new-mode'} mode={mode} day={day} onCancel={mode ? () => setEditingMode(false) : undefined} onSave={value => { if (update(current => saveLifeMode(current, value, day), 'Temporary context saved.')) setEditingMode(false); }} />}
    </section>
    <section aria-labelledby="life-experiment-title">
      <h3 id="life-experiment-title">Try one small thing</h3>
      <p>Choose an action that fits your life. At the end, decide whether it helped and whether you want to repeat it.</p>
      <ExperimentForm day={day} onSave={experiment => update(current => saveExperiment(current, experiment), 'Your experiment is saved.')} />
      <div className="life-context-experiments">{[...context.experiments].reverse().map(experiment => <ExperimentCard key={experiment.id} experiment={experiment} day={day} update={update} />)}</div>
      {!context.experiments.length && <p className="life-context-hint">For example: prepare two lunches, pack a gym bag the night before, or take a lunchtime walk.</p>}
    </section>
    <section aria-labelledby="life-evidence-title">
      <h3 id="life-evidence-title">Optional usage evidence</h3>
      <p>See whether recording is getting easier. Counts and timings stay with your private records and may be included in account saving. No meal text, messages, or photos are included, and nothing is sent to an analytics service.</p>
      <label className="life-context-consent"><input type="checkbox" checked={context.research.enabled} onChange={event => { const enabled = event.currentTarget.checked; update(current => setResearchEnabled(current, enabled), enabled ? 'Usage evidence enabled for future actions.' : 'Usage evidence disabled and cleared.'); }} />Keep usage counts and timings</label>
      <small>Turning this off clears the saved usage events. Your meals and workouts stay saved.</small>
      {context.research.enabled && <>
        <dl className="life-context-metrics">
          <div><dt>Captures completed</dt><dd>{evidence.capturesCompleted} / {evidence.capturesStarted} started</dd></div>
          <div><dt>Capture failures</dt><dd>{evidence.capturesFailed}</dd></div>
          <div><dt>Typical processing time</dt><dd>{evidence.medianCaptureMs === null ? 'No timed captures yet' : `${(evidence.medianCaptureMs / 1000).toFixed(1)} seconds`}</dd></div>
          <div><dt>Slower processing time (90th percentile)</dt><dd>{evidence.p90CaptureMs === null ? 'No timed captures yet' : `${(evidence.p90CaptureMs / 1000).toFixed(1)} seconds`}</dd></div>
          <div><dt>Meal corrections</dt><dd>{evidence.corrections}</dd></div>
          <div><dt>Usual meals used</dt><dd>{evidence.usualsUsed}</dd></div>
          <div><dt>Days visited</dt><dd>{evidence.distinctVisitDays}</dd></div>
          <div><dt>Returns after a break</dt><dd>{evidence.comebacks}</dd></div>
          <div><dt>Visit in the second week</dt><dd>{evidence.returnedInSecondWeek === null ? 'No visits recorded yet' : evidence.returnedInSecondWeek ? 'Recorded' : 'Not recorded yet'}</dd></div>
        </dl>
        <p className="life-context-hint">Based on up to 300 recent events. Processing time measures capture processing, rather than the time you spend reviewing it. These are personal observations, not a retention study.</p>
        <button className="button secondary" onClick={exportEvidence}>Export usage evidence</button>
      </>}
    </section>
  </div>;
}

function ModeForm({ mode, day, onSave, onCancel }: { mode?: LifeMode; day: string; onSave: (mode: LifeMode) => void; onCancel?: () => void }) {
  const [kind, setKind] = useState<LifeMode['kind']>(mode?.kind ?? 'busy-week');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const minutes = String(data.get('minutes') ?? '').trim();
    onSave({ id: mode?.id ?? crypto.randomUUID(), kind, name: String(data.get('name') ?? '').trim() || lifeModeLabels[kind], startDay: String(data.get('start')), endDay: String(data.get('end')), details: String(data.get('details') ?? ''), ...(minutes ? { availableMinutes: Number(minutes) } : {}), ...(String(data.get('equipment') ?? '').trim() ? { equipment: String(data.get('equipment')).trim() } : {}) });
  };
  return <form className="life-context-form" onSubmit={submit}>
    <label>What is changing?<select value={kind} onChange={event => setKind(event.currentTarget.value as LifeMode['kind'])}>{lifeModeKinds.map(value => <option value={value} key={value}>{lifeModeLabels[value]}</option>)}</select></label>
    <label>Name <span>(optional)</span><input name="name" maxLength={80} defaultValue={mode?.name ?? ''} placeholder="My conference week" /></label>
    <div className="life-context-form-row"><label>Start date<input type="date" name="start" defaultValue={mode?.startDay ?? day} required /></label><label>End date<input type="date" name="end" min={day} defaultValue={mode?.endDay && mode.endDay >= day ? mode.endDay : addLifeDays(day, 6)} required /></label></div>
    <label>What should Spot know? <span>(optional)</span><textarea name="details" maxLength={1000} defaultValue={mode?.details ?? ''} placeholder="Restaurant meals, a hotel gym, and a packed schedule." /></label>
    <div className="life-context-form-row"><label>Available minutes <span>(optional)</span><input type="number" name="minutes" min={5} max={180} step={1} defaultValue={mode?.availableMinutes ?? ''} /></label><label>Equipment <span>(optional)</span><input name="equipment" maxLength={240} defaultValue={mode?.equipment ?? ''} placeholder="Dumbbells and a treadmill" /></label></div>
    <div className="life-context-actions"><button className="button primary" type="submit">Save temporary mode</button>{onCancel && <button className="button secondary" type="button" onClick={onCancel}>Cancel</button>}</div>
  </form>;
}

function ExperimentForm({ day, onSave }: { day: string; onSave: (experiment: LifeExperiment) => boolean }) {
  return <form className="life-context-form" onSubmit={event => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    if (onSave({ id: crypto.randomUUID(), action: String(data.get('action') ?? ''), startDay: String(data.get('start')), endDay: String(data.get('end')), timesPerWeek: Number(data.get('frequency')), status: 'active' })) form.reset();
  }}>
    <label>What do you want to try?<input name="action" maxLength={180} required placeholder="Prepare lunches for two workdays" /></label>
    <div className="life-context-form-row"><label>Start date<input name="start" type="date" defaultValue={day} required /></label><label>End date<input name="end" type="date" defaultValue={addLifeDays(day, 6)} required /></label></div>
    <label>Times per week<input name="frequency" type="number" min={1} max={7} step={1} defaultValue={2} required /></label>
    <button className="button primary" type="submit">Start my experiment</button>
  </form>;
}

function ExperimentCard({ experiment, day, update }: { experiment: LifeExperiment; day: string; update: Update }) {
  const [reviewing, setReviewing] = useState(false);
  const finished = experiment.status === 'completed';
  return <article className="life-context-card">
    <span className="life-context-status">{finished ? 'Reviewed' : experiment.startDay > day ? 'Starts soon' : experiment.endDay < day ? 'Ready to reflect' : 'Your experiment'}</span>
    <h4>{experiment.action}</h4><p>{experiment.timesPerWeek} {experiment.timesPerWeek === 1 ? 'time' : 'times'} per week · {experiment.startDay} through {experiment.endDay}</p>
    {finished && experiment.feedback && <><p>{experiment.feedback.helpful ? 'You found it helpful.' : 'It did not help this time.'} Effort: {experiment.feedback.effort === 'too-much' ? 'too much' : experiment.feedback.effort}. {experiment.feedback.enjoyed ? 'You enjoyed it.' : 'You did not enjoy it.'}</p>{experiment.feedback.note && <p>{experiment.feedback.note}</p>}</>}
    {finished ? <button className="button secondary" onClick={() => { const id = crypto.randomUUID(); update(current => repeatExperiment(current, experiment.id, id, day), 'A new round starts today. Your previous feedback is preserved.'); }}>Try it again</button> : <button className="button secondary" onClick={() => setReviewing(value => !value)}>{reviewing ? 'Keep going for now' : 'Reflect and finish'}</button>}
    {!finished && reviewing && <form className="life-context-form" onSubmit={event => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const completedAt = new Date().toISOString();
      if (update(current => finishExperiment(current, experiment.id, { helpful: data.get('helpful') === 'yes', enjoyed: data.get('enjoyed') === 'yes', effort: data.get('effort') as 'easy' | 'manageable' | 'too-much', note: String(data.get('note') ?? '') }, completedAt), 'Reflection saved. Keep what works for you.')) setReviewing(false);
    }}>
      <label>Did it help?<select name="helpful" required defaultValue=""><option value="" disabled>Choose an answer</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label>How much effort did it take?<select name="effort" required defaultValue=""><option value="" disabled>Choose an answer</option><option value="easy">Easy</option><option value="manageable">Manageable</option><option value="too-much">Too much</option></select></label>
      <label>Did you enjoy it?<select name="enjoyed" required defaultValue=""><option value="" disabled>Choose an answer</option><option value="yes">Yes</option><option value="no">No</option></select></label>
      <label>What would you change? <span>(optional)</span><textarea name="note" maxLength={500} /></label>
      <button className="button primary" type="submit">Save reflection and finish</button>
    </form>}
  </article>;
}
