import { useState } from 'react';
import { Modal } from '../../components';
import { defaultPreferences, preferencesSchema, type FoodPreferences } from './contracts';
import '../scanner/scanner.css';
import './preferences.css';

export default function PreferencesDialog({value,onSave,onClose}:{value?:FoodPreferences;onSave:(value:FoodPreferences)=>void;onClose:()=>void}) {
  const original = value ?? defaultPreferences();
  const [fields,setFields] = useState({restrictions:original.restrictions.join(', '),dislikes:original.dislikes.join(', '),favorites:original.favorites.join(', '),equipment:original.equipment.join(', ')});
  const [minutes,setMinutes] = useState(original.cookingMinutes?.toString() ?? '');
  const [household,setHousehold] = useState(String(original.householdSize));
  const [budget,setBudget] = useState(original.budget);
  const [priority,setPriority] = useState(original.shoppingPriority ?? 'balanced');
  const [weeklyBudget,setWeeklyBudget] = useState(original.weeklyBudget?.toString() ?? '');
  const [currency,setCurrency] = useState(original.shoppingCurrency ?? 'USD');
  const [stores,setStores] = useState(original.preferredStores?.join(', ') ?? '');
  const [brands,setBrands] = useState(original.brandFlexibility ?? 'open');
  const [workout,setWorkout] = useState(original.workoutPreferences);
  const [error,setError] = useState('');
  const split = (text:string) => [...new Set(text.split(',').map(item=>item.trim()).filter(Boolean))];
  return <Modal title="Food & routine preferences" onClose={onClose}><div className="fuel-scanner">
    <p className="fuel-label-intro">Start with food exclusions, then open only the sections that help you. Every section is optional; existing choices stay saved when a section is closed.</p>
    <form onSubmit={event=>{event.preventDefault(); const result=preferencesSchema.safeParse({shoppingPriority:priority,weeklyBudget:weeklyBudget?Number(weeklyBudget):null,shoppingCurrency:currency,preferredStores:split(stores),brandFlexibility:brands,restrictions:split(fields.restrictions),dislikes:split(fields.dislikes),favorites:split(fields.favorites),equipment:split(fields.equipment),cookingMinutes:minutes?Number(minutes):null,householdSize:Number(household),budget,workoutPreferences:workout,updatedAt:new Date().toISOString()}); if(!result.success){setError('Check your budget, currency, cooking time and household size. Keep each list to 30 items or fewer.');return;}onSave(result.data);}}>
      <fieldset className="fuel-label-fields"><legend>Food exclusions</legend>
        <label>Foods to exclude or dietary restrictions<input value={fields.restrictions} onChange={event=>setFields({...fields,restrictions:event.target.value})} placeholder="e.g. peanuts, vegetarian"/></label>
      </fieldset>
      <details className="fuel-preferences-section"><summary>Meals & cooking</summary><fieldset className="fuel-label-fields"><legend>Meals & cooking</legend>
        <label>Foods you dislike<input value={fields.dislikes} onChange={event=>setFields({...fields,dislikes:event.target.value})} placeholder="Separate with commas"/></label>
        <label>Favorite meals<input value={fields.favorites} onChange={event=>setFields({...fields,favorites:event.target.value})} placeholder="e.g. oatmeal, chicken bowls"/></label>
        <div className="fuel-label-pair"><label>Cooking time (minutes)<input type="number" min="5" max="240" value={minutes} placeholder="Not specified" onChange={event=>setMinutes(event.target.value)}/></label><label>People to cook for<input type="number" min="1" max="20" value={household} onChange={event=>setHousehold(event.target.value)}/></label></div>
        <label>Cooking equipment<input value={fields.equipment} onChange={event=>setFields({...fields,equipment:event.target.value})} placeholder="e.g. oven, microwave, blender"/></label>
      </fieldset></details>
      <details className="fuel-preferences-section"><summary>Shopping & budget</summary><fieldset className="fuel-label-fields"><legend>Shopping & budget</legend>
        <label>Budget preference<select value={budget} onChange={event=>setBudget(event.target.value as FoodPreferences['budget'])}><option value="unknown">Not specified</option><option value="economy">Keep costs down</option><option value="flexible">Flexible</option></select></label>
        <label>Shopping priority<select value={priority} onChange={e=>setPriority(e.target.value as typeof priority)}><option value="balanced">A little of everything</option><option value="budget">Saving money</option><option value="protein">More protein</option><option value="calories">Fewer calories</option><option value="less-sugar">Less sugar</option><option value="convenience">Convenience</option></select></label>
        <div className="fuel-label-pair"><label>Weekly grocery budget<input type="number" min="0.01" max="100000" step="0.01" value={weeklyBudget} onChange={e=>setWeeklyBudget(e.target.value)} placeholder="Optional"/></label><label>Budget currency<select value={currency} onChange={e=>setCurrency(e.target.value)}>{['USD','CAD','GBP','EUR','AUD'].map(code=><option key={code}>{code}</option>)}</select></label></div>
        <label>Stores you shop at<input value={stores} onChange={e=>setStores(e.target.value)} placeholder="Separate with commas"/></label>
        <label>Trying other brands<select value={brands} onChange={e=>setBrands(e.target.value as typeof brands)}><option value="open">Open to alternatives</option><option value="usual">Prefer my usual brands</option></select></label>
      </fieldset></details>
      <details className="fuel-preferences-section"><summary>Workout routine</summary><fieldset className="fuel-label-fields"><legend>Workout routine</legend>
        <label>Workout preferences<textarea rows={3} maxLength={2000} value={workout} onChange={event=>setWorkout(event.target.value)} placeholder="Equipment, activities you enjoy, and time available"/></label>
      </fieldset></details>
      {error&&<p role="alert" className="fuel-scan-error">{error}</p>}
      <button className="fuel-label-save">Save food & routine preferences</button>
    </form>
    <button className="fuel-label-link" onClick={()=>onSave(defaultPreferences())}>Forget these preferences</button>
    <p className="fuel-scan-footnote">Only your explicit choices are remembered here. Declining one meal does not create a permanent dislike.</p>
  </div></Modal>;
}
