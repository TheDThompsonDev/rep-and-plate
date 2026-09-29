import type { Nutrition } from '../../domain.ts';
import type { PantryLot } from '../pantry/ledger.ts';
import type { FoodPreferences } from '../preferences/contracts.ts';
import { mealCategorySchema,mealPlanSchema, type MealCategory,type MealPlan, type PlannedMeal } from './contracts.ts';
import { excludedIngredientText } from './exclusions.ts';

export type PlanningContext = {lots:PantryLot[];preferences:FoodPreferences;goals:Nutrition;startDate:string;mealCategories?:MealCategory[]};
const normalize = (text:string) => text.toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ').trim();

/** A missing ingredient may use grams or cups as its explicit unit, not a package serving. */
export function formatIngredientAmount(amount:number,label:string):string {
  const unit=label.trim();
  const bare=/^(?:g|kg|mg|ml|mL|l|L|oz|fl oz|lb|tsp|tbsp|cups?|grams?|millilit(?:er|re)s?)$/;
  if(bare.test(unit)) return `${amount} ${unit}`;
  return `${amount} × ${unit}`;
}

export function excludedIngredient(name:string, preferences:FoodPreferences) {
  return excludedIngredientText(name,preferences);
}

/** Validate the proposed plan against the user's explicit data before showing it. */
export function validateDraftPlan(input:unknown, context:PlanningContext,options:{enforceHousehold?:boolean;enforceCategories?:boolean}={}):MealPlan {
  const plan=mealPlanSchema.parse(input);
  const categories=mealCategorySchema.array().min(1).max(4).parse(context.mealCategories??['Dinner']);
  if(new Set(categories).size!==categories.length)throw new Error('Choose each meal type only once.');
  const seen=new Set<string>();
  const start=new Date(context.startDate+'T12:00:00Z');
  for(let index=0;index<plan.days.length;index++) {
    const date=new Date(start);date.setUTCDate(date.getUTCDate()+index);
    if(plan.days[index].date!==date.toISOString().slice(0,10)) throw new Error('The plan dates did not cover the requested seven days. Please try again.');
    if(options.enforceCategories!==false) {
      const actual=plan.days[index].meals.map(meal=>meal.category??'Dinner');
      if(actual.length!==categories.length || new Set(actual).size!==actual.length || categories.some(category=>!actual.includes(category)))throw new Error(`The draft must include exactly one ${categories.join(', ')} each day. Please try again.`);
    }
    for(const meal of plan.days[index].meals) {
      if(seen.has(meal.id)) throw new Error('The plan repeated a meal identifier. Please try again.');
      seen.add(meal.id);
      if(context.preferences.cookingMinutes && (meal.minutes === null || meal.minutes > context.preferences.cookingMinutes)) throw new Error('A meal did not fit your cooking time. Please try again.');
      if(options.enforceHousehold!==false && meal.portions!==context.preferences.householdSize) throw new Error('A meal did not match your household portions. Please try again.');
      for(const ingredient of meal.ingredients) {
        const lot=ingredient.lotId ? context.lots.find(item=>item.id===ingredient.lotId) : undefined;
        if(ingredient.lotId && !lot) throw new Error('A planned ingredient no longer exists in your pantry. Please regenerate the plan.');
        const excluded=excludedIngredient(`${ingredient.name} ${lot?.item.name ?? ''} ${lot?.item.productSnapshot?.ingredients ?? ''}`,context.preferences);
        if(excluded) throw new Error(`A suggested meal included “${excluded},” which conflicts with your preferences. Please try again.`);
        if(lot) {ingredient.name=lot.item.name;ingredient.servingLabel=lot.item.serving;}
      }
    }
  }
  return {...plan,status:'draft'};
}

