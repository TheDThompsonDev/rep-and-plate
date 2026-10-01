import {z} from 'zod';
import {mealPlanGenerationSchema,mealPlanSchema} from '../src/features/planning/contracts.ts';
import {planningGenerationContext,type PlanningContext} from '../src/features/planning/meal-plans.ts';

/** Provider-only IDs: never infer a pantry link from a name or repair an unknown reference. */
export function createMealPlanReferences(context:PlanningContext) {
  const aliases=context.lots.map((_,index)=>`pantry_item_${index+1}`);
  const originalIds=new Map(aliases.map((alias,index)=>[alias,context.lots[index].id]));
  const {lots,...rest}=planningGenerationContext(context);
  const input={...rest,lots:lots.map((lot,index)=>({
    id:aliases[index],purchased:lot.purchased,remaining:lot.remaining,inconsistent:lot.inconsistent,
    purchaseDate:lot.purchaseDate??null,capturedDate:lot.capturedDate??lot.date,
    item:{name:lot.item.name,receiptText:lot.item.receiptText,quantity:lot.item.quantity,
      serving:lot.item.serving,nutrition:lot.item.nutrition,needsReview:lot.item.needsReview,
      pantryDates:lot.item.pantryDates,price:lot.item.price,
      availability:lot.item.availability,ingredients:lot.item.productSnapshot?.ingredients??''},
  }))};
  const day=mealPlanGenerationSchema.shape.days.element;
  const meal=day.shape.meals.element;
  const lotId=aliases.length?z.enum(aliases as [string,...string[]]).nullable():z.null();
  const ingredient=meal.shape.ingredients.element.extend({lotId});
  const schema=mealPlanGenerationSchema.extend({days:z.array(day.extend({meals:z.array(meal.extend({ingredients:z.array(ingredient).min(1).max(25)})).min(1).max(4)})).length(7)});
  return {input,schema,restore(output:unknown){
    const plan=mealPlanSchema.parse(output);
    for(const day of plan.days)for(const meal of day.meals)for(const ingredient of meal.ingredients){
      if(ingredient.lotId===null)continue;
      const id=originalIds.get(ingredient.lotId);
      if(id===undefined)throw new Error('The plan used an unknown pantry reference. Please try again.');
      ingredient.lotId=id;
    }
    return plan;
  }};
}
