import type { AgentScope } from './contracts';

export const coachingConnectionScopes: AgentScope[] = ['nutrition:read', 'pantry:read', 'preferences:read', 'workouts:read', 'activities:read', 'coaching:read', 'coaching:write'];

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
