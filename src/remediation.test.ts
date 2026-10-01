import { describe, expect, it } from 'vitest';
import { initialState, repeatMeal, stateSchema, today, type Message } from './domain';
import { addActivity, resolveActivityProposal } from './activities';
import { applyAIResult } from './ai-client';
import { resultFixture } from '../tests/ai-fixtures';
import { spotWeek } from './features/spot/model';
import * as workouts from './workouts';
import { setWorkoutLoad } from './features/progress/set-loads';
import { buildAIRequest } from './ai-client';

describe('persona audit regressions', () => {
  it('explains an unchosen load when spoken reps cannot be recorded',()=>{
    const session=workouts.startPlan(initialState().workout,'upper');
    const next=workouts.replyToWorkout(session,'Got 7');
    expect(next.exercises[0].sets[0]).toBeNull();
    expect(next.conversation?.at(-1)?.text).toContain('Choose the load');
  });
  it('starts without an invented working load or prior performance', () => {
    const session = workouts.startPlan(initialState().workout, 'upper');
    expect(session.exercises.every(e => e.weight === 0 && e.previous.length === 0)).toBe(true);
    expect(workouts.recordSet(session, 0, 0, 8).exercises[0].sets[0]).toBeNull();
    const chosen = setWorkoutLoad(session, 0, 0, 45);
    expect(workouts.recordSet(chosen, 0, 0, 8).exercises[0].setWeights?.[0]).toBe(45);
  });
  it('carries a selected diary day without changing the meaning of today', () => {
    const state = initialState();
    const message: Message = {id:crypto.randomUUID(),role:'user',text:'I ate breakfast',time:'now'};
    const request = buildAIRequest(state, message, '2026-09-20');
    expect(request.captureDay).toBe('2026-09-20');
    expect(request.day).toBe(today());
  });
  it('reopens a finished session in place without adding duplicate history', () => {
    const session = workouts.startPlan(initialState().workout, 'upper');
    const done = {...workouts.recordSet(setWorkoutLoad(session,0,0,45),0,0,8),status:'finished' as const,finishedAt:new Date().toISOString()};
    const reopened = workouts.reopenWorkout(done);
    expect(reopened.status).toBe('active');
    expect(reopened.startedAt).toBe(done.startedAt);
    expect(reopened.exercises[0].sets[0]).toBe(8);
    expect(reopened.history).toEqual(done.history);
    expect(stateSchema.parse({...initialState(),workout:reopened}).workout.exercises[0].setWeights?.[0]).toBe(45);
  });
  it('preserves per-set loads, effort and conversation references when changing exercise order',()=>{
    const session=workouts.startPlan(initialState().workout,'upper');
    const logged=workouts.recordSet(setWorkoutLoad(session,0,0,45),0,0,8);
    logged.exercises[0].setEffort=[7.5,null,null];
    const moved=workouts.moveWorkoutExercise(logged,0,2);
    expect(moved.exercises[2]).toMatchObject({name:'Bench Press',sets:[8,null,null],setWeights:[45,null,null],setEffort:[7.5,null,null]});
    expect(moved.conversation?.every(message=>message.exerciseIndex===2)).toBe(true);
    expect(stateSchema.parse({...initialState(),workout:moved}).workout.exercises[2].setEffort?.[0]).toBe(7.5);
  });
  it('moves a historical correction into the editor without dropping the current finished session',()=>{
    const old={title:'Earlier',exercises:[],startedAt:'2026-09-20T12:00:00Z',finishedAt:'2026-09-20T12:30:00Z'};
    const latest={...initialState().workout,status:'finished' as const,title:'Latest',startedAt:'2026-09-21T12:00:00Z',finishedAt:'2026-09-21T12:30:00Z',history:[old]};
    const reopened=workouts.reopenHistoryWorkout(latest,0);
    expect(reopened.title).toBe('Earlier');
    expect(reopened.startedAt).toBe(old.startedAt);
    expect(reopened.history?.map(session=>session.title)).toEqual(['Latest']);
    const reloaded=stateSchema.parse({...initialState(),workout:reopened});
    const corrected=workouts.finishWorkout(reloaded.workout,'2026-09-30T12:00:00Z');
    expect(corrected.finishedAt).toBe(old.finishedAt);
    expect(corrected.originalFinishedAt).toBeUndefined();
    const next=workouts.startPlan(corrected,'upper');
    expect(next.history?.find(session=>session.title==='Earlier')?.finishedAt).toBe(old.finishedAt);
    expect(next.originalFinishedAt).toBeUndefined();
    expect(()=>workouts.reopenHistoryWorkout({...latest,status:'active'},0)).toThrow(/Finish the current/);
  });
  it('converts kg only at the boundary and keeps precision for stored loads',()=>{
    expect(workouts.displayLoad(workouts.storedLoad(80,'kg'),'kg')).toBe(80);
    expect(workouts.displayLoad(185,'lb')).toBe(185);
    expect(()=>workouts.storedLoad(-1,'kg')).toThrow();
    expect(()=>workouts.storedLoad(1000,'kg')).toThrow();
    expect(()=>workouts.storedLoad(NaN,'lb')).toThrow();
  });
  it('weekly strength volume uses performed set loads rather than an unconfirmed starter load',()=>{
    const state=initialState();
    state.workout={...state.workout,title:'Upper Body',status:'finished',startedAt:'2026-09-20T12:00:00Z',finishedAt:'2026-09-20T12:30:00Z',exercises:[{name:'Bench Press',weight:0,weightConfirmed:false,target:8,previous:[],sets:[8,null,6],setWeights:[45,null,50]}]};
    expect(spotWeek(state,'2026-09-20').volume).toBe(45*8+50*6);
  });
  it('repeats nutrition without replaying stock or prepared-batch deductions',()=>{
    const state=initialState();
    state.meals=[{id:'old',title:'Oats',day:'2026-09-20',time:'8 AM',source:'Prepared batch',note:'',category:'Breakfast',confidence:'confirmed',calories:215,protein:18.3,carbs:33,fat:0.4,recipeBatchId:'batch1',recipePortions:1,components:[{id:'c1',lotId:'lot1',name:'Oats',servings:1,servingLabel:'1 cup',nutrition:{calories:215,protein:18.3,carbs:33,fat:0.4},sourceUrls:[]}]}];
    const repeated=repeatMeal(state,'old');
    expect(repeated.meals).toHaveLength(2);
    expect(repeated.meals[1]).toMatchObject({protein:18.3,fat:0.4,day:today()});
    expect(repeated.meals[1].id).not.toBe('old');
    expect(repeated.meals[1].recipeBatchId).toBeUndefined();
    expect(repeated.meals[1].components?.[0].lotId).toBeUndefined();
    expect(repeated.recipeBatches).toBe(state.recipeBatches);
    expect(repeated.pantryEvents).toBe(state.pantryEvents);
    expect(stateSchema.safeParse(repeated).success).toBe(true);
  });
  it('saves a reviewed walk exactly once without changing meal totals or targets',()=>{
    const state=initialState();
    const id=crypto.randomUUID();
    state.messages.push({id,role:'user',text:'I walked for 20 minutes',time:'now'});
    const proposal={title:'Walk',minutes:20,day:today(),note:''};
    const response={...resultFixture(id),receipt:null,meal:null,decision:'conversation' as const,activity:proposal};
    const pending=applyAIResult(state,response);
    expect(pending.activities).toBeUndefined();
    const accepted=resolveActivityProposal(pending,`answer-${id}`,true);
    expect(accepted.activities).toHaveLength(1);
    expect(accepted.activities?.[0]).toMatchObject(proposal);
    expect(resolveActivityProposal(accepted,`answer-${id}`,true)).toBe(accepted);
    expect(accepted.profile).toBe(state.profile);
    expect(accepted.meals).toBe(state.meals);
    expect(stateSchema.parse(accepted).activities?.[0].minutes).toBe(20);
    expect(()=>addActivity(state,{...proposal,day:'2026-02-31'})).toThrow();
    expect(()=>addActivity(state,{...proposal,minutes:0})).toThrow();
    expect(resolveActivityProposal(pending,`answer-${id}`,false).activities).toBeUndefined();
  });
});
