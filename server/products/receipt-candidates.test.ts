import { describe,expect,it,vi } from 'vitest';
import { resultFixture } from '../../tests/ai-fixtures';
import { normalizeUSDA } from './usda';
import { suggestReceiptProducts } from './receipt-candidates';
import type { searchUSDAProducts } from './search';

const product=normalizeUSDA({fdcId:123,gtinUpc:'012345678905',description:'Whole milk',brandOwner:'Fixture',dataType:'Branded',servingSize:240,servingSizeUnit:'ml',householdServingFullText:'1 cup',labelNutrients:{calories:{value:150},protein:{value:8},carbohydrates:{value:12},fat:{value:8}}})!;
describe('automatic receipt candidate review',()=>{
  it('searches beyond the first three unique lines with bounded concurrency',async()=>{
    const receipt=resultFixture('many-lines').receipt!;
    receipt.items=Array.from({length:12},(_,i)=>({...receipt.items[0],id:String(i),name:`Item ${i}`,needsReview:true}));
    let active=0,peak=0;
    const search=vi.fn<typeof searchUSDAProducts>().mockImplementation(async()=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return {status:'candidates',products:[product],message:'Check.'};});
    const result=await suggestReceiptProducts(receipt,'synthetic',new AbortController().signal,search);
    expect(result.found).toBe(12);expect(search).toHaveBeenCalledTimes(12);expect(peak).toBeLessThanOrEqual(3);
  });
  it('bounds retrieval and preserves receipt evidence, nutrients, amounts and uncertainty',async()=>{
    const receipt=resultFixture('receipt').receipt!;
    receipt.items=Array.from({length:8},(_,index)=>({...receipt.items[0],id:String(index),receiptText:'WHL MLK',name:'Whole milk',needsReview:true,match:'generic' as const}));
    const before=structuredClone(receipt);
    const search=vi.fn<typeof searchUSDAProducts>().mockResolvedValue({status:'candidates',products:[product,product,product,product],message:'Compare packages.'});
    const result=await suggestReceiptProducts(receipt,'synthetic-key',new AbortController().signal,search);
    expect(search).toHaveBeenCalledTimes(1);expect(search.mock.calls[0][0]).toBe('Whole milk');
    expect(result.found).toBe(8);
    expect(result.receipt.items[0].productCandidates).toHaveLength(3);
    expect(result.receipt.items.map(({productCandidates,...item})=>item)).toEqual(before.items);
    expect(receipt).toEqual(before);expect(result.receipt.items[7].productCandidates).toHaveLength(3);
  });
  it('keeps capture available when USDA is unavailable and skips nonfood or confirmed items',async()=>{
    const receipt=resultFixture('receipt').receipt!;
    receipt.items[0].match='nonfood';receipt.items[0].needsReview=true;
    const search=vi.fn<typeof searchUSDAProducts>().mockRejectedValue(new Error('provider failure'));
    const result=await suggestReceiptProducts(receipt,'synthetic',new AbortController().signal,search);
    expect(result.receipt).toEqual(receipt);expect(result.found).toBe(0);expect(search).toHaveBeenCalledTimes(1);
    receipt.items[1].match='user';
    expect((await suggestReceiptProducts(receipt,'synthetic',new AbortController().signal,search)).attempted).toBe(0);
  });
  it('does not issue requests without a key or after cancellation',async()=>{
    const receipt=resultFixture('receipt').receipt!;const search=vi.fn<typeof searchUSDAProducts>();
    await suggestReceiptProducts(receipt,undefined,new AbortController().signal,search);
    const controller=new AbortController();controller.abort();
    await suggestReceiptProducts(receipt,'synthetic',controller.signal,search);
    expect(search).not.toHaveBeenCalled();
  });
});
