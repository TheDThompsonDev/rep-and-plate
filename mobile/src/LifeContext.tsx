import { useState } from 'react';
import { View, Text } from 'react-native';
import { ZodError } from 'zod';
import { id, type AppState } from '../../src/domain';
import { lifeModeKinds, lifeModeLabels, normalizeLifeContext, type LifeMode } from '../../src/features/life-context/contracts';
import { activeLifeMode, addLifeDays, cancelLifeMode, finishExperiment, repeatExperiment, saveExperiment, saveLifeMode, setResearchEnabled, summarizeLocalEvidence } from '../../src/features/life-context/model';
import { useLoadedHealth } from './store';
import { Button, Field, Choice, Sheet, Card } from './ui';

export default function NativeLifeContext({ onClose }: { onClose: () => void }) {
  const h = useLoadedHealth();
  const context = normalizeLifeContext(h.state.lifeContext);
  const mode = context.mode;
  const day = h.day;
  const active = activeLifeMode(context, day);
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<LifeMode['kind']>(mode?.kind ?? 'busy-week');
  const [name, setName] = useState(mode?.name ?? '');
  const [start, setStart] = useState(mode?.startDay ?? day);
  const [end, setEnd] = useState(mode?.endDay && mode.endDay >= day ? mode.endDay : addLifeDays(day, 6));
  const [details, setDetails] = useState(mode?.details ?? '');
  const [minutes, setMinutes] = useState(mode?.availableMinutes ? String(mode.availableMinutes) : '');
  const [equipment, setEquipment] = useState(mode?.equipment ?? '');
  const [action, setAction] = useState('');
  const [experimentStart, setExperimentStart] = useState(day);
  const [experimentEnd, setExperimentEnd] = useState(addLifeDays(day, 6));
  const [frequency, setFrequency] = useState('2');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [helpful, setHelpful] = useState('');
  const [effort, setEffort] = useState('');
  const [enjoyed, setEnjoyed] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const apply = (change: (state: AppState) => AppState, message: string) => {
    try {
      change(h.state);
      const saved = h.change(change);
      if (saved) { setError(''); h.setNotice(message); }
      else setError('Your change could not be saved. Please try again.');
      return saved;
    } catch (cause) {
      setError(cause instanceof ZodError ? cause.issues[0]?.message ?? 'Check those details.' : cause instanceof Error ? cause.message : 'Check those details.');
      return false;
    }
  };
  const editMode = () => {
    setKind(mode?.kind ?? 'busy-week'); setName(mode?.name ?? '');
    setStart(mode?.startDay ?? day); setEnd(mode?.endDay && mode.endDay >= day ? mode.endDay : addLifeDays(day, 6));
    setDetails(mode?.details ?? ''); setMinutes(mode?.availableMinutes ? String(mode.availableMinutes) : '');
    setEquipment(mode?.equipment ?? ''); setEditing(true);
  };
  const evidence = summarizeLocalEvidence(context);
  return <Sheet title="Life right now" onClose={onClose}>
    <View style={{ gap: 16 }}>
      <Text>Your routine can flex. Give Spot temporary context, or choose one small thing to try.</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: '#8b2626' }}>{error}</Text> : null}
      <Card>
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 19, fontWeight: '700' }}>Temporary mode</Text>
          <Text>These details apply only during your chosen dates. Your enduring preferences stay saved.</Text>
          {mode && !editing ? <>
            <Text style={{ fontWeight: '700' }}>{mode.name} · {active ? 'Active now' : mode.startDay > day ? 'Starts soon' : 'Finished'}</Text>
            <Text>{mode.startDay} through {mode.endDay}</Text>
            {mode.details ? <Text>{mode.details}</Text> : null}
            {mode.availableMinutes ? <Text>{mode.availableMinutes} minutes available</Text> : null}
            {mode.equipment ? <Text>Equipment: {mode.equipment}</Text> : null}
            <Text>{active ? 'Expires automatically after the end date.' : mode.startDay > day ? 'Spot will use this when the start date arrives.' : 'Your normal context is back.'}</Text>
            <Button label="Change details" secondary onPress={editMode} />
            <Button label={active ? 'End mode now' : 'Remove mode'} secondary onPress={() => { if (apply(cancelLifeMode, 'Temporary mode removed. Your usual context is back.')) setEditing(false); }} />
          </> : <>
            <Choice values={lifeModeKinds.map(value => lifeModeLabels[value])} value={lifeModeLabels[kind]} onChange={value => setKind(lifeModeKinds.find(item => lifeModeLabels[item] === value) ?? 'custom')} />
            <Field label="Name (optional)" value={name} onChangeText={setName} />
            <Field label="Start date (YYYY-MM-DD)" value={start} onChangeText={setStart} />
            <Field label="End date (YYYY-MM-DD)" value={end} onChangeText={setEnd} />
            <Field label="What should Spot know? (optional)" value={details} onChangeText={setDetails} multiline />
            <Field label="Available minutes (optional)" value={minutes} onChangeText={setMinutes} keyboardType="numeric" />
            <Field label="Available equipment (optional)" value={equipment} onChangeText={setEquipment} />
            <Button label="Save temporary mode" onPress={() => {
              const value: LifeMode = { id: mode?.id ?? id(), kind, name: name.trim() || lifeModeLabels[kind], startDay: start, endDay: end, details, ...(minutes.trim() ? { availableMinutes: Number(minutes) } : {}), ...(equipment.trim() ? { equipment: equipment.trim() } : {}) };
              if (apply(state => saveLifeMode(state, value, day), 'Temporary context saved.')) setEditing(false);
            }} />
            {mode ? <Button label="Cancel changes" secondary onPress={() => setEditing(false)} /> : null}
          </>}
        </View>
      </Card>
      <Card>
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 19, fontWeight: '700' }}>Try one small thing</Text>
          <Text>For example: prepare two lunches, or pack a gym bag the night before. Choose an action that fits your life.</Text>
          <Field label="What do you want to try?" value={action} onChangeText={setAction} />
          <Field label="Start date (YYYY-MM-DD)" value={experimentStart} onChangeText={setExperimentStart} />
          <Field label="End date (YYYY-MM-DD)" value={experimentEnd} onChangeText={setExperimentEnd} />
          <Field label="Times per week (1–7)" value={frequency} onChangeText={setFrequency} keyboardType="numeric" />
          <Button label="Start my experiment" disabled={!action.trim()} onPress={() => {
            const value = { id: id(), action, startDay: experimentStart, endDay: experimentEnd, timesPerWeek: Number(frequency), status: 'active' as const };
            if (apply(state => saveExperiment(state, value), 'Your experiment is saved.')) setAction('');
          }} />
        </View>
      </Card>
      {[...context.experiments].reverse().map(experiment => <Card key={experiment.id}>
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 17, fontWeight: '700' }}>{experiment.action}</Text>
          <Text>{experiment.timesPerWeek} times per week · {experiment.startDay} through {experiment.endDay}</Text>
          <Text>{experiment.status === 'completed' ? 'Reviewed' : experiment.startDay > day ? 'Starts soon' : experiment.endDay < day ? 'Ready to reflect' : 'Your experiment'}</Text>
          {experiment.status === 'completed' ? <>
            {experiment.feedback ? <>
              <Text>{experiment.feedback.helpful ? 'Helpful' : 'Did not help this time'} · Effort: {experiment.feedback.effort === 'too-much' ? 'too much' : experiment.feedback.effort} · {experiment.feedback.enjoyed ? 'Enjoyed it' : 'Did not enjoy it'}</Text>
              {experiment.feedback.note ? <Text>{experiment.feedback.note}</Text> : null}
            </> : null}
            <Button label="Try it again" secondary onPress={() => { const nextId = id(); apply(state => repeatExperiment(state, experiment.id, nextId, day), 'A new round starts today. Previous feedback is preserved.'); }} />
          </> : <>
            <Button label={reviewId === experiment.id ? 'Keep going for now' : 'Reflect and finish'} secondary onPress={() => { setReviewId(reviewId === experiment.id ? null : experiment.id); setHelpful(''); setEffort(''); setEnjoyed(''); setNote(''); }} />
            {reviewId === experiment.id ? <>
              <Text>Did it help?</Text><Choice values={['Yes', 'No']} value={helpful} onChange={setHelpful} />
              <Text>How much effort did it take?</Text><Choice values={['Easy', 'Manageable', 'Too much']} value={effort} onChange={setEffort} />
              <Text>Did you enjoy it?</Text><Choice values={['Yes', 'No']} value={enjoyed} onChange={setEnjoyed} />
              <Field label="What would you change? (optional)" value={note} onChangeText={setNote} multiline />
              <Button label="Save reflection and finish" disabled={!helpful || !effort || !enjoyed} onPress={() => {
                const feedback = { helpful: helpful === 'Yes', effort: (effort === 'Too much' ? 'too-much' : effort === 'Easy' ? 'easy' : 'manageable') as 'easy' | 'manageable' | 'too-much', enjoyed: enjoyed === 'Yes', note };
                const completedAt = new Date().toISOString();
                if (apply(state => finishExperiment(state, experiment.id, feedback, completedAt), 'Reflection saved. Keep what works for you.')) setReviewId(null);
              }} />
            </> : null}
          </>}
        </View>
      </Card>)}
      <Card>
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 19, fontWeight: '700' }}>Optional usage evidence</Text>
          <Text>Keep counts and timings with your private records, including account saving. No meal text, messages, or photos are included. Nothing is sent to an analytics service.</Text>
          <Button label={context.research.enabled ? 'Turn off and clear usage evidence' : 'Enable usage counts and timings'} secondary onPress={() => apply(state => setResearchEnabled(state, !context.research.enabled), context.research.enabled ? 'Usage evidence disabled and cleared.' : 'Usage evidence enabled for future actions.')} />
          {context.research.enabled ? <>
            <Text>Captures completed: {evidence.capturesCompleted} / {evidence.capturesStarted} started</Text>
            <Text>Capture failures: {evidence.capturesFailed}</Text>
            <Text>Typical processing time: {evidence.medianCaptureMs === null ? 'No timed captures yet' : `${(evidence.medianCaptureMs / 1000).toFixed(1)} seconds`}</Text>
            <Text>Slower processing time (90th percentile): {evidence.p90CaptureMs === null ? 'No timed captures yet' : `${(evidence.p90CaptureMs / 1000).toFixed(1)} seconds`}</Text>
            <Text>Meal corrections: {evidence.corrections} · Usual meals used: {evidence.usualsUsed}</Text>
            <Text>Days visited: {evidence.distinctVisitDays} · Returns after a break: {evidence.comebacks}</Text>
            <Text>Visit in second week: {evidence.returnedInSecondWeek === null ? 'No visits yet' : evidence.returnedInSecondWeek ? 'Recorded' : 'Not recorded yet'}</Text>
            <Text>Based on up to 300 recent events. Processing time excludes your review time. These are personal observations, not a retention study. Usage evidence is included in your account records export.</Text>
          </> : null}
        </View>
      </Card>
    </View>
  </Sheet>;
}
