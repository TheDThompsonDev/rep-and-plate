import {it,expect} from 'vitest';
import {initialState,stateSchema} from '../../domain';
import {isFreshDevice,mergeRecords,SyncEngine} from './sync';
import {prepareSnapshot,snapshotSummary} from './client';
it('preserves activity-only data in backup and refuses a silent first-sync replacement',async()=>{
 const state={...initialState(),activities:[{id:'walk',title:'Walk',day:'2026-09-20',minutes:20,note:''}]};
 expect(isFreshDevice(state)).toBe(false);
 expect(prepareSnapshot(state).activities).toEqual(state.activities);
 expect(snapshotSummary(state).activities).toBe(1);
 let local=state;let writes=0;
 const engine=new SyncEngine({local:()=>local,replace:async s=>{local=s as typeof state},read:async()=>({state:initialState(),revision:1}),write:async()=>{writes++;return 2},baseline:()=>null,checkpoint:async()=>{},empty:()=>isFreshDevice(local),active:()=>true});
 await engine.tick();
 expect(engine.status).toBe('conflict');expect(writes).toBe(0);expect(local.activities).toEqual(state.activities);
});
it('recognizes schema-normalized empty records but protects custom targets and body data',()=>{
 expect(isFreshDevice(stateSchema.parse(initialState()))).toBe(true);
 const changed=initialState();changed.profile.calories=2300;expect(isFreshDevice(changed)).toBe(false);
});
it('merges independent settings without losing either device edit',()=>{
 const b=initialState(); const a={...b,profile:{...b.profile,name:'A'}};const c={...b,profile:{...b.profile,protein:150}};
 expect(mergeRecords(b,a,c)?.profile).toMatchObject({name:'A',protein:150});
});
it('pauses competing pantry/consumption edits instead of overspending stock',()=>{
 const b=initialState(); const a={...b,groceries:[]}; const c={...b,pantryEvents:[]};
 expect(mergeRecords(b,a,c)).toBeNull();
});
it('restores a fresh device then saves edits with the retrieved revision',async()=>{
 const b=initialState();const remote={...b,profile:{...b.profile,name:'Cloud'}};
 let local=b;let writes=0;let base:any=null;
 const engine=new SyncEngine({local:()=>local,replace:async s=>{local=s},read:async()=>({state:remote,revision:7}),write:async(_s,r)=>{expect(r).toBe(7);writes++;return 8},checkpoint:async v=>{base=v},baseline:()=>base,empty:()=>true,active:()=>true});
 await engine.tick();expect(local.profile.name).toBe('Cloud');expect(writes).toBe(0);
 local={...local,profile:{...local.profile,protein:160}};await engine.tick();expect(writes).toBe(1);
});
it('does not overwrite existing first-sync records or a new edit while downloading',async()=>{
 let local=initialState();local.profile.name='Local'; const cloud={...initialState(),profile:{...initialState().profile,name:'Remote'}};
 let writes=0;const engine=new SyncEngine({local:()=>local,replace:async s=>{local=s},read:async()=>({state:cloud,revision:2}),write:async()=>{writes++;return 3},checkpoint:async()=>{},baseline:()=>null,empty:()=>false,active:()=>true});
 await engine.tick();expect(engine.status).toBe('conflict');expect(local.profile.name).toBe('Local');expect(writes).toBe(0);
});
it('stops applying remote records after sign-out',async()=>{
 let active=true;let local=initialState(); const engine=new SyncEngine({local:()=>local,replace:async s=>{local=s},read:async()=>{active=false;return {state:{...local,profile:{...local.profile,name:'Foreign'}},revision:3}},write:async()=>4,checkpoint:async()=>{},baseline:()=>null,empty:()=>true,active:()=>active});
 await engine.tick();expect(local.profile.name).not.toBe('Foreign');
});
