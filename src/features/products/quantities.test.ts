import {expect,it} from 'vitest';
import {packageServings} from './quantities';
import {groceryTotals} from '../../AICards';
import type {GroceryItem,GroceryReceipt} from '../../ai-contract';
it('counts labeled servings across packages without assuming unknown values',()=>{
  expect(packageServings('2','5')).toBe(10);
  expect(packageServings('1.5','2.5')).toBe(3.75);
  for(const [count,servings] of [['','5'],['2',''],['-1','5'],['NaN','5'],['1000','1000']])expect(packageServings(count,servings)).toBeNull();
});
const item=(overrides:Partial<GroceryItem>):GroceryItem=>({id:'item',receiptText:'MILK',name:'Whole milk',quantity:'1 gallon',serving:'1 cup',servingsPurchased:16,nutrition:{calories:150,protein:8,carbs:12,fat:8},match:'user',note:'',sources:[],needsReview:false,availability:'available',...overrides});
const receipt=(items:GroceryItem[]):GroceryReceipt=>({id:'receipt',fingerprint:'f',store:'Market',date:'2026-10-01',items,note:'',sources:[]});
it('keeps receipt totals finite when an edited item carries NaN or missing nutrition',()=>{
  // Q8: the receipt edit form stores Number(field) without validation, so a stray "abc" becomes NaN per serving.
  const edited=item({id:'edited',nutrition:{calories:Number('abc'),protein:8,carbs:12,fat:8}});
  const legacy=item({id:'legacy',nutrition:{calories:120} as GroceryItem['nutrition']});
  const unknownCount=item({id:'unknown',servingsPurchased:null});
  const totals=groceryTotals(receipt([item({}),edited,legacy,unknownCount]));
  expect(totals.total).toEqual({calories:2400,protein:128,carbs:192,fat:128});
  expect(totals.known).toBe(1);
  expect(totals.foods).toBe(4);
});
