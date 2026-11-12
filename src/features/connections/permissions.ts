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
