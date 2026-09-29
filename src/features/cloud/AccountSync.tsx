import type {AppState} from '../../domain';
import {getCloudClient,requireBrowserOwner,exportDevice} from './client';
import {useAccountSync,type SyncPlatform} from './useAccountSync';
import {syncLabels} from './sync';
import './sync.css';
import {browserGet,browserSet} from '../../platform/browser-records';
const platform:SyncPlatform={
 account:async()=>{const client=await getCloudClient();if(!client)return null;const s=await client.auth.getSession();if(!s.data.session)return null;const session=await requireBrowserOwner(client);return {client,user:session.user.id,identity:localStorage.getItem('health.records.owner')!};},
 get:browserGet,set:browserSet,
};
export default function AccountSync({state,onRestore}:{state:AppState;onRestore:(state:AppState)=>Promise<void>}){
 const sync=useAccountSync(state,onRestore,platform);
 if(sync.status==='device')return null;
 return <aside className="account-sync" aria-label="Account save status"><span role="status">{syncLabels[sync.status]}</span>
 {sync.status==='offline'||sync.status==='paused'?<><p>{sync.error}</p><button onClick={sync.retry}>Retry account saving</button></>:null}
 {sync.status==='conflict'&&<><p>Both copies are safe. Export this device before choosing which copy to continue with. Changes to the same meals or pantry need your review.</p>{sync.error&&<p role="alert">{sync.error}</p>}<button onClick={()=>exportDevice(state)}>Export this device</button><button onClick={()=>void sync.resolve('cloud')}>Use account copy</button><button onClick={()=>void sync.resolve('device')}>Keep this device’s copy</button></>}
 </aside>;
}
