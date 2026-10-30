# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: kitchen-round-two.spec.ts >> manual pantry stock stays available without purchase claims or receipt-review work
- Location: tests\kitchen-round-two.spec.ts:31:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'Grocery spending' })
Expected substring: "0 reviewed � 0 with missing"
Received string:    "Your grocery trips, together.Only reviewed receipts count. This is recorded household spending, including nonfood purchases—not a complete account of everything you spent.No reviewed totals yet0 reviewed · 0 with missing or unchecked totalsYour shopping history is private to your saved account or this device. No cross-user shopping analytics are collected by this feature."
Timeout: 5000ms

Call log:
  - Expect "toContainText" getByRole('region', { name: 'Grocery spending' }) with timeout 5000ms
  - waiting for getByRole('region', { name: 'Grocery spending' })
    14 × locator resolved to <section aria-label="Grocery spending">…</section>
       - unexpected value "Your grocery trips, together.Only reviewed receipts count. This is recorded household spending, including nonfood purchases—not a complete account of everything you spent.No reviewed totals yet0 reviewed · 0 with missing or unchecked totalsYour shopping history is private to your saved account or this device. No cross-user shopping analytics are collected by this feature."

```

```yaml
- region "Grocery spending":
  - heading "Your grocery trips, together." [level=3]
  - paragraph: Only reviewed receipts count. This is recorded household spending, including nonfood purchases—not a complete account of everything you spent.
  - strong: No reviewed totals yet
  - text: 0 reviewed · 0 with missing or unchecked totals
  - paragraph: Your shopping history is private to your saved account or this device. No cross-user shopping analytics are collected by this feature.
