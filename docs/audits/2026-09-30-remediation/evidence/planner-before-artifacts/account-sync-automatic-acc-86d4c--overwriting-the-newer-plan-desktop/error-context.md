# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: account-sync.spec.ts >> automatic account refresh closes an open planner without overwriting the newer plan
- Location: tests\account-sync.spec.ts:82:1

# Error details

```
Error: expect(locator).not.toBeVisible() failed

Locator:  getByRole('dialog', { name: 'Your week of meals' })
Expected: not visible
Received: visible
Timeout:  15000ms

Call log:
  - Expect "not toBeVisible" getByRole('dialog', { name: 'Your week of meals' }) with timeout 15000ms
  - waiting for getByRole('dialog', { name: 'Your week of meals' })
    33 × locator resolved to <dialog open="" class="modal wide" aria-label="Your week of meals">…</dialog>
       - unexpected value "visible"

```

```yaml
- dialog "Your week of meals":
  - heading "Your week of meals" [level=2]
  - button "Close dialog"
  - paragraph
  - paragraph: A seven-day draft for 1 person. Review ingredients and portions before approving.
  - text: Saved weeks
  - combobox "Saved meal-plan weeks"
  - text: Generated drafts and valid edits are saved automatically. Approval stays your choice. Ingredients to use
  - combobox "Ingredients to use"
  - text: Meal variety
  - combobox "Meal variety"
  - paragraph: Shopping-supported plans can add ingredients for variety. Pantry-only plans need confirmed quantities for the whole week.
  - group "Meals to plan each day"
  - text: Week starting
  - textbox "Week starting": 2026-10-01
  - button "Create a new draft"
  - strong: Draft to review
  - text: Drafts save automatically. Planning does not change your pantry or daily intake.
  - button "Save draft now"
  - button "Approve reviewed plan"
  - heading "Thursday, Oct 1" [level=3]
  - article
  - button "Add a meal to this day"
  - heading "Friday, Oct 2" [level=3]
  - article
  - button "Add a meal to this day"
  - heading "Saturday, Oct 3" [level=3]
  - article
  - button "Add a meal to this day"
  - heading "Sunday, Oct 4" [level=3]
  - article
  - button "Add a meal to this day"
  - heading "Monday, Oct 5" [level=3]
  - article
  - button "Add a meal to this day"
  - heading "Tuesday, Oct 6" [level=3]
  - article
  - button "Add a meal to this day"
  - heading "Wednesday, Oct 7" [level=3]
  - article
  - button "Add a meal to this day"
  - heading "Your shopping & pantry check" [level=3]
  - paragraph: Amounts below account for every meal in the week, including repeat ingredients.
  - list
  - region "Basket cost coverage"
  - button "Save draft"
  - button "Approve this plan"
  - paragraph: Approval saves the plan. Log a portion only after eating it. Check package ingredients for your restrictions; recipe suggestions cannot verify allergen handling.
```

# Test source

