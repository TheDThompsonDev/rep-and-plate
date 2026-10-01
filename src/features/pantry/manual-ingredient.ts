import {z} from 'zod';
import {today,type AppState} from '../../domain';
import {aiNutritionSchema} from '../../ai-contract';
export const manualPantryIngredientSchema=z.object({name:z.string().trim().min(1).max(200),serving:z.string().trim().min(1).max(150),servings:z.number().finite().positive().max(10000),nutrition:aiNutritionSchema});
export function addManualPantryIngredient(state:AppState,input:unknown,operationId:string):AppState {
  const value=manualPantryIngredientSchema.parse(input);
  const id=`manual-ingredient:${operationId}`;
  if(state.groceries?.some(receipt=>receipt.id===id))return state;
  return {...state,groceries:[...(state.groceries??[]),{id,fingerprint:id,store:'Ingredients entered by you',date:today(),note:'Amount on hand and nutrition entered by you. No purchase date or price assumed.',sources:[],items:[{id:`${id}:item`,receiptText:value.name,name:value.name,quantity:`${value.servings} servings on hand`,serving:value.serving,servingsPurchased:value.servings,nutrition:value.nutrition,match:'user',note:'Confirmed labeled servings on hand. No food logged as eaten.',sources:[],needsReview:false,availability:'available'}]}]};
}
