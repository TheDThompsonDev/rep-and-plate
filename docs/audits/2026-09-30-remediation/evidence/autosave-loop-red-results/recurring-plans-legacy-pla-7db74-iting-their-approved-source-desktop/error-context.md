# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recurring-plans.spec.ts >> legacy plan revisions autosave once without console errors or rewriting their approved source
- Location: tests\recurring-plans.spec.ts:25:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 1
Received: 44
```

# Page snapshot

```yaml
- generic [ref=f1e4]:
  - link "Skip to content" [ref=f1e5] [cursor=pointer]:
    - /url: "#main"
  - main [ref=f1e7]:
    - region "Rep & Plate chat home" [ref=f1e8]:
      - generic [ref=f1e9]:
        - button "Open chat menu" [ref=f1e10] [cursor=pointer]
        - button "Rep & Plate home" [ref=f1e12] [cursor=pointer]:
          - heading "Rep & Plate" [level=1] [ref=f1e13]
        - generic [ref=f1e15]:
          - button "Today’s nutrition in chat" [ref=f1e16] [cursor=pointer]
          - button "Your profile" [ref=f1e19] [cursor=pointer]
      - log "Capture conversation" [ref=f1e23]:
        - region "Tell Spot" [ref=f1e24]:
          - generic [ref=f1e25]:
            - text: YOUR FOOD. YOUR REPS. YOUR PACE.
            - heading "Always here." [level=2] [ref=f1e26]
            - paragraph [ref=f1e27]: (In a supportive way.)
            - text: Tell me what you ate or what you did.
            - generic [ref=f1e28]:
              - button "Tell Spot" [ref=f1e29] [cursor=pointer]
              - button "Another Spot mood" [ref=f1e32] [cursor=pointer]
        - generic [ref=f1e38]: Your conversation
      - generic [ref=f1e40]:
        - button "Scan a barcode in chat" [ref=f1e41] [cursor=pointer]
        - button "Take a meal photo" [ref=f1e47] [cursor=pointer]
        - button "Attach image or screenshot" [ref=f1e51] [cursor=pointer]
        - textbox "Message Rep & Plate" [ref=f1e56]:
          - /placeholder: What happened?
        - button "Use voice" [ref=f1e57] [cursor=pointer]
      - navigation "Chat navigation" [ref=f1e61]:
        - button "Chat" [ref=f1e62] [cursor=pointer]
        - button "Nutrition" [ref=f1e67] [cursor=pointer]
        - button "Scan a barcode" [ref=f1e71] [cursor=pointer]:
          - generic [ref=f1e78]: Scan
        - button "Workouts" [ref=f1e79] [cursor=pointer]
        - button "Kitchen" [ref=f1e87] [cursor=pointer]
  - dialog "Your week of meals" [ref=f1e93]:
    - generic [ref=f1e94]:
      - heading "Your week of meals" [level=2] [ref=f1e95]
      - button "Close dialog" [ref=f1e96] [cursor=pointer]
    - generic [ref=f1e100]:
      - paragraph [ref=f1e105]:
        - text: Start with what’s in your kitchen.
        - strong [ref=f1e106]: Make room for meals you enjoy.
      - paragraph [ref=f1e107]: A seven-day draft for 1 person. Review ingredients and portions before approving.
      - generic [ref=f1e108]:
        - text: Saved weeks
        - combobox "Saved meal-plan weeks" [ref=f1e109]:
          - option "2026-10-02 · Draft" [selected]
          - option "2026-09-25 · Approved"
        - generic [ref=f1e110]: Generated drafts and valid edits are saved automatically. Approval stays your choice.
      - generic [ref=f1e111]:
        - generic [ref=f1e112]:
          - text: Ingredients to use
          - combobox "Ingredients to use" [ref=f1e113]:
            - option "Include a shopping list" [selected]
            - option "Confirmed pantry only"
        - generic [ref=f1e114]:
          - text: Meal variety
          - combobox "Meal variety" [ref=f1e115]:
            - 'option "Variety: at least three ideas" [selected]'
            - option "Repeats are welcome"
      - paragraph [ref=f1e116]: Shopping-supported plans can add ingredients for variety. Pantry-only plans need confirmed quantities for the whole week.
      - group "Meals to plan each day" [ref=f1e117]:
        - generic [ref=f1e119]:
          - generic [ref=f1e120]:
            - checkbox "Breakfast" [ref=f1e121]
            - text: Breakfast
          - generic [ref=f1e122]:
            - checkbox "Lunch" [ref=f1e123]
            - text: Lunch
          - generic [ref=f1e124]:
            - checkbox "Dinner" [checked] [disabled] [ref=f1e125]
            - text: Dinner
          - generic [ref=f1e126]:
            - checkbox "Snack" [ref=f1e127]
            - text: Snack
        - generic [ref=f1e128]: Choose at least one meal type. Each gets a place on all seven days.
      - generic [ref=f1e129]:
        - generic [ref=f1e130]:
          - text: Week starting
          - textbox "Week starting" [ref=f1e131]: 2026-10-02
        - button "Create a new draft" [ref=f1e132] [cursor=pointer]
      - generic [ref=f1e138]:
        - strong [ref=f1e139]: Draft to review
        - generic [ref=f1e140]: Drafts save automatically. Planning does not change your pantry or daily intake.
      - generic [ref=f1e141]:
        - button "Save draft now" [ref=f1e142] [cursor=pointer]
        - button "Approve reviewed plan" [ref=f1e143] [cursor=pointer]
      - generic [ref=f1e144]:
        - generic [ref=f1e145]:
          - heading "Friday, Oct 2" [level=3] [ref=f1e146]
          - article [ref=f1e147]:
            - heading "Oatmeal 1" [level=4] [ref=f1e148]
            - paragraph [ref=f1e149]: Dinner · 1 portion · 10 min
            - list [ref=f1e150]:
              - listitem [ref=f1e151]:
                - generic [ref=f1e152]:
                  - text: Oats
                  - generic [ref=f1e153]: 1/2 cup
                - strong [ref=f1e154]: 1 × 1/2 cup
            - paragraph [ref=f1e155]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e157] [cursor=pointer]
            - paragraph [ref=f1e158]: ~150 cal · 5g protein per portion
            - paragraph [ref=f1e159]: Prepare oats with water.
            - generic [ref=f1e160]:
              - button "Edit meal" [ref=f1e161] [cursor=pointer]
              - button "Swap meal" [ref=f1e162] [cursor=pointer]
          - button "Add a meal to this day" [ref=f1e163] [cursor=pointer]
        - generic [ref=f1e164]:
          - heading "Saturday, Oct 3" [level=3] [ref=f1e165]
          - article [ref=f1e166]:
            - heading "Oatmeal 2" [level=4] [ref=f1e167]
            - paragraph [ref=f1e168]: Dinner · 1 portion · 10 min
            - list [ref=f1e169]:
              - listitem [ref=f1e170]:
                - generic [ref=f1e171]:
                  - text: Oats
                  - generic [ref=f1e172]: 1/2 cup
                - strong [ref=f1e173]: 1 × 1/2 cup
            - paragraph [ref=f1e174]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e176] [cursor=pointer]
            - paragraph [ref=f1e177]: ~150 cal · 5g protein per portion
            - paragraph [ref=f1e178]: Prepare oats with water.
            - generic [ref=f1e179]:
              - button "Edit meal" [ref=f1e180] [cursor=pointer]
              - button "Swap meal" [ref=f1e181] [cursor=pointer]
          - button "Add a meal to this day" [ref=f1e182] [cursor=pointer]
        - generic [ref=f1e183]:
          - heading "Sunday, Oct 4" [level=3] [ref=f1e184]
          - article [ref=f1e185]:
            - heading "Oatmeal 3" [level=4] [ref=f1e186]
            - paragraph [ref=f1e187]: Dinner · 1 portion · 10 min
            - list [ref=f1e188]:
              - listitem [ref=f1e189]:
                - generic [ref=f1e190]:
                  - text: Oats
                  - generic [ref=f1e191]: 1/2 cup
                - strong [ref=f1e192]: 1 × 1/2 cup
            - paragraph [ref=f1e193]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e195] [cursor=pointer]
            - paragraph [ref=f1e196]: ~150 cal · 5g protein per portion
            - paragraph [ref=f1e197]: Prepare oats with water.
            - generic [ref=f1e198]:
              - button "Edit meal" [ref=f1e199] [cursor=pointer]
              - button "Swap meal" [ref=f1e200] [cursor=pointer]
          - button "Add a meal to this day" [ref=f1e201] [cursor=pointer]
        - generic [ref=f1e202]:
          - heading "Monday, Oct 5" [level=3] [ref=f1e203]
          - article [ref=f1e204]:
            - heading "Oatmeal 4" [level=4] [ref=f1e205]
            - paragraph [ref=f1e206]: Dinner · 1 portion · 10 min
            - list [ref=f1e207]:
              - listitem [ref=f1e208]:
                - generic [ref=f1e209]:
                  - text: Oats
                  - generic [ref=f1e210]: 1/2 cup
                - strong [ref=f1e211]: 1 × 1/2 cup
            - paragraph [ref=f1e212]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e214] [cursor=pointer]
            - paragraph [ref=f1e215]: ~150 cal · 5g protein per portion
            - paragraph [ref=f1e216]: Prepare oats with water.
            - generic [ref=f1e217]:
              - button "Edit meal" [ref=f1e218] [cursor=pointer]
              - button "Swap meal" [ref=f1e219] [cursor=pointer]
          - button "Add a meal to this day" [ref=f1e220] [cursor=pointer]
        - generic [ref=f1e221]:
          - heading "Tuesday, Oct 6" [level=3] [ref=f1e222]
          - article [ref=f1e223]:
            - heading "Oatmeal 5" [level=4] [ref=f1e224]
            - paragraph [ref=f1e225]: Dinner · 1 portion · 10 min
            - list [ref=f1e226]:
              - listitem [ref=f1e227]:
                - generic [ref=f1e228]:
                  - text: Oats
                  - generic [ref=f1e229]: 1/2 cup
                - strong [ref=f1e230]: 1 × 1/2 cup
            - paragraph [ref=f1e231]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e233] [cursor=pointer]
            - paragraph [ref=f1e234]: ~150 cal · 5g protein per portion
            - paragraph [ref=f1e235]: Prepare oats with water.
            - generic [ref=f1e236]:
              - button "Edit meal" [ref=f1e237] [cursor=pointer]
              - button "Swap meal" [ref=f1e238] [cursor=pointer]
          - button "Add a meal to this day" [ref=f1e239] [cursor=pointer]
        - generic [ref=f1e240]:
          - heading "Wednesday, Oct 7" [level=3] [ref=f1e241]
          - article [ref=f1e242]:
            - heading "Oatmeal 6" [level=4] [ref=f1e243]
            - paragraph [ref=f1e244]: Dinner · 1 portion · 10 min
            - list [ref=f1e245]:
              - listitem [ref=f1e246]:
                - generic [ref=f1e247]:
                  - text: Oats
                  - generic [ref=f1e248]: 1/2 cup
                - strong [ref=f1e249]: 1 × 1/2 cup
            - paragraph [ref=f1e250]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e252] [cursor=pointer]
            - paragraph [ref=f1e253]: ~150 cal · 5g protein per portion
            - paragraph [ref=f1e254]: Prepare oats with water.
            - generic [ref=f1e255]:
              - button "Edit meal" [ref=f1e256] [cursor=pointer]
              - button "Swap meal" [ref=f1e257] [cursor=pointer]
          - button "Add a meal to this day" [ref=f1e258] [cursor=pointer]
        - generic [ref=f1e259]:
          - heading "Thursday, Oct 8" [level=3] [ref=f1e260]
          - article [ref=f1e261]:
            - heading "Oatmeal 7" [level=4] [ref=f1e262]
            - paragraph [ref=f1e263]: Dinner · 1 portion · 10 min
            - list [ref=f1e264]:
              - listitem [ref=f1e265]:
                - generic [ref=f1e266]:
                  - text: Oats
                  - generic [ref=f1e267]: 1/2 cup
                - strong [ref=f1e268]: 1 × 1/2 cup
            - paragraph [ref=f1e269]: Ingredient amounts are for the whole recipe.
            - button "Replace pantry ingredient" [ref=f1e271] [cursor=pointer]
            - paragraph [ref=f1e272]: ~150 cal · 5g protein per portion
            - paragraph [ref=f1e273]: Prepare oats with water.
            - generic [ref=f1e274]:
              - button "Edit meal" [ref=f1e275] [cursor=pointer]
              - button "Swap meal" [ref=f1e276] [cursor=pointer]
          - button "Add a meal to this day" [ref=f1e277] [cursor=pointer]
      - generic [ref=f1e278]:
        - heading "Your shopping & pantry check" [level=3] [ref=f1e279]
        - paragraph [ref=f1e286]: Amounts below account for every meal in the week, including repeat ingredients.
        - list [ref=f1e287]:
          - listitem [ref=f1e288]:
            - strong [ref=f1e289]: Oats
            - generic [ref=f1e290]: 4 additional servings · 1/2 cup
      - region "Basket cost coverage" [ref=f1e291]:
        - heading "What might the remaining ingredients cost?" [level=3] [ref=f1e292]
        - paragraph [ref=f1e293]: No priced additional quantities yet.
        - paragraph [ref=f1e294]: 0 of 1 ingredients covered by pantry stock; 0 additional ingredients priced; 1 need a price or quantity check.
        - text: Based on reviewed receipt prices from the last 30 days. Shelf prices, full packages, tax and other groceries can change the checkout total.
      - generic [ref=f1e295]:
        - button "Save draft" [ref=f1e296] [cursor=pointer]
        - button "Approve this plan" [ref=f1e297] [cursor=pointer]
      - paragraph [ref=f1e298]: Approval saves the plan. Log a portion only after eating it. Check package ingredients for your restrictions; recipe suggestions cannot verify allergen handling.
      - generic [ref=f1e299]:
        - heading "Make the most of your groceries" [level=3] [ref=f1e300]
        - article [ref=f1e301]:
          - strong [ref=f1e302]: Oats
          - paragraph [ref=f1e303]: 3 labeled servings remain from your 2026-09-25 purchase.
          - generic [ref=f1e304]:
            - button "Find a meal idea" [ref=f1e305] [cursor=pointer]
            - button "Dismiss for now" [ref=f1e306] [cursor=pointer]
        - paragraph [ref=f1e307]: Purchase dates help organize ideas. They do not tell us whether food is fresh or spoiled.
