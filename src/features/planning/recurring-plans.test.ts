import { describe,it,expect } from 'vitest';
import { mealPlanSchema,mealPlanGenerationSchema,type MealPlan } from './contracts';
import { copyMealToDay,createPlanRevision,editPlannedMeal,movePlannedMeal,repeatApprovedWeek,shiftPlanDate } from './recurring-plans';
import { mealEstimate,planShoppingList,validateDraftPlan } from './meal-plans';
import { defaultPreferences } from '../preferences/contracts';
import type { PantryLot } from '../pantry/ledger';
const fixture=():MealPlan=>({id:'approved-week',createdAt:'2026-09-25T12:00:00Z',status:'approved',days:Array.from({length:7},(_,index)=>({date:shiftPlanDate('2026-09-25',index),meals:[{id:`meal-${index}`,title:`Oatmeal ${index+1}`,portions:1,minutes:10,ingredients:[{lotId:'r::oats',name:'Oats',servingLabel:'1/2 cup',servings:1}],notes:''}]}))});
const lot:PantryLot={id:'r::oats',receiptId:'r',store:'Shop',date:'2026-09-25',purchased:10,remaining:3,inconsistent:false,item:{id:'oats',receiptText:'Oats',name:'Oats',quantity:'10 servings',serving:'1/2 cup',servingsPurchased:10,nutrition:{calories:150,protein:5,carbs:27,fat:3},match:'exact',note:'',sources:[],needsReview:false,availability:'available'}};
describe('repeatable meal-plan drafts',()=>{
  it('reads legacy dinner-only plans while strict generation requires meal categories',()=>{
    const original=fixture();expect(mealPlanSchema.safeParse(original).success).toBe(true);
    expect(mealPlanGenerationSchema.safeParse(original).success).toBe(false);
    const withTypes={...original,days:original.days.map(day=>({...day,meals:day.meals.map(meal=>({...meal,category:'Dinner'}))}))};
    expect(mealPlanGenerationSchema.safeParse(withTypes).success).toBe(true);
  });
  it('repeats an approved week with new dates and identities without changing the saved week',()=>{
    const original=fixture();const snapshot=structuredClone(original);
    const next=repeatApprovedWeek(original,'2026-10-02');
    expect(original).toEqual(snapshot);expect(next.status).toBe('draft');expect(next.id).not.toBe(original.id);
    expect(next.days.map(day=>day.date)).toEqual(['2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06','2026-10-07','2026-10-08']);
    const beforeIds=new Set(original.days.flatMap(day=>day.meals.map(meal=>meal.id)));
    expect(next.days.every(day=>day.meals.every(meal=>!beforeIds.has(meal.id)&&meal.category==='Dinner'))).toBe(true);
    expect(planShoppingList(next,[lot])).toEqual([{name:'Oats',servingLabel:'1/2 cup',servings:4,reason:'shortage'}]);
    expect(lot.remaining).toBe(3);
  });
  it('rejects draft repetition, overlapping weeks, and impossible calendar dates',()=>{
    expect(()=>repeatApprovedWeek({...fixture(),status:'draft'},'2026-10-02')).toThrow('Approve');
    expect(()=>repeatApprovedWeek(fixture(),'2026-09-30')).toThrow('after');
    expect(()=>repeatApprovedWeek(fixture(),'2027-02-31')).toThrow('valid calendar');
  });
  it('creates a separate revision before editing a meal already approved or logged',()=>{
    const original=fixture();const {plan,mealIds}=createPlanRevision(original);
    const edited=editPlannedMeal(plan,mealIds['meal-0'],{title:'Oats for two',category:'Breakfast',portions:2});
    expect(original.days[0].meals[0]).toMatchObject({id:'meal-0',title:'Oatmeal 1',portions:1});
    expect(edited.days[0].meals[0]).toMatchObject({title:'Oats for two',category:'Breakfast',portions:2});
    expect(mealEstimate(edited.days[0].meals[0],[lot]).totals.calories).toBe(75);
    expect(()=>editPlannedMeal(original,'meal-0',{title:'Changed'})).toThrow('draft revision');
  });
  it('moves meals between dates, permits empty days, and keeps the four-meal daily limit',()=>{
    const {plan,mealIds}=createPlanRevision(fixture());
    const moved=movePlannedMeal(plan,mealIds['meal-0'],'2026-09-26');
    expect(moved.days[0].meals).toEqual([]);expect(moved.days[1].meals).toHaveLength(2);expect(plan.days[0].meals).toHaveLength(1);
    expect(mealPlanSchema.safeParse(moved).success).toBe(true);
    const three=copyMealToDay(moved,moved.days[1].meals[0].id,'2026-09-26');
    const four=copyMealToDay(three.plan,three.mealId,'2026-09-26');
    expect(()=>copyMealToDay(four.plan,four.mealId,'2026-09-26')).toThrow('fewer than four');
    expect(()=>movePlannedMeal(four.plan,four.plan.days[2].meals[0].id,'2026-09-26')).toThrow('four meals');
  });
  it('allows explicit per-meal portions on manual save while generated plans respect household size',()=>{
    const {plan,mealIds}=createPlanRevision(fixture());const edited=editPlannedMeal(plan,mealIds['meal-0'],{portions:2});
    const context={lots:[lot],preferences:defaultPreferences(),goals:{calories:2000,protein:100,carbs:200,fat:70},startDate:'2026-09-25'};
    expect(()=>validateDraftPlan(edited,context)).toThrow('household');
    expect(validateDraftPlan(edited,context,{enforceHousehold:false}).days[0].meals[0].portions).toBe(2);
  });
});

