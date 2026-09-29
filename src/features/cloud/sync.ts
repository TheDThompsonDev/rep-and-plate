import {initialState,stateSchema,type AppState} from '../../domain';
export type Checkpoint={state:AppState;revision:number};
export type SyncStatus='device'|'checking'|'saving'|'saved'|'offline'|'conflict'|'waiting'|'paused';
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>(value as Record<string,unknown>)[key]!==undefined).map(key=>[key,canonical((value as Record<string,unknown>)[key])]));
 return value;
}
const same=(a:unknown,b:unknown)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const stockKeys=['meals','groceries','pantryEvents','recipeBatches','mealPlans'] as const;
/** Consumption and stock form a single transaction. Never merge concurrent
 * inventory edits into a quantity neither device actually reviewed. */
export function mergeRecords(base:AppState,local:AppState,remote:AppState):AppState|null {
 const stock=(v:AppState)=>stockKeys.map(k=>v[k]);
 if(!same(stock(base),stock(local))&&!same(stock(base),stock(remote))&&!same(stock(local),stock(remote)))return null;
 const conflict=Symbol('conflict');
 function merge(b:any,l:any,r:any):any {
  if(same(l,r)||same(b,r))return l;
  if(same(b,l))return r;
  if(b&&l&&r&&typeof b==='object'&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(b)&&!Array.isArray(l)&&!Array.isArray(r)){
   const result:Record<string,unknown>={};
   for(const key of new Set([...Object.keys(b),...Object.keys(l),...Object.keys(r)])){
    const value=merge(b[key],l[key],r[key]);if(value===conflict)return conflict;if(value!==undefined)result[key]=value;
   }return result;
  }return conflict;
 }
 const value=merge(base,local,remote);if(value===conflict)return null;
 const parsed=stateSchema.safeParse(value);return parsed.success?parsed.data:null;
}
export type SyncAdapter={
 local:()=>AppState;replace:(value:AppState)=>Promise<void>;
 read:()=>Promise<Checkpoint|null>;write:(value:AppState,revision:number)=>Promise<number>;
 baseline:()=>Checkpoint|null;checkpoint:(value:Checkpoint)=>Promise<void>;
 empty:()=>boolean;active:()=>boolean;
 archive?:(value:AppState,source:'device'|'cloud')=>Promise<void>;
};
export class SyncEngine {
 status:SyncStatus='checking';error='';private running=false;
 constructor(private io:SyncAdapter){}
 async tick(choice?:'device'|'cloud'){
  if(this.running||!this.io.active())return;
  if(this.status==='conflict'&&!choice)return;
  if(this.io.local().messages.some(m=>m.aiStatus==='pending')){this.status='waiting';return;}
  this.running=true;this.status='checking';this.error='';
  try{
   const initial=this.io.local();const remote=await this.io.read();
   if(!this.io.active())return;
   const local=this.io.local();const base=this.io.baseline();
   if(local.messages.some(m=>m.aiStatus==='pending')){this.status='waiting';return;}
   let next=local;
   if(choice==='cloud'&&!remote){this.status='conflict';this.error='The account copy was removed. Export this device before deciding whether to upload it again.';return;}
   if(remote){
    if(choice){await this.io.archive?.(local,'device');await this.io.archive?.(remote.state,'cloud');if(!this.io.active())return;next=choice==='cloud'?remote.state:local;}
    else if(same(local,remote.state))next=local;
    else if(base){const merged=mergeRecords(base.state,local,remote.state);if(!merged){this.status='conflict';return;}next=merged;}
    else if(this.io.empty()&&same(initial,local))next=remote.state;
    else{this.status='conflict';return;}
   }else if(base&&!choice){
    // A cloud copy was removed. Do not resurrect it from a stale device.
    this.status='conflict';return;
   }
   if(!same(next,local)){
    if(!same(this.io.local(),local)){this.status='waiting';return;}
    await this.io.replace(next);if(!this.io.active())return;
   }
   let revision=remote?.revision??0;
   if(!remote||!same(next,remote.state)){
    this.status='saving';revision=await this.io.write(next,revision);if(!this.io.active())return;
   }
   await this.io.checkpoint({state:next,revision});if(!this.io.active())return;
   this.status=same(this.io.local(),next)?'saved':'waiting';
  }catch(e){this.status='offline';this.error=e instanceof Error?e.message:'Saving is unavailable. Your changes remain on this device.';}
  finally{this.running=false;}
 }
}
export function isFreshDevice(state:AppState){
 const fresh=initialState();
 const ignore=new Set(['messages','spot','chatRevision']);
 return Object.keys(state).every(key=>ignore.has(key)||same(state[key as keyof AppState],fresh[key as keyof AppState]))
  &&!state.messages.some(m=>m.id!=='welcome');
}
export const syncLabels:Record<SyncStatus,string>={device:'Saved on this device',checking:'Checking your saved records…',saving:'Saving to your account…',saved:'Saved to your account',offline:'Saved here · account sync needs attention',conflict:'Two copies need your review',waiting:'Saved here · waiting to sync',paused:'Account sync paused'};