```

# Test source

```ts
  1   | import { commitSeededRecords,readBrowserRecords } from "./record-fixture";
  2   | import { test,expect,type Page } from "./app-fixture";
  3   | 
  4   | const stored=readBrowserRecords;
  5   | async function seedWeek(page:Page) {
  6   |   await page.goto('/');
  7   |   await page.evaluate(()=>{
  8   |     const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
  9   |     state.groceries=[{id:'repeat-shop',fingerprint:'repeat-shop',store:'Test pantry',date:'2026-09-25',note:'',sources:[],items:[{id:'oats',receiptText:'Oats',name:'Oats',quantity:'10 servings',serving:'1/2 cup',servingsPurchased:10,nutrition:{calories:150,protein:5,carbs:27,fat:3},match:'exact',note:'',sources:[],needsReview:false,availability:'available'}]}];
  10  |     state.pantryEvents=[{id:'stock-check',lotId:'repeat-shop::oats',kind:'adjusted',servings:-7,createdAt:'2026-09-25T12:00:00Z',note:'Counted three servings remaining.'}];
  11  |     state.mealPlans=[{id:'original-approved',createdAt:'2026-09-25T12:00:00Z',status:'approved',days:Array.from({length:7},(_,index)=>{const date=new Date('2026-09-25T12:00:00Z');date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),meals:[{id:`original-${index}`,title:`Oatmeal ${index+1}`,portions:1,minutes:10,ingredients:[{lotId:'repeat-shop::oats',name:'Oats',servingLabel:'1/2 cup',servings:1}],notes:'Prepare oats with water.'}]};})}];
  12  |     localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  13  |   });await commitSeededRecords(page);
  14  |   await page.reload();
  15  | }
  16  | async function openPlan(page:Page) {
  17  |   await page.getByRole('button',{name:'Open chat menu'}).click();
  18  |   await page.getByRole('button',{name:'Plan my week',exact:true}).click();
  19  | }
  20  | test.beforeEach(async({page})=>{
  21  |   await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));
  22  |   await page.route('**/api/chat',route=>route.abort());
  23  | });
  24  | 
  25  | test('legacy plan revisions autosave once without console errors or rewriting their approved source',async({page})=>{
  26  |   const errors:string[]=[];
  27  |   page.on('console',message=>{if(message.type()==='error'&&errors.length<20)errors.push(message.text());});
  28  |   page.on('pageerror',error=>{if(errors.length<20)errors.push(error.message);});
  29  |   await seedWeek(page);
  30  |   const original=(await stored(page)).mealPlans[0];
  31  |   // Legacy records omit category; revision adds it after the existing fields.
  32  |   expect(original.days[0].meals[0].category).toBeUndefined();
  33  |   await openPlan(page);
  34  |   await page.evaluate(()=>{
  35  |     (window as any).__planAutosaveWrites=0;
  36  |     const write=Storage.prototype.setItem;
  37  |     Storage.prototype.setItem=function(key,value){
  38  |       if(key==='health.pending.guest'&&JSON.parse(value).mealPlans?.length===2)(window as any).__planAutosaveWrites++;
  39  |       return write.call(this,key,value);
  40  |     };
  41  |   });
  42  |   await page.getByLabel('Repeat week starting',{exact:true}).fill('2026-10-02');
  43  |   await page.getByRole('button',{name:'Repeat this week as a draft',exact:true}).click();
  44  |   await expect.poll(async()=>(await stored(page)).mealPlans.length).toBe(2);
  45  |   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,250)))));