```ts
  1   | import {test,expect,type Page} from '@playwright/test';
  2   | import {mockCloud,stored} from './cloud-fixture';
  3   | import {initialState} from '../src/domain';
  4   | async function enter(page:Page,name=''){
  5   |  await page.goto('/');await page.getByRole('button',{name:'Sign in',exact:true}).click();
  6   |  await page.getByLabel('Email',{exact:true}).fill('fixture@example.test');await page.getByLabel('Password',{exact:true}).fill('test-password-only');
  7   |  await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();
  8   |  if(name)await page.getByLabel('Your name').fill(name);
  9   |  await page.getByRole('checkbox',{name:/These device records are mine/}).check();await page.getByRole('button',{name:'That’s me. Let’s go.'}).click();
  10  |  await page.getByRole('button',{name:'Let’s do this'}).click();
  11  | }
  12  | test('account saves automatically, survives reload, and pulls a change from another device',async({page})=>{
  13  |  const cloud=await mockCloud(page);await enter(page,'Ada');
  14  |  const status=page.getByRole('complementary',{name:'Account save status'});
  15  |  await expect(status).toContainText('Saved to your account');expect(cloud.remote.state.profile.name).toBe('Ada');
  16  |  await page.reload();await expect(status).toContainText('Saved to your account');
  17  |  cloud.remote={...cloud.remote,revision:cloud.remote.revision+1,state:{...cloud.remote.state,profile:{...cloud.remote.state.profile,name:'Ada from phone'}}};
  18  |  await expect.poll(async()=>(await stored(page)).profile.name,{timeout:15000}).toBe('Ada from phone');
  19  | });
  20  | test('a fresh signed-in device automatically restores its existing account records',async({page})=>{
  21  |  const cloud=await mockCloud(page);const state=initialState();state.profile.name='Returning friend';
  22  |  cloud.remote={user_id:'11111111-1111-4111-8111-111111111111',revision:9,updated_at:new Date().toISOString(),state};
  23  |  await enter(page);await expect(page.getByRole('complementary',{name:'Account save status'})).toContainText('Saved to your account');
  24  |  expect((await stored(page)).profile.name).toBe('Returning friend');expect(cloud.saveCalls).toBe(0);
  25  | });
  26  | test('existing local records conflict safely with a different account copy and preserve recovery copy',async({page})=>{
  27  |  const cloud=await mockCloud(page);const state=initialState();state.profile.name='Local history';
  28  |  await page.addInitScript(state=>{if(!localStorage.getItem('fuel.prototype.v1'))localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));},state);
  29  |  cloud.remote={user_id:'11111111-1111-4111-8111-111111111111',revision:9,updated_at:new Date().toISOString(),state:{...state,profile:{...state.profile,name:'Cloud history'}}};
  30  |  await enter(page);const status=page.getByRole('complementary',{name:'Account save status'});
  31  |  await expect(status).toContainText('Two copies need your review');expect(cloud.saveCalls).toBe(0);expect((await stored(page)).profile.name).toBe('Local history');
  32  |  await status.getByRole('button',{name:'Use account copy'}).click();await expect(status).toContainText('Saved to your account');
  33  |  expect((await stored(page)).profile.name).toBe('Cloud history');
  34  |  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('health.sync.recovery.')).map(k=>JSON.parse(localStorage.getItem(k)!).profile.name))).toContain('Local history');
  35  | });
  36  | test('large restored photos survive reload when the localStorage compatibility mirror exceeds quota',async({page})=>{
  37  |  test.setTimeout(60000);
  38  |  const cloud=await mockCloud(page),state=initialState();state.profile.name='Photo keeper';
  39  |  const photo=Buffer.alloc(4_000_000,65),user='11111111-1111-4111-8111-111111111111';
  40  |  state.messages[0].image=`rp-media:${user}/${'a'.repeat(64)}.png`;
  41  |  cloud.remote={user_id:user,revision:9,updated_at:new Date().toISOString(),state};
  42  |  await page.route('https://fuelcloudtest.supabase.co/storage/v1/object/**',route=>route.fulfill({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'image/png',body:photo}));
  43  |  await enter(page);
  44  |  const status=page.getByRole('complementary',{name:'Account save status'});
  45  |  await expect(status).toContainText('Saved to your account',{timeout:20000});
  46  |  const inspect=()=>page.evaluate(async()=>{
  47  |   const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('rep-and-plate-records',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  48  |   const raw=await new Promise<string>((resolve,reject)=>{const request=database.transaction('records','readonly').objectStore('records').get('fuel.prototype.v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  49  |   const state=JSON.parse(raw),mirror=localStorage.getItem('fuel.prototype.v1');database.close();
  50  |   return {name:state.profile.name,imageLength:state.messages[0].image?.length,mirrorLength:mirror?.length??0};
  51  |  });
  52  |  const saved=await inspect();expect(saved.imageLength).toBeGreaterThan(5_000_000);expect(saved.mirrorLength).toBeLessThan(saved.imageLength);
  53  |  await page.reload();await expect(status).toContainText('Saved to your account',{timeout:20000});
  54  |  expect(await inspect()).toEqual(saved);expect(cloud.saveCalls).toBe(0);
  55  |  await page.getByRole('button',{name:'Your profile',exact:true}).click();await expect(page.getByRole('heading',{name:'Looking ahead, Photo keeper.'})).toBeVisible();
  56  | });
  57  | test('an interrupted account switch cannot hydrate or upload another account’s active copy',async({page})=>{
  58  |  const cloud=await mockCloud(page);await enter(page,'Account A');
  59  |  const status=page.getByRole('complementary',{name:'Account save status'});await expect(status).toContainText('Saved to your account');
  60  |  await page.evaluate(async()=>{
  61  |   const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('rep-and-plate-records',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  62  |   const original=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);original.profile.name='Account B private records';
  63  |   // Simulate the precise crash window: B's account/active copies reached disk,
  64  |   // while A's owner marker still remains. A's account archive is unchanged.
  65  |   await new Promise<void>((resolve,reject)=>{const tx=database.transaction('records','readwrite');tx.objectStore('records').put(JSON.stringify(original),'fuel.prototype.v1');tx.objectStore('records').put(JSON.stringify(original),'health.account.other-account');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  66  |   database.close();localStorage.setItem('fuel.prototype.v1',JSON.stringify(original));
  67  |  });
  68  |  await page.reload();await expect(status).toContainText('Saved to your account');
  69  |  expect((await stored(page)).profile.name).toBe('Account A');expect(cloud.remote.state.profile.name).toBe('Account A');
  70  | });
  71  | test('signing out during a photo restore never applies or uploads the former account’s pending copy',async({page})=>{
  72  |  const cloud=await mockCloud(page),state=initialState(),user='11111111-1111-4111-8111-111111111111';state.profile.name='Pending cloud copy';state.messages[0].image=`rp-media:${user}/${'b'.repeat(64)}.png`;
  73  |  cloud.remote={user_id:user,revision:9,updated_at:new Date().toISOString(),state};
  74  |  let release!:()=>void,seen!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{seen=resolve;});
  75  |  await page.route('https://fuelcloudtest.supabase.co/storage/v1/object/**',async route=>{seen();await gate;await route.fulfill({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'image/png',body:Buffer.from('test-photo')});});
  76  |  await enter(page);await started;
  77  |  await page.evaluate(async()=>{const path='/src/features/cloud/client.ts';const {getCloudClient}=await import(path);await (await getCloudClient()).auth.signOut({scope:'local'});});
  78  |  release();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
  79  |  await page.reload();expect((await stored(page)).profile.name).not.toBe('Pending cloud copy');expect(cloud.saveCalls).toBe(0);
  80  | });
  81  | 
  82  | test('automatic account refresh closes an open planner without overwriting the newer plan',async({page})=>{
  83  |  const cloud=await mockCloud(page),state=initialState();
  84  |  const plan={id:'shared-week',createdAt:new Date().toISOString(),status:'draft' as const,days:Array.from({length:7},(_,index)=>({date:`2026-10-0${index+1}`,meals:[{id:`planned-${index}`,title:'Local beans',category:'Dinner' as const,portions:1,minutes:15,ingredients:[{lotId:null,name:'Beans',servingLabel:'1 cup',servings:1}],notes:''}]}))};
  85  |  state.mealPlans=[plan];
  86  |  await page.addInitScript(state=>{if(!localStorage.getItem('fuel.prototype.v1'))localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));},state);
  87  |  await enter(page,'Planner keeper');
  88  |  const status=page.getByRole('complementary',{name:'Account save status'});
  89  |  await expect(status).toContainText('Saved to your account');
  90  |  await page.getByRole('button',{name:'Kitchen',exact:true}).click();
  91  |  await page.getByRole('button',{name:'Open meal planner',exact:true}).click();
  92  |  await expect(page.getByRole('heading',{name:'Local beans',exact:true})).toHaveCount(7);
  93  |  const replacement={...cloud.remote.state,mealPlans:[{...plan,days:plan.days.map(day=>({...day,meals:day.meals.map(meal=>({...meal,title:'Phone beans'}))}))}]};
  94  |  cloud.remote={...cloud.remote,revision:cloud.remote.revision+1,state:replacement};
> 95  |  await expect(page.getByRole('dialog',{name:'Your week of meals'})).not.toBeVisible({timeout:15000});
      |                                                                         ^ Error: expect(locator).not.toBeVisible() failed
  96  |  await expect.poll(async()=>(await stored(page)).mealPlans?.[0].days[0].meals[0].title).toBe('Phone beans');
  97  |  await page.reload();
  98  |  await page.getByRole('button',{name:'Open meal planner',exact:true}).click();
  99  |  await expect(page.getByRole('heading',{name:'Phone beans',exact:true})).toHaveCount(7);
  100 |  expect(cloud.remote.state.mealPlans[0].days[0].meals[0].title).toBe('Phone beans');
  101 | });
  102 | 
```