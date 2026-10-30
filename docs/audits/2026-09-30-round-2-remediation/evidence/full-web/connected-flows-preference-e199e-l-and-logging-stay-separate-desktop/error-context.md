# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: connected-flows.spec.ts >> preferences shape a seven-day plan with true shortages; approval and logging stay separate
- Location: tests\connected-flows.spec.ts:19:1

# Error details

```
TypeError: Cannot read properties of undefined (reading 'restrictions')
```

# Page snapshot

```yaml
- generic [ref=f2e4]:
  - link "Skip to content" [ref=f2e5] [cursor=pointer]:
    - /url: "#main"
  - main [ref=f2e7]:
    - region "Rep & Plate chat home" [ref=f2e8]:
      - generic [ref=f2e9]:
        - button "Open chat menu" [ref=f2e10] [cursor=pointer]
        - button "Rep & Plate home" [ref=f2e12] [cursor=pointer]:
          - heading "Rep & Plate" [level=1] [ref=f2e13]
        - generic [ref=f2e15]:
          - button "Today’s nutrition in chat" [ref=f2e16] [cursor=pointer]
          - button "Your profile" [ref=f2e19] [cursor=pointer]
      - log "Capture conversation" [ref=f2e23]:
        - region "Tell Spot" [ref=f2e24]:
          - generic [ref=f2e25]:
            - text: YOUR FOOD. YOUR REPS. YOUR PACE.
            - heading "Always here." [level=2] [ref=f2e26]
            - paragraph [ref=f2e27]: (In a supportive way.)
            - text: Tell me what you ate or what you did.
            - generic [ref=f2e28]:
              - button "Tell Spot" [ref=f2e29] [cursor=pointer]
              - button "Another Spot mood" [ref=f2e32] [cursor=pointer]
        - generic [ref=f2e38]: Your conversation
      - generic [ref=f2e40]:
        - button "Scan a barcode in chat" [ref=f2e41] [cursor=pointer]
        - button "Take a meal photo" [ref=f2e47] [cursor=pointer]
        - button "Attach image or screenshot" [ref=f2e51] [cursor=pointer]
        - textbox "Message Rep & Plate" [ref=f2e56]:
          - /placeholder: What happened?
        - button "Use voice" [ref=f2e57] [cursor=pointer]
      - navigation "Chat navigation" [ref=f2e61]:
        - button "Chat" [ref=f2e62] [cursor=pointer]
        - button "Nutrition" [ref=f2e67] [cursor=pointer]
        - button "Scan a barcode" [ref=f2e71] [cursor=pointer]:
          - generic [ref=f2e78]: Scan
        - button "Workouts" [ref=f2e79] [cursor=pointer]
        - button "Kitchen" [ref=f2e87] [cursor=pointer]
```

# Test source

