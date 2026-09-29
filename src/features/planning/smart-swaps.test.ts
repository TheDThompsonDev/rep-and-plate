import { describe,it,expect } from 'vitest';
import type { PantryLot } from '../pantry/ledger';
import { defaultPreferences } from '../preferences/contracts';
import { excludedIngredientText } from './exclusions';
import { comparePantryPortions,eligibleSwapLots } from './smart-swaps';
import { validateDraftPlan } from './meal-plans';

const source={provider:'usda' as const,id:'123',url:'https://fdc.nal.usda.gov/food-details/123/nutrients',fetchedAt:'2026-09-25T12:00:00Z',updatedAt:null,release:null};
const lot:PantryLot={id:'r::a',receiptId:'r',store:'Shop',date:'2026-09-25',purchased:4,remaining:4,inconsistent:false,item:{id:'a',receiptText:'Oats',name:'Oats',quantity:'4 servings',serving:'40g',servingsPurchased:4,nutrition:{calories:60,protein:2,carbs:10,fat:1},match:'exact',note:'',sources:[{title:'USDA',url:source.url}],needsReview:false,availability:'available',productSnapshot:{id:'usda-123',gtin:'00012345678905',name:'Oats',brand:'Test',ingredients:'Oats',serving:{label:'40g',amount:40,unit:'g'},nutrition:{calories:150,protein:5,carbs:25,fat:2.5},basis:'100g',source,verification:'source',version:'1'}}};
const other:PantryLot={...lot,id:'r::b',item:{...lot.item,id:'b',name:'Other oats',serving:'1/2 cup (50g)',nutrition:{calories:75,protein:3,carbs:12,fat:2}}};

describe('real pantry macro comparisons',()=>{
  it('uses normalized saved nutrition, not the raw per-100g source values',()=>{
    const result=comparePantryPortions(lot,other,.5,2,defaultPreferences());
    expect(result?.from).toEqual({calories:30,protein:1,carbs:5,fat:.5});
    expect(result?.to).toEqual({calories:150,protein:6,carbs:24,fat:4});
    expect(result?.difference).toEqual({calories:120,protein:5,carbs:19,fat:3.5});
    expect(lot.remaining).toBe(4);
  });
  it('does not compare missing nutrition, review-needed labels, excluded ingredients, or invalid amounts',()=>{
    expect(comparePantryPortions(lot,{...other,item:{...other.item,nutrition:null}},1,1,defaultPreferences())).toBeNull();
    expect(comparePantryPortions(lot,{...other,item:{...other.item,needsReview:true}},1,1,defaultPreferences())).toBeNull();
    expect(comparePantryPortions(lot,other,0,1,defaultPreferences())).toBeNull();
    expect(comparePantryPortions(lot,other,1,Infinity,defaultPreferences())).toBeNull();
    expect(comparePantryPortions(lot,lot,1,1,defaultPreferences())).toBeNull();
    expect(eligibleSwapLots([lot,other],{...defaultPreferences(),dislikes:['oats']})).toEqual([]);
  });
  it('marks unknown stock and missing ingredients as unknown rather than verified suitable',()=>{
    const uncertain={...other,remaining:null,item:{...other.item,productSnapshot:undefined}};
    const result=comparePantryPortions(lot,uncertain,5,1,defaultPreferences());
    expect(result?.notes).toHaveLength(3);
    expect(result?.notes.join(' ')).toContain('quantity is unknown');
    expect(result?.notes.join(' ')).toContain('ingredient list');
    expect(result?.notes.join(' ')).toContain('less than this comparison uses');
  });
  it('checks saved ingredient lists for allergen aliases hidden by the product name',()=>{
    const sauce={...other,item:{...other.item,name:'Cooking sauce',productSnapshot:{...lot.item.productSnapshot!,ingredients:'Water, sodium caseinate, salt'}}};
    expect(eligibleSwapLots([sauce],{...defaultPreferences(),restrictions:['dairy-free']})).toEqual([]);
    expect(excludedIngredientText('Tahini dressing',{...defaultPreferences(),restrictions:['sesame allergy']})).toBe('tahini');
    expect(excludedIngredientText('Soybean lecithin',{...defaultPreferences(),restrictions:['soy']})).toBe('soybean');
    expect(excludedIngredientText('Groundnuts',{...defaultPreferences(),restrictions:['peanuts']})).toBe('groundnut');
  });
  it('uses word boundaries and distinguishes explicitly named plant milks from dairy',()=>{
    const preferences={...defaultPreferences(),restrictions:['vegetarian']};
    expect(excludedIngredientText('Chamomile tea',preferences)).toBeUndefined();
    expect(excludedIngredientText('Graham crackers',preferences)).toBeUndefined();
    expect(excludedIngredientText('Ham sandwich',preferences)).toBe('ham');
    expect(excludedIngredientText('Oat milk, water, oats',{...defaultPreferences(),restrictions:['dairy-free']})).toBeUndefined();
    expect(excludedIngredientText('Oat milk blend, whey protein',{...defaultPreferences(),restrictions:['dairy-free']})).toBe('whey');
  });
  it('applies snapshot ingredient exclusions to weekly plan validation too',()=>{
    const sauce={...lot,item:{...lot.item,name:'Cooking sauce',productSnapshot:{...lot.item.productSnapshot!,ingredients:'Sodium caseinate'}}};
    const preferences={...defaultPreferences(),restrictions:['milk']};
    const plan={id:'plan',status:'draft',createdAt:'2026-09-25',days:Array.from({length:7},(_,index)=>{const date=new Date('2026-09-25T12:00:00Z');date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),meals:[{id:`m-${index}`,title:'Sauce meal',portions:1,minutes:5,ingredients:[{lotId:lot.id,name:'Sauce',servingLabel:'1 tbsp',servings:1}],notes:''}]};})};
    expect(()=>validateDraftPlan(plan,{lots:[sauce],preferences,goals:{calories:2000,protein:100,carbs:200,fat:70},startDate:'2026-09-25'})).toThrow('caseinate');
  });
});
