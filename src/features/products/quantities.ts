/** Package counts are explicit user inputs; never infer them from receipt text. */
export function packageServings(packages:string,servingsPerPackage:string):number|null {
  if(!packages.trim()||!servingsPerPackage.trim())return null;
  const count=Number(packages),servings=Number(servingsPerPackage),total=count*servings;
  return Number.isFinite(total)&&count>0&&servings>0&&total<=10000?Math.round(total*10000)/10000:null;
}
export type NutritionPerServing={calories:number;protein:number;carbs:number;fat:number};
type Purchased={nutrition?:Partial<NutritionPerServing>|null;servingsPurchased?:number|null};
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
/** Receipt totals only count items whose per-serving nutrition and purchased servings are all finite
 * numbers. Edited or legacy records can carry NaN or missing fields; those items are left out of the
 * total and reported in the count instead of turning every total into NaN. */
export function hasCountableNutrition<T extends Purchased>(item:T):item is T&{nutrition:NutritionPerServing;servingsPurchased:number} {
  const n=item.nutrition;
  return !!n&&finite(n.calories)&&finite(n.protein)&&finite(n.carbs)&&finite(n.fat)&&finite(item.servingsPurchased)&&item.servingsPurchased>0;
}
export function sumPurchasedNutrition<T extends Purchased>(items:readonly T[]):{total:NutritionPerServing;counted:number} {
  const countable=items.filter(hasCountableNutrition);
  const total=countable.reduce<NutritionPerServing>((s,item)=>({
    calories:s.calories+item.nutrition.calories*item.servingsPurchased,
    protein:s.protein+item.nutrition.protein*item.servingsPurchased,
    carbs:s.carbs+item.nutrition.carbs*item.servingsPurchased,
    fat:s.fat+item.nutrition.fat*item.servingsPurchased,
  }),{calories:0,protein:0,carbs:0,fat:0});
  return {total,counted:countable.length};
}
