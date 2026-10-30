import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {readStoredState,type AppState,type StoredStateResult} from '../domain';
import {persistBrowserRecords} from './browser-records';

/** The passive mount write gives a fresh device its first durable snapshot and
 * moves a legacy localStorage mirror into IndexedDB. It must never replace a
 * snapshot that could not be read: that blob stays in place, with its copy
 * already queued, for a version of the app that can open it. */
export function persistOpenedRecords(opened:StoredStateResult,state:AppState){
 if(opened.status==='unreadable')return Promise.resolve();
 return persistBrowserRecords(state);
}
/** Journal at the action boundary, not a later passive effect: a refresh after
 * clicking Save must not outrun persistence. Functional edits compose against
 * the latest accepted state without side effects inside React updater calls. */
export function useBrowserRecords(onError:()=>void){
 const [opened]=useState(readStoredState);
 const [state,publish]=useState<AppState>(opened.state);
 const current=useRef(state),failure=useRef(onError);failure.current=onError;
 const setState=useCallback((action:SetStateAction<AppState>)=>{
  const next=typeof action==='function'?action(current.current):action;
  if(next===current.current)return;
  current.current=next;
  void persistBrowserRecords(next).catch(()=>failure.current());
  publish(next);
 },[]);
 useEffect(()=>{void persistOpenedRecords(opened,current.current).catch(()=>failure.current());},[opened]);
 return [state,setState,current] as const;
}
