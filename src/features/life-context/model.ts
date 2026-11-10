import { experimentFeedbackSchema, lifeExperimentSchema, lifeModeSchema, localEventSchema, normalizeLifeContext, type ExperimentFeedback, type LifeContext, type LifeExperiment, type LifeMode, type LocalEvent } from './contracts';

type WithLifeContext = { lifeContext?: LifeContext };
export function localLifeDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addLifeDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function activeLifeMode(context: LifeContext | undefined, day = localLifeDay()): LifeMode | undefined {
  const parsed = lifeModeSchema.safeParse(context?.mode);
  return parsed.success && parsed.data.startDay <= day && day <= parsed.data.endDay ? parsed.data : undefined;
}
export function saveLifeMode<T extends WithLifeContext>(state: T, input: LifeMode, day = localLifeDay()): T {
  const mode = lifeModeSchema.parse(input);
  if (mode.endDay < day) throw Error('Choose an end date that is today or later.');
  return { ...state, lifeContext: { ...normalizeLifeContext(state.lifeContext), mode } };
}
export function cancelLifeMode<T extends WithLifeContext>(state: T): T {
  const { mode: _mode, ...context } = normalizeLifeContext(state.lifeContext);
  void _mode;
  return { ...state, lifeContext: context };
}
export function saveExperiment<T extends WithLifeContext>(state: T, input: LifeExperiment): T {
  const experiment = lifeExperimentSchema.parse(input);
  const context = normalizeLifeContext(state.lifeContext);
  const others = context.experiments.filter(item => item.id !== experiment.id);
  if (others.length >= 30) throw Error('Your experiment history is full. Export your records before starting more.');
  if (experiment.status === 'active' && others.some(item => item.status === 'active' && item.action.toLowerCase() === experiment.action.toLowerCase() && item.startDay <= experiment.endDay && experiment.startDay <= item.endDay)) throw Error('This experiment is already active during those dates.');
  return { ...state, lifeContext: { ...context, experiments: [...others, experiment] } };
}
export function finishExperiment<T extends WithLifeContext>(state: T, id: string, feedback: ExperimentFeedback, at = new Date().toISOString()): T {
  const context = normalizeLifeContext(state.lifeContext);
  const experiment = context.experiments.find(item => item.id === id);
  if (!experiment || experiment.status === 'completed') return state;
  return saveExperiment(state, { ...experiment, status: 'completed', feedback: experimentFeedbackSchema.parse(feedback), completedAt: at });
}
export function repeatExperiment<T extends WithLifeContext>(state: T, id: string, nextId: string, day = localLifeDay()): T {
  const experiment = normalizeLifeContext(state.lifeContext).experiments.find(item => item.id === id);
  if (!experiment || experiment.status !== 'completed') throw Error('Finish the experiment before repeating it.');
  const duration = Math.round((new Date(`${experiment.endDay}T12:00:00Z`).getTime() - new Date(`${experiment.startDay}T12:00:00Z`).getTime()) / 86400000);
  return saveExperiment(state, { id: nextId, action: experiment.action, startDay: day, endDay: addLifeDays(day, duration), timesPerWeek: experiment.timesPerWeek, status: 'active' });
}
export function setResearchEnabled<T extends WithLifeContext>(state: T, enabled: boolean): T {
  const context = normalizeLifeContext(state.lifeContext);
  return { ...state, lifeContext: { ...context, research: { enabled, events: enabled ? context.research.events : [] } } };
}
export function recordLocalEvent<T extends WithLifeContext>(state: T, event: LocalEvent): T {
  if (!state.lifeContext?.research.enabled) return state;
  const parsed = localEventSchema.safeParse(event);
  if (!parsed.success) return state;
  const context = normalizeLifeContext(state.lifeContext);
  if (context.research.events.some(item => item.id === parsed.data.id && item.kind === parsed.data.kind)) return state;
  return { ...state, lifeContext: { ...context, research: { enabled: true, events: [...context.research.events, parsed.data].slice(-300) } } };
}
export function lifeContextForAI(context: LifeContext | undefined, day = localLifeDay()) {
  const mode = activeLifeMode(context, day);
  const experiments = normalizeLifeContext(context).experiments.filter(item => item.status === 'active' && item.startDay <= day && day <= item.endDay);
  return {
    ...(mode ? { temporaryMode: { kind: mode.kind, name: mode.name, startDay: mode.startDay, endDay: mode.endDay, details: mode.details, availableMinutes: mode.availableMinutes, equipment: mode.equipment } } : {}),
    experiments: experiments.map(item => ({ action: item.action, timesPerWeek: item.timesPerWeek, endDay: item.endDay })),
  };
}
export function summarizeLocalEvidence(context: LifeContext | undefined) {
  const events = normalizeLifeContext(context).research.events;
  const count = (kind: LocalEvent['kind']) => events.filter(item => item.kind === kind).length;
  const durations = events.filter(item => item.kind === 'capture_completed' && item.durationMs !== undefined).map(item => item.durationMs!).sort((a, b) => a - b);
  const visits = events.filter(item => item.kind === 'visit').map(item => new Date(item.at).getTime()).sort((a, b) => a - b);
  const firstVisit = visits[0];
  const distinctVisitDays = new Set(events.filter(item => item.kind === 'visit').map(item => localLifeDay(new Date(item.at)))).size;
  return {
    capturesStarted: count('capture_started'), capturesCompleted: count('capture_completed'), capturesFailed: count('capture_failed'),
    mealsLogged: count('meal_logged'), corrections: count('meal_corrected'), usualsUsed: count('usual_used'), guidanceUsed: count('guidance_used'),
    medianCaptureMs: durations.length ? (durations[Math.floor((durations.length - 1) / 2)] + durations[Math.floor(durations.length / 2)]) / 2 : null,
    p90CaptureMs: durations.length ? durations[Math.ceil(durations.length * 0.9) - 1] : null,
    timedCaptures: durations.length, distinctVisitDays,
    returnedInSecondWeek: firstVisit === undefined ? null : visits.some(at => at - firstVisit >= 7 * 86400000 && at - firstVisit < 14 * 86400000),
    comebacks: visits.filter((at, index) => index > 0 && at - visits[index - 1] >= 3 * 86400000).length,
  };
}
