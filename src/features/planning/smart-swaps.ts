import type { Nutrition } from '../../domain';
import type { PantryLot } from '../pantry/ledger';
import type { FoodPreferences } from '../preferences/contracts';
import { excludedIngredientText } from './exclusions';

export function eligibleSwapLots(lots:PantryLot[],preferences:FoodPreferences):PantryLot[] {
  return lots.filter(lot=>lot.item.availability==='available' && !lot.inconsistent && (lot.remaining===null || lot.remaining>0) &&
    !lot.item.needsReview && lot.item.nutrition!==null && !!lot.item.serving.trim() &&
    !excludedIngredientText(`${lot.item.name} ${lot.item.productSnapshot?.ingredients ?? ''}`,preferences));
}

export type SwapComparison = {from:Nutrition;to:Nutrition;difference:Nutrition;notes:string[]};
/** Grocery nutrition is already per labeled serving, even when its source snapshot is per 100g. */
export function comparePantryPortions(from:PantryLot,to:PantryLot,fromServings:number,toServings:number,preferences:FoodPreferences):SwapComparison|null {
  if(from.id===to.id || ![fromServings,toServings].every(value=>Number.isFinite(value)&&value>0&&value<=1000))return null;
  if(eligibleSwapLots([from,to],preferences).length!==2)return null;
  const round=(value:number)=>Math.round(value*100)/100;
  const fromTotals:Nutrition={calories:0,protein:0,carbs:0,fat:0};
  const toTotals:Nutrition={calories:0,protein:0,carbs:0,fat:0};
  const difference:Nutrition={calories:0,protein:0,carbs:0,fat:0};
  for(const key of ['calories','protein','carbs','fat'] as const) {
    fromTotals[key]=round(from.item.nutrition![key]*fromServings);
    toTotals[key]=round(to.item.nutrition![key]*toServings);
    difference[key]=round(toTotals[key]-fromTotals[key]);
  }
  const notes:string[]=[];
  for(const [lot,amount] of [[from,fromServings],[to,toServings]] as const) {
    if(lot.remaining===null)notes.push(`Check how much ${lot.item.name} remains; its pantry quantity is unknown.`);
    else if(amount>lot.remaining)notes.push(`You have ${lot.remaining} servings of ${lot.item.name} recorded, less than this comparison uses.`);
    if(!lot.item.productSnapshot?.ingredients.trim())notes.push(`The full ingredient list for ${lot.item.name} is not available. Check the package against your restrictions.`);
  }
  return {from:fromTotals,to:toTotals,difference,notes};
}
