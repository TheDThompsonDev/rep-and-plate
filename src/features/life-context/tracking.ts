import type { AppState } from '../../domain';
import { recordLocalEvent } from './model';

/** Called only at explicit user writes, never while restoring or syncing records. */
export function trackMealTransition(before: AppState, after: AppState, actionId: string, source: 'web' | 'native', at = new Date().toISOString()): AppState {
  if (before === after || !after.lifeContext?.research.enabled) return after;
  const saved = after.meals.filter(meal => !meal.example && !before.meals.some(old => old.id === meal.id));
  const corrected = after.meals.some(meal => {
    const old = before.meals.find(item => item.id === meal.id);
    return old && JSON.stringify(old) !== JSON.stringify(meal);
  });
  let next = after;
  for (const meal of saved) {
    next = recordLocalEvent(next, { id: actionId + ":" + meal.id, kind: "meal_logged", at, source });
    if (meal.source === "Repeated saved meal") next = recordLocalEvent(next, { id: actionId + ":" + meal.id, kind: "usual_used", at, source });
  }
  if (corrected) next = recordLocalEvent(next, { id: actionId, kind: 'meal_corrected', at, source });
  return next;
}
