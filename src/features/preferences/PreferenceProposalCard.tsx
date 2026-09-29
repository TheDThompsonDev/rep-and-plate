import { Check, SlidersHorizontal, X } from 'lucide-react';
import type { FoodPreferences } from './contracts';
import { applyPreferenceProposal,preferenceFieldLabels,preferenceValueText,type PreferenceProposal,type PreferenceProposalStatus } from './proposals';
import './preferences.css';

export default function PreferenceProposalCard({proposal,status,onAccept,onDismiss,current}:{proposal:PreferenceProposal;status:PreferenceProposalStatus;onAccept:()=>void;onDismiss:()=>void;current?:FoodPreferences}) {
  let after:FoodPreferences|undefined;
  let error='';
  if(current && status==='pending') {
    try {after=applyPreferenceProposal(current,proposal);}
    catch(cause) {error=cause instanceof Error?cause.message:'These preferences need a check before saving.';}
  }
  const changes=[...new Set(proposal.changes.map(change=>change.field))];
  return <section className="fuel-preference-proposal" aria-label="Review preference changes">
    <span className="fuel-preference-eyebrow"><SlidersHorizontal size={15}/>Your preferences</span>
    <h3>{status==='accepted'?'Preferences saved':status==='dismissed'?'Left your preferences as they were':'Remember this for next time?'}</h3>
    <p>{proposal.description}</p>
    <blockquote><small>From your message</small>{proposal.evidence}</blockquote>
    <ul className="fuel-preference-changes">{proposal.changes.map((change,index)=><li key={`${change.field}-${index}`} className={change.field==='restrictions'&&change.operation==='remove'?'fuel-preference-removal':''}>
      <strong>{change.field==='restrictions'&&change.operation==='remove'?'Remove food exclusion':`${change.operation==='add'?'Add to':change.operation==='remove'?'Remove from':'Set'} ${preferenceFieldLabels[change.field].toLowerCase()}`}</strong>
      <span>{change.field==='cookingMinutes'?`${change.value} minutes`:change.field==='budget'?preferenceValueText('budget',change.value):change.value}</span>
    </li>)}</ul>
    {current&&after&&<details className="fuel-preference-preview"><summary>Review before and after</summary>{changes.map(field=><div key={field}><strong>{preferenceFieldLabels[field]}</strong><span>Now: {preferenceValueText(field,current[field])}</span><span>After saving: {preferenceValueText(field,after[field])}</span></div>)}</details>}
    {error&&<p className="fuel-preference-error" role="alert">{error}</p>}
    {status==='pending'?<><div className="fuel-preference-buttons"><button onClick={onAccept} disabled={!!error}><Check size={15}/>Save these preferences</button><button onClick={onDismiss}><X size={15}/>Not now</button></div><small className="fuel-preference-footnote">Nothing changes until you save. You can review or forget preferences in You.</small></>:<p className="fuel-preference-status">{status==='accepted'?<Check size={15}/>:<X size={15}/>} {status==='accepted'?'Saved with your approval.':'Not saved.'}</p>}
  </section>;
}
