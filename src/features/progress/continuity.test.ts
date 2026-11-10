import { describe, expect, it } from 'vitest';
import type { AppState } from '../../domain';
import { applyPreviousLoads, comparableProgress, previousExercise, saveProgramSubstitution, shortenRemainingWorkout, substituteExercise } from './continuity';

type Workout = AppState['workout'];
type Exercise = Workout['exercises'][number];
function exercise(patch: Partial<Exercise> = {}): Exercise {
  return { name: 'Bench Press', weight: 135, weightConfirmed: true, target: 8, previous: [], sets: [8, 8, 7], ...patch };
}
function completed(exercises: Exercise[], title = 'Upper Body', startedAt = '2026-11-01T10:00:00.000Z', finishedAt = '2026-11-01T11:00:00.000Z') {
  return { title, startedAt, finishedAt, exercises };
}
function workout(patch: Partial<Workout> = {}): Workout {
  return {
    status: 'active', title: 'Upper Body',
    startedAt: '2026-11-08T10:00:00.000Z', finishedAt: patch.status === 'finished' ? '2026-11-08T11:00:00.000Z' : null,
    exercises: [exercise({ weight: 0, weightConfirmed: false, sets: [null, null, null] })],
    history: [completed([exercise()])],
    ...patch,
  } as unknown as Workout;
}

