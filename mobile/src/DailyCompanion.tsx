import { useState } from 'react';
import { View, Text } from 'react-native';
import { Button, Card } from './ui';
import { useLoadedHealth } from './store';
import { ManualMeal } from './ManualMeal';
import type { AppState } from '../../src/domain';
import { dismissDailyAction, familiarMeals, selectDailyAction, toggleUsualMeal } from '../../src/features/daily/model';

export type NativeDailyExperienceProps = {
  onDecide: () => void;
  /** Open the existing portion-review draft; this callback must not log immediately. */
  onRepeatMeal?: (mealId: string) => void;
  onLifeContext?: () => void;
};

export function NativeDailyExperience({ onDecide, onRepeatMeal, onLifeContext }: NativeDailyExperienceProps) {
  const h = useLoadedHealth();
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [repeatSource, setRepeatSource] = useState<AppState['meals'][number] | null>(null);
  const action = selectDailyAction(h.state, h.day);
  const meals = familiarMeals(h.state, h.day);
  const visibleMeals = expanded ? meals.slice(0, 15) : meals.slice(0, 3);
  const reviewMeal = (mealId: string) => {
    if (onRepeatMeal) {
      onRepeatMeal(mealId);
      return;
    }
    const source = h.state.meals.find(meal => meal.id === mealId);
    if (source) setRepeatSource(source);
  };
  const pin = (mealId: string) => {
    try {
      const saved = h.change(state => toggleUsualMeal(state, mealId));
      setNotice(saved ? '' : 'Your usual meals could not be saved. Please try again.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That usual meal could not be saved.');
    }
  };
  const dismiss = () => {
    if (!action) return;
    const saved = h.change(state => dismissDailyAction(state, action.key, h.day));
    setNotice(saved ? '' : 'That suggestion could not be dismissed. Please try again.');
  };
  const runAction = () => {
    if (!action) return;
    if (action.kind === 'workout') h.setTab('Workouts');
    else if (action.kind === 'review') h.setTab('You');
    else if (action.kind === 'meal' && action.mealId) reviewMeal(action.mealId);
    else onDecide();
  };

  if (repeatSource) return <ManualMeal key={repeatSource.id} day={h.day} source={repeatSource} onClose={() => setRepeatSource(null)} onSaved={() => setRepeatSource(null)} />;
  if (!action && !meals.length && !onLifeContext) return null;
  return (
    <View style={{ gap: 12 }}>
      {action && <Card>
        <View style={{ gap: 10 }}>
          <Text style={{ color: '#47735e', fontSize: 10, letterSpacing: 1, fontWeight: '700' }}>A LITTLE LESS TO FIGURE OUT</Text>
          <Text accessibilityRole="header" style={{ color: '#163e33', fontSize: 21, lineHeight: 27, fontWeight: '700' }}>{action.title}</Text>
          <Text style={{ color: '#526b61', fontSize: 14, lineHeight: 21 }}>{action.detail}</Text>
          <Button label={action.label} onPress={runAction} disabled={h.busy} />
          <Button label="Not today" onPress={dismiss} secondary disabled={h.busy} />
        </View>
      </Card>}
      {meals.length > 0 && <Card>
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={{ color: '#163e33', fontSize: 18, fontWeight: '700' }}>Your familiar meals</Text>
          <Text style={{ color: '#60786d', fontSize: 13, lineHeight: 19 }}>Start with a saved meal. Check the portion before logging.</Text>
          {visibleMeals.map(({ meal, occurrences, pinned }) => <View key={meal.id} style={{ gap: 7, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e3ece5' }}>
            <Text style={{ color: '#163e33', fontSize: 15, fontWeight: '700' }}>{meal.title}</Text>
            <Text style={{ color: '#3f6654', fontSize: 13 }}>{meal.confidence === 'estimated' ? '~' : ''}{meal.calories.toLocaleString()} cal · {meal.protein}g protein</Text>
            <Text style={{ color: '#60786d', fontSize: 12 }}>{pinned ? 'Your saved usual' : occurrences > 1 ? `Logged ${occurrences} times` : 'Recently logged'}{meal.confidence === 'estimated' ? ' · Estimated' : ''}</Text>
            <Button label={`Review ${meal.title}`} onPress={() => reviewMeal(meal.id)} disabled={h.busy} />
            <Button label={pinned ? 'Remove from usual meals' : 'Make my usual'} onPress={() => pin(meal.id)} secondary disabled={h.busy} />
          </View>)}
          {meals.length > 3 && <Button label={expanded ? 'Show fewer meals' : 'More familiar meals'} onPress={() => setExpanded(value => !value)} secondary />}
          <Button label="Having something different? Tell Spot." onPress={() => h.tellSpot()} secondary disabled={h.busy} />
        </View>
      </Card>}
      {onLifeContext && <Button label="A different kind of week?" onPress={onLifeContext} secondary disabled={h.busy} />}
      {notice ? <Text accessibilityLiveRegion="polite" style={{ color: '#725028', fontSize: 13, lineHeight: 20 }}>{notice}</Text> : null}
    </View>
  );
}

export default NativeDailyExperience;
