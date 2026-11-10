import type { AppState } from '../../domain';

type Workout = AppState['workout'];
type Exercise = Workout['exercises'][number];
export type RecordedExerciseSet = { index: number; weight: number; reps: number };
export type PreviousExercise = {
  name: string;
  title: string;
  startedAt: string;
  finishedAt: string;
  sets: RecordedExerciseSet[];
  totalReps: number;
};
export type ComparableProgress = {
  name: string;
  weight: number;
  previousReps: number;
  currentReps: number;
  change: number;
  sets: number;
  previousFinishedAt: string;
  currentStartedAt: string | null;
  detail: string;
};

export function normalizeExerciseName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function recordedSets(exercise: Exercise): RecordedExerciseSet[] {
  const sets: RecordedExerciseSet[] = [];
  exercise.sets.forEach((reps, index) => {
    if (reps === null || !Number.isInteger(reps) || reps <= 0 || reps > 100) return;
    const perSet = exercise.setWeights?.[index];
    const weight = typeof perSet === 'number' ? perSet : exercise.weightConfirmed === true ? exercise.weight : null;
    if (weight === null || !Number.isFinite(weight) || weight < 0 || weight > 2000) return;
    sets.push({ index, weight, reps });
  });
  return sets;
}

/** The last completed, dated session containing a usable record of this exact
 * exercise name. Names are normalized for spaces/case, never inferred as synonyms. */
export function previousExercise(workout: Workout, name: string): PreviousExercise | null {
  const wanted = normalizeExerciseName(name);
  if (!wanted) return null;
  const currentStart = workout.startedAt ? Date.parse(workout.startedAt) : NaN;
  const sessions = [...(workout.history ?? [])].filter(session => {
    if (!session.startedAt || !session.finishedAt || /\b(?:sample|demo|example)\b/i.test(session.title)) return false;
    const start = Date.parse(session.startedAt), finish = Date.parse(session.finishedAt);
    return Number.isFinite(start) && Number.isFinite(finish) && finish >= start &&
      (!Number.isFinite(currentStart) || (start < currentStart && finish <= currentStart));
  }).sort((a, b) => Date.parse(b.finishedAt!) - Date.parse(a.finishedAt!));
  for (const session of sessions) {
    const matches = session.exercises.filter(exercise => normalizeExerciseName(exercise.name) === wanted);
    // Multiple similarly named exercise blocks are ambiguous; do not choose one.
    if (matches.length !== 1) continue;
    const exercise = matches[0], sets = recordedSets(exercise);
    if (sets.length) return {
      name: exercise.name,
      title: session.title,
      startedAt: session.startedAt!,
      finishedAt: session.finishedAt!,
      sets,
      totalReps: sets.reduce((sum, set) => sum + set.reps, 0),
    };
  }
  return null;
}

function activeExercise(workout: Workout, index: number): Exercise {
  const exercise = workout.exercises[index];
  if (workout.status !== 'active' || !Number.isInteger(index) || !exercise) {
    throw new Error('Open an active exercise before changing its remaining sets.');
  }
  return exercise;
}

/** Called only after the person chooses to use previous loads. Each matching
 * unrecorded set gets its previous exact load; performed work is untouched. */
export function applyPreviousLoads(workout: Workout, exerciseIndex: number): Workout {
  const exercise = activeExercise(workout, exerciseIndex);
  const previous = previousExercise(workout, exercise.name);
  if (!previous || !exercise.sets.some(reps => reps === null)) return workout;
  const byIndex = new Map(previous.sets.map(set => [set.index, set]));
  let applied = false;
  const setWeights = exercise.sets.map((reps, index) => {
    const existing = exercise.setWeights?.[index];
    if (reps !== null) return existing ?? (exercise.weightConfirmed === true ? exercise.weight : null);
    const prior = byIndex.get(index);
    if (!prior) return existing ?? null;
    applied = true;
    return prior.weight;
  });
  if (!applied) return workout;
  const recorded = exercise.sets.some(reps => reps !== null);
  const allLoadsKnown = setWeights.every(weight => weight !== null);
  const firstLoad = setWeights.find(weight => weight !== null);
  return {
    ...workout,
    exercises: workout.exercises.map((item, index) => index !== exerciseIndex ? item : {
      ...item,
      previous: previous.sets.map(set => set.reps),
      setWeights,
      ...(!recorded && allLoadsKnown && firstLoad !== undefined ? { weight: firstLoad, weightConfirmed: true } : {}),
    }),
  };
}

/** A planning estimate of three minutes per remaining set, including rest.
 * Recorded indices and any unrecorded gaps before them remain intact. When
 * layout preservation needs more sets than the time budget, preservation wins. */
