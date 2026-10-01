import {useEffect,useState} from 'react';
import {AppState,Switch,Text,View} from 'react-native';
import {fetch as expoFetch} from 'expo/fetch';
import {Button,Card,Field,Sheet,s} from './ui';
import {useHealth} from './store';
import {cloudClient,getConnection} from './api';
import {requireDeviceOwner,sessionSignal} from './auth';
import {cloudEpoch,cloudPaused} from '../../src/features/cloud/sync-control';
import {useConnections,type ConnectionsPlatform} from '../../src/features/connections/useConnections';
import type {AgentScope} from '../../src/features/connections/contracts';

const access:{scope:AgentScope;label:string;detail:string}[]=[
  {scope:'nutrition:read',label:'Nutrition summaries',detail:'Seven days of totals and your nutrition goals.'},
  {scope:'pantry:read',label:'Pantry',detail:'Available ingredients and remaining servings.'},
  {scope:'preferences:read',label:'Food preferences',detail:'Restrictions, favorites, dislikes, and cooking preferences.'},
  {scope:'workouts:read',label:'Completed workouts',detail:'Your most recent completed workouts.'},
  {scope:'meals:propose',label:'Propose meal logs',detail:'Send meals here for your review before anything is logged.'},
];
const platform:ConnectionsPlatform={
  foreground:()=>AppState.currentState==='active',
  async session(){
    if(cloudPaused())throw Error('Reconnect your account before opening Connections.');
    const selected=await getConnection();
    if(!selected)throw Error('Set your hosted server address in You → Connection, then sign in under Cloud & your records.');
    if(selected.token)throw Error('Agent connections on mobile require a hosted account. The local development bridge does not support this yet. Manage local agents from the web app, or connect this phone to your hosted server.');
    const client=await cloudClient();
    const user=await requireDeviceOwner(client);
    const signal=sessionSignal(),epoch=cloudEpoch();
    const active=()=>!signal.aborted&&epoch===cloudEpoch()&&!cloudPaused();
    return {
      identity:`${selected.url}:${user.user.id}`,mode:'account',url:selected.url,active,
      async request(body){
        if(!active())throw Error('Your account changed. Reopen Connections.');
        const current=await getConnection();
        const latest=await requireDeviceOwner(client);
        if(!active()||latest.user.id!==user.user.id||current?.url!==selected.url||current.token)throw Error('Your connection changed. Reopen Connections.');
        const response=await expoFetch(`${selected.url}/api/agents/manage`,{
          method:'POST',headers:{Authorization:`Bearer ${latest.access_token}`,'Content-Type':'application/json','X-RP-Client':'web'},
          body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(20000)]),redirect:'error',
        });
        const value=await response.json();
        if(!active())throw Error('Your account changed. Reopen Connections.');
        if(!response.ok)throw Error(typeof value?.error==='string'?value.error:value?.error?.message??'Connections could not reach your account. Please retry.');
        return value;
      },
    };
  },
};

