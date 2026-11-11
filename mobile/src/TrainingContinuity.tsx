import { useState } from 'react';
import { View, Text } from 'react-native';
import { Button, Card, Choice, Field } from './ui';
import { useLoadedHealth } from './store';
import type { AppState } from '../../src/domain';
import { applyPreviousLoads, comparableProgress, previousExercise, saveProgramSubstitution, shortenRemainingWorkout, substituteExercise } from '../../src/features/progress/continuity';

export function NativeTrainingContinuity() {
  const h = useLoadedHealth();
  const [selected, setSelected] = useState(0);
  const [minutes, setMinutes] = useState('25');
  const [replacement, setReplacement] = useState('');
  const [keep, setKeep] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const index = selected < h.state.workout.exercises.length ? selected : 0;
  const exercise = h.state.workout.exercises[index];
  const previous = exercise ? previousExercise(h.state.workout, exercise.name) : null;
  const progress = comparableProgress(h.state.workout);
  const choices = h.state.workout.exercises.map((item, n) => `${n + 1}. ${item.name}`);
  const unstarted = exercise?.sets.every(reps => reps === null) ?? false;
  const hasRemaining = exercise?.sets.some(reps => reps === null) ?? false;
  const change = (transform: (current: AppState) => AppState, message: string) => {
    try {
      const saved = h.change(transform);
      setNotice(saved ? message : 'Your workout could not be updated. Please try again.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Your remaining workout could not be updated.');
    }
  };
  const checkSelected = (current: AppState) => {
    if (!exercise || current.workout.exercises[index]?.name !== exercise.name) throw new Error('Your workout changed. Choose the exercise again.');
  };
  const useLoads = () => change(current => {
    checkSelected(current);
    return { ...current, workout: applyPreviousLoads(current.workout, index) };
  }, 'Previous loads are ready for your remaining sets.');
  const substitute = () => change(current => {
    checkSelected(current);
    const changed = { ...current, workout: substituteExercise(current.workout, index, replacement) };
    return keep ? saveProgramSubstitution(changed, exercise!.name, replacement) : changed;
  }, keep ? 'Substitution saved for this session and matching exercises in your training week. Choose the new load before logging.' : 'Substitution saved for this session. Choose the new load before logging.');

  if (h.state.workout.status === 'finished') return progress.length ? <Card><View style={{ gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: '#234c3a', fontSize: 18, fontWeight: '700' }}>Your recorded progress</Text>
    {progress.map(item => <View key={`${item.name}:${item.weight}`} style={{ gap: 4 }}>
      <Text style={{ color: '#234c3a', fontSize: 14, lineHeight: 21 }}>{item.detail}</Text>
      <Text style={{ color: '#5b7466', fontSize: 12, lineHeight: 18 }}>Compared with the session completed {new Date(item.previousFinishedAt).toLocaleDateString()}.</Text>
    </View>)}
  </View></Card> : null;
  if (h.state.workout.status !== 'active' || !exercise) return null;
  return <Card><View style={{ gap: 12 }}>
    <Text accessibilityRole="header" style={{ color: '#234c3a', fontSize: 18, fontWeight: '700' }}>Make this session work for today</Text>
    <Text style={{ color: '#234c3a', fontSize: 13, fontWeight: '700' }}>Exercise</Text>
    <Choice values={choices} value={choices[index]} onChange={value => { setSelected(choices.indexOf(value)); setReplacement(''); setKeep(false); setNotice(''); }} />
    {previous ? <View style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: '#dce9df', borderRadius: 12, backgroundColor: '#f5faf6' }}>
      <Text style={{ color: '#234c3a', fontSize: 14, fontWeight: '700' }}>Last recorded: {previous.name}</Text>
      <Text style={{ color: '#234c3a', fontSize: 13, lineHeight: 21 }}>{previous.sets.map(set => `Set ${set.index + 1}: ${set.weight} lb × ${set.reps}`).join(' · ')}</Text>
      <Text style={{ color: '#5b7466', fontSize: 12, lineHeight: 18 }}>{new Date(previous.finishedAt).toLocaleDateString()} · Confirmed recorded loads, shown in pounds.</Text>
      <Button label="Use previous loads for remaining sets" onPress={useLoads} disabled={h.busy || !hasRemaining} />
    </View> : <Text style={{ color: '#5b7466', fontSize: 13, lineHeight: 20 }}>No earlier completed session with confirmed loads for this exercise yet.</Text>}
    <Button label={expanded ? 'Hide session options' : 'Short on time or need a substitute?'} onPress={() => setExpanded(value => !value)} secondary />
    {expanded && <View style={{ gap: 12 }}>
      <Field label="Minutes available for remaining work" value={minutes} onChangeText={setMinutes} keyboardType="numeric" />
      <Button label="Shorten remaining work" onPress={() => change(current => ({ ...current, workout: shortenRemainingWorkout(current.workout, Number(minutes)) }), 'Remaining work shortened. Your recorded sets are preserved.')} disabled={h.busy} />
      <Text style={{ color: '#5b7466', fontSize: 12, lineHeight: 18 }}>Uses a rough estimate of three minutes per remaining set, including rest. Recorded work always stays.</Text>
      <Field label={`Substitute for ${exercise.name}`} value={replacement} onChangeText={setReplacement} editable={unstarted && !h.busy} maxLength={100} placeholder="Exercise you want to do instead" />
      {h.state.profile.trainingProgram && <View style={{ gap: 7 }}>
        <Text style={{ color: '#234c3a', fontSize: 13, fontWeight: '700' }}>Save this substitute</Text>
        <Choice values={['This session only', 'Keep in my training week']} value={keep ? 'Keep in my training week' : 'This session only'} onChange={value => setKeep(value === 'Keep in my training week')} />
      </View>}
      <Button label="Use this substitute" onPress={substitute} disabled={h.busy || !unstarted || !replacement.trim()} />
      {!unstarted && <Text style={{ color: '#5b7466', fontSize: 12, lineHeight: 18 }}>Choose an exercise you have not started. Recorded exercises keep their identity.</Text>}
    </View>}
    {notice ? <Text accessibilityLiveRegion="polite" style={{ color: '#234c3a', fontSize: 13, lineHeight: 20 }}>{notice}</Text> : null}
  </View></Card>;
}

export default NativeTrainingContinuity;
