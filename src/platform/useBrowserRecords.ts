import {useCallback,useEffect,useRef,useState,type SetStateAction} from 'react';
import {readState,type AppState} from '../domain';
import {persistBrowserRecords} from './browser-records';

/** Journal at the action boundary, not a later passive effect: a refresh after
 * clicking Save must not outrun persistence. Functional edits compose against
 * the latest accepted state without side effects inside React updater calls. */
export function useBrowserRecords(onError:()=>void){
 const [state,publish]=useState<AppState>(readState);
 const current=useRef(state),failure=useRef(onError);failure.current=onError;
 const setState=useCallback((action:SetStateAction<AppState>)=>{
  const next=typeof action==='function'?action(current.current):action;
  if(next===current.current)return;
  current.current=next;
  void persistBrowserRecords(next).catch(()=>failure.current());
  publish(next);
 },[]);
 useEffect(()=>{void persistBrowserRecords(current.current).catch(()=>failure.current());},[]);
 return [state,setState,current] as const;
}
