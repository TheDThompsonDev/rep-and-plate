import {describe,it,expect} from 'vitest';
import {initialState,stateSchema} from './domain';
import * as workouts from './workouts';
import {setWorkoutLoad} from './features/progress/set-loads';
import {completedWorkoutHistory,completedWorkoutContext} from './features/workout-planning/history';

describe('round two workout records and reuse',()=>{
 it('keeps the full diary available while AI context remains bounded',()=>{
  const w=initialState().workout;
  w.history=Array.from({length:13},(_,i)=>({title:'Recorded day',startedAt:`2026-09-${String(i+1).padStart(2,'0')}T12:00:00Z`,finishedAt:`2026-09-${String(i+1).padStart(2,'0')}T13:00:00Z`,exercises:[{name:'Press',weight:100,target:8,sets:[8],previous:[]}]}));
  expect(completedWorkoutHistory(w)).toHaveLength(13);
  expect(completedWorkoutContext(w)).toHaveLength(5);
  w.history[0].exercises=Array.from({length:9},(_,i)=>({name:`Exercise ${i+1}`,weight:100,target:8,sets:Array(12).fill(8),previous:[]}));
  const oldest=completedWorkoutHistory(w).at(-1)!;
  expect(oldest.exercises).toHaveLength(9);
  expect(oldest.exercises[0].sets).toHaveLength(12);
 });
 it('uses selected units for recorded and corrected conversational sets',()=>{
  let w=workouts.startPlan(initialState().workout,'upper');
  w=setWorkoutLoad(w,0,0,workouts.storedLoad(80,'kg'));
  w=workouts.recordSet(w,0,0,8,undefined,'kg');
  expect(w.conversation?.at(-1)?.text).toContain('80 kg × 8');
  w=workouts.replyToWorkout(w,'Set 1 was 7','kg');
  expect(w.conversation?.at(-1)?.text).toContain('80 kg × 7');
  expect(w.exercises[0].setWeights?.[0]).toBe(workouts.storedLoad(80,'kg'));
 });
 it('persists rest end time and clears it on finish',()=>{
  const s=initialState();s.workout=workouts.startPlan(s.workout,'upper');
  s.workout=workouts.startWorkoutRest(s.workout,120,1000);
  const restored=stateSchema.parse(JSON.parse(JSON.stringify(s)));
  expect(restored.workout.restUntil).toBe(121000);
  expect(workouts.finishWorkout(restored.workout).restUntil).toBeNull();
  expect(()=>workouts.startWorkoutRest(s.workout,-1)).toThrow();
 });
 it('saves a personal lineup and repeats fresh sets without assuming performed loads',()=>{
  let w=workouts.startPlan(initialState().workout,'upper');
  w=workouts.adjustWorkoutExercise(w,0,{name:'Personal press',weight:100,target:6,setCount:2});
  w=workouts.moveWorkoutExercise(w,0,1);
  w=workouts.recordSet(w,1,0,6);
  w=workouts.saveWorkoutRoutine(w,'My custom day');
  const routine=w.routines![0];
  expect(routine.exercises[1]).toMatchObject({name:'Personal press',setCount:2,target:6});
  expect(()=>workouts.startWorkoutRoutine(w,routine.id)).toThrow(/Finish/);
  w=workouts.finishWorkout(w,'2026-09-30T12:00:00Z');
  w=workouts.startWorkoutRoutine(w,routine.id);
  expect(w.title).toBe('My custom day');
  expect(w.exercises[1]).toMatchObject({name:'Personal press',sets:[null,null],weightConfirmed:false});
  expect(w.exercises[1].setWeights).toEqual([null,null]);
  expect(w.history?.[0].exercises[1].sets).toEqual([6,null]);
  expect(w.routines).toHaveLength(1);
  const parsed=stateSchema.parse({...initialState(),workout:w});
  expect(parsed.workout.routines).toEqual(w.routines);
 });
 it('preserves saved routines when starting a starter or reopening older history',()=>{
  let w=workouts.saveWorkoutRoutine(workouts.startPlan(initialState().workout,'upper'),'Reusable');
  w=workouts.finishWorkout(w);
  w=workouts.startPlan(w,'lower');
  expect(w.routines).toHaveLength(1);
  w=workouts.finishWorkout(w);
  w=workouts.reopenHistoryWorkout(w,0);
  expect(w.routines).toHaveLength(1);
  expect(workouts.deleteWorkoutRoutine(w,w.routines![0].id).routines).toHaveLength(0);
 });
 it('applies a chosen load only to remaining sets without changing prior actuals',()=>{
  let w=workouts.startPlan(initialState().workout,'upper');
  w=setWorkoutLoad(w,0,0,100);w=workouts.recordSet(w,0,0,8);
  w=workouts.applyLoadToRemainingSets(w,0,0,110);
  expect(w.exercises[0].sets).toEqual([8,null,null]);
  expect(w.exercises[0].setWeights).toEqual([100,110,110]);
  expect(()=>workouts.applyLoadToRemainingSets(w,0,1,Infinity)).toThrow();
 });
});
