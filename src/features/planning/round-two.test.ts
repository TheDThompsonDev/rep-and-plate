import {describe,it,expect} from 'vitest';
import {initialState} from '../../domain';
import {addManualPantryIngredient} from '../pantry/manual-ingredient';
import {getPantryLots} from '../pantry/ledger';
import {receiptSpending} from '../shopping/shopping';
import {firstWeekSteps} from './first-week';
import {defaultPreferences} from '../preferences/contracts';
import * as planning from './meal-plans';
import {mealPlanGenerationSchema,mealPlanSchema,type CookingStep,type MealPlan} from './contracts';
const context={lots:[],preferences:defaultPreferences(),goals:{calories:2000,protein:110,carbs:250,fat:78},startDate:'2026-10-01',variety:'varied' as const,pantryMode:'shopping-supported' as const};
const method:{steps:CookingStep[];reviewed:boolean}={steps:[{action:'combine',ingredientIndexes:[0,1],minutes:null,temperatureC:null},{action:'simmer',ingredientIndexes:[0,1],minutes:10,temperatureC:null},{action:'serve',ingredientIndexes:[0,1,2],minutes:null,temperatureC:null}],reviewed:true};
function plan():MealPlan {return {id:'test',createdAt:'2026-09-30T12:00:00Z',status:'draft',days:Array.from({length:7},(_,i)=>({date:`2026-10-0${i+1}`,meals:[{id:`m${i}`,title:`Different dinner ${i}`,category:'Dinner',portions:1,minutes:15,notes:'Milk covers the whole week.',ingredients:[{lotId:null,name:'Rolled oats',servingLabel:'40 g',servings:1},{lotId:null,name:'Whole milk',servingLabel:'1 cup',servings:1},{lotId:null,name:['Carrot','Spinach','Broccoli'][i%3],servingLabel:'1 cup',servings:1}],cookingMethod:structuredClone(method)}]}))};}
describe('round-two kitchen truth and usable plans',()=>{
 it('separates manual on-hand entry from purchase dates and spending review while retaining stock',()=>{
  const state=addManualPantryIngredient(initialState(),{name:'Oats',serving:'40 g',servings:10,nutrition:{calories:150,protein:5,carbs:27,fat:3}},'origin');
  const lots=getPantryLots(state);expect(lots).toHaveLength(1);expect(lots[0].remaining).toBe(10);
  expect(planning.useUpSuggestions(lots,defaultPreferences())[0].reason).not.toMatch(/purchase/i);
  expect(receiptSpending(state.groceries!)).toEqual({totals:{},stores:{},unpriced:0,covered:0});
  expect(firstWeekSteps(state).find(step=>step.key==='receipt')?.done).toBe(false);
 });
 it('does not infer purchase date for an ordinary receipt without one',()=>{
  const state=addManualPantryIngredient(initialState(),{name:'Oats',serving:'40 g',servings:10,nutrition:{calories:150,protein:5,carbs:27,fat:3}},'origin');
  state.groceries![0].id='real-receipt';state.groceries![0].fingerprint='real-receipt';
  expect(receiptSpending(state.groceries!).unpriced).toBe(1);
  expect(planning.useUpSuggestions(getPantryLots(state),defaultPreferences())[0].reason).not.toMatch(/purchase/i);
  state.groceries![0].purchase={purchaseDate:'2026-09-25',currency:null,subtotal:null,total:null,tax:null,discount:null,confirmed:false};
  expect(planning.useUpSuggestions(getPantryLots(state),defaultPreferences())[0].reason).toContain('2026-09-25 purchase');
 });
 it('keeps optional structured methods but never trusts generated review or provider notes',()=>{
  const original=plan();const generated=planning.validateGeneratedPlan(original,context);
  expect(generated.days[0].meals[0]).toMatchObject({notes:'',cookingMethod:{steps:method.steps,reviewed:false}});
  expect(original.days[0].meals[0]).toMatchObject({cookingMethod:{reviewed:true},notes:'Milk covers the whole week.'});
  expect(generated.days[0].meals[0].ingredients).toEqual(original.days[0].meals[0].ingredients);
  expect(planning.validateDraftPlan({...generated,days:generated.days.map(day=>({...day,meals:day.meals.map(meal=>({...meal,cookingMethod:{...method,reviewed:true}}))}))},context).days[0].meals[0].cookingMethod?.reviewed).toBe(true);
  const legacy=plan();for(const d of legacy.days)for(const m of d.meals)delete m.cookingMethod;expect(mealPlanSchema.parse(legacy).days).toHaveLength(7);
 });
 it('rejects method references to ingredients outside the saved recipe',()=>{
  const input=plan();input.days[0].meals[0].cookingMethod={...method,steps:[{...method.steps[0],ingredientIndexes:[24]}]};
  expect(()=>planning.validateDraftPlan(input,context)).toThrow(/cooking.*ingredient/i);
 });
 it('retains a valid sparse repeated draft and reports pattern repetition rather than dropping it',()=>{
  const input=plan();for(const day of input.days)day.meals[0].title='Oat dinner';
  expect(()=>planning.validateGeneratedPlan(input,context)).not.toThrow();
  expect(planning.planVarietySummary(input)[0]).toMatchObject({category:'Dinner',meals:7,patterns:1});
 });
 it('creates a separate method review revision and invalidates it when recipe amounts change',()=>{
  const original={...plan(),status:'approved' as const};const snapshot=structuredClone(original);
  const revision=planning.reviewCookingMethod(original,'m0',true);
  expect(revision.plan.id).not.toBe(original.id);expect(revision.plan.status).toBe('draft');expect(original).toEqual(snapshot);
  const meal=revision.plan.days[0].meals[0];expect(planning.invalidateCookingReview(meal,{...meal,portions:2}).cookingMethod?.reviewed).toBe(false);
  expect(planning.invalidateCookingReview(meal,{...meal,title:'Renamed only'}).cookingMethod?.reviewed).toBe(true);
  const hostile=plan();(hostile.days[0].meals[0].cookingMethod!.steps[0] as {action:string}).action='You have enough stock';expect(mealPlanGenerationSchema.safeParse(hostile).success).toBe(false);
 });
 it('omits generic targets from provider context but retains explicitly chosen goals',()=>{
  expect(planning.planningGenerationContext(context)).not.toHaveProperty('goals');
  expect(planning.planningGenerationContext({...context,goalsConfigured:false})).not.toHaveProperty('goals');
  expect(planning.planningGenerationContext({...context,goalsConfigured:true}).goals).toEqual(context.goals);
 });
 it('salvages a valid week when an optional method is incomplete, without weakening core validation',()=>{
  const input=plan();input.days[0].meals[0].cookingMethod!.steps=[{action:'combine',ingredientIndexes:[0],minutes:null,temperatureC:null}];
  input.days[1].meals[0].cookingMethod!.steps=[{action:'combine',ingredientIndexes:[24],minutes:null,temperatureC:null}];
  const result=planning.validateGeneratedPlan(input,context);
  expect(result.days[0].meals[0].cookingMethod).toBeNull();expect(result.days[1].meals[0].cookingMethod).toBeNull();expect(result.days[2].meals[0].cookingMethod).toMatchObject({reviewed:false,steps:method.steps});
  expect(result.days.map(day=>day.meals[0].ingredients)).toEqual(input.days.map(day=>day.meals[0].ingredients));expect(result.days.map(day=>day.date)).toEqual(input.days.map(day=>day.date));
  input.days[0].meals[0].ingredients[0].lotId='invented';expect(()=>planning.validateGeneratedPlan(input,context)).toThrow('no longer exists');input.days[0].meals[0].ingredients[0].lotId=null;
  input.days[0].date='2026-10-20';expect(()=>planning.validateGeneratedPlan(input,context)).toThrow('seven days');
 });
 it('requires meaningful cooking references, heat time and baking temperature only for new generation and review',()=>{
  const input=plan(),meal=input.days[0].meals[0];meal.cookingMethod!.steps=[{action:'combine',ingredientIndexes:[0],minutes:null,temperatureC:null}];
  expect(planning.cookingMethodIssue(meal)).toContain('every listed ingredient');expect(()=>planning.reviewCookingMethod(input,'m0',true)).toThrow('every listed ingredient');
  expect(planning.validateDraftPlan(input,context).days).toHaveLength(7);
  meal.cookingMethod!.steps=[{action:'bake',ingredientIndexes:[0,1,2],minutes:null,temperatureC:null}];expect(planning.cookingMethodIssue(meal)).toContain('need a time');
  meal.cookingMethod!.steps[0].minutes=20;expect(planning.cookingMethodIssue(meal)).toContain('oven temperature');
  meal.cookingMethod!.steps[0].temperatureC=180;expect(planning.cookingMethodIssue(meal)).toBeNull();expect(planning.cookingStepText(meal.cookingMethod!.steps[0],meal)).toContain('356');
 });
 it('counts ingredient patterns instead of different titles or rotating vegetables around the same base',()=>{
  const input=plan();expect(planning.planVarietySummary(input)[0].patterns).toBe(1);
  input.days[1].meals[0].ingredients=[{lotId:null,name:'Chickpeas',servingLabel:'1 cup',servings:1},{lotId:null,name:'Rice',servingLabel:'1 cup',servings:1}];
  input.days[2].meals[0].ingredients=[{lotId:null,name:'Tofu',servingLabel:'100 g',servings:1},{lotId:null,name:'Noodles',servingLabel:'100 g',servings:1}];
  expect(planning.planVarietySummary(input)[0].patterns).toBe(3);
 });
});
