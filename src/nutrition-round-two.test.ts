import { expect, it } from 'vitest';
import { initialState, repeatMeal, today, type Meal } from './domain';
import { nutritionInsights } from './features/insights/insights';
import { buildAIRequest } from './ai-client';
import { addManualPantryIngredient } from './features/pantry/manual-ingredient';

const meal: Meal = {id:'label',title:'Yogurt',category:'Breakfast',day:today(),time:'9:00 AM',source:'Manual entry',confidence:'confirmed',note:'',calories:215,protein:18.3,carbs:33,fat:0.4,recipeBatchId:'batch',recipePortions:1,components:[{id:'component',name:'Yogurt',servings:1,servingLabel:'1 cup',lotId:'lot',nutrition:{calories:215,protein:18.3,carbs:33,fat:0.4},sourceUrls:[]}]};
it('repeats a reviewed fractional portion with exact nutrition and no stock links or effects',()=>{
 const state={...initialState(),meals:[meal]};
 const next=repeatMeal(state,meal.id,today(),1.5);
 expect(next.meals.at(-1)).toMatchObject({calories:322.5,protein:27.45,carbs:49.5,fat:0.6});
 expect(next.meals.at(-1)?.components?.[0]).toMatchObject({servings:1.5,nutrition:{protein:27.45,fat:0.6}});
 expect(next.meals.at(-1)?.components?.[0].lotId).toBeUndefined();
 expect(next.meals.at(-1)?.recipeBatchId).toBeUndefined();
 expect(next.meals.at(-1)?.note).toContain('Pantry and prepared portions were not changed');
 expect(next.meals[0]).toEqual(meal);
 expect(next.pantryEvents).toEqual(state.pantryEvents);
});
it('rejects invalid multipliers and nutrition beyond schema bounds',()=>{
 const state={...initialState(),meals:[meal]};
 for(const multiplier of [0,-1,NaN,Infinity,101])expect(()=>repeatMeal(state,meal.id,today(),multiplier)).toThrow();
 expect(()=>repeatMeal(state,meal.id,today(),100)).toThrow();
});
it('describes recorded protein without sample target judgments until targets are configured',()=>{
 const state={...initialState(),meals:[meal]};
 const unconfigured=nutritionInsights(state)[1];
 expect(unconfigured.description).not.toMatch(/reached|110g target/);
 expect(unconfigured.detail).not.toContain('Compared with your current target');
 expect(unconfigured.title).toContain('18g protein');
 state.profile.targetsConfigured=true;
 expect(nutritionInsights(state)[1].description).toContain('110g target');
});
it('keeps manual on-hand ingredients available without calling them shopping trips',()=>{
 const state=addManualPantryIngredient(initialState(),{name:'Oats',serving:'40 g',servings:2,nutrition:{calories:150,protein:5,carbs:27,fat:3}},'on-hand');
 const request=buildAIRequest(state,{id:'question',role:'user',text:'What can I make?',time:'now'});
 expect(request.context.shopping?.recordedReceipts).toBe(0);
 expect(request.context.shopping?.missingOrUncheckedTotals).toBe(0);
 expect(request.context.groceries[0].items[0].name).toBe('Oats');
 expect(request.context.goalsConfigured).toBe(false);
});