> 46  |   expect(await page.evaluate(()=>(window as any).__planAutosaveWrites)).toBe(1);
      |                                                                         ^ Error: expect(received).toBe(expected) // Object.is equality
  47  |   await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();
  48  |   await page.getByLabel('Meal name',{exact:true}).fill('My revised oats');
  49  |   await expect.poll(async()=>(await stored(page)).mealPlans.at(-1).days[0].meals[0].title).toBe('My revised oats');
  50  |   // Let passive effects settle; an assertion that only checks saved content missed the loop.
  51  |   await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(resolve,150)))));
  52  |   expect(errors).toEqual([]);
  53  |   expect((await stored(page)).mealPlans[0]).toEqual(original);
  54  | });
  55  | 
  56  | test('approved weeks repeat into editable drafts with fresh shortages and no automatic logging',async({page})=>{
  57  |   let generated=0;await page.route('**/api/plans/meals',route=>{generated++;return route.abort();});
  58  |   await seedWeek(page);const before=await stored(page);const original=before.mealPlans[0];
  59  |   await openPlan(page);
  60  |   await page.getByLabel('Repeat week starting',{exact:true}).fill('2026-10-02');
  61  |   await page.getByRole('button',{name:'Repeat this week as a draft',exact:true}).click();
  62  |   await expect(page.locator('.fuel-plan-status')).toContainText('Draft to review');
  63  |   await expect(page.getByRole('button',{name:'Log one portion',exact:true})).toHaveCount(0);
  64  |   await expect(page.locator('.fuel-plan-shopping')).toContainText('4 additional servings');
  65  |   // Repeated drafts now save automatically; the original approved week stays byte-equivalent.
  66  |   await expect.poll(async()=>(await stored(page)).mealPlans.length).toBe(2);
  67  |   expect((await stored(page)).mealPlans[0]).toEqual(original);
  68  |   expect((await stored(page)).mealPlans[1].status).toBe('draft');
  69  |   expect((await stored(page)).meals).toEqual(before.meals);
  70  |   expect((await stored(page)).pantryEvents).toEqual(before.pantryEvents);
  71  |   await page.getByRole('button',{name:'Save draft',exact:true}).click();
  72  |   await expect.poll(async()=>(await stored(page)).mealPlans.length).toBe(2);
  73  |   let saved=await stored(page);
  74  |   expect(saved.mealPlans).toHaveLength(2);expect(saved.mealPlans[0]).toEqual(original);
  75  |   const repeatedId=saved.mealPlans[1].id;expect(repeatedId).not.toBe(original.id);
  76  |   expect(saved.mealPlans[1].days[0].date).toBe('2026-10-02');
  77  |   expect(saved.mealPlans[1].days[0].meals[0].id).not.toBe(original.days[0].meals[0].id);
  78  |   await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();
  79  |   await page.getByLabel('Meal name',{exact:true}).fill('Morning oats');
  80  |   await page.getByLabel('Meal type',{exact:true}).selectOption('Breakfast');
  81  |   await page.getByLabel('Recipe portions',{exact:true}).fill('2');
  82  |   await page.getByLabel('Meal day',{exact:true}).selectOption('2026-10-03');
  83  |   await expect(page.locator('.fuel-plan-day').first()).toContainText('Nothing planned for this day yet');
  84  |   await page.getByRole('button',{name:'Done editing',exact:true}).click();
  85  |   await page.getByRole('button',{name:'Approve this plan',exact:true}).click();
  86  |   saved=await stored(page);
  87  |   expect(saved.mealPlans).toHaveLength(2);expect(saved.mealPlans[0]).toEqual(original);
  88  |   const repeated=saved.mealPlans.find((plan:any)=>plan.id===repeatedId);
  89  |   expect(repeated.status).toBe('approved');expect(repeated.days[0].meals).toEqual([]);
  90  |   expect(repeated.days[1].meals.find((meal:any)=>meal.title==='Morning oats')).toMatchObject({category:'Breakfast',portions:2});
  91  |   expect(saved.meals).toEqual(before.meals);expect(saved.pantryEvents).toEqual(before.pantryEvents);
  92  |   await page.reload();await openPlan(page);
  93  |   const meal=page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Morning oats',exact:true})});
  94  |   await expect(meal).toContainText('Breakfast · 2 portions');
  95  |   await expect(meal).toContainText('75 cal');
  96  |   await meal.getByRole('button',{name:'Log one portion',exact:true}).click();
  97  |   let after=await stored(page);expect(after.meals.at(-1)).toMatchObject({title:'Morning oats',category:'Breakfast',calories:75});
  98  |   expect(after.pantryEvents.filter((event:any)=>event.kind==='consumed')).toHaveLength(1);
  99  |   expect(after.meals.at(-1).id).toContain(repeatedId);
  100 |   // Selecting the older approved week must use that week's identity, not the newest saved plan.
  101 |   await page.getByLabel('Saved meal-plan weeks').selectOption('original-approved');
  102 |   await page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Oatmeal 1',exact:true})}).getByRole('button',{name:'Log one portion',exact:true}).click();
  103 |   after=await stored(page);expect(after.meals.at(-1).id).toContain('original-approved');
  104 |   expect(after.meals.at(-1).category).toBe('Dinner');
  105 |   expect(after.meals).toHaveLength(before.meals.length+2);expect(generated).toBe(0);
  106 |   await page.reload();await openPlan(page);
  107 |   await expect(page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Morning oats',exact:true})}).getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  108 |   await page.getByLabel('Saved meal-plan weeks').selectOption('original-approved');
  109 |   await expect(page.locator('.fuel-planned-meal').filter({has:page.getByRole('heading',{name:'Oatmeal 1',exact:true})}).getByRole('button',{name:'Portion logged',exact:true})).toBeDisabled();
  110 |   const replayed=await stored(page);
  111 |   expect(replayed.meals).toEqual(after.meals);
  112 |   expect(replayed.pantryEvents).toEqual(after.pantryEvents);
  113 |   expect(replayed.mealPlans.find((plan:any)=>plan.id==='original-approved')).toEqual(original);
  114 | });
  115 | 
  116 | test('editing or extending an approved week creates a new revision and preserves existing identities',async({page})=>{
  117 |   await seedWeek(page);const before=await stored(page);await openPlan(page);
  118 |   await page.getByRole('button',{name:'Edit meal',exact:true}).first().click();
  119 |   await expect(page.locator('.fuel-plan-status')).toContainText('Draft to review');
  120 |   await page.getByLabel('Meal name',{exact:true}).fill('Lunch oats');
  121 |   await page.getByLabel('Meal type',{exact:true}).selectOption('Lunch');
  122 |   await page.getByRole('button',{name:'Done editing',exact:true}).click();
  123 |   await page.getByRole('button',{name:'Add a meal to this day',exact:true}).first().click();
  124 |   const copySelect=page.getByLabel('Meal to copy to 2026-09-25');
  125 |   await copySelect.selectOption({label:'Lunch · Lunch oats'});
  126 |   await page.getByLabel('Meal name',{exact:true}).fill('Snack oats');
  127 |   await page.getByLabel('Meal type',{exact:true}).selectOption('Snack');
  128 |   await page.getByRole('button',{name:'Done editing',exact:true}).click();
  129 |   await page.getByRole('button',{name:'Save draft',exact:true}).click();
  130 |   const after=await stored(page);expect(after.mealPlans).toHaveLength(2);
  131 |   expect(after.mealPlans[0]).toEqual(before.mealPlans[0]);
  132 |   const revised=after.mealPlans[1];expect(revised.id).not.toBe(before.mealPlans[0].id);
  133 |   expect(revised.days[0].meals.map((meal:any)=>meal.category)).toEqual(['Lunch','Snack']);
  134 |   expect(revised.days[0].meals.map((meal:any)=>meal.id)).not.toContain('original-0');
  135 |   expect(new Set(revised.days.flatMap((day:any)=>day.meals.map((meal:any)=>meal.id))).size).toBe(8);
  136 |   expect(after.meals).toEqual(before.meals);expect(after.pantryEvents).toEqual(before.pantryEvents);
  137 |   await expect(page.getByRole('button',{name:'Log one portion',exact:true})).toHaveCount(0);
  138 |   expect(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  139 | });
  140 | 
  141 | test('full-day generation sends selected meal types and autosaves all 28 meals as an unapproved draft',async({page})=>{
  142 |   let context:any;
  143 |   await page.route('**/api/plans/meals',route=>{
  144 |     context=route.request().postDataJSON();
  145 |     const start=new Date(context.startDate+'T12:00:00Z');
  146 |     return route.fulfill({json:{id:'full-day-draft',status:'draft',createdAt:new Date().toISOString(),days:Array.from({length:7},(_,index)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+index);return {date:date.toISOString().slice(0,10),meals:context.mealCategories.map((category:string)=>({id:`full-${index}-${category}`,title:`${category} oats ${index+1}`,category,portions:1,minutes:10,ingredients:[{lotId:'repeat-shop::oats',name:'Oats',servingLabel:'1/2 cup',servings:1}],notes:''}))};})}});
```