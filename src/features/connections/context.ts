import { personalMeals, sumNutrition, type AppState } from '../../domain';
import { getPantryLots } from '../pantry/ledger';
import { agentActionSchema, agentContextSchema, daySchema, type AgentAction, type AgentContext } from './contracts';

const short = (value: string) => value.slice(0, 300);
/** Explicit projection: never serialize raw AppState, captures, messages, or profile names. */
export function buildAgentContext(state: AppState, day: string, timezone: string): AgentContext {
  daySchema.parse(day);
  const anchor = new Date(`${day}T12:00:00Z`);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(anchor); date.setUTCDate(date.getUTCDate() - 6 + index);
    const key = date.toISOString().slice(0, 10);
    return { day: key, meals: personalMeals(state.meals, key).length, totals: sumNutrition(state.meals, key) };
  });
  const lots = getPantryLots(state).filter(lot => lot.item.availability === 'available' && (lot.remaining === null || lot.remaining !== 0));
  const prefs = state.preferences;
  const preferences = prefs ? [
    ...prefs.restrictions.map(v => `Restriction: ${v}`),
    ...prefs.dislikes.map(v => `Dislikes: ${v}`),
    ...prefs.favorites.map(v => `Favorite: ${v}`),
    `Household size: ${prefs.householdSize}`,
    ...(prefs.cookingMinutes ? [`Cooking time: ${prefs.cookingMinutes} minutes`] : []),
    ...prefs.equipment.map(v => `Equipment: ${v}`),
  ] : [];
  const sessions = [...(state.workout.history ?? []),...(state.workout.status === 'finished' ? [{...state.workout,title:state.workout.title ?? 'Workout'}] : [])];
  const history = [...new Map(sessions.filter(w => w.finishedAt).map(w=>[`${w.startedAt}:${w.title}`,w])).values()].sort((a,b)=>b.finishedAt!.localeCompare(a.finishedAt!));
  const { calories, protein, carbs, fat } = state.profile;
  return agentContextSchema.parse({
    day, timezone,
    nutrition: { days, goals: { calories, protein, carbs, fat }, goalsConfigured: !!state.profile.targetsConfigured },
    pantry: lots.slice(0, 200).map(lot => ({ id: short(lot.id), name: short(lot.item.name), remainingServings: lot.inconsistent ? null : lot.remaining, serving: short(lot.item.serving), needsReview: lot.item.needsReview || lot.inconsistent })),
    preferences: preferences.slice(0, 60).map(short),
    workouts: history.slice(0, 10).map(w => ({ title: short(w.title), finishedAt: w.finishedAt!, exercises: w.exercises.slice(0, 50).map(e => ({ name: short(e.name), weightUnit: 'lb', sets: e.sets.flatMap((reps, index) => reps === null ? [] : [{ reps, weight: e.setWeights?.[index] ?? e.weight }]).slice(0, 100) })) })),
    truncated: [...(lots.length > 200 ? ['pantry'] : []), ...(preferences.length > 60 ? ['preferences'] : []), ...(history.length > 10 || history.some(w => w.exercises.length > 50 || w.exercises.some(e => e.sets.length > 100)) ? ['workouts'] : [])],
  });
}

/** The receipt is kept independently of the meal so undo + acknowledgment retry cannot resurrect it. */
export function resolveAgentMeal(state: AppState, raw: AgentAction, status: 'accepted' | 'dismissed', now = new Date().toISOString()): AppState {
  const action = agentActionSchema.parse(raw);
  const receipt = state.agentResolutions?.find(r => r.actionId === action.id);
  if (receipt) {
    if (receipt.status !== status) throw Error('This proposal was already reviewed.');
    return state;
  }
  if (action.status !== 'pending' || Date.parse(action.expiresAt) <= Date.parse(now)) throw Error('This proposal is no longer available. Refresh your connections.');
  const mealId = `agent-meal:${action.id}`;
  const { portion, ...meal } = action.meal;
  return {
    ...state,
    meals: status === 'accepted' && !state.meals.some(m => m.id === mealId) ? [...state.meals, {
      ...meal, id: mealId, source: `Agent · ${action.connectionName}`, confidence: 'estimated',
      note: `${portion}. ${meal.note}\nProposed by ${action.connectionName}; logged by you. Nutrition is an estimate. Pantry quantities have not been changed.`,
    }] : state.meals,
    agentResolutions: [...(state.agentResolutions ?? []), { actionId: action.id, status, resolvedAt: now }],
  };
}

export function agentReviewConflicts(state: AppState, actions: AgentAction[]) {
  return actions.filter(action => {
    const receipt = state.agentResolutions?.find(r => r.actionId === action.id);
    return receipt && action.status !== 'pending' && receipt.status !== action.status;
  });
}
