import type { Nutrition } from '../../domain.ts';
import type { PantryLot } from '../pantry/ledger.ts';
import type { FoodPreferences } from '../preferences/contracts.ts';
import { mealCategorySchema,mealPlanSchema, type CookingStep,type MealCategory,type MealPlan, type PlannedMeal } from './contracts.ts';
import {createPlanRevision} from './recurring-plans.ts';
import { excludedIngredientText } from './exclusions.ts';

export type PlanningContext = {lots:PantryLot[];preferences:FoodPreferences;goals:Nutrition;goalsConfigured?:boolean;startDate:string;mealCategories?:MealCategory[];pantryMode?:'pantry-only'|'shopping-supported';variety?:'varied'|'repeat-friendly'};
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
      if(meal.cookingMethod?.steps.some(step=>step.ingredientIndexes.some(index=>!meal.ingredients[index]) || new Set(step.ingredientIndexes).size!==step.ingredientIndexes.length))throw new Error('A cooking step refers to an ingredient outside this recipe. Review the cooking method.');
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

/** Generation-only choices must not prevent later manual edits or intentionally repeated weeks. */
export function validateGeneratedPlan(input:unknown,context:PlanningContext):MealPlan {
  const candidate=mealPlanSchema.parse(input);
  // An unusable optional method must not discard a valid ingredient schedule.
  // Core references, dates, restrictions and quantities still receive full validation.
  for(const day of candidate.days)for(const meal of day.meals)if(meal.cookingMethod&&cookingMethodIssue(meal))meal.cookingMethod=null;
  const plan=validateDraftPlan(candidate,context);
  // Provider prose cannot prove stock coverage and may contradict the quantity ledger.
  // Generated plans retain their ingredient schedule; ordinary user-edited notes are
  // preserved by validateDraftPlan, which intentionally does not apply this boundary.
  for(const day of plan.days)for(const meal of day.meals){meal.notes='';if(meal.cookingMethod)meal.cookingMethod.reviewed=false;}
  if(context.pantryMode==='pantry-only' && planShoppingList(plan,context.lots).length)throw new Error('Your confirmed pantry amounts do not cover this week. Check quantities, or choose Include a shopping list.');
  // Variety is a preference, not a reason to discard an otherwise usable draft.
  // Both clients show the ingredient-pattern check, including sparse-pantry repeats.
  return plan;
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
      reason:lot.remaining===null ? 'Check how much you have, then include it in a meal.' : `${lot.remaining} labeled servings remain${lot.purchaseDate ? ` from your ${lot.purchaseDate} purchase` : `; stock recorded ${lot.capturedDate??lot.date}`}.`,
      prompt:`Suggest a meal using my ${lot.item.name}, respecting my saved food preferences. Show any extra ingredients separately. Ask me to check freshness; don't assume food has expired.`}));
}

export function cookingStepText(step:CookingStep,meal:PlannedMeal) {
  const action=step.action==='saute'?'Sauté':step.action[0].toUpperCase()+step.action.slice(1);
  const ingredients=step.ingredientIndexes.map(index=>meal.ingredients[index]?.name).filter(Boolean).join(', ');
  return `${action} ${ingredients}${step.temperatureC===null?'':` at ${step.temperatureC}°C (${Math.round(step.temperatureC*9/5+32)}°F)`}${step.minutes===null?'':` for ${step.minutes} min`}.`;
}

/** Generation and explicit method review use stricter completeness checks than legacy plan reads. */
export function cookingMethodIssue(meal:PlannedMeal):string|null {
  if(!meal.cookingMethod)return null;
  const referenced=new Set<number>();
  for(const step of meal.cookingMethod.steps){
    if(step.ingredientIndexes.some(index=>!meal.ingredients[index])||new Set(step.ingredientIndexes).size!==step.ingredientIndexes.length)return 'A cooking step refers to an ingredient outside this recipe. Review the cooking method.';
    step.ingredientIndexes.forEach(index=>referenced.add(index));
    if(['boil','simmer','saute','bake','steam','microwave'].includes(step.action)&&step.minutes===null)return 'Cooking steps need a time. Add the minutes or request another method.';
    if(step.action==='bake'&&step.temperatureC===null)return 'A baking step needs an oven temperature. Add it or request another method.';
  }
  return referenced.size<meal.ingredients.length?'The cooking method does not include every listed ingredient. Review the steps before cooking.':null;
}

/** Generic starting numbers are not chosen goals and are omitted from model input. */
export function planningGenerationContext(context:PlanningContext) {
  const {goals,...rest}=context;
  return {...rest,...(context.goalsConfigured===true?{goals}:{})};
}

/** Reviewing a method is an explicit user decision; approved weeks remain immutable. */
export function reviewCookingMethod(input:MealPlan,mealId:string,reviewed:boolean) {
  const revision=createPlanRevision(input);
  const id=revision.mealIds[mealId];
  const meal=revision.plan.days.flatMap(day=>day.meals).find(item=>item.id===id);
  if(!meal?.cookingMethod)throw new Error('This meal has no cooking method to review.');
  const issue=reviewed?cookingMethodIssue(meal):null;if(issue)throw new Error(issue);
  meal.cookingMethod.reviewed=reviewed;
  return revision;
}

/** Ingredient/portion changes require another method review, even when step order stays useful. */
export function invalidateCookingReview(before:PlannedMeal,after:PlannedMeal):PlannedMeal {
  return after.cookingMethod&&(before.portions!==after.portions||JSON.stringify(before.ingredients)!==JSON.stringify(after.ingredients)) ? {...after,cookingMethod:{...after.cookingMethod,reviewed:false}} : after;
}

const seasoning=/^(?:water|salt|sea salt|black pepper|ground black pepper|olive oil|vegetable oil|canola oil|cooking oil|seasoning|spices?|herbs?|garlic|garlic powder|cinnamon)$/;
function ingredientPattern(meal:PlannedMeal) {
  const names=meal.ingredients.map(item=>normalize(item.name).replace(/\b(fresh|canned|cooked|raw|chopped|diced|sliced|frozen|whole)\b/g,'').replace(/\s+/g,' ').trim());
  const primary=names.filter(name=>!seasoning.test(name));
  return new Set(primary.length?primary:names);
}
function similarPattern(a:Set<string>,b:Set<string>) {
  const common=[...a].filter(value=>b.has(value)).length;
  return common===a.size&&common===b.size || common>=2&&common/(a.size+b.size-common)>=0.5;
}
export function planVarietySummary(plan:MealPlan) {
  const categories=[...new Set(plan.days.flatMap(day=>day.meals.map(meal=>meal.category??'Dinner')))];
  return categories.map(category=>{
    const meals=plan.days.flatMap(day=>day.meals).filter(meal=>(meal.category??'Dinner')===category);
    const patterns:Set<string>[]=[];
    for(const meal of meals){const pattern=ingredientPattern(meal);if(!patterns.some(existing=>similarPattern(existing,pattern)))patterns.push(pattern);}
    const repeated=meals.length>=3&&patterns.length<Math.min(3,meals.length);
    return {category,meals:meals.length,patterns:patterns.length,repeated,message:`${category}: ${patterns.length} ingredient ${patterns.length===1?'pattern':'patterns'} across ${meals.length} meals.${repeated?' Several meals reuse a similar base. For more variety, include a shopping list or change ingredients. Repeats can be practical with a small pantry.':''}`};
  });
}
