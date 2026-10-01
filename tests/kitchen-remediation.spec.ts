import {test,expect} from './app-fixture';
import {readBrowserRecords,seedBrowserRecords} from './record-fixture';

test.beforeEach(async({page})=>{
  await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));
});

test('generated meal drafts and edits survive closing and reloading without approval or intake',async({page})=>{
  await page.route('**/api/plans/meals',route=>{
    const context=route.request().postDataJSON();
    expect(context.pantryMode).toBe('shopping-supported');expect(context.variety).toBe('varied');
    const start=new Date(context.startDate+'T12:00:00Z');
    return route.fulfill({json:{id:'recover-week',createdAt:new Date().toISOString(),status:'draft',days:Array.from({length:7},(_,index)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),meals:[{id:`meal-${index}`,title:['Bean bowl','Vegetable soup','Tofu rice'][index%3],category:'Dinner',portions:1,minutes:15,ingredients:[{lotId:null,name:'Beans',servingLabel:'1 cup',servings:1}],notes:'Warm and serve. You have enough beans for the week.'}]};})}});
  });
  await page.goto('/#kitchen');
  await page.getByRole('button',{name:'Open meal planner',exact:true}).click();
  await page.getByRole('button',{name:'Create my week',exact:true}).click();
  await expect(page.locator('.fuel-plan-day')).toHaveCount(7);
  await expect(page.locator('.fuel-plan-note')).toHaveCount(0);
  await expect.poll(async()=>(await readBrowserRecords(page)).mealPlans?.length).toBe(1);
  await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();
  await page.getByLabel('Meal name',{exact:true}).fill('My bean bowl');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.reload();
  await page.getByRole('button',{name:'Open meal planner',exact:true}).click();
  await expect(page.getByRole('heading',{name:'My bean bowl',exact:true})).toBeVisible();
  const saved=await readBrowserRecords(page);
  expect(saved.mealPlans.at(-1).status).toBe('draft');expect(saved.meals).toEqual([]);expect(saved.pantryEvents??[]).toEqual([]);
});

test('recipe prerequisite returns to the entered batch and collapsed preferences retain their values',async({page})=>{
  await page.goto('/#kitchen');
  await page.getByRole('button',{name:'Open recipes',exact:true}).click();
  await page.getByRole('button',{name:'Prepare a batch',exact:true}).click();
  await page.getByLabel('Batch name',{exact:true}).fill('Sunday oats');
  await page.getByLabel('How many portions did the whole batch make?').fill('4');
  await page.getByRole('button',{name:'Set up ingredients in pantry'}).click();
  await expect(page.getByRole('dialog')).toContainText('Your pantry');
  await page.getByRole('button',{name:'Add ingredient manually'}).click();
  await page.getByLabel('Ingredient name').fill('Oats');
  await page.getByLabel('One labeled serving').fill('40 g');
  await page.getByLabel('Total labeled servings on hand').fill('5');
  await page.getByLabel('Calories per serving',{exact:true}).fill('150');
  await page.getByLabel('Protein per serving (g)').fill('5');
  await page.getByLabel('Carbs per serving (g)').fill('27');
  await page.getByLabel('Fat per serving (g)').fill('3');
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Add confirmed ingredient'}).click();
  await expect(page.locator('.pantry-lot-heading')).toContainText('Oats');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await expect(page.getByLabel('Batch name',{exact:true})).toHaveValue('Sunday oats');
  await expect(page.getByLabel('How many portions did the whole batch make?')).toHaveValue('4');
  await page.locator('.recipe-ingredient').getByRole('checkbox').check();
  await page.getByLabel('Servings of Oats used').fill('2');
  await page.getByRole('button',{name:'Confirm prepared batch'}).click();
  await expect(page.getByRole('region',{name:'Sunday oats'})).toContainText('4 / 4 portions left');
  expect((await readBrowserRecords(page)).meals).toEqual([]);
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.getByRole('button',{name:'Chat',exact:true}).click();
  await page.getByRole('button',{name:'Open chat menu'}).click();
  await page.getByRole('button',{name:'Food & routine preferences',exact:true}).click();
  await expect(page.getByLabel('Foods you dislike')).not.toBeVisible();
  await page.getByText('Meals & cooking',{exact:true}).first().click();
  await page.getByLabel('Foods you dislike').fill('mushrooms');
  await page.getByText('Meals & cooking',{exact:true}).first().click();
  await page.getByLabel('Foods to exclude or dietary restrictions').fill('peanuts');
  await page.getByRole('button',{name:'Save food & routine preferences'}).click();
  await expect.poll(async()=>(await readBrowserRecords(page)).preferences?.dislikes).toEqual(['mushrooms']);
});

test('receipt purchase date and prioritized review queue lead straight to the uncertain food',async({page})=>{
  await page.goto('/#kitchen');
  const state=await readBrowserRecords(page);
  state.groceries=[{id:'receipt-dates',fingerprint:'receipt-dates',store:'Audit market',date:'2026-09-30',note:'',sources:[],purchase:{purchaseDate:'2026-09-25',currency:'USD',subtotal:null,tax:null,discount:null,total:null,confirmed:true},items:[{id:'milk',receiptText:'MILK',name:'Whole milk',quantity:'2 cartons',serving:'1 cup',servingsPurchased:null,nutrition:{calories:150,protein:8,carbs:12,fat:8},match:'generic',note:'',sources:[],needsReview:true,availability:'available'},{id:'soap',receiptText:'SOAP',name:'Soap',quantity:'1',serving:'',servingsPurchased:null,nutrition:null,match:'nonfood',note:'',sources:[],needsReview:false,availability:'available'}]}];
  await seedBrowserRecords(page,state);await page.reload();
  await page.getByRole('button',{name:'Open pantry',exact:true}).click();
  const queue=page.getByRole('region',{name:'Pantry review queue'});
  await expect(queue).toContainText('1 food item needs a check');await expect(queue).not.toContainText('Soap');
  await expect(page.locator('.pantry-lot-heading')).toContainText('Purchased 2026-09-25');
  await page.getByRole('button',{name:'Review Whole milk',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Check this grocery item');
  await expect(page.getByLabel('Product name',{exact:true})).toHaveValue('Whole milk');
  await expect(page.getByRole('dialog')).toContainText('2 tubs × 5 servings = 10');
});
