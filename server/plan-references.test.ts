import {describe,it,expect} from 'vitest';
import {createMealPlanReferences} from './plan-references';
import {defaultPreferences} from '../src/features/preferences/contracts';
import {type PlanningContext,validateGeneratedPlan} from '../src/features/planning/meal-plans';
import type {MealPlan} from '../src/features/planning/contracts';
const context:PlanningContext={goals:{calories:2000,protein:110,carbs:250,fat:78},goalsConfigured:false,preferences:defaultPreferences(),startDate:'2026-10-01',pantryMode:'shopping-supported',variety:'varied',lots:[0,1].map(i=>({id:`private-receipt-${i}::private-item-${i}`,receiptId:`private-receipt-${i}`,store:'Synthetic market',date:'2026-09-30',purchaseDate:null,capturedDate:'2026-09-30',purchased:20,remaining:20,inconsistent:false,item:{id:`private-item-${i}`,receiptText:'WHOLE MILK',name:'Whole milk',quantity:'20 servings',serving:'1 cup',servingsPurchased:20,nutrition:{calories:150,protein:8,carbs:12,fat:8},match:'user',note:'',sources:[],needsReview:false,availability:'available'}}))};
function fixture(lotId:string|null):MealPlan{return {id:'draft',createdAt:'',status:'draft',days:Array.from({length:7},(_,i)=>({date:`2026-10-0${i+1}`,meals:[{id:`meal-${i}`,title:'Milk idea',category:'Dinner',portions:1,minutes:1,notes:'',cookingMethod:null,ingredients:[{lotId,name:'Whole milk',servingLabel:'1 cup',servings:1}]}]}))};}
describe('request-local meal planning references',()=>{
 it('exposes short distinct IDs without raw receipt or nested item identifiers and preserves necessary stock context',()=>{
  const dated=structuredClone(context);dated.lots[0].item.pantryDates={labelKind:'best-before',labelDate:'2026-10-05',openedDate:'2026-09-30'};
  dated.lots[0].item.price={total:5.25,discount:0};
  const original=structuredClone(dated),refs=createMealPlanReferences(dated);
  expect(refs.input.lots.map(lot=>lot.id)).toEqual(['pantry_item_1','pantry_item_2']);expect(JSON.stringify(refs.input)).not.toContain('private-');expect(refs.input).not.toHaveProperty('goals');
  expect(refs.input.lots[0]).toMatchObject({remaining:20,inconsistent:false,item:{name:'Whole milk',serving:'1 cup',nutrition:{calories:150},needsReview:false,availability:'available',pantryDates:dated.lots[0].item.pantryDates,price:dated.lots[0].item.price}});expect(dated).toEqual(original);
 });
 it('constrains structured output to known aliases or explicit missing ingredients',()=>{
  const refs=createMealPlanReferences(context);expect(refs.schema.safeParse(fixture('pantry_item_1')).success).toBe(true);expect(refs.schema.safeParse(fixture(null)).success).toBe(true);
  expect(refs.schema.safeParse(fixture('pantry_item_99')).success).toBe(false);expect(refs.schema.safeParse(fixture(context.lots[0].id)).success).toBe(false);
 });
 it('round-trips exact aliases for identically named lots without changing source plan or stock',()=>{
  const refs=createMealPlanReferences(context),plan=fixture('pantry_item_2'),before=structuredClone(plan),stock=structuredClone(context.lots);plan.days[0].meals[0].ingredients.push({lotId:'pantry_item_1',name:'Same name',servings:0.5,servingLabel:'1 cup'});const source=structuredClone(plan);
  const restored=refs.restore(plan);expect(restored.days[0].meals[0].ingredients.map(i=>i.lotId)).toEqual([context.lots[1].id,context.lots[0].id]);expect(plan).toEqual(source);expect(context.lots).toEqual(stock);expect(before.days[0].meals[0].ingredients).toHaveLength(1);
  const valid=validateGeneratedPlan(restored,context);expect(valid.days).toHaveLength(7);expect(context.lots).toEqual(stock);
 });
 it('rejects an unknown alias rather than inferring the same-name pantry food',()=>{
  const refs=createMealPlanReferences(context),stock=structuredClone(context.lots);expect(()=>refs.restore(fixture('pantry_item_99'))).toThrow(/unknown pantry reference/i);expect(context.lots).toEqual(stock);
 });
 it('requires null for added ingredients when there are no pantry lots',()=>{
  const refs=createMealPlanReferences({...context,lots:[]});expect(refs.schema.safeParse(fixture(null)).success).toBe(true);expect(refs.schema.safeParse(fixture('pantry_item_1')).success).toBe(false);expect(refs.restore(fixture(null)).days[0].meals[0].ingredients[0].lotId).toBeNull();
 });
 it('retains core validation after mapping instead of repairing quantities, dates or restrictions',()=>{
  const refs=createMealPlanReferences(context),plan=fixture('pantry_item_1');plan.days[0].date='2026-10-30';expect(()=>validateGeneratedPlan(refs.restore(plan),context)).toThrow('seven days');plan.days[0].date='2026-10-01';
  expect(()=>validateGeneratedPlan(refs.restore(plan),{...context,preferences:{...context.preferences,restrictions:['dairy-free']}})).toThrow('conflicts');plan.days[0].meals[0].ingredients[0].servings=0;expect(refs.schema.safeParse(plan).success).toBe(false);
 });
});
