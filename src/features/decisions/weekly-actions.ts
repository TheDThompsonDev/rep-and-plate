import { personalMeals, type AppState } from '../../domain';

export type WeeklyFoodAction = {
  kind: 'repeat-meal';
  label: string;
  mealId: string;
};
export type WeeklyActionInsight = {
  tone: 'protein';
  title: string;
  description: string;
  detail: string;
  evidence: string;
  action: WeeklyFoodAction;
};

const canonical = (text: string) => text.toLowerCase().trim().replace(/\s+/g, ' ');
const decimal = (value: number) => Math.round(value * 10) / 10;

/** Describe exact saved records. Missing logs never become evidence of behavior. */
export function weeklyActionInsights(state: Pick<AppState, 'meals' | 'profile'>, end: string): WeeklyActionInsight[] {
  const date = new Date(`${end}T12:00:00`);
  if (!Number.isFinite(date.getTime())) return [];
  date.setDate(date.getDate() - 6);
  const start = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const meals = personalMeals(state.meals).filter(meal => meal.day >= start && meal.day <= end &&
    meal.title.trim() && Number.isFinite(meal.protein) && Number.isFinite(meal.calories) && meal.calories > 0);
  if (!meals.length) return [];
  const evidence = `${start} to ${end} · ${meals.length} saved meals · sample records excluded`;
  const groups = new Map<string, typeof meals>();
  for (const meal of meals) {
    // Equal titles alone do not establish equal portions or nutrition.
    const key = [canonical(meal.title), meal.category, meal.calories, meal.protein, meal.carbs, meal.fat].join('|');
    groups.set(key, [...(groups.get(key) ?? []), meal]);
  }
  const repeated = [...groups.values()].filter(group => new Set(group.map(meal => meal.day)).size >= 2)
    .sort((a, b) => new Set(b.map(meal => meal.day)).size - new Set(a.map(meal => meal.day)).size ||
      b.at(-1)!.day.localeCompare(a.at(-1)!.day));
  if (repeated.length) {
    const group = repeated[0];
    const meal = [...group].sort((a, b) => b.day.localeCompare(a.day)).at(0)!;
    const days = new Set(group.map(item => item.day)).size;
    return [{
      tone: 'protein',
      title: 'A familiar meal you can reuse.',
      description: `${meal.title} appears on ${days} different days with the same recorded nutrition totals.`,
      detail: `These saved entries have matching titles, meal categories and recorded nutrition. They are a useful starting point, not proof that every preparation was identical. Review the portion and any changes before repeating. Unlogged meals and days remain unknown.\n\n${group.map(item => `${item.day}: ${item.title} · ${item.calories} cal · ${item.protein}g protein`).join('\n')}`,
      evidence,
      action: { kind: 'repeat-meal', label: 'Review and repeat this meal', mealId: meal.id },
    }];
  }
  if (!state.profile.targetsConfigured || state.profile.protein <= 0) return [];
  const comparisons: { higher: typeof meals[number]; lower: typeof meals[number]; difference: number }[] = [];
  for (const higher of meals) for (const lower of meals) {
    if (higher.id === lower.id || higher.day === lower.day || higher.category !== lower.category ||
      higher.category === 'Snack' || canonical(higher.title) === canonical(lower.title)) continue;
    const difference = decimal(higher.protein - lower.protein);
    if (difference >= 10) comparisons.push({ higher, lower, difference });
  }
  const pair = comparisons.sort((a, b) => b.difference - a.difference || b.higher.day.localeCompare(a.higher.day))[0];
  if (!pair) return [];
  return [{
    tone: 'protein',
    title: 'An option for your saved protein goal.',
    description: `${pair.higher.title} has ${pair.difference}g more recorded protein than ${pair.lower.title}, for the portions you saved.`,
    detail: `This compares two ${pair.higher.category.toLowerCase()} records on different days. Portions and other nutrients differ; this is an optional choice, not a claim that one meal caused a result or that either day was complete. Estimated nutrition remains approximate.\n\n${pair.lower.day}: ${pair.lower.title} · ${pair.lower.calories} cal · ${pair.lower.protein}g protein\n${pair.higher.day}: ${pair.higher.title} · ${pair.higher.calories} cal · ${pair.higher.protein}g protein`,
    evidence,
    action: { kind: 'repeat-meal', label: 'Review this option for next time', mealId: pair.higher.id },
  }];
}
