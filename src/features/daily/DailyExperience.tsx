import { useId, useState } from 'react';
import type { AppState } from '../../domain';
import { dismissDailyAction, familiarMeals, selectDailyAction, toggleUsualMeal, type FamiliarMeal } from './model';
import './daily.css';

export type DailyExperienceProps = {
  state: AppState;
  onChange: (next: AppState) => void;
  onRepeatMeal: (mealId: string) => void;
  onResumeWorkout: () => void;
  onDecide: () => void;
  onReview: (messageId?: string) => void;
  onCapture: () => void;
};

export default function DailyExperience({
  state, onChange, onRepeatMeal, onResumeWorkout, onDecide, onReview, onCapture,
}: DailyExperienceProps) {
  const titleId = useId();
  const usualsId = useId();
  const [notice, setNotice] = useState('');
  const action = selectDailyAction(state);
  const meals = familiarMeals(state);
  const savedCount = meals.filter(item => item.pinned).length;
  const pin = (id: string) => {
    try {
      onChange(toggleUsualMeal(state, id));
      setNotice('');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That usual meal could not be saved.');
    }
  };
  const runAction = () => {
    if (!action) return;
    if (action.kind === 'workout') onResumeWorkout();
    else if (action.kind === 'review') onReview();
    else if (action.kind === 'meal' && action.mealId) onRepeatMeal(action.mealId);
    else onDecide();
  };
  const mealRow = ({ meal, pinned, occurrences }: FamiliarMeal) => (
    <li className="daily-meal-row" key={meal.id}>
      <button className="daily-meal-review" onClick={() => onRepeatMeal(meal.id)} aria-label={`Review ${meal.title} to log again`}>
        {meal.image && <img src={meal.image} alt="" loading="lazy" />}
        <span>
          <strong>{meal.title}</strong>
          <small>{meal.confidence === 'estimated' ? '~' : ''}{meal.calories.toLocaleString()} cal · {meal.protein}g protein</small>
          <span className="daily-meal-origin">{pinned ? 'Your saved usual' : occurrences > 1 ? `Logged ${occurrences} times` : 'Recently logged'}{meal.confidence === 'estimated' ? ' · Estimated' : ''}</span>
        </span>
        <span className="daily-meal-arrow" aria-hidden="true">→</span>
      </button>
      <button className={`daily-pin${pinned ? ' is-pinned' : ''}`} onClick={() => pin(meal.id)} aria-pressed={pinned} aria-label={pinned ? `Remove ${meal.title} from usual meals` : `Save ${meal.title} as a usual meal`}>
        {pinned ? 'Saved as usual' : 'Make my usual'}
      </button>
    </li>
  );

  if (!action && !meals.length) return null;
  return (
    <section className="daily-experience" aria-label="Your next step and familiar meals">
      {action && <section className="daily-next-action" data-testid="daily-next-action" aria-labelledby={titleId}>
        <span className="daily-eyebrow">A LITTLE LESS TO FIGURE OUT</span>
        <h2 id={titleId}>{action.title}</h2>
        <p>{action.detail}</p>
        <div className="daily-action-buttons">
          <button className="daily-primary" onClick={runAction}>{action.label}<span aria-hidden="true">→</span></button>
          <button className="daily-dismiss" onClick={() => onChange(dismissDailyAction(state, action.key))} aria-label="Dismiss this suggestion for today">Not today</button>
        </div>
      </section>}
      {meals.length > 0 && <section className="daily-familiar" data-testid="daily-familiar-meals" aria-labelledby={usualsId}>
        <div className="daily-familiar-heading"><h2 id={usualsId}>Your familiar meals</h2><span>{savedCount ? `${savedCount} saved usual${savedCount === 1 ? '' : 's'}` : 'A familiar place to start'}</span></div>
        <p className="daily-familiar-help">Start with a saved meal. Check the portion before logging.</p>
        <ul className="daily-meal-list">{meals.slice(0, 3).map(mealRow)}</ul>
        {meals.length > 3 && <details className="daily-more"><summary>More familiar meals</summary><ul className="daily-meal-list">{meals.slice(3, 15).map(mealRow)}</ul></details>}
        <button className="daily-different" onClick={onCapture}>Having something different? Tell Spot.</button>
      </section>}
      {notice && <p className="daily-notice" role="status">{notice}</p>}
    </section>
  );
}
