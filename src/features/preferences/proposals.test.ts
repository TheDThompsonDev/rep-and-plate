import { describe,it,expect } from 'vitest';
import { defaultPreferences } from './contracts';
import { applyPreferenceProposal,preferenceProposalSchema,type PreferenceProposal } from './proposals';

const proposal=(changes:PreferenceProposal['changes']):PreferenceProposal=>({evidence:'Please remember these preferences.',description:'Update the preferences you explicitly shared.',changes});
describe('explicit preference proposals',()=>{
  it('proposes household shopping priorities and a budget without silent memory writes',()=>{
    const current=defaultPreferences();
    const next=applyPreferenceProposal(current,proposal([{field:'shoppingPriority',operation:'set',value:'budget'},{field:'weeklyBudget',operation:'set',value:'125.50'},{field:'shoppingCurrency',operation:'set',value:'CAD'},{field:'preferredStores',operation:'add',value:'Costco'}]));
    expect(next).toMatchObject({shoppingPriority:'budget',weeklyBudget:125.5,shoppingCurrency:'CAD',preferredStores:['Costco']});
    expect(current.weeklyBudget).toBeUndefined();
    expect(()=>applyPreferenceProposal(current,proposal([{field:'weeklyBudget',operation:'set',value:'-10'}]))).toThrow();
    expect(()=>applyPreferenceProposal(current,proposal([{field:'shoppingPriority',operation:'set',value:'invented'}]))).toThrow();
  });
  it('creates a preview without mutating the saved preferences',()=>{
    const current=defaultPreferences();const copy=structuredClone(current);
    const next=applyPreferenceProposal(current,proposal([{field:'restrictions',operation:'add',value:'peanuts'},{field:'cookingMinutes',operation:'set',value:'25'},{field:'householdSize',operation:'set',value:'2'}]));
    expect(current).toEqual(copy);
    expect(next).toMatchObject({restrictions:['peanuts'],cookingMinutes:25,householdSize:2});
  });
  it('deduplicates repeated additions without inventing extra preferences',()=>{
    const current={...defaultPreferences(),favorites:['Oatmeal']};
    const update=proposal([{field:'favorites',operation:'add',value:' oatmeal '},{field:'favorites',operation:'add',value:'OATMEAL'}]);
    const next=applyPreferenceProposal(current,update);
    expect(next.favorites).toEqual(['Oatmeal']);
    expect(applyPreferenceProposal(next,update).favorites).toEqual(['Oatmeal']);
    expect(next.dislikes).toEqual([]);
  });
  it('removes only the named exclusion, without fuzzy or broad removals',()=>{
    const current={...defaultPreferences(),restrictions:['Peanuts','Tree nuts','Dairy-free']};
    const next=applyPreferenceProposal(current,proposal([{field:'restrictions',operation:'remove',value:'peanuts'}]));
    expect(next.restrictions).toEqual(['Tree nuts','Dairy-free']);
    expect(current.restrictions).toEqual(['Peanuts','Tree nuts','Dairy-free']);
  });
  it.each(['20 minutes','1e2','2.5','NaN','Infinity','-1','241','0'])('rejects invalid cooking time %s without partial writes',value=>{
    const current=defaultPreferences();
    expect(()=>applyPreferenceProposal(current,proposal([{field:'dislikes',operation:'add',value:'mushrooms'},{field:'cookingMinutes',operation:'set',value}]))).toThrow();
    expect(current.dislikes).toEqual([]);expect(current.cookingMinutes).toBeNull();
  });
  it('rejects operations that could replace a whole exclusion list or ambiguously reset a scalar',()=>{
    const current={...defaultPreferences(),restrictions:['peanuts']};
    expect(()=>applyPreferenceProposal(current,proposal([{field:'restrictions',operation:'set',value:'milk'}]))).toThrow('one item');
    expect(()=>applyPreferenceProposal(current,proposal([{field:'householdSize',operation:'remove',value:'1'}]))).toThrow('replacement');
    expect(()=>applyPreferenceProposal(current,proposal([{field:'householdSize',operation:'set',value:'21'}]))).toThrow('between 1 and 20');
    expect(current.restrictions).toEqual(['peanuts']);
  });
  it('rejects contradictory changes and duplicate scalar instructions',()=>{
    const current=defaultPreferences();
    expect(()=>applyPreferenceProposal(current,proposal([{field:'restrictions',operation:'add',value:'milk'},{field:'restrictions',operation:'remove',value:'Milk'}]))).toThrow('both adds and removes');
    expect(()=>applyPreferenceProposal(current,proposal([{field:'householdSize',operation:'set',value:'2'},{field:'householdSize',operation:'set',value:'3'}]))).toThrow('more than once');
  });
  it('keeps unknown budget explicit and enforces list bounds',()=>{
    const current={...defaultPreferences(),budget:'economy' as const};
    expect(applyPreferenceProposal(current,proposal([{field:'budget',operation:'set',value:'unknown'}])).budget).toBe('unknown');
    expect(()=>applyPreferenceProposal(current,proposal([{field:'budget',operation:'set',value:'cheap'}]))).toThrow();
    expect(()=>applyPreferenceProposal({...current,dislikes:Array.from({length:30},(_,i)=>`item ${i}`)},proposal([{field:'dislikes',operation:'add',value:'one more'}]))).toThrow();
    expect(preferenceProposalSchema.safeParse({description:'No evidence',changes:[]}).success).toBe(false);
  });
});
