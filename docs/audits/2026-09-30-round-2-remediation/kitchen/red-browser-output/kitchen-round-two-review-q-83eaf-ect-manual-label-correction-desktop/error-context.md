# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: kitchen-round-two.spec.ts >> review queue opens saved candidates and offers direct manual label correction
- Location: tests\kitchen-round-two.spec.ts:6:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('dialog')
Expected substring: "Choose a possible product"
Received string:    "Check this grocery itemUse the package label when you have it. Leave unknown nutrition blank.Product nameQuantity purchasedServing sizeTotal servings purchasedPackages purchased × servings per package = total servings. For example, 2 tubs × 5 servings = 10. Copy the serving size and nutrition from that same label.Calories per servingProtein per serving (g)Carbs per serving (g)Fat per serving (g)Save grocery details "
Timeout: 5000ms

Call log:
  - Expect "toContainText" getByRole('dialog') with timeout 5000ms
  - waiting for getByRole('dialog')
    14 × locator resolved to <dialog open="" class="modal " aria-label="Check this grocery item">…</dialog>
       - unexpected value "Check this grocery itemUse the package label when you have it. Leave unknown nutrition blank.Product nameQuantity purchasedServing sizeTotal servings purchasedPackages purchased × servings per package = total servings. For example, 2 tubs × 5 servings = 10. Copy the serving size and nutrition from that same label.Calories per servingProtein per serving (g)Carbs per serving (g)Fat per serving (g)Save grocery details "

```

```yaml
- dialog "Check this grocery item":
  - heading "Check this grocery item" [level=2]
  - button "Close dialog"
  - paragraph: Use the package label when you have it. Leave unknown nutrition blank.
  - text: Product name
  - textbox "Product name": Uncertain oats
  - text: Quantity purchased
  - textbox "Quantity purchased": 1 package
  - text: Serving size
  - textbox "Serving size":
    - /placeholder: e.g. 1 cup (240 ml)
  - text: Total servings purchased
  - spinbutton "Total servings purchased"
  - paragraph: Packages purchased × servings per package = total servings. For example, 2 tubs × 5 servings = 10. Copy the serving size and nutrition from that same label.
  - text: Calories per serving
  - spinbutton "Calories per serving"
  - text: Protein per serving (g)
  - spinbutton "Protein per serving (g)"
  - text: Carbs per serving (g)
  - spinbutton "Carbs per serving (g)"
  - text: Fat per serving (g)
  - spinbutton "Fat per serving (g)"
  - button "Save grocery details"
