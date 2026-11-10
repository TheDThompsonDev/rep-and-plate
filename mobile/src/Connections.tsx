import {useEffect,useState} from 'react';
import {AppState,Switch,Text,View} from 'react-native';
import {fetch as expoFetch} from 'expo/fetch';
import {Button,Card,Choice,Field,Sheet,s} from './ui';
import {useLoadedHealth} from './store';
import {cloudClient,getConnection} from './api';
import {requireDeviceOwner,sessionSignal} from './auth';
import {cloudEpoch,cloudPaused} from '../../src/features/cloud/sync-control';
import {useConnections,type ConnectionsPlatform} from '../../src/features/connections/useConnections';
import type {AgentScope} from '../../src/features/connections/contracts';
import {coachingConnectionScopes,toggleConnectionScope} from '../../src/features/connections/permissions';
import {connectionLifetimes,defaultLifetimeDays,expiryNotice,setupGuides} from '../../src/features/connections/setup';

const access:{scope:AgentScope;label:string;detail:string}[]=[
  {scope:'nutrition:read',label:'Nutrition summaries',detail:'Seven days of totals and your nutrition goals.'},
  {scope:'pantry:read',label:'Pantry',detail:'Available ingredients and remaining servings.'},
  {scope:'preferences:read',label:'Food preferences',detail:'Restrictions, favorites, dislikes, and cooking preferences.'},
  {scope:'workouts:read',label:'Completed workouts',detail:'Your most recent completed workouts.'},
  {scope:'activities:read',label:'Recorded activities',detail:'Activity dates, durations and your recorded notes.'},
  {scope:'coaching:read',label:'Coaching plan and memory',detail:'Your agreed plan, priorities, feedback and decision history.'},
  {scope:'coaching:write',label:'Change your coaching plan',detail:'Prepare plan changes and save records from your other apps, each only after you say yes in your assistant. Requires coaching read access.'},
  {scope:'meals:propose',label:'Propose meal logs',detail:'Send meals here for your review before anything is logged.'},
];
export const nativeConnections:ConnectionsPlatform={
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
  const h=useLoadedHealth();
  const open=h.tool==='agents';
  const c=useConnections(h.state,h.applyAgentAction,nativeConnections,open);
  const [name,setName]=useState('');
  const [scopes,setScopes]=useState<AgentScope[]>(['meals:propose']);
  const [days,setDays]=useState(String(defaultLifetimeDays));
  const [guideName,setGuideName]=useState('Claude Code');
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
  if(!open)return null;
  const awaiting=c.overview.actions.filter(action=>action.status==='pending'&&h.state.agentResolutions?.some(receipt=>receipt.actionId===action.id));
  const pending=c.overview.actions.filter(action=>action.status==='pending'&&!h.state.agentResolutions?.some(receipt=>receipt.actionId===action.id));
  const outcomes=c.overview.actions.filter(action=>action.status!=='pending');
  const disabled=c.busy||h.busy;
  const guides=c.credential&&c.session?setupGuides(c.session.url,c.credential.token):[];
  const guide=guides.find(item=>item.name===guideName)??guides[0];
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
        <Button label="Use daily coaching permissions" secondary onPress={()=>setScopes([...coachingConnectionScopes])}/>
        {access.map(item=><View key={item.scope} style={s.between}>
          <View style={s.grow}><Text style={s.h3}>{item.label}</Text><Text style={s.muted}>{item.detail}</Text></View>
          <Switch accessibilityLabel={item.label} value={scopes.includes(item.scope)} disabled={disabled}
            onValueChange={enabled=>setScopes(previous=>toggleConnectionScope(previous,item.scope,enabled))}/>
        </View>)}
        <Text style={s.h3}>Keep this connection working for</Text>
        <Choice values={connectionLifetimes.map(option=>String(option.days))} value={days} onChange={setDays} labels={Object.fromEntries(connectionLifetimes.map(option=>[String(option.days),option.label]))}/>
        <Text style={s.muted}>You can keep it going or disconnect at any time.</Text>
        <Button label="Create connection" disabled={disabled||!name.trim()||!scopes.length} onPress={()=>void c.create(name,scopes,Number(days))}/>
      </Card>
      {c.credential&&<Card mint>
        <Text accessibilityRole="header" style={s.h2}>Save your access token</Text>
        <Text style={s.text}>This token appears only now and works until {new Date(c.credential.connection.expiresAt).toLocaleDateString()}. Closing this screen hides it. You can keep it going from this screen later without setting anything up again.</Text>
        <Text style={s.h3}>Endpoint</Text>
        <Text selectable style={s.text}>{c.session.url}/api/agents/v1</Text>
        <Text style={s.h3}>Remote MCP endpoint</Text>
        <Text selectable style={s.text}>{c.session.url}/api/agents/mcp</Text>
        <Text style={s.muted}>Set the connector request header Authorization to Bearer followed by the access token below.</Text>
        <Text style={s.h3}>Access token</Text>
        <Text selectable style={s.text}>{c.credential.token}</Text>
        {guide&&<>
          <Text accessibilityRole="header" style={s.h3}>Set up your assistant</Text>
          <Choice values={guides.map(item=>item.name)} value={guide.name} onChange={setGuideName}/>
          <Text style={s.muted}>{guide.status==='limited'?'Limited · ':guide.status==='unavailable'?'Not available yet · ':''}{guide.summary}</Text>
          {guide.steps.map((step,index)=><View key={`${guide.id}-${index}`}>
            <Text style={s.text}>{index+1}. {step.text}</Text>
            {!!step.copy&&<Text selectable style={s.muted}>{step.copy}</Text>}
          </View>)}
          <Text style={s.muted}>Most assistants run on a computer, so send yourself these steps or open Rep & Plate there. Press and hold any line to copy it.</Text>
        </>}
        <Text style={s.muted}>Keep the token out of chats and shared files. You never need to share your password.</Text>
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
        const receipt=h.state.agentResolutions?.find(item=>item.actionId===action.id);
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
        const notice=expiryNotice(connection.expiresAt,now);
        const active=!connection.revokedAt&&notice.state!=='expired';
        const renewable=!connection.revokedAt&&notice.renewable&&notice.state!=='active';
        return <Card key={connection.id}>
          <Text style={s.h3}>{connection.name}</Text>
          <Text style={s.muted}>{connection.scopes.map(scope=>access.find(item=>item.scope===scope)?.label).join(' · ')}</Text>
          <Text style={s.muted}>{connection.revokedAt?'Disconnected':active?`${notice.label} · until ${new Date(connection.expiresAt).toLocaleDateString()}`:notice.label}</Text>
          {renewable&&<Text style={s.muted}>Keeping it adds {defaultLifetimeDays} days to the same token, so your assistant keeps working without being set up again.</Text>}
          {renewable&&<Button label={`Keep ${connection.name} connected`} disabled={disabled} onPress={()=>void c.renew(connection.id)}/>}
          {active&&<Button label={`Disconnect ${connection.name}`} secondary disabled={disabled} onPress={()=>void c.revoke(connection.id)}/>}
        </Card>;
      })}
      <Text style={s.tiny}>Your agent receives the saved account revision and its update time with each context request.</Text>
    </>}
  </Sheet>;
}
