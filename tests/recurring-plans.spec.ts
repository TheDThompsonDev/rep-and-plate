import { test,expect,type Page } from '@playwright/test';

const stored=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('fuel.prototype.v1')!));
async function seedWeek(page:Page) {
  await page.goto('/');
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
    state.groceries=[{id:'repeat-shop',fingerprint:'repeat-shop',store:'Test pantry',date:'2026-09-25',note:'',sources:[],items:[{id:'oats',receiptText:'Oats',name:'Oats',quantity:'10 servings',serving:'1/2 cup',servingsPurchased:10,nutrition:{calories:150,protein:5,carbs:27,fat:3},match:'exact',note:'',sources:[],needsReview:false,availability:'available'}]}];
    state.pantryEvents=[{id:'stock-check',lotId:'repeat-shop::oats',kind:'adjusted',servings:-7,createdAt:'2026-09-25T12:00:00Z',note:'Counted three servings remaining.'}];
    state.mealPlans=[{id:'original-approved',createdAt:'2026-09-25T12:00:00Z',status:'approved',days:Array.from({length:7},(_,index)=>{const date=new Date('2026-09-25T12:00:00Z');date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),meals:[{id:`original-${index}`,title:`Oatmeal ${index+1}`,portions:1,minutes:10,ingredients:[{lotId:'repeat-shop::oats',name:'Oats',servingLabel:'1/2 cup',servings:1}],notes:'Prepare oats with water.'}]};})}];
    localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  });await page.reload();
}
async function openPlan(page:Page) {
  await page.getByRole('button',{name:'Open chat menu'}).click();
  await page.getByRole('button',{name:'Plan my week',exact:true}).click();
}
test.beforeEach(async({page})=>{
  await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));
  await page.route('**/api/chat',route=>route.abort());
});

