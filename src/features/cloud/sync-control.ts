let generation=0, paused=false;
const listeners=new Set<()=>void>();
export const cloudEpoch=()=>generation;
export const cloudPaused=()=>paused;
export function invalidateCloudSync(){generation++;for(const fn of listeners)fn();}
export function pauseCloudSync(){paused=true;invalidateCloudSync();}
export function resumeCloudSync(){paused=false;invalidateCloudSync();}
export function onAccountChange(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
