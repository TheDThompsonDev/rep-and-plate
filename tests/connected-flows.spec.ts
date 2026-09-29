import { test,expect,type Page } from '@playwright/test';
const stored=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('fuel.prototype.v1')!));
async function menu(page:Page,name:string){await page.getByRole('button',{name:'Open chat menu'}).click();await page.getByRole('button',{name,exact:true}).click();}
async function seedPantry(page:Page){
  await page.goto('/');
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
    state.groceries=[{id:'week-shop',fingerprint:'week-shop',store:'Test grocery',date:'2026-09-25',note:'',sources:[],items:[
      {id:'milk',receiptText:'Whole milk',name:'Whole milk',quantity:'4 cups',serving:'1 cup',servingsPurchased:4,nutrition:{calories:150,protein:8,carbs:12,fat:8},match:'exact',note:'',sources:[],needsReview:false,availability:'available'},
      {id:'oats',receiptText:'Oats',name:'Oats',quantity:'7 servings',serving:'1/2 cup',servingsPurchased:7,nutrition:{calories:150,protein:5,carbs:27,fat:3},match:'exact',note:'',sources:[],needsReview:false,availability:'available'}]}];
    localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  });await page.reload();
}
test.beforeEach(async({page})=>{
  await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));
  await page.route('**/api/chat',route=>route.abort());
});
test('preferences shape a seven-day plan with true shortages; approval and logging stay separate',async({page})=>{
  let context:any;
  await page.route('**/api/plans/meals',route=>{
    context=route.request().postDataJSON();
    const start=new Date(context.startDate+'T12:00:00Z');
    return route.fulfill({json:{id:'week-fixture',createdAt:new Date().toISOString(),status:'draft',days:Array.from({length:7},(_,index)=>{const day=new Date(start);day.setUTCDate(day.getUTCDate()+index);return {date:day.toISOString().slice(0,10),meals:[{id:`breakfast-${index}`,title:`Creamy oatmeal ${index+1}`,portions:1,minutes:10,ingredients:[{lotId:'week-shop::milk',name:'Whole milk',servingLabel:'1 cup',servings:1},{lotId:'week-shop::oats',name:'Oats',servingLabel:'1/2 cup',servings:1}],notes:'Cook oats with milk.'}]};})}});
  });
  await seedPantry(page);const before=await stored(page);
  await menu(page,'Food & routine preferences');
  await page.getByLabel('Foods to exclude or dietary restrictions').fill('peanuts');
  await page.getByLabel('Foods you dislike').fill('mushrooms');
  await page.getByLabel('Cooking time (minutes)').fill('20');
  await page.getByRole('button',{name:'Save food & routine preferences'}).click();
  await page.reload();expect((await stored(page)).preferences.restrictions).toEqual(['peanuts']);
  await menu(page,'Plan my week');
  await page.getByRole('button',{name:'Create my week'}).click();
  await expect(page.locator('.fuel-plan-day')).toHaveCount(7);
  expect(context.preferences.dislikes).toEqual(['mushrooms']);
  expect(context.lots.find((lot:any)=>lot.id==='week-shop::milk').remaining).toBe(4);
  await expect(page.locator('.fuel-plan-shopping')).toContainText('3 additional servings');
  await expect(page.locator('.fuel-plan-nutrition').first()).toContainText('300 cal · 13g protein');
  expect((await stored(page)).meals).toEqual(before.meals);
  expect((await stored(page)).pantryEvents??[]).toEqual([]);
  await page.getByRole('button',{name:'Approve this plan'}).click();
  expect((await stored(page)).mealPlans[0].status).toBe('approved');
  expect((await stored(page)).meals).toEqual(before.meals);
  await page.getByRole('button',{name:'Log one portion',exact:true}).first().click();
  await expect(page.getByRole('button',{name:'Portion logged',exact:true})).toHaveCount(1);
  let state=await stored(page);
  expect(state.meals).toHaveLength(before.meals.length+1);
  expect(state.meals.at(-1).calories).toBe(300);
  expect(state.pantryEvents.filter((event:any)=>event.kind==='consumed')).toHaveLength(2);
  await page.reload();await menu(page,'Plan my week');
  await expect(page.getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  state=await stored(page);expect(state.meals).toHaveLength(before.meals.length+1);
  expect(state.pantryEvents.filter((event:any)=>event.kind==='consumed')).toHaveLength(2);
  await page.keyboard.press('Escape');await menu(page,'Your groceries');
  await expect(page.locator('.pantry-lot').filter({hasText:'Whole milk'})).toContainText('3 servings left');
  await expect(page.locator('.pantry-lot').filter({hasText:'Oats'})).toContainText('6 servings left');
  await page.getByRole('button',{name:'Undo Creamy oatmeal 1',exact:true}).click();
  await expect(page.locator('.pantry-lot').filter({hasText:'Whole milk'})).toContainText('4 servings left');
  expect((await stored(page)).meals).toEqual(before.meals);
  await page.reload();await menu(page,'Your groceries');
  await expect(page.locator('.pantry-lot').filter({hasText:'Oats'})).toContainText('7 servings left');
});

test('pantry confirms partial usage, adjustments and undo without guessing consumption',async({page})=>{
  await seedPantry(page);const before=await stored(page);
  await menu(page,'Your groceries');
  await page.getByRole('checkbox',{name:'Use Whole milk',exact:true}).check();
  await page.locator('.pantry-lot').filter({hasText:'Whole milk'}).getByLabel('Servings used').fill('0.5');
  await page.getByLabel('Meal name',{exact:true}).fill('Milk in chai');
  await page.getByRole('button',{name:'Confirm meal & update pantry'}).click();
  await expect(page.locator('.pantry-lot').filter({hasText:'Whole milk'})).toContainText('3.5 servings left');
  expect((await stored(page)).meals.at(-1).calories).toBe(75);
  await page.locator('.pantry-lot').filter({hasText:'Oats'}).getByRole('button',{name:'Update amount'}).click();
  await page.getByLabel('Servings remaining').fill('5');
  await page.getByLabel('What changed?').selectOption('discarded');
  await page.getByRole('button',{name:'Save remaining amount'}).click();
  await expect(page.locator('.pantry-lot').filter({hasText:'Oats'})).toContainText('5 servings left');
  expect((await stored(page)).meals).toHaveLength(before.meals.length+1);
  await page.getByRole('button',{name:'Undo change'}).click();
  await expect(page.locator('.pantry-lot').filter({hasText:'Oats'})).toContainText('7 servings left');
  await page.getByRole('button',{name:'Undo Milk in chai'}).click();
  expect((await stored(page)).meals).toEqual(before.meals);
  await expect(page.locator('.pantry-lot').filter({hasText:'Whole milk'})).toContainText('4 servings left');
});

test('a conflicting plan is rejected without saving meals or inventory changes',async({page})=>{
  await seedPantry(page);
  await menu(page,'Food & routine preferences');
  await page.getByLabel('Foods to exclude or dietary restrictions').fill('milk');
  await page.getByRole('button',{name:'Save food & routine preferences'}).click();
  await page.route('**/api/plans/meals',route=>{const context=route.request().postDataJSON();const start=new Date(context.startDate+'T12:00:00Z');return route.fulfill({json:{id:'bad-plan',createdAt:new Date().toISOString(),status:'draft',days:Array.from({length:7},(_,index)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),meals:[{id:`bad-${index}`,title:'Milk',portions:1,minutes:1,ingredients:[{lotId:'week-shop::milk',name:'Drink',servingLabel:'1 cup',servings:1}],notes:''}]};})}});});
  const before=await stored(page);
  await menu(page,'Plan my week');await page.getByRole('button',{name:'Create my week'}).click();
  await expect(page.getByRole('alert')).toContainText('conflicts with your preferences');
  await expect(page.locator('.fuel-plan-day')).toHaveCount(0);
  expect((await stored(page)).meals).toEqual(before.meals);
  expect((await stored(page)).groceries).toEqual(before.groceries);
  expect((await stored(page)).mealPlans??[]).toEqual([]);
});

