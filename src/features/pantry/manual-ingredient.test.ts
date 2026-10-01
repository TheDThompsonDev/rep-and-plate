import {expect,it} from 'vitest';
import {initialState} from '../../domain';
import {addManualPantryIngredient} from './manual-ingredient';
import {getPantryLots} from './ledger';
it('adds explicitly confirmed stock once without creating intake or assuming a purchase',()=>{
  const input={name:'Oats',serving:'40 g',servings:2.5,nutrition:{calories:150,protein:5,carbs:27,fat:3}};
  const before=initialState();const next=addManualPantryIngredient(before,input,'test');
  expect(getPantryLots(next)[0].remaining).toBe(2.5);expect(next.meals).toEqual(before.meals);
  expect(next.groceries?.[0].purchase).toBeUndefined();expect(addManualPantryIngredient(next,input,'test')).toBe(next);
  expect(()=>addManualPantryIngredient(before,{...input,servings:-1},'bad')).toThrow();
});
