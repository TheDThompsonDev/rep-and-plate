import { personalMeals, today, type AppState } from '../../domain';
import { dailyPreferencesSchema, type DailyPreferences } from './contracts';

export type FamiliarMeal = {
  meal: AppState['meals'][number];
  occurrences: number;
  pinned: boolean;
};
export type DailyAction = {
  key: string;
  kind: 'workout' | 'review' | 'meal' | 'decide';
  title: string;
  detail: string;
  label: string;
  mealId?: string;
};

export function dailyPreferences(state: AppState): DailyPreferences {
  const parsed = dailyPreferencesSchema.safeParse(state.dailyPreferences);
  return parsed.success ? parsed.data : { usualMealIds: [] };
}

function identity(meal: AppState['meals'][number]) {
  return `${meal.category}:${meal.title.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

export function familiarMeals(state: AppState, day = today()): FamiliarMeal[] {
  const pins = dailyPreferences(state).usualMealIds;
  const real = personalMeals(state.meals).filter(meal => meal.day <= day);
  const groups = new Map<string, FamiliarMeal>();
  // Keep a whole saved snapshot; matching titles never merge nutrition or portions.
  const newest = [...real].sort((a, b) => `${b.day} ${b.time ?? ''}`.localeCompare(`${a.day} ${a.time ?? ''}`));
  for (const meal of newest) {
    const key = identity(meal);
    const existing = groups.get(key);
    if (existing) existing.occurrences += 1;
    else groups.set(key, { meal, occurrences: 1, pinned: false });
  }
  // A pin identifies the chosen version, even if a newer similarly named meal exists.
  for (const mealId of pins) {
    const meal = real.find(item => item.id === mealId);
    if (!meal) continue;
    const key = identity(meal);
    const group = groups.get(key);
    if (group && !group.pinned) groups.set(key, { ...group, meal, pinned: true });
  }
  return [...groups.values()].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.pinned && b.pinned) return pins.indexOf(a.meal.id) - pins.indexOf(b.meal.id);
    return b.occurrences - a.occurrences || b.meal.day.localeCompare(a.meal.day);
  });
}

export function toggleUsualMeal(state: AppState, mealId: string): AppState {
  const real = personalMeals(state.meals);
  const meal = real.find(item => item.id === mealId);
  if (!meal) throw new Error('Choose a saved meal before making it a usual.');
  const preferences = dailyPreferences(state);
  const pinned = preferences.usualMealIds.includes(mealId);
  // Selecting a different version replaces the pin for that meal, rather than
  // hiding a second similarly named pin in the grouped shortcuts.
  const ids = preferences.usualMealIds.filter(id => {
    if (id === mealId) return false;
    const other = real.find(item => item.id === id);
    return other && (pinned || identity(other) !== identity(meal));
  });
  if (!pinned && ids.length >= 12) throw new Error('You can save 12 usual meals. Remove one before adding another.');
  return {
    ...state,
    dailyPreferences: {
      ...preferences,
      usualMealIds: pinned ? ids : [...ids, mealId],
    },
  };
}

export function dismissDailyAction(state: AppState, key: string, day = today()): AppState {
  return {
    ...state,
    dailyPreferences: {
      ...dailyPreferences(state),
      dismissedAction: { day, key },
    },
  };
}

export function selectDailyAction(state: AppState, day = today()): DailyAction | null {
  let action: DailyAction;
  const pending = state.reviews.filter(item => !item.resolved).length;
  const loggedToday = new Set(personalMeals(state.meals).filter(meal => meal.day === day).map(identity));
  const familiar = familiarMeals(state, day).find(item => (item.pinned || item.occurrences > 1) && !loggedToday.has(identity(item.meal)));
  if (state.workout.status === 'active') {
    action = { key: 'resume-workout', kind: 'workout', title: 'Your workout is ready to resume.', detail: 'Pick up from your saved sets.', label: 'Resume workout' };
  } else if (pending) {
    action = { key: 'pending-reviews', kind: 'review', title: 'One quick Spot Check?', detail: `${pending} saved ${pending === 1 ? 'capture needs' : 'captures need'} your review.`, label: 'Review captures' };
  } else if (familiar) {
    action = { key: `usual:${familiar.meal.id}`, kind: 'meal', mealId: familiar.meal.id, title: `Having ${familiar.meal.title} again?`, detail: 'Start with your saved version and check the portion.', label: 'Review this meal' };
  } else {
    action = { key: 'decide-next-meal', kind: 'decide', title: 'What sounds good for your next meal?', detail: 'Find an option that fits your time and what you have.', label: 'Help me decide' };
  }
  const dismissed = dailyPreferences(state).dismissedAction;
  return dismissed?.day === day && dismissed.key === action.key ? null : action;
}