export function shortenRemainingWorkout(workout: Workout, minutes: number): Workout {
  if (workout.status !== 'active') throw new Error('Start a workout before shortening its remaining work.');
  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 120) throw new Error('Choose between 5 and 120 minutes.');
  const pending = workout.exercises.reduce((sum, exercise) => sum + exercise.sets.filter(reps => reps === null).length, 0);
  if (!pending) return workout;
  const budget = Math.max(1, Math.floor(minutes / 3));
  if (pending <= budget) return workout;
  let lastRecordedExercise = -1;
  const required = workout.exercises.map((exercise, index) => {
    let last = -1;
    exercise.sets.forEach((reps, set) => { if (reps !== null) last = set; });
    if (last >= 0) lastRecordedExercise = index;
    return last + 1;
  });
  // Keep an unstarted exercise's first set when it precedes recorded work so
  // removing that exercise cannot change links to a performed exercise.
  required.forEach((count, index) => {
    if (!count && index < lastRecordedExercise && workout.exercises[index].sets.length) required[index] = 1;
  });
  const mandatoryPending = required.reduce((sum, count, index) => sum + workout.exercises[index].sets.slice(0, count).filter(reps => reps === null).length, 0);
  let allowance = Math.max(0, budget - mandatoryPending);
  let changed = false;
  const exercises = workout.exercises.map((exercise, index) => {
    const minimum = required[index];
    const extra = Math.min(exercise.sets.length - minimum, allowance);
    allowance -= extra;
    const count = minimum + extra;
    if (count === exercise.sets.length) return exercise;
    changed = true;
    return {
      ...exercise,
      sets: exercise.sets.slice(0, count),
      ...(exercise.setWeights ? { setWeights: exercise.setWeights.slice(0, count) } : {}),
      ...(exercise.setEffort ? { setEffort: exercise.setEffort.slice(0, count) } : {}),
    };
  });
  // Only remove trailing empty blocks; earlier recorded exercise indices stay stable.
  while (exercises.length && !exercises.at(-1)!.sets.length) { exercises.pop(); changed = true; }
  return changed ? { ...workout, exercises } : workout;
}

export function substituteExercise(workout: Workout, exerciseIndex: number, replacement: string): Workout {
  const exercise = activeExercise(workout, exerciseIndex);
  const name = replacement.trim();
  if (!name || name.length > 100) throw new Error('Enter an exercise name with up to 100 characters.');
  if (exercise.sets.some(reps => reps !== null)) throw new Error('Keep recorded exercises unchanged. Substitute an exercise you have not started.');
  if (normalizeExerciseName(name) === normalizeExerciseName(exercise.name)) return workout;
  return {
    ...workout,
    exercises: workout.exercises.map((item, index) => index !== exerciseIndex ? item : {
      ...item, name, weight: 0, weightConfirmed: false, previous: [],
      sets: item.sets.map(() => null),
      setWeights: item.sets.map(() => null),
      setEffort: item.sets.map(() => null),
    }),
  };
}

/** Explicitly requested program edit. It changes future prescription names only. */
export function saveProgramSubstitution(state: AppState, original: string, replacement: string): AppState {
  const program = state.profile.trainingProgram;
  const name = replacement.trim();
  if (!name || name.length > 100) throw new Error('Enter an exercise name with up to 100 characters.');
  if (!program) return state;
  const wanted = normalizeExerciseName(original);
  let changed = false;
  const sessions = program.sessions.map(session => ({
    ...session,
    exercises: session.exercises.map(exercise => {
      if (normalizeExerciseName(exercise.name) !== wanted) return exercise;
      changed = true;
      return { ...exercise, name };
    }),
  }));
  return changed ? {
    ...state,
    profile: { ...state.profile, trainingProgram: { ...program, sessions } },
  } : state;
}

/** Describes only recorded reps at identical loads and matching set positions.
 * Zero-load/bodyweight work is excluded; the helper makes no strength/volume claim. */
export function comparableProgress(workout: Workout): ComparableProgress[] {
  if (workout.status !== 'finished') return [];
  const currentStart = Date.parse(workout.startedAt ?? '');
  const currentFinish = Date.parse(workout.finishedAt ?? '');
  if (!Number.isFinite(currentStart) || !Number.isFinite(currentFinish) || currentFinish < currentStart) return [];
  const results: ComparableProgress[] = [];
  for (const exercise of workout.exercises) {
    if (workout.exercises.filter(item => normalizeExerciseName(item.name) === normalizeExerciseName(exercise.name)).length !== 1) continue;
    const previous = previousExercise(workout, exercise.name);
    if (!previous) continue;
    const priorByIndex = new Map(previous.sets.map(set => [set.index, set]));
    const groups = new Map<number, { previousReps: number; currentReps: number; sets: number }>();
    for (const set of recordedSets(exercise)) {
      const prior = priorByIndex.get(set.index);
      if (!prior || set.weight <= 0 || prior.weight !== set.weight) continue;
      const group = groups.get(set.weight) ?? { previousReps: 0, currentReps: 0, sets: 0 };
      group.previousReps += prior.reps;
      group.currentReps += set.reps;
      group.sets += 1;
      groups.set(set.weight, group);
    }
    for (const [weight, evidence] of groups) {
      const change = evidence.currentReps - evidence.previousReps;
      const direction = change > 0 ? `${change} more` : change < 0 ? `${Math.abs(change)} fewer` : 'The same number of';
      results.push({
        name: exercise.name, weight, ...evidence, change,
        previousFinishedAt: previous.finishedAt,
        currentStartedAt: workout.startedAt ?? null,
        detail: `${exercise.name}: ${direction} reps across ${evidence.sets} comparable ${evidence.sets === 1 ? 'set' : 'sets'} at ${weight} lb (${evidence.currentReps} vs ${evidence.previousReps}).`,
      });
    }
  }
  return results;
}