```ts
  1   | import { test,expect,type Page } from "./app-fixture";
  2   | import { commitSeededRecords, readBrowserRecords } from "./record-fixture";
  3   | const stored=readBrowserRecords;
  4   | async function menu(page:Page,name:string){await page.getByRole('button',{name:'Open chat menu'}).click();await page.getByRole('button',{name,exact:true}).click();}
  5   | async function seedPantry(page:Page){
  6   |   await page.goto('/');
  7   |   await page.evaluate(()=>{
  8   |     const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
  9   |     state.groceries=[{id:'week-shop',fingerprint:'week-shop',store:'Test grocery',date:'2026-09-25',note:'',sources:[],items:[
  10  |       {id:'milk',receiptText:'Whole milk',name:'Whole milk',quantity:'4 cups',serving:'1 cup',servingsPurchased:4,nutrition:{calories:150,protein:8,carbs:12,fat:8},match:'exact',note:'',sources:[],needsReview:false,availability:'available'},
  11  |       {id:'oats',receiptText:'Oats',name:'Oats',quantity:'7 servings',serving:'1/2 cup',servingsPurchased:7,nutrition:{calories:150,protein:5,carbs:27,fat:3},match:'exact',note:'',sources:[],needsReview:false,availability:'available'}]}];
  12  |     localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  13  |   });await commitSeededRecords(page);await page.reload();
  14  | }
  15  | test.beforeEach(async({page})=>{
  16  |   await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));
  17  |   await page.route('**/api/chat',route=>route.abort());
  18  | });
  19  | test('preferences shape a seven-day plan with true shortages; approval and logging stay separate',async({page})=>{
  20  |   let context:any;
  21  |   await page.route('**/api/plans/meals',route=>{
  22  |     context=route.request().postDataJSON();
  23  |     const start=new Date(context.startDate+'T12:00:00Z');
  24  |     return route.fulfill({json:{id:'week-fixture',createdAt:new Date().toISOString(),status:'draft',days:Array.from({length:7},(_,index)=>{const day=new Date(start);day.setUTCDate(day.getUTCDate()+index);return {date:day.toISOString().slice(0,10),meals:[{id:`breakfast-${index}`,title:`Creamy oatmeal ${index+1}`,portions:1,minutes:10,ingredients:[{lotId:'week-shop::milk',name:'Whole milk',servingLabel:'1 cup',servings:1},{lotId:'week-shop::oats',name:'Oats',servingLabel:'1/2 cup',servings:1}],notes:'Cook oats with milk.'}]};})}});
  25  |   });
  26  |   await seedPantry(page);const before=await stored(page);
  27  |   await menu(page,'Food & routine preferences');
  28  |   await page.getByLabel('Foods to exclude or dietary restrictions').fill('peanuts');
  29  |   await page.locator('summary').filter({hasText:'Meals & cooking'}).click();
  30  |   await page.getByLabel('Foods you dislike').fill('mushrooms');
  31  |   await page.getByLabel('Cooking time (minutes)').fill('20');
  32  |   await page.getByRole('button',{name:'Save food & routine preferences'}).click();
> 33  |   await page.reload();expect((await stored(page)).preferences.restrictions).toEqual(['peanuts']);
      |                                                               ^ TypeError: Cannot read properties of undefined (reading 'restrictions')
  34  |   await menu(page,'Plan my week');
  35  |   await page.getByRole('button',{name:'Create my week'}).click();
  36  |   await expect(page.locator('.fuel-plan-day')).toHaveCount(7);
  37  |   expect(context.preferences.dislikes).toEqual(['mushrooms']);
  38  |   expect(context.lots.find((lot:any)=>lot.id==='week-shop::milk').remaining).toBe(4);
  39  |   await expect(page.locator('.fuel-plan-shopping')).toContainText('3 additional servings');
  40  |   await expect(page.locator('.fuel-plan-nutrition').first()).toContainText('300 cal · 13g protein');
  41  |   expect((await stored(page)).meals).toEqual(before.meals);
  42  |   expect((await stored(page)).pantryEvents??[]).toEqual([]);
  43  |   await page.getByRole('button',{name:'Approve this plan'}).click();
  44  |   expect((await stored(page)).mealPlans[0].status).toBe('approved');
  45  |   expect((await stored(page)).meals).toEqual(before.meals);
  46  |   await page.getByRole('button',{name:'Log one portion',exact:true}).first().click();
  47  |   await expect(page.getByRole('button',{name:'Portion logged',exact:true})).toHaveCount(1);
  48  |   let state=await stored(page);
  49  |   expect(state.meals).toHaveLength(before.meals.length+1);
  50  |   expect(state.meals.at(-1).calories).toBe(300);
  51  |   expect(state.pantryEvents.filter((event:any)=>event.kind==='consumed')).toHaveLength(2);
  52  |   await page.reload();await menu(page,'Plan my week');
  53  |   await expect(page.getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  54  |   state=await stored(page);expect(state.meals).toHaveLength(before.meals.length+1);
  55  |   expect(state.pantryEvents.filter((event:any)=>event.kind==='consumed')).toHaveLength(2);
  56  |   await page.keyboard.press('Escape');await menu(page,'Your groceries');
  57  |   await expect(page.locator('.pantry-lot').filter({hasText:'Whole milk'})).toContainText('3 servings left');
  58  |   await expect(page.locator('.pantry-lot').filter({hasText:'Oats'})).toContainText('6 servings left');
  59  |   await page.getByRole('button',{name:'Undo Creamy oatmeal 1',exact:true}).click();
  60  |   await expect(page.locator('.pantry-lot').filter({hasText:'Whole milk'})).toContainText('4 servings left');
  61  |   expect((await stored(page)).meals).toEqual(before.meals);
  62  |   await page.reload();await menu(page,'Your groceries');
  63  |   await expect(page.locator('.pantry-lot').filter({hasText:'Oats'})).toContainText('7 servings left');
  64  | });
  65  | 
  66  | test('pantry confirms partial usage, adjustments and undo without guessing consumption',async({page})=>{
  67  |   await seedPantry(page);const before=await stored(page);
  68  |   await menu(page,'Your groceries');
  69  |   await page.getByRole('checkbox',{name:'Use Whole milk',exact:true}).check();
  70  |   await page.locator('.pantry-lot').filter({hasText:'Whole milk'}).getByLabel('Servings used').fill('0.5');
  71  |   await page.getByLabel('Meal name',{exact:true}).fill('Milk in chai');
  72  |   await page.getByRole('button',{name:'Confirm meal & update pantry'}).click();
  73  |   await expect(page.locator('.pantry-lot').filter({hasText:'Whole milk'})).toContainText('3.5 servings left');
  74  |   expect((await stored(page)).meals.at(-1).calories).toBe(75);
  75  |   await page.locator('.pantry-lot').filter({hasText:'Oats'}).getByRole('button',{name:'Update amount'}).click();
  76  |   await page.getByLabel('Servings remaining').fill('5');
  77  |   await page.getByLabel('What changed?').selectOption('discarded');
  78  |   await page.getByRole('button',{name:'Save remaining amount'}).click();
  79  |   await expect(page.locator('.pantry-lot').filter({hasText:'Oats'})).toContainText('5 servings left');
  80  |   expect((await stored(page)).meals).toHaveLength(before.meals.length+1);
  81  |   await page.getByRole('button',{name:'Undo change'}).click();
  82  |   await expect(page.locator('.pantry-lot').filter({hasText:'Oats'})).toContainText('7 servings left');
  83  |   await page.getByRole('button',{name:'Undo Milk in chai'}).click();
  84  |   expect((await stored(page)).meals).toEqual(before.meals);
  85  |   await expect(page.locator('.pantry-lot').filter({hasText:'Whole milk'})).toContainText('4 servings left');
  86  | });
  87  | 
  88  | test('a conflicting plan is rejected without saving meals or inventory changes',async({page})=>{
  89  |   await seedPantry(page);
  90  |   await menu(page,'Food & routine preferences');
  91  |   await page.getByLabel('Foods to exclude or dietary restrictions').fill('milk');
  92  |   await page.getByRole('button',{name:'Save food & routine preferences'}).click();
  93  |   await page.route('**/api/plans/meals',route=>{const context=route.request().postDataJSON();const start=new Date(context.startDate+'T12:00:00Z');return route.fulfill({json:{id:'bad-plan',createdAt:new Date().toISOString(),status:'draft',days:Array.from({length:7},(_,index)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),meals:[{id:`bad-${index}`,title:'Milk',portions:1,minutes:1,ingredients:[{lotId:'week-shop::milk',name:'Drink',servingLabel:'1 cup',servings:1}],notes:''}]};})}});});
  94  |   const before=await stored(page);
  95  |   await menu(page,'Plan my week');await page.getByRole('button',{name:'Create my week'}).click();
  96  |   await expect(page.getByRole('alert')).toContainText('conflicts with your preferences');
  97  |   await expect(page.locator('.fuel-plan-day')).toHaveCount(0);
  98  |   expect((await stored(page)).meals).toEqual(before.meals);
  99  |   expect((await stored(page)).groceries).toEqual(before.groceries);
  100 |   expect((await stored(page)).mealPlans??[]).toEqual([]);
  101 | });
  102 | 
  103 | test('real pantry comparisons scale explicit portions without changing intake or stock',async({page})=>{
  104 |   await seedPantry(page);const before=await stored(page);
  105 |   await page.getByRole('navigation',{name:'Chat navigation'}).getByRole('button',{name:'Nutrition',exact:true}).click();
  106 |   await page.getByRole('button',{name:/Compare foods in your pantry/}).click();
  107 |   await page.getByLabel('Current food',{exact:true}).selectOption('week-shop::milk');
  108 |   await page.getByLabel('Possible replacement',{exact:true}).selectOption('week-shop::oats');
  109 |   await page.getByLabel('Current food servings').fill('0.5');
  110 |   const calories=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Calories',exact:true})});
  111 |   await expect(calories).toHaveText('Calories75150+75');
  112 |   const protein=page.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Protein',exact:true})});
  113 |   await expect(protein).toHaveText('Protein4g5g+1g');
  114 |   await expect(page.getByRole('dialog')).toContainText('One serving: 1 cup');
  115 |   await expect(page.getByRole('dialog')).toContainText('One serving: 1/2 cup');
  116 |   await expect(page.getByRole('dialog')).toContainText('ingredient list for Whole milk is not available');
  117 |   await expect(page.getByRole('dialog')).toContainText('not a claim that one food is healthier');
  118 |   expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  119 |   await page.keyboard.press('Escape');
  120 |   const after=await stored(page);expect(after.meals).toEqual(before.meals);expect(after.groceries).toEqual(before.groceries);expect(after.pantryEvents??[]).toEqual([]);
  121 | });
  122 | 
  123 | test('saved exclusions remove matching food from swap choices',async({page})=>{
  124 |   await seedPantry(page);await menu(page,'Food & routine preferences');
  125 |   await page.getByLabel('Foods to exclude or dietary restrictions').fill('dairy-free');
  126 |   await page.getByRole('button',{name:'Save food & routine preferences'}).click();
  127 |   await page.getByRole('navigation',{name:'Chat navigation'}).getByRole('button',{name:'Nutrition',exact:true}).click();
  128 |   await page.getByRole('button',{name:/Compare foods in your pantry/}).click();
  129 |   await expect(page.getByRole('dialog')).toContainText('There aren’t two ready-to-compare foods yet');
  130 |   await expect(page.getByLabel('Current food',{exact:true})).toHaveCount(0);
  131 | });
  132 | 
```