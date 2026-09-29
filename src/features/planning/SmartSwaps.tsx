import { useState } from 'react';
import { ArrowRightLeft, ChevronRight } from 'lucide-react';
import { Modal } from '../../components';
import { Sources } from '../../AICards';
import type { PantryLot } from '../pantry/ledger';
import type { FoodPreferences } from '../preferences/contracts';
import { comparePantryPortions,eligibleSwapLots } from './smart-swaps';
import '../scanner/scanner.css';
import './planning.css';

export default function SmartSwaps({lots,preferences,onAsk}:{lots:PantryLot[];preferences:FoodPreferences;onAsk:(text:string)=>void}) {
  const [open,setOpen]=useState(false);
  const [fromId,setFromId]=useState('');
  const [toId,setToId]=useState('');
  const [fromQuantity,setFromQuantity]=useState('1');
  const [toQuantity,setToQuantity]=useState('1');
  const eligible=eligibleSwapLots(lots,preferences);
  const from=eligible.find(lot=>lot.id===fromId);
  const to=eligible.find(lot=>lot.id===toId);
  const comparison=from&&to ? comparePantryPortions(from,to,Number(fromQuantity),Number(toQuantity),preferences) : null;
  const labels={calories:'Calories',protein:'Protein',carbs:'Carbs',fat:'Fat'};
  function ask() {
    if(!comparison || !from || !to)return;
    const differences=Object.entries(comparison.difference).map(([key,value])=>`${value>=0?'+':''}${value} ${key==='calories'?'calories':`g ${key}`}`).join(', ');
    setOpen(false);
    onAsk(`Help me consider a food swap for my goals and saved preferences. I selected ${fromQuantity} labeled serving(s) of ${from.item.name} (one serving: ${from.item.serving}) versus ${toQuantity} labeled serving(s) of ${to.item.name} (one serving: ${to.item.serving}). Calculated difference for the replacement: ${differences}. These portions are user-selected, not necessarily equivalent. Do not assume the foods are interchangeable or verified allergen-safe, and do not log anything.`);
  }
  return <section className="nutrition-swaps">
    <div className="nutrition-section-heading"><h2>Smart swaps</h2><span>Your foods. Your portions.</span></div>
    <button className="fuel-swaps-entry" onClick={()=>setOpen(true)}><span className="fuel-swaps-icon"><ArrowRightLeft size={23}/></span><span><strong>Compare foods in your pantry</strong><small>{eligible.length>=2?'See how calories and macros change for the portions you choose.':'Add two foods with confirmed serving details to compare them here.'}</small></span><ChevronRight size={19}/></button>
    {open&&<Modal title="Compare your food options" onClose={()=>setOpen(false)}><div className="fuel-scanner fuel-smart-swaps">
      <p className="fuel-label-intro">Choose a food and a possible replacement. Compare the portions you would actually use.</p>
      {eligible.length<2?<div className="fuel-scan-status">There aren’t two ready-to-compare foods yet. Scan or review food labels in Chat, then check their serving sizes. Foods matching your saved exclusions are left out.</div>:<>
        <div className="fuel-swap-pickers">{([{side:'from',title:'Current food',id:fromId,setId:setFromId,quantity:fromQuantity,setQuantity:setFromQuantity,lot:from},{side:'to',title:'Possible replacement',id:toId,setId:setToId,quantity:toQuantity,setQuantity:setToQuantity,lot:to}] as const).map(input=><section key={input.side}>
          <label>{input.title}<select aria-label={input.title} value={input.id} onChange={event=>input.setId(event.target.value)}><option value="">Choose a saved food</option>{eligible.filter(lot=>input.side==='from'?lot.id!==toId:lot.id!==fromId).map(lot=><option key={lot.id} value={lot.id}>{lot.item.name} · {lot.store}</option>)}</select></label>
          {input.lot&&<><p><strong>One serving:</strong> {input.lot.item.serving}</p><label>Servings to compare<input aria-label={`${input.title} servings`} type="number" min="0.01" max="1000" step="any" value={input.quantity} onChange={event=>input.setQuantity(event.target.value)}/></label><small>Saved nutrition is per this labeled serving.</small><Sources sources={input.lot.item.sources}/>{input.lot.item.productSnapshot&&<small>Record {input.lot.item.productSnapshot.source.id} · {input.lot.item.productSnapshot.source.provider==='usda'?'USDA':'Your label'} · original values per {input.lot.item.productSnapshot.basis==='serving'?'serving':input.lot.item.productSnapshot.basis}</small>}</>}
        </section>)}</div>
        {from&&to&&!comparison&&<p role="alert" className="fuel-scan-error">Enter a positive serving amount up to 1,000 for each food.</p>}
        {comparison&&<>
          <div className="fuel-swap-table-wrap"><table className="fuel-swap-table"><caption>Approximate nutrition for your selected portions</caption><thead><tr><th scope="col">Nutrient</th><th scope="col">Current</th><th scope="col">Replacement</th><th scope="col">Change</th></tr></thead><tbody>{(['calories','protein','carbs','fat'] as const).map(key=><tr key={key}><th scope="row">{labels[key]}</th><td>{comparison.from[key]}{key==='calories'?'':'g'}</td><td>{comparison.to[key]}{key==='calories'?'':'g'}</td><td>{comparison.difference[key]>0?'+':''}{comparison.difference[key]}{key==='calories'?'':'g'}</td></tr>)}</tbody></table></div>
          <p className="fuel-scan-footnote">Change means replacement minus current. Portions may differ in size or use; this is a comparison, not a claim that one food is healthier.</p>
          {comparison.notes.length>0&&<ul className="fuel-swap-notes">{comparison.notes.map(note=><li key={note}>{note}</li>)}</ul>}
          <button className="fuel-label-save" onClick={ask}>Discuss this swap in Chat</button>
        </>}
      </>}
      <p className="fuel-scan-footnote">This uses your saved nutrition estimates and changes no meals or pantry amounts. Ingredient checks do not verify allergen handling.</p>
    </div></Modal>}
  </section>;
}
