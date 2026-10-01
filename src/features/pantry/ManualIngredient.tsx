import {useState} from 'react';
import {Modal} from '../../components';
import {manualPantryIngredientSchema} from './manual-ingredient';
export default function ManualIngredient({onClose,onAdd}:{onClose:()=>void;onAdd:(input:unknown)=>void}) {
  const [error,setError]=useState('');
  return <Modal title="Add an ingredient you have" onClose={onClose}><form className="edit-form" onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);const input={name:String(form.get('name')),serving:String(form.get('serving')),servings:Number(form.get('servings')),nutrition:Object.fromEntries(['calories','protein','carbs','fat'].map(key=>[key,Number(form.get(key))]))};const parsed=manualPantryIngredientSchema.safeParse(input);if(!parsed.success){setError('Check the name, serving, amount and label nutrition.');return;}try{onAdd(parsed.data);}catch(cause){setError(cause instanceof Error?cause.message:'This ingredient could not be saved.');}}}>
    <p>Enter the amount you actually have and nutrition for one labeled serving. This creates pantry stock for recipes; it does not log a meal.</p>
    <label>Ingredient name<input name="name" maxLength={200} required/></label>
    <label>One labeled serving<input name="serving" maxLength={150} placeholder="For example, 1/2 cup (40 g)" required/></label>
    <label>Total labeled servings on hand<input name="servings" type="number" min="0.0001" max="10000" step="any" required/></label>
    <p>Packages × servings per package = total servings. Enter only what remains if you have already used some.</p>
    <div className="form-grid">{(['calories','protein','carbs','fat'] as const).map(key=><label key={key}>{key==='calories'?'Calories per serving':`${key[0].toUpperCase()+key.slice(1)} per serving (g)`}<input name={key} type="number" min="0" max="20000" step="any" required/></label>)}</div>
    <label className="pantry-manual-confirm"><input type="checkbox" required/> <span>I checked the serving, amount and nutrition. These ingredients are on hand.</span></label>
    {error&&<p role="alert">{error}</p>}<button className="button primary full-width">Add confirmed ingredient</button>
  </form></Modal>;
}