test('approved weeks repeat into editable drafts with fresh shortages and no automatic logging',async({page})=>{
  let generated=0;await page.route('**/api/plans/meals',route=>{generated++;return route.abort();});
  await seedWeek(page);const before=await stored(page);const original=before.mealPlans[0];
  await openPlan(page);
  await page.getByLabel('Repeat week starting',{exact:true}).fill('2026-10-02');
  await page.getByRole('button',{name:'Repeat this week as a draft',exact:true}).click();
  await expect(page.locator('.fuel-plan-status')).toContainText('Draft to review');
  await expect(page.getByRole('button',{name:'Log one portion',exact:true})).toHaveCount(0);
  await expect(page.locator('.fuel-plan-shopping')).toContainText('4 additional servings');
  expect((await stored(page)).mealPlans).toEqual(before.mealPlans);
  expect((await stored(page)).meals).toEqual(before.meals);
  expect((await stored(page)).pantryEvents).toEqual(before.pantryEvents);
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  let saved=await stored(page);
  expect(saved.mealPlans).toHaveLength(2);expect(saved.mealPlans[0]).toEqual(original);
  const repeatedId=saved.mealPlans[1].id;expect(repeatedId).not.toBe(original.id);
  expect(saved.mealPlans[1].days[0].date).toBe('2026-10-02');
  expect(saved.mealPlans[1].days[0].meals[0].id).not.toBe(original.days[0].meals[0].id);
  await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();
  await page.getByLabel('Meal name',{exact:true}).fill('Morning oats');
  await page.getByLabel('Meal type',{exact:true}).selectOption('Breakfast');
  await page.getByLabel('Recipe portions',{exact:true}).fill('2');
  await page.getByLabel('Meal day',{exact:true}).selectOption('2026-10-03');
  await expect(page.locator('.fuel-plan-day').first()).toContainText('Nothing planned for this day yet');
  await page.getByRole('button',{name:'Done editing',exact:true}).click();
  await page.getByRole('button',{name:'Approve this plan',exact:true}).click();
  saved=await stored(page);
  expect(saved.mealPlans).toHaveLength(2);expect(saved.mealPlans[0]).toEqual(original);
  const repeated=saved.mealPlans.find((plan:any)=>plan.id===repeatedId);
  expect(repeated.status).toBe('approved');expect(repeated.days[0].meals).toEqual([]);
  expect(repeated.days[1].meals.find((meal:any)=>meal.title==='Morning oats')).toMatchObject({category:'Breakfast',portions:2});
  expect(saved.meals).toEqual(before.meals);expect(saved.pantryEvents).toEqual(before.pantryEvents);
  await page.reload();await openPlan(page);
  const meal=page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Morning oats',exact:true})});
  await expect(meal).toContainText('Breakfast · 2 portions');
  await expect(meal).toContainText('75 cal');
  await meal.getByRole('button',{name:'Log one portion',exact:true}).click();
  let after=await stored(page);expect(after.meals.at(-1)).toMatchObject({title:'Morning oats',category:'Breakfast',calories:75});
  expect(after.pantryEvents.filter((event:any)=>event.kind==='consumed')).toHaveLength(1);
  expect(after.meals.at(-1).id).toContain(repeatedId);
  // Selecting the older approved week must use that week's identity, not the newest saved plan.
  await page.getByLabel('Saved meal-plan weeks').selectOption('original-approved');
  await page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Oatmeal 1',exact:true})}).getByRole('button',{name:'Log one portion',exact:true}).click();
  after=await stored(page);expect(after.meals.at(-1).id).toContain('original-approved');
  expect(after.meals.at(-1).category).toBe('Dinner');
  expect(after.meals).toHaveLength(before.meals.length+2);expect(generated).toBe(0);
  await page.reload();await openPlan(page);
  await expect(page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Morning oats',exact:true})}).getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  await page.getByLabel('Saved meal-plan weeks').selectOption('original-approved');
  await expect(page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Oatmeal 1',exact:true})}).getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  const replayed=await stored(page);
  expect(replayed.meals).toEqual(after.meals);
  expect(replayed.pantryEvents).toEqual(after.pantryEvents);
  expect(replayed.mealPlans.find((plan:any)=>plan.id==='original-approved')).toEqual(original);
});

test('editing or extending an approved week creates a new revision and preserves existing identities',async({page})=>{
  await seedWeek(page);const before=await stored(page);await openPlan(page);
  await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();
  await expect(page.locator('.fuel-plan-status')).toContainText('Draft to review');
  await page.getByLabel('Meal name',{exact:true}).fill('Lunch oats');
  await page.getByLabel('Meal type',{exact:true}).selectOption('Lunch');
  await page.getByRole('button',{name:'Done editing',exact:true}).click();
  await page.getByRole('button',{name:'Add a meal to this day',exact:true}).first().click();
  const copySelect=page.getByLabel('Meal to copy to 2026-09-25');
  await copySelect.selectOption({label:'Lunch · Lunch oats'});
  await page.getByLabel('Meal name',{exact:true}).fill('Snack oats');
  await page.getByLabel('Meal type',{exact:true}).selectOption('Snack');
  await page.getByRole('button',{name:'Done editing',exact:true}).click();
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  const after=await stored(page);expect(after.mealPlans).toHaveLength(2);
  expect(after.mealPlans[0]).toEqual(before.mealPlans[0]);
  const revised=after.mealPlans[1];expect(revised.id).not.toBe(before.mealPlans[0].id);
  expect(revised.days[0].meals.map((meal:any)=>meal.category)).toEqual(['Lunch','Snack']);
  expect(revised.days[0].meals.map((meal:any)=>meal.id)).not.toContain('original-0');
  expect(new Set(revised.days.flatMap((day:any)=>day.meals.map((meal:any)=>meal.id))).size).toBe(8);
  expect(after.meals).toEqual(before.meals);expect(after.pantryEvents).toEqual(before.pantryEvents);
  await expect(page.getByRole('button',{name:'Log one portion',exact:true})).toHaveCount(0);
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
});

test('full-day generation sends selected meal types and reviews all 28 meals before saving',async({page})=>{
  let context:any;
  await page.route('**/api/plans/meals',route=>{
    context=route.request().postDataJSON();
    const start=new Date(context.startDate+'T12:00:00Z');
    return route.fulfill({json:{id:'full-day-draft',status:'draft',createdAt:new Date().toISOString(),days:Array.from({length:7},(_,index)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),meals:context.mealCategories.map((category:string)=>({id:`full-${index}-${category}`,title:`${category} oats ${index+1}`,category,portions:1,minutes:10,ingredients:[{lotId:'repeat-shop::oats',name:'Oats',servingLabel:'1/2 cup',servings:1}],notes:''}))};})}});
  });
  await seedWeek(page);const before=await stored(page);await openPlan(page);
  await expect(page.getByRole('checkbox',{name:'Dinner',exact:true})).toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Breakfast',exact:true})).not.toBeChecked();
  await page.getByRole('checkbox',{name:'Breakfast',exact:true}).check();
  await page.getByRole('checkbox',{name:'Lunch',exact:true}).check();
  await page.getByRole('checkbox',{name:'Snack',exact:true}).check();
  await page.getByRole('button',{name:'Create a new draft',exact:true}).click();
  await expect(page.locator('.fuel-planned-meal')).toHaveCount(28);
  expect(context.mealCategories).toEqual(['Breakfast','Lunch','Dinner','Snack']);
  const firstDay=page.locator('.fuel-plan-day').first();
  for(const category of ['Breakfast','Lunch','Dinner','Snack'])await expect(firstDay).toContainText(`${category} · 1 portion`);
  await expect(page.locator('.fuel-plan-shopping')).toContainText('25 additional servings');
  expect((await stored(page)).mealPlans).toEqual(before.mealPlans);
  expect((await stored(page)).meals).toEqual(before.meals);
  expect((await stored(page)).pantryEvents).toEqual(before.pantryEvents);
  await page.getByRole('button',{name:'Save draft',exact:true}).click();
  expect((await stored(page)).mealPlans.at(-1).days.flatMap((day:any)=>day.meals)).toHaveLength(28);
});


test('oversized planned portions fail visibly without crashing or changing intake',async({page})=>{
  await seedWeek(page);
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
    state.groceries[0].items[0].servingsPurchased=1000;
    state.pantryEvents=[];
    state.mealPlans[0].days[0].meals[0].ingredients[0].servings=200;
    localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  });
  await page.reload();const before=await stored(page);await openPlan(page);
  const first=page.locator('.fuel-planned-meal').first();
  await first.getByRole('button',{name:'Log one portion',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('too large');
  await expect(first.getByRole('button',{name:'Log one portion',exact:true})).toBeEnabled();
  const after=await stored(page);expect(after.meals).toEqual(before.meals);expect(after.pantryEvents).toEqual(before.pantryEvents);
  await page.locator('.fuel-planned-meal').nth(1).getByRole('button',{name:'Log one portion',exact:true}).click();
  await expect(page.locator('.fuel-planned-meal').nth(1).getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  expect((await stored(page)).meals).toHaveLength(before.meals.length+1);
});
