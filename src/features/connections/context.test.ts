import { describe, expect, it } from 'vitest';
import { initialState, stateSchema } from '../../domain';
import { agentReviewConflicts, buildAgentContext, resolveAgentMeal } from './context';
import { agentMealSchema, agentContextSchema, type AgentAction } from './contracts';

const action: AgentAction = {
  id: '86aa94e4-70f5-4db8-b173-15d099869d48', connectionId: '86aa94e4-70f5-4db8-b173-15d099869d49',
  connectionName: 'My assistant', requestId: '86aa94e4-70f5-4db8-b173-15d099869d40',
  createdAt: '2026-09-29T12:00:00Z', expiresAt: '2026-10-06T12:00:00Z', resolvedAt: null, status: 'pending',
  meal: { title: 'Chili', day: '2026-09-29', time: '12:30', category: 'Lunch', portion: '1 bowl', calories: 450, protein: 30, carbs: 40, fat: 19, note: 'Estimated from ingredients.' },
};
const now = '2026-09-29T13:00:00Z';
describe('agent context and reviewed actions', () => {
  it('distinguishes chosen targets from defaults while accepting legacy context without metadata',()=>{
    const state=initialState();
    const fresh=buildAgentContext(state,'2026-09-29','America/Chicago');
    expect(fresh.nutrition.goalsConfigured).toBe(false);
    state.profile.targetsConfigured=true;
    expect(buildAgentContext(state,'2026-09-29','America/Chicago').nutrition.goalsConfigured).toBe(true);
    const {goalsConfigured:_configured,...legacyNutrition}=fresh.nutrition;
    expect(agentContextSchema.safeParse({...fresh,nutrition:legacyNutrition}).success).toBe(true);
    expect(Object.keys(fresh.nutrition).sort()).toEqual(['days','goals','goalsConfigured']);
  });
  it('only projects allowed record fields, leaving chat and media private', () => {
    const state = initialState();
    state.messages.push({ id: 'private', role: 'user', text: 'PRIVATE MESSAGE', image: 'data:image/png;base64,PRIVATE', time: '12:30' });
    state.profile.name = 'PRIVATE NAME';
    state.workout.routines=[{id:'private-routine',name:'PRIVATE ROUTINE',exercises:[{name:'Press',target:8,setCount:3}]}];
    state.workout.restUntil=1890000000000;
    state.activities=[{id:'walk',title:'PRIVATE WALK',day:'2026-09-29',minutes:20,note:'PRIVATE NOTE'}];
    const context = buildAgentContext(state, '2026-09-29', 'America/Chicago');
    expect(context.nutrition.days.at(-1)).toEqual({ day: '2026-09-29', meals: 0, totals: { calories: 0, protein: 0, carbs: 0, fat: 0 } });
    expect(context.workouts).toEqual([]);
    expect(JSON.stringify(context)).not.toContain('PRIVATE');
  });
  it('saves one reviewed meal and a durable receipt that survives undo', () => {
    const saved = resolveAgentMeal(initialState(), action, 'accepted', now);
    expect(saved.meals).toHaveLength(1);
    expect(saved.meals[0]).toMatchObject({ calories: 450, source: 'Agent · My assistant', day: '2026-09-29' });
    expect(saved.agentResolutions).toHaveLength(1);
    expect(resolveAgentMeal(saved, action, 'accepted', now)).toBe(saved);
    const undone = stateSchema.parse({ ...saved, meals: [] });
    expect(resolveAgentMeal(undone, action, 'accepted', now).meals).toHaveLength(0);
  });
  it('dismissal creates no intake and remains final on retry', () => {
    const saved = resolveAgentMeal(initialState(), action, 'dismissed', now);
    expect(saved.meals).toHaveLength(0);
    expect(() => resolveAgentMeal(saved, action, 'accepted', now)).toThrow(/already/i);
  });
  it('rejects revoked and expired proposals and malformed dates or invented fields', () => {
    expect(() => resolveAgentMeal(initialState(), { ...action, status: 'revoked' }, 'accepted', now)).toThrow();
    expect(() => resolveAgentMeal(initialState(), action, 'accepted', '2026-11-01T12:00:00Z')).toThrow();
    expect(agentMealSchema.safeParse({ ...action.meal, day: '2026-02-30' }).success).toBe(false);
    expect(agentMealSchema.safeParse({ ...action.meal, userId: 'somebody' }).success).toBe(false);
  });
  it('retains a visible conflict if a locally saved review meets a different terminal server outcome', () => {
    const saved = resolveAgentMeal(initialState(), action, 'accepted', now);
    expect(agentReviewConflicts(saved, [action])).toEqual([]);
    expect(agentReviewConflicts(saved, [{ ...action, status: 'accepted' }])).toEqual([]);
    expect(agentReviewConflicts(saved, [{ ...action, status: 'revoked' }])).toHaveLength(1);
    expect(saved.meals).toHaveLength(1);
  });
  it('projects actual per-set loads rather than the original exercise target', () => {
    const state = initialState();
    state.workout.history = [{ title: 'Training', startedAt: now, finishedAt: now, exercises: [{ name: 'Press', weight: 100, target: 8, previous: [], sets: [8, null, 6], setWeights: [105, null, 110] }] }];
    expect(buildAgentContext(state, '2026-09-29', 'America/Chicago').workouts[0].exercises[0].sets).toEqual([{ reps: 8, weight: 105 }, { reps: 6, weight: 110 }]);
  });
  it('includes the latest finished session before another workout archives it and deduplicates history',()=>{
    const state=initialState();
    state.workout={...state.workout,status:'finished',title:'Latest',startedAt:now,finishedAt:now,exercises:[{name:'Press',weight:45,target:8,previous:[],sets:[8],setWeights:[50]}]};
    expect(buildAgentContext(state,'2026-09-29','America/Chicago').workouts).toHaveLength(1);
    state.workout.history=[{...state.workout,title:'Latest'}];
    const context=buildAgentContext(state,'2026-09-29','America/Chicago');
    expect(context.workouts).toHaveLength(1);
    expect(context.workouts[0].exercises[0].sets).toEqual([{reps:8,weight:50}]);
  });
});