```

# Test source

```ts
  1  | import {test,expect} from './app-fixture';
  2  | import {readBrowserRecords,seedBrowserRecords} from './record-fixture';
  3  | import {normalizeUSDA} from '../server/products/usda';
  4  | const product=normalizeUSDA({fdcId:9001,gtinUpc:'012345678905',description:'Audit rolled oats',brandOwner:'Audit oats',dataType:'Branded',servingSize:40,servingSizeUnit:'g',labelNutrients:{calories:{value:150},protein:{value:5},carbohydrates:{value:27},fat:{value:3}}})!;
  5  | async function ready(page:any){await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));await page.goto('/#chat');await page.getByRole('textbox',{name:'Message Rep & Plate'}).waitFor();return readBrowserRecords(page);}
  6  | test('review queue opens saved candidates and offers direct manual label correction',async({page})=>{
  7  |  const state=await ready(page);state.groceries=[{id:'review-route',fingerprint:'review-route',store:'Audit market',date:'2026-09-30',note:'',sources:[],items:[{id:'oats',receiptText:'OATS',name:'Uncertain oats',quantity:'1 package',serving:'',servingsPurchased:null,nutrition:null,match:'unresolved',needsReview:true,availability:'available',note:'',sources:[],productCandidates:[product]}]}];
  8  |  await seedBrowserRecords(page,state);await page.reload();await page.getByRole('button',{name:'Kitchen',exact:true}).click();await page.getByRole('button',{name:'Open pantry',exact:true}).click();await page.getByRole('button',{name:'Review Uncertain oats',exact:true}).click();
> 9  |  await expect(page.getByRole('dialog')).toContainText('Choose a possible product');await expect(page.getByRole('radio')).toHaveCount(1);
     |                                         ^ Error: expect(locator).toContainText(expected) failed
  10 |  await page.getByRole('button',{name:'Enter package details manually',exact:true}).click();await expect(page.getByLabel('Product name',{exact:true})).toHaveValue('Uncertain oats');
  11 |  await page.getByLabel('Serving size',{exact:true}).fill('40 g');await page.getByLabel('Total servings purchased',{exact:true}).fill('5');
  12 |  for(const [name,value] of Object.entries({'Calories per serving':'150','Protein per serving (g)':'5','Carbs per serving (g)':'27','Fat per serving (g)':'3'}))await page.getByLabel(name,{exact:true}).fill(value);
  13 |  await page.getByRole('button',{name:'Save grocery details',exact:true}).click();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  14 |  await expect(page.getByRole('region',{name:'Pantry review queue'})).toHaveCount(0);const saved=await readBrowserRecords(page);expect(saved.groceries[0].items[0]).toMatchObject({needsReview:false,servingsPurchased:5,nutrition:{calories:150}});expect(saved.meals).toEqual([]);
  15 | });
  16 | test('structured cooking review persists without inventory changes and shows ingredient-pattern repetition',async({page})=>{
  17 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await ready(page);
  18 |  await page.route('**/api/plans/meals',route=>{const context=route.request().postDataJSON(),start=new Date(context.startDate+'T12:00:00Z');return route.fulfill({json:{id:'method-plan',createdAt:new Date().toISOString(),status:'draft',days:Array.from({length:7},(_,i)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+i);return {date:date.toISOString().slice(0,10),meals:[{id:`m${i}`,title:`Oats idea ${i}`,category:'Dinner',portions:1,minutes:15,notes:'There is enough food all week.',ingredients:[{lotId:null,name:'Oats',servingLabel:'40 g',servings:1},{lotId:null,name:'Milk',servingLabel:'1 cup',servings:1}],cookingMethod:{reviewed:true,steps:[{action:'combine',ingredientIndexes:[0,1],minutes:null,temperatureC:null},{action:'simmer',ingredientIndexes:[0,1],minutes:10,temperatureC:null}]}}]};})}});});
  19 |  await page.getByRole('button',{name:'Kitchen',exact:true}).click();await page.getByRole('button',{name:'Open meal planner',exact:true}).click();await page.getByRole('button',{name:'Create my week',exact:true}).click();await expect(page.locator('.fuel-plan-day')).toHaveCount(7);
  20 |  await expect(page.getByRole('region',{name:'Ingredient variety check'})).toContainText('1 ingredient pattern across 7 meals');await expect(page.getByRole('dialog')).not.toContainText('enough food all week');
  21 |  await page.getByRole('button',{name:'Review cooking method',exact:true}).first().click();await expect(page.getByRole('region',{name:'Cooking method for Oats idea 0'})).toContainText('Simmer Oats, Milk for 10 min.');await page.getByRole('checkbox',{name:'I reviewed this cooking method',exact:true}).check();
  22 |  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Open meal planner',exact:true}).click();await page.getByRole('button',{name:'Cooking method reviewed',exact:true}).first().click();await expect(page.getByRole('checkbox',{name:'I reviewed this cooking method',exact:true})).toBeChecked();
  23 |  await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();await page.getByLabel('Oats recipe servings',{exact:true}).fill('2');await expect(page.getByRole('checkbox',{name:'I reviewed this cooking method',exact:true})).not.toBeChecked();
  24 |  const saved=await readBrowserRecords(page);expect(saved.meals).toEqual([]);expect(saved.pantryEvents??[]).toEqual([]);expect(saved.mealPlans[0].status).toBe('draft');expect(errors).toEqual([]);
  25 | });
  26 | 
```