describe('training continuity', () => {
  it('uses a completed personal session and excludes sample, unfinished, and future history', () => {
    const source = workout({ history: [
      completed([exercise()]),
      completed([exercise({ weight: 999 })], 'Sample Upper Body', '2026-11-07T10:00:00.000Z', '2026-11-07T11:00:00.000Z'),
      { ...completed([exercise({ weight: 800 })]), startedAt: '2026-11-07T15:00:00.000Z', finishedAt: null },
      completed([exercise({ weight: 600 })], 'Future', '2026-11-09T10:00:00.000Z', '2026-11-09T11:00:00.000Z'),
    ] });
    const previous = previousExercise(source, '  bench   PRESS ');
    expect(previous?.title).toBe('Upper Body');
    expect(previous?.sets.map(set => set.weight)).toEqual([135, 135, 135]);
    expect(previousExercise(source, 'Dumbbell Bench Press')).toBeNull();
  });

  it('requires known recorded loads instead of treating an old example weight as confirmation', () => {
    const legacy = workout({ history: [completed([exercise({ weightConfirmed: undefined })])] });
    expect(previousExercise(legacy, 'Bench Press')).toBeNull();
    const explicit = workout({ history: [completed([exercise({ weightConfirmed: undefined, setWeights: [95, 135, 175] })])] });
    expect(previousExercise(explicit, 'Bench Press')?.sets.map(set => set.weight)).toEqual([95, 135, 175]);
  });

  it('carries the exact previous per-set loads only after the helper is invoked', () => {
    const source = workout({ history: [completed([exercise({ setWeights: [95, 135, 175] })])] });
    const changed = applyPreviousLoads(source, 0);
    expect(changed.exercises[0].setWeights).toEqual([95, 135, 175]);
    expect(changed.exercises[0].previous).toEqual([8, 8, 7]);
    expect(changed.exercises[0].sets).toEqual([null, null, null]);
    expect(source.exercises[0].weight).toBe(0);
    expect(source.exercises[0].setWeights).toBeUndefined();
    expect(changed.history).toBe(source.history);
  });

  it('preserves performed sets and their loads when filling the remaining sets', () => {
    const active = exercise({ weight: 140, sets: [9, null, null], setWeights: [140, null, null], setEffort: [2, null, null] });
    const source = workout({ exercises: [active], history: [completed([exercise({ setWeights: [95, 135, 175] })])] });
    const changed = applyPreviousLoads(source, 0).exercises[0];
    expect(changed.weight).toBe(140);
    expect(changed.sets).toBe(active.sets);
    expect(changed.setWeights).toEqual([140, 135, 175]);
    expect(changed.setEffort).toBe(active.setEffort);
  });

  it('does not invent loads for extra sets or gaps in the earlier session', () => {
    const source = workout({
      exercises: [exercise({ weight: 0, weightConfirmed: false, sets: [null, null, null, null] })],
      history: [completed([exercise({ sets: [8, null, 7], setWeights: [95, 135, 175] })])],
    });
    const changed = applyPreviousLoads(source, 0).exercises[0];
    expect(changed.setWeights).toEqual([95, null, 175, null]);
    expect(changed.weightConfirmed).toBe(false);
  });

  it('shortens only unrecorded work while preserving recorded set positions and effort', () => {
    const active = exercise({ sets: [8, null, 7, null, null], setWeights: [95, null, 135, null, null], setEffort: [2, null, 1, null, null] });
    const source = workout({ exercises: [active, exercise({ name: 'Rows', sets: [null, null, null] })] });
    const changed = shortenRemainingWorkout(source, 5);
    expect(changed.exercises).toHaveLength(1);
    expect(changed.exercises[0].sets).toEqual([8, null, 7]);
    expect(changed.exercises[0].setWeights).toEqual([95, null, 135]);
    expect(changed.exercises[0].setEffort).toEqual([2, null, 1]);
    expect(source.exercises[0].sets).toEqual([8, null, 7, null, null]);
    expect(changed.exercises.some(item => item.sets.includes(null))).toBe(true);
  });

  it('keeps earlier exercise indices stable when a later exercise already has recorded sets', () => {
    const source = workout({ exercises: [
      exercise({ name: 'Rows', sets: [null, null, null] }),
      exercise({ name: 'Bench Press', sets: [8, null, null] }),
      exercise({ name: 'Curls', sets: [null, null, null] }),
    ] });
    const changed = shortenRemainingWorkout(source, 5);
    expect(changed.exercises[1].name).toBe('Bench Press');
    expect(changed.exercises[1].sets[0]).toBe(8);
    expect(changed.exercises[0].sets).toEqual([null]);
  });

  it('leaves a fully recorded session intact and rejects invalid time budgets', () => {
    const source = workout({ exercises: [exercise()] });
    expect(shortenRemainingWorkout(source, 5)).toBe(source);
    expect(() => shortenRemainingWorkout(source, NaN)).toThrow('between 5 and 120');
    expect(() => shortenRemainingWorkout(workout({ status: 'finished' }), 25)).toThrow('Start a workout');
  });

  it('resets load, previous reps, and effort for an explicitly chosen unstarted substitute', () => {
    const source = workout({ exercises: [exercise({ sets: [null, null], previous: [8, 7], setWeights: [135, 135], setEffort: [2, 2] })] });
    const changed = substituteExercise(source, 0, '  Dumbbell Bench Press  ').exercises[0];
    expect(changed.name).toBe('Dumbbell Bench Press');
    expect(changed.weight).toBe(0);
    expect(changed.weightConfirmed).toBe(false);
    expect(changed.previous).toEqual([]);
    expect(changed.setWeights).toEqual([null, null]);
    expect(changed.setEffort).toEqual([null, null]);
    expect(source.exercises[0].name).toBe('Bench Press');
  });

  it('protects even a recorded zero-rep attempt from being renamed', () => {
    expect(() => substituteExercise(workout({ exercises: [exercise({ sets: [0, null] })] }), 0, 'Rows')).toThrow('recorded exercises unchanged');
    expect(() => substituteExercise(workout(), 0, '   ')).toThrow('exercise name');
  });

  it('saves an explicitly chosen substitution only to matching future prescriptions', () => {
    const session = workout();
    const source = {
      workout: session,
      profile: { trainingProgram: {
        sessions: [
          { title: 'Session 1', exercises: [{ name: 'Bench Press', target: 8, sets: 3 }, { name: 'Dumbbell Bench Press', target: 10, sets: 2 }] },
          { title: 'Session 2', exercises: [{ name: 'bench press', target: 6, sets: 4 }] },
        ],
      } },
    } as unknown as AppState;
    const changed = saveProgramSubstitution(source, 'Bench Press', 'Machine Chest Press');
    expect(changed.profile.trainingProgram!.sessions[0].exercises).toEqual([
      { name: 'Machine Chest Press', target: 8, sets: 3 },
      { name: 'Dumbbell Bench Press', target: 10, sets: 2 },
    ]);
    expect(changed.profile.trainingProgram!.sessions[1].exercises[0]).toEqual({ name: 'Machine Chest Press', target: 6, sets: 4 });
    expect(changed.workout).toBe(source.workout);
    expect(changed.workout.history).toBe(source.workout.history);
    expect(source.profile.trainingProgram!.sessions[0].exercises[0].name).toBe('Bench Press');
    expect(saveProgramSubstitution(source, 'Rows', 'Cable Row')).toBe(source);
  });

  it('reports reps at the same exact load with a dated evidence trail', () => {
    const source = workout({ status: 'finished', finishedAt: '2026-11-08T11:00:00.000Z', exercises: [exercise({ sets: [10, 8, 7] })] });
    const [progress] = comparableProgress(source);
    expect(progress).toMatchObject({ name: 'Bench Press', weight: 135, previousReps: 23, currentReps: 25, change: 2, sets: 3, previousFinishedAt: '2026-11-01T11:00:00.000Z' });
    expect(progress.detail).toContain('3 comparable sets');
  });

  it('compares matching set positions and excludes changed loads, bodyweight, and active sessions', () => {
    const source = workout({ status: 'finished', exercises: [exercise({ sets: [10, 8, 7], setWeights: [175, 135, 135] })] });
    expect(comparableProgress(source)[0]).toMatchObject({ sets: 2, currentReps: 15, previousReps: 15, change: 0 });
    expect(comparableProgress(workout())).toEqual([]);
    expect(comparableProgress(workout({ status: 'finished', finishedAt: null }))).toEqual([]);
    const bodyweight = workout({ status: 'finished', exercises: [exercise({ weight: 0 })], history: [completed([exercise({ weight: 0 })])] });
    expect(comparableProgress(bodyweight)).toEqual([]);
  });

  it('avoids ambiguous duplicate exercise blocks and does not compare a session to itself', () => {
    const current = completed([exercise({ sets: [10, 10, 10] })], 'Upper Body', '2026-11-08T10:00:00.000Z', '2026-11-08T11:00:00.000Z');
    const source = workout({ status: 'finished', exercises: current.exercises, history: [completed([exercise()]), current] });
    expect(comparableProgress(source)[0].change).toBe(7);
    const ambiguous = workout({ history: [completed([exercise(), exercise()])] });
    expect(previousExercise(ambiguous, 'Bench Press')).toBeNull();
  });
});