describe('full-day meal generation',()=>{
  const context={lots:[lot],preferences:defaultPreferences(),goals:{calories:2000,protein:100,carbs:200,fat:70},startDate:'2026-09-25'};
  it('supports all four selected meal categories on each of seven days',()=>{
    const categories=['Breakfast','Lunch','Dinner','Snack'] as const;
    const plan={...fixture(),days:fixture().days.map(day=>({...day,meals:categories.map(category=>({...day.meals[0],id:`${day.meals[0].id}-${category}`,category}))}))};
    const validated=validateDraftPlan(plan,{...context,mealCategories:[...categories]});
    expect(validated.days.flatMap(day=>day.meals)).toHaveLength(28);
    expect(validated.days.every(day=>day.meals.length===4)).toBe(true);
  });
  it('rejects missing, duplicated, and unexpected daily meal categories',()=>{
    const categories=['Breakfast','Dinner'] as const;
    const plan={...fixture(),days:fixture().days.map(day=>({...day,meals:categories.map(category=>({...day.meals[0],id:`${day.meals[0].id}-${category}`,category}))}))};
    const missing=structuredClone(plan);missing.days[0].meals.pop();
    expect(()=>validateDraftPlan(missing,{...context,mealCategories:[...categories]})).toThrow('exactly one');
    const duplicate=structuredClone(plan);duplicate.days[0].meals[0].category='Dinner';
    expect(()=>validateDraftPlan(duplicate,{...context,mealCategories:[...categories]})).toThrow('exactly one');
    expect(()=>validateDraftPlan(plan,{...context,mealCategories:['Breakfast','Lunch']})).toThrow('exactly one');
    expect(()=>validateDraftPlan(plan,{...context,mealCategories:['Dinner','Dinner']})).toThrow('only once');
    expect(()=>validateDraftPlan(plan,{...context,mealCategories:[]})).toThrow();
  });
  it('defaults legacy generation to Dinner but permits explicitly edited schedules when saving',()=>{
    expect(validateDraftPlan(fixture(),context).days).toHaveLength(7);
    const {plan,mealIds}=createPlanRevision(fixture());
    let edited=editPlannedMeal(plan,mealIds['meal-0'],{category:'Breakfast',portions:2});
    edited=movePlannedMeal(edited,mealIds['meal-0'],'2026-09-26');
    expect(()=>validateDraftPlan(edited,context)).toThrow('exactly one');
    expect(validateDraftPlan(edited,context,{enforceHousehold:false,enforceCategories:false}).days[0].meals).toEqual([]);
  });
});