test('real pantry comparisons scale explicit portions without changing intake or stock',async({page})=>{
  await seedPantry(page);const before=await stored(page);
  await page.getByRole('navigation',{name:'Chat navigation'}).getByRole('button',{name:'Nutrition',exact:true}).click();
  await page.getByRole('button',{name:/Compare foods in your pantry/}).click();
  await page.getByLabel('Current food',{exact:true}).selectOption('week-shop::milk');
  await page.getByLabel('Possible replacement',{exact:true}).selectOption('week-shop::oats');
  await page.getByLabel('Current food servings').fill('0.5');
  const calories=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Calories',exact:true})});
  await expect(calories).toHaveText('Calories75150+75');
  const protein=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Protein',exact:true})});
  await expect(protein).toHaveText('Protein4g5g+1g');
  await expect(page.getByRole('dialog')).toContainText('One serving: 1 cup');
  await expect(page.getByRole('dialog')).toContainText('One serving: 1/2 cup');
  await expect(page.getByRole('dialog')).toContainText('ingredient list for Whole milk is not available');
  await expect(page.getByRole('dialog')).toContainText('not a claim that one food is healthier');
  expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.keyboard.press('Escape');
  const after=await stored(page);expect(after.meals).toEqual(before.meals);expect(after.groceries).toEqual(before.groceries);expect(after.pantryEvents??[]).toEqual([]);
});

test('saved exclusions remove matching food from swap choices',async({page})=>{
  await seedPantry(page);await menu(page,'Food & routine preferences');
  await page.getByLabel('Foods to exclude or dietary restrictions').fill('dairy-free');
  await page.getByRole('button',{name:'Save food & routine preferences'}).click();
  await page.getByRole('navigation',{name:'Chat navigation'}).getByRole('button',{name:'Nutrition',exact:true}).click();
  await page.getByRole('button',{name:/Compare foods in your pantry/}).click();
  await expect(page.getByRole('dialog')).toContainText('There aren’t two ready-to-compare foods yet');
  await expect(page.getByLabel('Current food',{exact:true})).toHaveCount(0);
});
