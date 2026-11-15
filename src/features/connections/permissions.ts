import type { AgentScope } from './contracts';

export const coachingConnectionScopes: AgentScope[] = ['nutrition:read', 'pantry:read', 'preferences:read', 'workouts:read', 'activities:read', 'coaching:read', 'coaching:write'];

/**
 * What a new connection can do unless the person changes it: everything a coach needs.
 * The old default left coaching off. Its owner's first real Claude chat then got four basic tools
 * and a bare list of records: no plan, no check-in, no next step, nothing of Spot.
 */
export const defaultConnectionScopes: AgentScope[] = [...coachingConnectionScopes, 'meals:propose'];

export function toggleConnectionScope(scopes: AgentScope[], scope: AgentScope, enabled: boolean): AgentScope[] {
  const selected = new Set(scopes);
  if (enabled) {
    selected.add(scope);
    if (scope === 'coaching:write') selected.add('coaching:read');
  } else {
    selected.delete(scope);
    if (scope === 'coaching:read') selected.delete('coaching:write');
  }
  return [...selected];
}

/** What each permission means, in the words the Connections screen and the sign-in consent page both use. */
export const connectionAccess: { scope: AgentScope; title: string; detail: string }[] = [
  { scope: 'nutrition:read', title: 'Nutrition & goals', detail: 'Seven days of recorded totals and your daily targets.' },
  { scope: 'pantry:read', title: 'Pantry', detail: 'Available ingredients, serving sizes, and quantities.' },
  { scope: 'preferences:read', title: 'Food preferences', detail: 'Restrictions, favorites, household size, and cooking needs.' },
  { scope: 'workouts:read', title: 'Workout history', detail: 'Your ten most recent completed sessions.' },
  { scope: 'activities:read', title: 'Recorded activities', detail: 'Recorded activity dates, durations and your notes. Missing activity stays unknown.' },
  { scope: 'coaching:read', title: 'Coaching plan & memory', detail: 'Your agreed plan, priorities, feedback, explicit memories and decision history.' },
  { scope: 'coaching:write', title: 'Change your coaching plan', detail: 'Prepare plan changes and save records from your other apps, each only after you say yes in your assistant. Includes feedback and memory changes.' },
  { scope: 'meals:propose', title: 'Suggest meal records', detail: 'Send estimates for you to review before logging.' },
];
