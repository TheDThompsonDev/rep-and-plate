import type {GroceryReceipt} from '../../ai-contract';

/** Manual on-hand entries reuse pantry storage, but never represent a purchase. */
export function isPurchaseReceipt(receipt:Pick<GroceryReceipt,'id'|'fingerprint'>) {
  return !receipt.id.startsWith('manual-ingredient:') && !receipt.fingerprint.startsWith('manual-ingredient:');
}
export function purchaseReceipts(receipts:GroceryReceipt[]) {
  return receipts.filter(isPurchaseReceipt);
}
