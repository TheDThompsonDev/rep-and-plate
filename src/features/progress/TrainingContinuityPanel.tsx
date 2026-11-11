import { useId, useState, type Dispatch, type SetStateAction } from 'react';
import type { AppState } from '../../domain';
import { applyPreviousLoads, comparableProgress, previousExercise, saveProgramSubstitution, shortenRemainingWorkout, substituteExercise } from './continuity';
import './training-continuity.css';

export default function TrainingContinuityPanel({ state, onChange }: {
  state: AppState;
  onChange: Dispatch<SetStateAction<AppState>>;
}) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const [minutes, setMinutes] = useState('25');
  const [replacement, setReplacement] = useState('');
  const [keep, setKeep] = useState(false);
  const [notice, setNotice] = useState('');
  const index = selected < state.workout.exercises.length ? selected : 0;
  const exercise = state.workout.exercises[index];
  const previous = exercise ? previousExercise(state.workout, exercise.name) : null;
  const progress = comparableProgress(state.workout);
  const unstarted = exercise?.sets.every(reps => reps === null) ?? false;
  const hasRemaining = exercise?.sets.some(reps => reps === null) ?? false;
  const change = (transform: (current: AppState) => AppState, message: string) => {
    try {
      transform(state);
      onChange(current => {
        try { return transform(current); } catch { return current; }
      });
      setNotice(message);
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

  if (state.workout.status === 'finished') return progress.length ? <section className="training-continuity" aria-label="Recorded workout progress">
    <h3>Your recorded progress</h3>
    {progress.map(item => <p key={`${item.name}:${item.weight}`}>{item.detail}<small>Compared with the session completed {new Date(item.previousFinishedAt).toLocaleDateString()}.</small></p>)}
  </section> : null;
  if (state.workout.status !== 'active' || !exercise) return null;
  return <section className="training-continuity" aria-labelledby={`${id}-heading`}>
    <h3 id={`${id}-heading`}>Make this session work for today</h3>
    <label className="training-continuity-field" htmlFor={`${id}-exercise`}>Exercise
      <select id={`${id}-exercise`} value={index} onChange={event => { setSelected(Number(event.target.value)); setReplacement(''); setKeep(false); setNotice(''); }}>
        {state.workout.exercises.map((item, n) => <option key={n} value={n}>{n + 1}. {item.name}</option>)}
      </select>
    </label>
    {previous ? <div className="training-continuity-previous">
      <strong>Last recorded: {previous.name}</strong>
      <span>{previous.sets.map(set => `Set ${set.index + 1}: ${set.weight} lb × ${set.reps}`).join(' · ')}</span>
      <small>{new Date(previous.finishedAt).toLocaleDateString()} · Confirmed recorded loads, shown in pounds.</small>
      <button type="button" onClick={useLoads} disabled={!hasRemaining}>Use previous loads for remaining sets</button>
    </div> : <p className="training-continuity-muted">No earlier completed session with confirmed loads for this exercise yet.</p>}
    <details className="training-continuity-options">
      <summary>Short on time or need a substitute?</summary>
      <div className="training-continuity-option">
        <label className="training-continuity-field" htmlFor={`${id}-minutes`}>Minutes available for remaining work
          <input id={`${id}-minutes`} type="number" min="5" max="120" inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value)} />
        </label>
        <button type="button" onClick={() => change(current => ({ ...current, workout: shortenRemainingWorkout(current.workout, Number(minutes)) }), 'Remaining work shortened. Your recorded sets are preserved.')}>Shorten remaining work</button>
        <small>Uses a rough estimate of three minutes per remaining set, including rest. Recorded work always stays.</small>
      </div>
      <div className="training-continuity-option">
        <label className="training-continuity-field" htmlFor={`${id}-substitute`}>Substitute for {exercise.name}
          <input id={`${id}-substitute`} maxLength={100} value={replacement} disabled={!unstarted} placeholder="Exercise you want to do instead" onChange={event => setReplacement(event.target.value)} />
        </label>
        {state.profile.trainingProgram && <label className="training-continuity-checkbox"><input type="checkbox" checked={keep} disabled={!unstarted} onChange={event => setKeep(event.target.checked)} />Keep in my training week</label>}
        <button type="button" onClick={substitute} disabled={!unstarted || !replacement.trim()}>Use this substitute</button>
        {!unstarted && <small>Choose an exercise you have not started. Recorded exercises keep their identity.</small>}
      </div>
    </details>
    {notice && <p className="training-continuity-notice" role="status">{notice}</p>}
  </section>;
}