export function mealEstimate(meal:PlannedMeal,lots:PantryLot[]) {
  const totals:Nutrition={calories:0,protein:0,carbs:0,fat:0};
  let known=0;
  for(const ingredient of meal.ingredients) {
    const lot=lots.find(item=>item.id===ingredient.lotId);
    if(!lot?.item.nutrition || lot.item.needsReview) continue;
    known++;
    for(const key of ['calories','protein','carbs','fat'] as const) totals[key]+=lot.item.nutrition[key]*ingredient.servings/meal.portions;
  }
  for(const key of ['calories','protein','carbs','fat'] as const) totals[key]=Math.round(totals[key]*10)/10;
  return {totals,complete:known===meal.ingredients.length,known,total:meal.ingredients.length};
}

export type ShoppingNeed={name:string;servingLabel:string;servings:number|null;reason:'shortage'|'check-quantity'};
export function planShoppingList(plan:MealPlan,lots:PantryLot[]):ShoppingNeed[] {
  const allocations=new Map<string,{name:string;servingLabel:string;servings:number;lotId:string|null}>();
  for(const day of plan.days) for(const meal of day.meals) for(const ingredient of meal.ingredients) {
    const key=ingredient.lotId ?? `new:${normalize(ingredient.name)}:${normalize(ingredient.servingLabel)}`;
    const previous=allocations.get(key);
    if(previous) previous.servings+=ingredient.servings;
    else allocations.set(key,{...ingredient});
  }
  const needs:ShoppingNeed[]=[];
  for(const allocation of allocations.values()) {
    const lot=lots.find(item=>item.id===allocation.lotId);
    if(lot && lot.item.availability==='available' && (lot.remaining===null || lot.inconsistent)) {
      needs.push({name:allocation.name,servingLabel:allocation.servingLabel,servings:null,reason:'check-quantity'});continue;
    }
    const available=lot?.item.availability==='available' ? Math.max(0,lot.remaining ?? 0) : 0;
    const shortage=Math.max(0,Math.round((allocation.servings-available)*10000)/10000);
    if(shortage) needs.push({name:allocation.name,servingLabel:allocation.servingLabel,servings:shortage,reason:'shortage'});
  }
  return needs.reduce<ShoppingNeed[]>((result,need)=>{
    const existing=result.find(item=>item.reason===need.reason && normalize(item.name)===normalize(need.name) && normalize(item.servingLabel)===normalize(need.servingLabel));
    if(existing && existing.servings!==null && need.servings!==null) existing.servings=Math.round((existing.servings+need.servings)*10000)/10000;
    else if(!existing) result.push({...need});
    return result;
  },[]);
}

export function mealPortionSelections(meal:PlannedMeal,lots:PantryLot[]) {
  const selection=new Map<string,number>();
  for(const ingredient of meal.ingredients) {
    if(!ingredient.lotId) return null;
    selection.set(ingredient.lotId,(selection.get(ingredient.lotId) ?? 0)+ingredient.servings/meal.portions);
  }
  for(const [id,servings] of selection) {
    const lot=lots.find(item=>item.id===id);
    if(!lot || lot.remaining===null || lot.remaining < servings || lot.inconsistent || lot.item.availability==='used' || !lot.item.nutrition || lot.item.needsReview) return null;
  }
  return [...selection].map(([lotId,servings])=>({lotId,servings}));
}

export function useUpSuggestions(lots:PantryLot[],preferences:FoodPreferences) {
  return lots.filter(lot=>lot.item.availability==='available' && !lot.inconsistent && (lot.remaining===null || lot.remaining>0) && !excludedIngredient(`${lot.item.name} ${lot.item.productSnapshot?.ingredients ?? ''}`,preferences))
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4).map(lot=>({lotId:lot.id,name:lot.item.name,
      reason:lot.remaining===null ? 'Check how much you have, then include it in a meal.' : `${lot.remaining} labeled servings remain from your ${lot.date} purchase.`,
      prompt:`Suggest a meal using my ${lot.item.name}, respecting my saved food preferences. Show any extra ingredients separately. Ask me to check freshness; don't assume food has expired.`}));
}
