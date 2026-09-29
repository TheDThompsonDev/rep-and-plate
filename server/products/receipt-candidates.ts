import type { GroceryReceipt } from '../../src/ai-contract.ts';
import { searchUSDAProducts } from './search.ts';

/** All unresolved lines are eligible; duplicate names share work and at most three searches run at once. */
export async function suggestReceiptProducts(
  receipt:GroceryReceipt, key:string|undefined, signal:AbortSignal, search=searchUSDAProducts,
):Promise<{receipt:GroceryReceipt;attempted:number;found:number}> {
  if(!key || signal.aborted)return {receipt,attempted:0,found:0};
  const selected=receipt.items.filter(item=>item.match!=='nonfood'&&item.match!=='user'&&item.needsReview&&(item.name||item.receiptText).trim().length>=2);
  const queries=[...new Set(selected.map(item=>(item.name||item.receiptText).trim().slice(0,160)))];
  const results=new Map<string,Awaited<ReturnType<typeof search>>>();
  const boundedSignal=AbortSignal.any([signal,AbortSignal.timeout(30000)]);
  let next=0;
  await Promise.all(Array.from({length:Math.min(3,queries.length)},async()=>{
    while(next<queries.length&&!boundedSignal.aborted) {
      const query=queries[next++];
      try {results.set(query,await search(query,key,boundedSignal));}catch { /* A failed line never loses the receipt. */ }
    }
  }));
  if(signal.aborted)return {receipt,attempted:selected.length,found:0};
  const ids=new Set(selected.map(item=>item.id));let found=0;
  const items=receipt.items.map(item=>{
    if(!ids.has(item.id))return item;
    const result=results.get((item.name||item.receiptText).trim().slice(0,160));
    if(result?.status==='candidates'&&result.products.length){found++;return {...item,productCandidates:result.products.slice(0,3)};}
    return item;
  });
  return {receipt:{...receipt,items},attempted:selected.length,found};
}