/** Mounted with the app so approved connections can refresh while the sheet is closed. */
export function Connections(){
  const h=useHealth();
  const open=h.tool==='agents';
  const c=useConnections(h.state!,h.applyAgentAction,platform,open);
  const [name,setName]=useState('');
  const [scopes,setScopes]=useState<AgentScope[]>(['meals:propose']);
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
  if(!open)return null;
  const awaiting=c.overview.actions.filter(action=>action.status==='pending'&&h.state!.agentResolutions?.some(receipt=>receipt.actionId===action.id));
  const pending=c.overview.actions.filter(action=>action.status==='pending'&&!h.state!.agentResolutions?.some(receipt=>receipt.actionId===action.id));
  const outcomes=c.overview.actions.filter(action=>action.status!=='pending');
  const disabled=c.busy||h.busy;
  return <Sheet title="Agent connections" onClose={()=>h.setTool(null)}>
    <Text style={s.text}>Use your preferred agent with Rep & Plate. Choose what each connection can read and review meal logs here.</Text>
    <Text style={s.muted}>Photos, chat messages, and your account password are never shared through these tools. Agents read your latest records saved to your account. Changes waiting to sync may not appear yet.</Text>
    {c.loading&&<Text accessibilityLiveRegion="polite" style={s.muted}>Refreshing connections…</Text>}
    {!!c.error&&<Text accessibilityRole="alert" style={s.text}>{c.error}</Text>}
    <Button label="Refresh connections" secondary disabled={c.busy} onPress={()=>void c.refresh()}/>
    {c.session&&<>
      <Card>
        <Text accessibilityRole="header" style={s.h2}>Connect an agent</Text>
        <Field label="Connection name" placeholder="My assistant" value={name} onChangeText={setName} maxLength={80}/>
        {access.map(item=><View key={item.scope} style={s.between}>
          <View style={s.grow}><Text style={s.h3}>{item.label}</Text><Text style={s.muted}>{item.detail}</Text></View>
          <Switch accessibilityLabel={item.label} value={scopes.includes(item.scope)} disabled={disabled}
            onValueChange={enabled=>setScopes(previous=>enabled?[...previous,item.scope]:previous.filter(scope=>scope!==item.scope))}/>
        </View>)}
        <Text style={s.muted}>Access expires in 30 days. You can disconnect earlier at any time.</Text>
        <Button label="Create connection" disabled={disabled||!name.trim()||!scopes.length} onPress={()=>void c.create(name,scopes)}/>
      </Card>
      {c.credential&&<Card mint>
        <Text accessibilityRole="header" style={s.h2}>Save your access token</Text>
        <Text style={s.text}>This token appears only now. Select and copy it into your agent’s secure connection settings. Closing this screen hides it.</Text>
        <Text style={s.h3}>Endpoint</Text>
        <Text selectable style={s.text}>{c.session.url}/api/agents/v1</Text>
        <Text style={s.h3}>Access token</Text>
        <Text selectable style={s.text}>{c.credential.token}</Text>
        <Text style={s.muted}>For the CLI, set REP_PLATE_URL to {c.session.url} and REP_PLATE_TOKEN to this token. Keep the token out of chats and shared files. You never need to share your password.</Text>
        <Button label="I saved the token" secondary onPress={c.clearCredential}/>
      </Card>}
      <Text accessibilityRole="header" style={s.h2}>Meals to review · {pending.length}</Text>
      <Text style={s.muted}>Log only food you actually ate. Nutrition is an estimate. Logging does not change pantry quantities.</Text>
      {!pending.length&&<Text style={s.muted}>Proposals from your connected agents will appear here.</Text>}
      {awaiting.map(action=><Card key={action.id}><Text style={s.h3}>{action.meal.title}</Text><Text style={s.muted}>Your review is saved on this device. Refresh to send the outcome to {action.connectionName}.</Text></Card>)}
      {pending.map(action=><Card key={action.id}>
        <Text style={s.eyebrow}>{action.connectionName}</Text>
        <Text accessibilityRole="header" style={s.h3}>{action.meal.title}</Text>
        <Text style={s.text}>{action.meal.day} · {action.meal.time} · {action.meal.category}</Text>
        <Text style={s.text}>{action.meal.portion}</Text>
        <Text style={s.text}>{action.meal.calories} kcal · Protein {action.meal.protein} g · Carbs {action.meal.carbs} g · Fat {action.meal.fat} g</Text>
        {!!action.meal.note&&<Text style={s.muted}>{action.meal.note}</Text>}
        <Button label="Log this meal" disabled={disabled} onPress={()=>void c.resolve(action,'accepted')}/>
        <Button label="Dismiss proposal" secondary disabled={disabled} onPress={()=>void c.resolve(action,'dismissed')}/>
      </Card>)}
      <Text accessibilityRole="header" style={s.h2}>Recent outcomes</Text>
      {!outcomes.length&&<Text style={s.muted}>Completed proposal outcomes will appear here.</Text>}
      {outcomes.map(action=>{
        const receipt=h.state!.agentResolutions?.find(item=>item.actionId===action.id);
        const mismatch=receipt&&receipt.status!==action.status;
        return <Card key={action.id}>
          <Text style={s.eyebrow}>{action.connectionName}</Text>
          <Text style={s.h3}>{action.meal.title}</Text>
          <Text style={s.text}>Server outcome: {action.status}</Text>
          {receipt&&<Text style={s.muted}>Your saved review: {receipt.status}</Text>}
          {mismatch&&<Text accessibilityRole="alert" style={s.text}>These outcomes differ. Your meal records and saved review have been kept. Check the meal in Nutrition before making another change.</Text>}
        </Card>;
      })}
      <Text accessibilityRole="header" style={s.h2}>Your connections</Text>
      {!c.overview.connections.length&&<Text style={s.muted}>No agents connected yet.</Text>}
      {c.overview.connections.map(connection=>{
        const active=!connection.revokedAt&&Date.parse(connection.expiresAt)>now;
        return <Card key={connection.id}>
          <Text style={s.h3}>{connection.name}</Text>
          <Text style={s.muted}>{connection.scopes.map(scope=>access.find(item=>item.scope===scope)?.label).join(' · ')}</Text>
          <Text style={s.muted}>{connection.revokedAt?'Disconnected':active?`Expires ${new Date(connection.expiresAt).toLocaleDateString()}`:'Expired'}</Text>
          {active&&<Button label={`Disconnect ${connection.name}`} secondary disabled={disabled} onPress={()=>void c.revoke(connection.id)}/>}
        </Card>;
      })}
      <Text style={s.tiny}>Your agent receives the saved account revision and its update time with each context request.</Text>
    </>}
  </Sheet>;
}
