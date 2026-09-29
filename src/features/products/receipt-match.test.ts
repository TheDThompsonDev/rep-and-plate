import {describe,it,expect} from 'vitest';
import {applyReceiptProduct} from './receipt-match';
import {resultFixture} from '../../../tests/ai-fixtures';
import {initialState,sumNutrition,type AppState} from '../../domain';
import {mealFromPantry,updatePantryItem} from '../pantry/ledger';
import type {FoodProduct} from './contracts';
const product:FoodProduct={id:'usda-fixture',gtin:'00049000006346',name:'Fixture milk',brand:'Fixture',ingredients:'Milk',serving:{label:'1 cup (240 ml)',amount:240,unit:'ml'},basis:'100ml',nutrition:{calories:60,protein:3,carbs:5,fat:3},source:{provider:'usda',id:'1',url:'https://fdc.nal.usda.gov/food-details/1/nutrients',fetchedAt:'2026-09-25',updatedAt:null,release:null},verification:'source',version:'v1'};
describe('confirmed receipt product selection',()=>{
 it('preserves printed evidence, scales a coherent basis, and clears old purchase counts unless confirmed',()=>{
  const item=resultFixture('receipt').receipt!.items[0];const next=applyReceiptProduct(item,product,null);
  expect(next.receiptText).toBe(item.receiptText);expect(next.quantity).toBe(item.quantity);expect(next.servingsPurchased).toBeNull();expect(next.nutrition?.calories).toBe(144);expect(next.productSnapshot?.version).toBe('v1');expect(item.nutrition?.calories).toBe(150);
 });
 it('does not invent per-serving nutrition from incompatible units',()=>{const next=applyReceiptProduct(resultFixture('r').receipt!.items[0],{...product,basis:'100g'},4);expect(next.nutrition).toBeNull();expect(next.needsReview).toBe(true);expect(next.servingsPurchased).toBe(4);});
 it('does not replace the identity or serving basis behind consumed stock',()=>{
  const receipt=resultFixture('r').receipt!;let state:AppState={...initialState(),groceries:[receipt]};state=mealFromPantry(state,[{lotId:'r::r-0',servings:0.5}],'meal','Breakfast','Milk');
  const item=receipt.items[0];expect(()=>updatePantryItem(state,'r',applyReceiptProduct(item,product,16))).toThrow(/quantity history/);expect(()=>updatePantryItem(state,'r',{...item,serving:'1 tablespoon'})).toThrow(/quantity history/);
  const unchanged=updatePantryItem(state,'r',{...item,note:'Checked the same package'});expect(sumNutrition(unchanged.meals)).toEqual(sumNutrition(state.meals));
 });
});
