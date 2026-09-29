import { useEffect, useState } from 'react';
import { CalendarDays, Copy, RefreshCw, ShoppingBasket } from 'lucide-react';
import { Modal } from '../../components';
import { today, type Nutrition } from '../../domain';
import type { PantryLot } from '../pantry/ledger';
import { defaultPreferences, type FoodPreferences } from '../preferences/contracts';
import type { MealCategory,MealPlan, PlannedMeal } from './contracts';
import type { GroceryReceipt } from '../../ai-contract';
import IngredientLink from './IngredientLink';
import { linkPlannedIngredient, unloggedPlan } from './pantry-links';
import { basketSummary, estimatePlanBasket } from './basket';
import { formatIngredientAmount, mealEstimate, mealPortionSelections, planShoppingList, useUpSuggestions, validateDraftPlan, type PlanningContext } from './meal-plans';
import { copyMealToDay,createPlanRevision,movePlannedMeal,repeatApprovedWeek,shiftPlanDate } from './recurring-plans';
import '../scanner/scanner.css';
import './planning.css';

export type MealPlannerProps={lots:PantryLot[];receipts?:GroceryReceipt[];preferences?:FoodPreferences;goals:Nutrition;value?:MealPlan;plans?:MealPlan[];loggedMealIds?:string[];onGenerate:(context:PlanningContext)=>Promise<MealPlan>;onSave:(plan:MealPlan)=>void;onClose:()=>void;onLog?:(meal:PlannedMeal,planId:string)=>void;onAsk?:(text:string)=>void};
export default function MealPlanner({lots,receipts=[],preferences:provided,goals,value,plans=[],loggedMealIds=[],onGenerate,onSave,onClose,onLog,onAsk}:MealPlannerProps) {
  const preferences=provided ?? defaultPreferences();
  const [plan,setPlan]=useState<MealPlan|undefined>(value);
  const [startDate,setStartDate]=useState(value?.days[0].date ?? today());
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [swapping,setSwapping]=useState<string|null>(null);
  const [dismissed,setDismissed]=useState<string[]>([]);
  const [pendingLog,setPendingLog]=useState<string|null>(null);
  const pendingRecorded=pendingLog!==null&&loggedMealIds.includes(pendingLog);
  useEffect(()=>{
    if(!pendingLog)return;
    if(pendingRecorded){setPendingLog(null);return;}
    const timeout=setTimeout(()=>{setError('Your portion was not confirmed. Check your latest pantry amounts and try again.');setPendingLog(null);},3000);
    return ()=>clearTimeout(timeout);
  },[pendingLog,pendingRecorded]);
  function logPortion(meal:PlannedMeal,planId:string) {
    if(!onLog||pendingLog)return;
    try {onLog(meal,planId);setPendingLog(`pantry-meal:plan:${planId}:${meal.id}`);setError('');}
    catch(cause){setError(cause instanceof Error?cause.message:'This portion could not be logged. Check your pantry and try again.');}
  }
  const [repeatStart,setRepeatStart]=useState(value?.days[0].date?shiftPlanDate(value.days[0].date,7):shiftPlanDate(today(),7));
  const [addingDay,setAddingDay]=useState<string|null>(null);
  const [mealCategories,setMealCategories]=useState<MealCategory[]>(()=>value ? [...new Set(value.days.flatMap(day=>day.meals.map(meal=>meal.category??'Dinner')))] : ['Dinner']);
  const savedPlans=plans.length?plans:value?[value]:[];
  const savedPlan=plan?savedPlans.find(saved=>saved.id===plan.id):undefined;
  const isSavedApproved=!!plan&&savedPlan?.status==='approved'&&JSON.stringify(savedPlan)===JSON.stringify(plan);
  const remainingPlan=plan?unloggedPlan(plan,loggedMealIds):undefined;
  const needs=remainingPlan ? planShoppingList(remainingPlan,lots) : [];
  const basket=remainingPlan?basketSummary(estimatePlanBasket(remainingPlan,lots,receipts,today()),preferences.weeklyBudget,preferences.shoppingCurrency):undefined;
  const suggestions=useUpSuggestions(lots,preferences).filter(item=>!dismissed.includes(item.lotId));
  async function generate() {
    if(busy)return;
    setBusy(true);setError('');
    try {const context={lots,preferences,goals,startDate,mealCategories};setPlan(validateDraftPlan(await onGenerate(context),context));setEditing(null);setSwapping(null);}
    catch(cause){setError(cause instanceof Error ? cause.message : 'The meal plan could not be created. Please try again.');}
    finally {setBusy(false);}
  }
  function updateMeal(id:string,update:(meal:PlannedMeal)=>PlannedMeal) {
    setPlan(current=>current ? {...current,status:'draft',days:current.days.map(day=>({...day,meals:day.meals.map(meal=>meal.id===id ? update(meal) : meal)}))} : current);
  }
  function beginEdit(id:string) {
    if(!plan)return;
    try {const revision=createPlanRevision(plan);setPlan(revision.plan);setEditing(revision.mealIds[id]);setError('');}
    catch {setError('Check this plan before editing.');}
  }
  function chooseSaved(saved:MealPlan) {
    setPlan(saved);setMealCategories([...new Set(saved.days.flatMap(day=>day.meals.map(meal=>meal.category??'Dinner')))]);setStartDate(saved.days[0].date);setRepeatStart(shiftPlanDate(saved.days[0].date,7));setEditing(null);setSwapping(null);setAddingDay(null);setError('');
  }
  function repeatWeek() {
    if(!plan || !isSavedApproved)return;
    try {const draft=repeatApprovedWeek(plan,repeatStart);setPlan(draft);setStartDate(draft.days[0].date);setRepeatStart(shiftPlanDate(draft.days[0].date,7));setEditing(null);setSwapping(null);setError('');}
    catch(cause){setError(cause instanceof Error?cause.message:'Choose a date for the next week.');}
  }
  function save(status:MealPlan['status']) {
    if(!plan)return;
    try {const checked=validateDraftPlan(plan,{lots,preferences,goals,startDate:plan.days[0].date},{enforceHousehold:false,enforceCategories:false});onSave({...checked,status});setPlan({...checked,status});setRepeatStart(shiftPlanDate(checked.days[0].date,7));setEditing(null);setError('');}
    catch(cause){setError(cause instanceof Error ? cause.message : 'Check the plan before saving.');}
  }
  return <Modal title="Your week of meals" onClose={onClose} wide><div className="fuel-scanner fuel-planner">
    <div className="fuel-scanner-intro"><span><CalendarDays size={28}/></span><p>Start with what’s in your kitchen.<br/><strong>Make room for meals you enjoy.</strong></p></div>
    <p className="fuel-label-intro">A seven-day draft for {preferences.householdSize} {preferences.householdSize===1?'person':'people'}{preferences.cookingMinutes ? `, up to ${preferences.cookingMinutes} minutes per meal` : ''}. Review ingredients and portions before approving.</p>
    {savedPlans.length>0&&<label className="fuel-plan-history">Saved weeks<select aria-label="Saved meal-plan weeks" value={plan?.id??''} onChange={event=>{const saved=savedPlans.find(item=>item.id===event.target.value);if(saved)chooseSaved(saved);}}>{!savedPlan&&<option value={plan?.id??''}>{plan?'Unsaved draft':'Choose a saved week'}</option>}{savedPlans.slice().reverse().map(saved=><option key={saved.id} value={saved.id}>{saved.days[0].date} · {saved.status==='approved'?'Approved':'Draft'}</option>)}</select><small>Save your draft before switching weeks.</small></label>}
    <fieldset className="fuel-plan-categories" disabled={busy}><legend>Meals to plan each day</legend><div>{(['Breakfast','Lunch','Dinner','Snack'] as const).map(category=><label key={category}><input type="checkbox" checked={mealCategories.includes(category)} disabled={mealCategories.length===1&&mealCategories.includes(category)} onChange={event=>setMealCategories(current=>(['Breakfast','Lunch','Dinner','Snack'] as const).filter(value=>value===category?event.target.checked:current.includes(value)))}/>{category}</label>)}</div><small>Choose at least one meal type. Each gets a place on all seven days.</small></fieldset>
    <div className="fuel-plan-generate"><label>Week starting<input type="date" value={startDate} onChange={event=>setStartDate(event.target.value)} disabled={busy}/></label><button className="fuel-label-save" onClick={()=>void generate()} disabled={busy || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)}><RefreshCw size={16}/>{busy?'Planning your meals…':plan?'Create a new draft':'Create my week'}</button></div>
    {error&&<p role="alert" className="fuel-scan-error">{error}</p>}
    {busy&&<p role="status" className="fuel-scan-status">Checking your ingredients, preferences, and portions…</p>}
    {plan&&<>
      <div className="fuel-plan-status"><strong>{plan.status==='approved'?'Approved plan':'Draft to review'}</strong><span>Planning does not change your pantry or daily intake.</span></div>
      {isSavedApproved&&<section className="fuel-plan-repeat"><div><Copy size={19}/><strong>Make this week work again</strong></div><p>Copy the schedule into a new draft. We’ll check it against what remains in your pantry.</p><label>Repeat week starting<input type="date" aria-label="Repeat week starting" value={repeatStart} min={shiftPlanDate(plan.days[6].date,1)} onChange={event=>setRepeatStart(event.target.value)}/></label><button onClick={repeatWeek}>Repeat this week as a draft</button><small>Your approved week and logged meals stay as they are. This schedules no automatic activity.</small></section>}
      <div className="fuel-plan-days">{plan.days.map(day=><section key={day.date} className="fuel-plan-day"><h3>{new Date(day.date+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</h3>{day.meals.length===0&&<p className="fuel-plan-meta">Nothing planned for this day yet.</p>}{day.meals.map(meal=>{
        const estimate=mealEstimate(meal,lots);const canLog=mealPortionSelections(meal,lots);const edit=editing===meal.id;const logged=loggedMealIds.includes(`pantry-meal:plan:${plan.id}:${meal.id}`);const logging=pendingLog===`pantry-meal:plan:${plan.id}:${meal.id}`;
        return <article className="fuel-planned-meal" key={meal.id}>
          {edit?<label>Meal name<input value={meal.title} maxLength={200} onChange={event=>updateMeal(meal.id,current=>({...current,title:event.target.value}))}/></label>:<h4>{meal.title}</h4>}
          {edit&&<div className="fuel-plan-edit-fields"><label>Meal day<select aria-label="Meal day" value={day.date} onChange={event=>{try{setPlan(movePlannedMeal(plan,meal.id,event.target.value));setError('');}catch(cause){setError(cause instanceof Error?cause.message:'Choose a day in this week.');}}}>{plan.days.map(option=><option key={option.date} value={option.date}>{option.date}</option>)}</select></label><label>Meal type<select aria-label="Meal type" value={meal.category??'Dinner'} onChange={event=>updateMeal(meal.id,current=>({...current,category:event.target.value as PlannedMeal['category']}))}>{(['Breakfast','Lunch','Dinner','Snack'] as const).map(category=><option key={category}>{category}</option>)}</select></label><label>Recipe portions<input aria-label="Recipe portions" type="number" min="1" max="20" step="1" value={meal.portions} onChange={event=>{const portions=Number(event.target.value);if(Number.isInteger(portions)&&portions>=1&&portions<=20)updateMeal(meal.id,current=>({...current,portions}));}}/></label></div>}
          <p className="fuel-plan-meta">{meal.category??'Dinner'} · {meal.portions} portion{meal.portions===1?'':'s'}{meal.minutes?` · ${meal.minutes} min`:''}</p>
          <ul>{meal.ingredients.map((ingredient,index)=><li key={`${ingredient.lotId ?? ingredient.name}-${index}`}><span>{ingredient.name}<small>{ingredient.servingLabel}</small></span>{edit?<label className="fuel-plan-amount">Servings<input aria-label={`${ingredient.name} recipe servings`} type="number" min="0.01" max="1000" step="any" value={ingredient.servings} onChange={event=>{const amount=Number(event.target.value);if(Number.isFinite(amount)&&amount>0)updateMeal(meal.id,current=>({...current,ingredients:current.ingredients.map((item,i)=>i===index?{...item,servings:amount}:item)}));}}/></label>:<strong>{formatIngredientAmount(ingredient.servings,ingredient.servingLabel)}</strong>}</li>)}</ul>
          <p className="fuel-plan-meta">Ingredient amounts are for the whole recipe.{edit?' Portions divide this recipe; adjust ingredient amounts separately.':''}</p>
          {!logged&&<div className="fuel-plan-links">{meal.ingredients.map((ingredient,index)=><IngredientLink key={`${index}:${ingredient.lotId??'missing'}`} ingredient={ingredient} lots={lots} preferences={preferences} onLink={(lotId,servings)=>{try{setPlan(linkPlannedIngredient(plan,meal.id,index,lotId,servings,{lots,preferences,loggedMealIds,confirmed:true}));setError('');}catch(cause){setError(cause instanceof Error?cause.message:'Check this ingredient before connecting it.');}}}/>)}</div>}
          {estimate.known>0?<p className="fuel-plan-nutrition">{estimate.complete?'~':'At least '}{Math.round(estimate.totals.calories)} cal · {estimate.totals.protein}g protein per portion{estimate.complete?'':' · partial estimate'}</p>:<p className="fuel-plan-meta">Nutrition will be available when ingredient amounts and labels are confirmed.</p>}
          {!estimate.complete&&estimate.known>0&&<p className="fuel-plan-meta">Nutrition available for {estimate.known} of {estimate.total} ingredients. Missing ingredients are not counted as zero.</p>}
          {meal.notes&&<p className="fuel-plan-note">{meal.notes}</p>}
          <div className="fuel-plan-actions"><button onClick={()=>edit?setEditing(null):beginEdit(meal.id)}>{edit?'Done editing':'Edit meal'}</button><button onClick={()=>setSwapping(swapping===meal.id?null:meal.id)}>Swap meal</button>{onLog&&isSavedApproved&&<button disabled={!canLog || logged || !!pendingLog} onClick={()=>{if(canLog)logPortion(meal,plan.id);}}>{logged?'Portion logged':logging?'Saving portion...':'Log one portion'}</button>}</div>
          {swapping===meal.id&&<label className="fuel-plan-swap">Replace with another meal from this week<select value="" onChange={event=>{const other=plan.days.flatMap(item=>item.meals).find(item=>item.id===event.target.value);if(other){const revision=createPlanRevision(plan);const id=revision.mealIds[meal.id];setPlan({...revision.plan,days:revision.plan.days.map(day=>({...day,meals:day.meals.map(current=>current.id===id?{...other,id:current.id,category:current.category??'Dinner',ingredients:other.ingredients.map(item=>({...item}))}:current)}))});setEditing(null);setSwapping(null);}}}><option value="">Choose a meal</option>{plan.days.flatMap(item=>item.meals).filter(item=>item.id!==meal.id).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
        </article>;
      })}{day.meals.length<4&&<><button className="fuel-plan-add-meal" onClick={()=>setAddingDay(addingDay===day.date?null:day.date)}>Add a meal to this day</button>{addingDay===day.date&&<label className="fuel-plan-swap">Use a meal from this week<select aria-label={`Meal to copy to ${day.date}`} value="" onChange={event=>{try{const copied=copyMealToDay(plan,event.target.value,day.date);setPlan(copied.plan);setEditing(copied.mealId);setAddingDay(null);setError('');}catch(cause){setError(cause instanceof Error?cause.message:'This meal could not be copied.');}}}><option value="">Choose a meal to copy</option>{plan.days.flatMap(item=>item.meals).map(item=><option key={item.id} value={item.id}>{item.category??'Dinner'} · {item.title}</option>)}</select></label>}</>}</section>)}</div>
      <section className="fuel-plan-shopping"><h3><ShoppingBasket size={21}/>Your shopping & pantry check</h3><p>Amounts below account for every meal in the week, including repeat ingredients.</p>{needs.length?<ul>{needs.map((need,index)=><li key={index}><strong>{need.name}</strong><span>{need.reason==='check-quantity'?'Check how much remains':`${need.servings} additional servings · ${need.servingLabel}`}</span></li>)}</ul>:<p>Known pantry quantities cover this plan. Check your actual stock before cooking.</p>}</section>
      {basket&&<section className="fuel-plan-cost" aria-label="Basket cost coverage"><h3>What might the remaining ingredients cost?</h3><p>{basket.amount}</p><p>{basket.coverage}{basket.budgetText}</p><small>{basket.note}</small></section>}
      <div className="fuel-product-actions"><button onClick={()=>save('draft')}>Save draft</button><button onClick={()=>save('approved')}>Approve this plan</button></div>
      <p className="fuel-scan-footnote">Approval saves the plan. Log a portion only after eating it. Check package ingredients for your restrictions; recipe suggestions cannot verify allergen handling.</p>
    </>}
    {suggestions.length>0&&<section className="fuel-plan-useup"><h3>Make the most of your groceries</h3>{suggestions.map(item=><article key={item.lotId}><strong>{item.name}</strong><p>{item.reason}</p><div className="fuel-plan-actions">{onAsk&&<button onClick={()=>onAsk(item.prompt)}>Find a meal idea</button>}<button onClick={()=>setDismissed(current=>[...current,item.lotId])}>Dismiss for now</button></div></article>)}<p className="fuel-scan-footnote">Purchase dates help organize ideas. They do not tell us whether food is fresh or spoiled.</p></section>}
  </div></Modal>;
}
