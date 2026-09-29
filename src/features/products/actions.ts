import type { AppState } from "../../domain";
import { today, clockTime } from "../../domain";
import { nutritionForServing, type FoodProduct } from "./contracts";

export function savePrivateProduct(state: AppState, product: FoodProduct): AppState {
  return { ...state, products: [...(state.products ?? []).filter(p => p.gtin !== product.gtin), product] };
}
export function captureProduct(state: AppState, product: FoodProduct, action: "grocery" | "meal", servings: number, actionId: string): AppState {
  if (!Number.isFinite(servings) || servings <= 0 || servings > 1000 || state.messages.some(m => m.id === actionId)) return state;
  const nutrition = nutritionForServing(product);
  const sources = product.source.url ? [{title: "USDA FoodData Central",url:product.source.url}] : [];
  if (action === "meal" && !nutrition) return state;
  if (action === "meal" && nutrition && Object.values(nutrition).some(n=>n*servings>20000)) return state;
  const receiptId = `product-${actionId}`, mealId = `product-meal-${actionId}`;
  const saved = {
    ...state,
    messages: [...state.messages, {id: actionId, role: "assistant" as const, time: clockTime(), ai: true, aiStatus:"complete" as const,
      text: action === "grocery" ? `${product.name} saved to your groceries. This doesn't count toward today's intake.` : `${product.name} added to your day. ${servings} serving${servings === 1 ? "" : "s"}.`,
      receiptId: action === "grocery" ? receiptId : undefined, mealId: action === "meal" ? mealId : undefined, sources }],
  };
  if (action === "meal") return {...saved, meals:[...state.meals,{...Object.fromEntries(Object.entries(nutrition!).map(([k,v])=>[k,Math.round(v*servings*100)/100])) as NonNullable<ReturnType<typeof nutritionForServing>>,
    id:mealId,title:product.name,category:"Snack",day:today(),time:clockTime(),source:product.source.provider === "label" ? "Your confirmed label" : "USDA FoodData Central",
    confidence:"confirmed",note:`${servings} × ${product.serving.label}. Product snapshot ${product.version}.`,components:[{id:`${mealId}-component`,name:product.name,servings,servingLabel:product.serving.label,nutrition:Object.fromEntries(Object.entries(nutrition!).map(([k,v])=>[k,v*servings])) as NonNullable<ReturnType<typeof nutritionForServing>>,sourceUrls:sources.map(s=>s.url),productSnapshot:product}]} ]};
  return {...saved,groceries:[...(state.groceries ?? []),{id:receiptId,fingerprint:receiptId,store:"Scanned groceries",date:today(),note:"Added from a barcode. Quantities are labeled servings.",sources,
    items:[{id:receiptId+"-item",receiptText:product.gtin,name:product.name,quantity:`${servings} servings`,serving:product.serving.label,servingsPurchased:servings,nutrition,productSnapshot:product,
      match:product.source.provider === "label" ? "user" : "exact",note:`${product.brand}. ${product.source.provider === "label" ? "Label confirmed by you" : "USDA source record; check your package if it differs"}. Version ${product.version}.`,sources,needsReview:!nutrition,availability:"available"}]}]};
}