```

# Test source

```ts
  1  | import {test,expect} from './app-fixture';
  2  | import {readBrowserRecords,seedBrowserRecords} from './record-fixture';
  3  | import {addManualPantryIngredient} from '../src/features/pantry/manual-ingredient';
  4  | import {normalizeUSDA} from '../server/products/usda';
  5  | const product=normalizeUSDA({fdcId:9001,gtinUpc:'012345678905',description:'Audit rolled oats',brandOwner:'Audit oats',dataType:'Branded',servingSize:40,servingSizeUnit:'g',labelNutrients:{calories:{value:150},protein:{value:5},carbohydrates:{value:27},fat:{value:3}}})!;
  6  | async function ready(page:any){await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));await page.goto('/#chat');await page.getByRole('textbox',{name:'Message Rep & Plate'}).waitFor();return readBrowserRecords(page);}
  7  | test('review queue opens saved candidates and offers direct manual label correction',async({page})=>{
  8  |  const state=await ready(page);state.groceries=[{id:'review-route',fingerprint:'review-route',store:'Audit market',date:'2026-09-30',note:'',sources:[],items:[{id:'oats',receiptText:'OATS',name:'Uncertain oats',quantity:'1 package',serving:'',servingsPurchased:null,nutrition:null,match:'unresolved',needsReview:true,availability:'available',note:'',sources:[],productCandidates:[product]}]}];
  9  |  state.groceries[0].items.push({...state.groceries[0].items[0],id:'oats2',name:'Second oats'});
  10 |  await seedBrowserRecords(page,state);await page.reload();await page.getByRole('button',{name:'Kitchen',exact:true}).click();await page.getByRole('button',{name:'Open pantry',exact:true}).click();await page.getByRole('button',{name:'Review Uncertain oats',exact:true}).click();
  11 |  await expect(page.getByRole('dialog')).toContainText('Choose a possible product');await expect(page.getByRole('radio')).toHaveCount(1);
  12 |  await page.getByRole('button',{name:'Enter package details manually',exact:true}).click();await expect(page.getByLabel('Product name',{exact:true})).toHaveValue('Uncertain oats');
  13 |  await page.getByLabel('Serving size',{exact:true}).fill('40 g');await page.getByLabel('Total servings purchased',{exact:true}).fill('5');
  14 |  await page.getByRole('button',{name:'Review suggested products instead',exact:true}).click();await page.getByRole('button',{name:'Enter package details manually',exact:true}).click();await expect(page.getByLabel('Serving size',{exact:true})).toHaveValue('40 g');await expect(page.getByLabel('Total servings purchased',{exact:true})).toHaveValue('5');
  15 |  for(const [name,value] of Object.entries({'Calories per serving':'150','Protein per serving (g)':'5','Carbs per serving (g)':'27','Fat per serving (g)':'3'}))await page.getByLabel(name,{exact:true}).fill(value);
  16 |  await page.getByRole('button',{name:'Save grocery details',exact:true}).click();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  17 |  await page.getByRole('button',{name:'Review Second oats',exact:true}).click();await page.getByRole('radio').check();await page.getByLabel('Total labeled servings purchased',{exact:true}).fill('8');await page.getByRole('checkbox',{name:'I checked the product, serving and purchased amount against my package.'}).check();await page.getByRole('button',{name:'Use this product',exact:true}).click();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  18 |  await expect(page.getByRole('region',{name:'Pantry review queue'})).toHaveCount(0);const saved=await readBrowserRecords(page);expect(saved.groceries[0].items[0]).toMatchObject({needsReview:false,servingsPurchased:5,nutrition:{calories:150}});expect(saved.groceries[0].items[1]).toMatchObject({needsReview:false,servingsPurchased:8,productSnapshot:{id:product.id}});expect(saved.meals).toEqual([]);await page.screenshot({path:test.info().outputPath('review-queue-completed.png')});
  19 | });
  20 | test('structured cooking review persists without inventory changes and shows ingredient-pattern repetition',async({page})=>{
  21 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await ready(page);
  22 |  await page.route('**/api/plans/meals',route=>{const context=route.request().postDataJSON(),start=new Date(context.startDate+'T12:00:00Z');return route.fulfill({json:{id:'method-plan',createdAt:new Date().toISOString(),status:'draft',days:Array.from({length:7},(_,i)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+i);return {date:date.toISOString().slice(0,10),meals:[{id:`m${i}`,title:`Oats idea ${i}`,category:'Dinner',portions:1,minutes:15,notes:'There is enough food all week.',ingredients:[{lotId:null,name:'Oats',servingLabel:'40 g',servings:1},{lotId:null,name:'Milk',servingLabel:'1 cup',servings:1}],cookingMethod:{reviewed:true,steps:[{action:'combine',ingredientIndexes:[0,1],minutes:null,temperatureC:null},{action:'simmer',ingredientIndexes:[0,1],minutes:10,temperatureC:null}]}}]};})}});});
  23 |  await page.getByRole('button',{name:'Kitchen',exact:true}).click();await page.getByRole('button',{name:'Open meal planner',exact:true}).click();await page.getByRole('button',{name:'Create my week',exact:true}).click();await expect(page.locator('.fuel-plan-day')).toHaveCount(7);
  24 |  await expect(page.getByRole('region',{name:'Ingredient variety check'})).toContainText('1 ingredient pattern across 7 meals');await expect(page.getByRole('dialog')).not.toContainText('enough food all week');
  25 |  await page.getByRole('button',{name:'Review cooking method',exact:true}).first().click();await expect(page.getByRole('region',{name:'Cooking method for Oats idea 0'})).toContainText('Simmer Oats, Milk for 10 min.');await page.getByRole('checkbox',{name:'I reviewed this cooking method',exact:true}).check();
  26 |  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Open meal planner',exact:true}).click();await page.getByRole('button',{name:'Cooking method reviewed',exact:true}).first().click();await expect(page.getByRole('checkbox',{name:'I reviewed this cooking method',exact:true})).toBeChecked();
  27 |  await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();await page.getByLabel('Oats recipe servings',{exact:true}).fill('2');await expect(page.getByRole('checkbox',{name:'I reviewed this cooking method',exact:true})).not.toBeChecked();
  28 |  const saved=await readBrowserRecords(page);expect(saved.meals).toEqual([]);expect(saved.pantryEvents??[]).toEqual([]);expect(saved.mealPlans[0].status).toBe('draft');expect(errors).toEqual([]);
  29 | });
  30 | 
  31 | test('manual pantry stock stays available without purchase claims or receipt-review work',async({page})=>{
> 32 |  const base=await ready(page);const state=addManualPantryIngredient(base,{name:'Manual oats',serving:'40 g',servings:10,nutrition:{calories:150,protein:5,carbs:27,fat:3}},'spending');await seedBrowserRecords(page,state);await page.reload();await page.getByRole('button',{name:'Kitchen',exact:true}).click();await page.getByRole('button',{name:'Open meal planner',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('10 labeled servings remain; stock recorded');await expect(page.getByRole('dialog')).not.toContainText('from your');await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.getByRole('button',{name:'Swaps, list & spending',exact:true}).click();await page.getByRole('tab',{name:'Your spending',exact:true}).click();const spending=page.getByRole('region',{name:'Grocery spending'});await expect(spending).toContainText(/0 reviewed\s+\u00b7\s+0 with missing/);await expect(spending.getByRole('button')).toHaveCount(0);const saved=await readBrowserRecords(page);expect(saved.groceries).toHaveLength(1);expect(saved.groceries[0].items[0].servingsPurchased).toBe(10);await page.screenshot({path:test.info().outputPath('manual-stock-not-a-purchase.png')});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   ^ Error: expect(locator).toContainText(expected) failed
  33 | });
  34 | 
```