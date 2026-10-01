import { describe,it,expect } from 'vitest';
import type { PantryLot } from '../pantry/ledger';
import { defaultPreferences } from '../preferences/contracts';
import type { MealPlan } from './contracts';
import { formatIngredientAmount,mealEstimate,mealPortionSelections,planShoppingList,planVarietySummary,useUpSuggestions,validateDraftPlan,validateGeneratedPlan } from './meal-plans';

const lot:PantryLot={id:'receipt::milk',receiptId:'receipt',store:'Shop',date:'2026-09-25',purchased:4,remaining:4,inconsistent:false,item:{id:'milk',receiptText:'milk',name:'Whole milk',quantity:'4 cups',serving:'1 cup',servingsPurchased:4,nutrition:{calories:150,protein:8,carbs:12,fat:8},match:'exact',note:'',sources:[],needsReview:false,availability:'available'}};
function fixture():MealPlan {
  return {id:'week',createdAt:'2026-09-25T12:00:00Z',status:'draft',days:Array.from({length:7},(_,index)=>({date:`2026-${index<6?'09':'10'}-${index<6?25+index:'01'}`,meals:[{id:`meal-${index}`,title:'Milk drink',portions:1,minutes:5,ingredients:[{lotId:lot.id,name:lot.item.name,servingLabel:'1 cup',servings:1}],notes:''}]}))};
}
describe('weekly meal plan accounting',()=>{
  it('rejects pantry-only drafts with shortages or unknown quantities while allowing a shopping list',()=>{
    const context={lots:[lot],preferences:defaultPreferences(),goals:{calories:2000,protein:100,carbs:200,fat:70},startDate:'2026-09-25',pantryMode:'pantry-only' as const};
    expect(()=>validateGeneratedPlan(fixture(),context)).toThrow('confirmed pantry amounts');
    expect(()=>validateGeneratedPlan(fixture(),{...context,lots:[{...lot,remaining:null}]})).toThrow('confirmed pantry amounts');
    expect(validateGeneratedPlan(fixture(),{...context,pantryMode:'shopping-supported'}).days).toHaveLength(7);
    expect(validateGeneratedPlan(fixture(),{...context,lots:[{...lot,remaining:7}]}).days).toHaveLength(7);
  });
  it('reports repeated ingredient patterns without discarding usable plans and removes provider notes',()=>{
    const context={lots:[lot],preferences:defaultPreferences(),goals:{calories:2000,protein:100,carbs:200,fat:70},startDate:'2026-09-25',variety:'varied' as const};
    const plan=fixture();plan.days[0].meals[0].notes='Warm the milk. There is enough milk for this week. Milk supply remains adequate. Oats will be depleted after this day. Stir until smooth.';
    expect(planVarietySummary(validateGeneratedPlan(plan,context))[0].patterns).toBe(1);
    const result=validateGeneratedPlan(plan,{...context,variety:'repeat-friendly'});
    expect(result.days[0].meals[0].notes).toBe('');
    expect(plan.days[0].meals[0].notes).toContain('enough');
    plan.days[1].meals[0].title='Milk cocoa';plan.days[2].meals[0].title='Milk porridge';
    expect(validateGeneratedPlan(plan,context).days).toHaveLength(7);
    expect(planVarietySummary(plan)[0].patterns).toBe(1);
  });
  it('discards all provider notes, including paraphrased inventory claims, but retains user-authored notes on ordinary edits',()=>{
    const context={lots:[lot],preferences:defaultPreferences(),goals:{calories:2000,protein:100,carbs:200,fat:70},startDate:'2026-09-25'};
    const plan=fixture();
    plan.days[0].meals[0].notes='Simmer the oats. Milk covers the whole week.';
    const generated=validateGeneratedPlan(plan,context);
    expect(generated.days[0].meals[0].notes).toBe('');
    expect(generated.days[0].meals[0].ingredients).toEqual(plan.days[0].meals[0].ingredients);
    expect(generated.days[0].meals[0].portions).toBe(plan.days[0].meals[0].portions);
    expect(generated.days.map(day=>day.date)).toEqual(plan.days.map(day=>day.date));
    const edited=structuredClone(generated);edited.days[0].meals[0].notes='My checked recipe: simmer for five minutes, then stir.';
    expect(validateDraftPlan(edited,context).days[0].meals[0].notes).toBe(edited.days[0].meals[0].notes);
  });
  it('displays explicit ingredient units without presenting grams as package servings',()=>{
    expect(formatIngredientAmount(40,'g')).toBe('40 g');
    expect(formatIngredientAmount(120,'ml')).toBe('120 ml');
    expect(formatIngredientAmount(2,'1/2 cup (40 g)')).toBe('2 × 1/2 cup (40 g)');
  });
  it('allocates the same stock once across all seven days and reports only the shortage',()=>{
    expect(planShoppingList(fixture(),[lot])).toEqual([{name:'Whole milk',servingLabel:'1 cup',servings:3,reason:'shortage'}]);
    expect(lot.remaining).toBe(4);
  });
  it('preserves unknown quantities and never guesses they cover the week',()=>{
    expect(planShoppingList(fixture(),[{...lot,remaining:null,purchased:null}])).toEqual([{name:'Whole milk',servingLabel:'1 cup',servings:null,reason:'check-quantity'}]);
  });
  it('keeps incompatible serving labels separate when aggregating shopping needs',()=>{
    const plan=fixture();plan.days[0].meals[0].ingredients=[{lotId:null,name:'Oats',servingLabel:'40g',servings:2},{lotId:null,name:'Oats',servingLabel:'1 cup',servings:1}];
    expect(planShoppingList(plan,[lot]).filter(item=>item.name==='Oats')).toHaveLength(2);
  });
  it('computes nutrition and confirmed consumption for one recipe portion only',()=>{
    const meal={...fixture().days[0].meals[0],portions:2,ingredients:[{lotId:lot.id,name:'Whole milk',servingLabel:'1 cup',servings:3}]};
    expect(mealEstimate(meal,[lot])).toEqual({totals:{calories:225,protein:12,carbs:18,fat:12},known:1,total:1,complete:true});
    expect(mealPortionSelections(meal,[lot])).toEqual([{lotId:lot.id,servings:1.5}]);
    expect(mealPortionSelections(meal,[{...lot,remaining:1}])).toBeNull();
    expect(mealPortionSelections(meal,[{...lot,item:{...lot.item,needsReview:true}}])).toBeNull();
  });
  it('does not turn unknown added ingredients into a complete zero-calorie estimate',()=>{
    const meal=fixture().days[0].meals[0];meal.ingredients.push({lotId:null,name:'Cocoa',servingLabel:'1 tbsp',servings:1});
    expect(mealEstimate(meal,[lot])).toMatchObject({known:1,total:2,complete:false});
    expect(mealPortionSelections(meal,[lot])).toBeNull();
  });
  it('rejects dietary conflicts, missing pantry references, and mismatched dates',()=>{
    const preferences=defaultPreferences();const context={lots:[lot],preferences,goals:{calories:2000,protein:100,carbs:200,fat:70},startDate:'2026-09-25'};
    expect(validateDraftPlan(fixture(),context).status).toBe('draft');
    expect(()=>validateDraftPlan(fixture(),{...context,preferences:{...preferences,restrictions:['dairy-free']}})).toThrow('conflicts');
    expect(()=>validateDraftPlan(fixture(),{...context,lots:[]})).toThrow('no longer exists');
    expect(()=>validateDraftPlan(fixture(),{...context,startDate:'2026-09-26'})).toThrow('seven days');
  });
  it('suggests only available, permitted food and never infers expiry',()=>{
    const preferences=defaultPreferences();
    expect(useUpSuggestions([lot],{...preferences,dislikes:['milk']})).toEqual([]);
    expect(useUpSuggestions([{...lot,remaining:0}],preferences)).toEqual([]);
    expect(useUpSuggestions([lot],preferences)[0].reason).toContain('4 labeled servings remain');
  });
});
