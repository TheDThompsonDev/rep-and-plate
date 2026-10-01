import { mealPlanSchema,plannedMealSchema,type MealPlan,type PlannedMeal } from './contracts.ts';

export function shiftPlanDate(day:string,offset:number) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw new Error('Choose a valid calendar date.');
  const date=new Date(`${day}T12:00:00Z`);
  if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day)throw new Error('Choose a valid calendar date.');
  date.setUTCDate(date.getUTCDate()+offset);
  return date.toISOString().slice(0,10);
}

/** An approved plan is never edited in place, including meals already linked to food logs. */
export function createPlanRevision(input:MealPlan):{plan:MealPlan;mealIds:Record<string,string>} {
  const plan=mealPlanSchema.parse(input);
  const mealIds:Record<string,string>={};
  if(plan.status==='approved') {
    plan.id=`plan-${crypto.randomUUID()}`;plan.createdAt=new Date().toISOString();plan.status='draft';
    for(const day of plan.days)for(const meal of day.meals){const id=`planned-meal-${crypto.randomUUID()}`;mealIds[meal.id]=id;meal.id=id;meal.category??='Dinner';}
  } else for(const day of plan.days)for(const meal of day.meals)mealIds[meal.id]=meal.id;
  return {plan,mealIds};
}

export function repeatApprovedWeek(input:MealPlan,startDate:string):MealPlan {
  if(input.status!=='approved')throw new Error('Approve and save this week before repeating it.');
  const lastDay=input.days.at(-1)?.date;
  shiftPlanDate(startDate,0);
  if(!lastDay || startDate<=lastDay)throw new Error('Choose a new week after this plan ends.');
  const {plan}=createPlanRevision(input);
  plan.days=plan.days.map((day,index)=>({...day,date:shiftPlanDate(startDate,index)}));
  return plan;
}

/** Moves a meal inside a draft week without changing its quantities or recorded consumption. */
export function movePlannedMeal(input:MealPlan,mealId:string,targetDate:string):MealPlan {
  if(input.status!=='draft')throw new Error('Create a draft revision before moving a meal.');
  const plan=mealPlanSchema.parse(input);
  const source=plan.days.find(day=>day.meals.some(meal=>meal.id===mealId));
  const target=plan.days.find(day=>day.date===targetDate);
  if(!source || !target)throw new Error('Choose a meal and a date in this week.');
  if(source===target)return plan;
  if(target.meals.length>=4)throw new Error('This day already has four meals. Move one first.');
  const meal=source.meals.find(meal=>meal.id===mealId)!;
  source.meals=source.meals.filter(item=>item.id!==mealId);target.meals.push(meal);
  return plan;
}

export function copyMealToDay(input:MealPlan,mealId:string,targetDate:string):{plan:MealPlan;mealId:string} {
  const original=input.days.flatMap(day=>day.meals).find(meal=>meal.id===mealId);
  if(!original)throw new Error('Choose an existing meal to copy.');
  const {plan}=createPlanRevision(input);
  const target=plan.days.find(day=>day.date===targetDate);
  if(!target || target.meals.length>=4)throw new Error('Choose a day with fewer than four meals.');
  const meal=plannedMealSchema.parse({...original,id:`planned-meal-${crypto.randomUUID()}`,category:original.category??'Dinner'});
  target.meals.push(meal);
  return {plan,mealId:meal.id};
}

export function editPlannedMeal(input:MealPlan,mealId:string,patch:Partial<Pick<PlannedMeal,'title'|'category'|'portions'|'ingredients'|'notes'|'minutes'|'cookingMethod'>>):MealPlan {
  if(input.status!=='draft')throw new Error('Create a draft revision before editing a meal.');
  const plan=mealPlanSchema.parse(input);
  const day=plan.days.find(day=>day.meals.some(meal=>meal.id===mealId));
  if(!day)throw new Error('This meal is no longer in the plan.');
  day.meals=day.meals.map(meal=>{
    if(meal.id!==mealId)return meal;
    const changed=plannedMealSchema.parse({...meal,...patch});
    if(changed.cookingMethod&&(changed.portions!==meal.portions||JSON.stringify(changed.ingredients)!==JSON.stringify(meal.ingredients)))changed.cookingMethod.reviewed=false;
    return changed;
  });
  return plan;
}
