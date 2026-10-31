# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: round-two-workouts.spec.ts >> confirming the existing zero reference updates all remaining load fields
- Location: tests\round-two-workouts.spec.ts:65:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator:  getByLabel('Bench Press set 2 weight (lb)', { exact: true })
Expected: "0"
Received: ""
Timeout:  5000ms

Call log:
  - Expect "toHaveValue" getByLabel('Bench Press set 2 weight (lb)', { exact: true }) with timeout 5000ms
  - waiting for getByLabel('Bench Press set 2 weight (lb)', { exact: true })
    14 × locator resolved to <input min="0" value="" max="2000" step="any" type="number"/>
       - unexpected value ""

```

```yaml
- spinbutton "Bench Press set 2 weight (lb)"
```

# Test source

```ts
  1  | import {test,expect} from './app-fixture';
  2  | import {readBrowserRecords,seedBrowserRecords} from './record-fixture';
  3  | 
  4  | test.beforeEach(async({page})=>{await page.route('**/api/status',r=>r.fulfill({json:{available:false,jev:false}}));await page.goto('/#workouts');});
  5  | test('rest survives navigation, reload and elapsed wall time',async({page})=>{
  6  |  await page.clock.install();
  7  |  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  8  |  await page.getByText('Rest timer',{exact:true}).click();
  9  |  await page.getByRole('button',{name:'Start 90-second rest',exact:true}).click();
  10 |  const end=(await readBrowserRecords(page)).workout.restUntil;
  11 |  expect(end).toBeGreaterThan(Date.now());
  12 |  await page.getByRole('button',{name:'Nutrition',exact:true}).click();
  13 |  await page.clock.fastForward(30000);
  14 |  await page.getByRole('button',{name:'Workouts',exact:true}).click();
  15 |  await page.getByText(/^\d+s rest$/).click();
  16 |  await expect(page.getByLabel('Rest remaining')).toContainText(/(?:5\d|60)s remaining/);
  17 |  expect((await readBrowserRecords(page)).workout.restUntil).toBe(end);
  18 |  await page.reload();await page.getByText(/^\d+s rest$/).click();
  19 |  expect((await readBrowserRecords(page)).workout.restUntil).toBe(end);
  20 |  await page.getByRole('button',{name:'End rest',exact:true}).click();
  21 |  await expect.poll(async()=>(await readBrowserRecords(page)).workout.restUntil).toBeNull();
  22 | });
  23 | test('all older sessions remain visible and can be reopened for correction',async({page})=>{
  24 |  await expect(page.getByRole('button',{name:'Start workout',exact:true})).toBeVisible();
  25 |  const state=await readBrowserRecords(page);
  26 |  state.workout.history=Array.from({length:13},(_,i)=>({title:`Recorded day ${i+1}`,startedAt:`2026-09-${String(i+1).padStart(2,'0')}T12:00:00Z`,finishedAt:`2026-09-${String(i+1).padStart(2,'0')}T13:00:00Z`,exercises:[{name:'Personal press',weight:100,target:8,sets:[8],previous:[]}]}));
  27 |  await seedBrowserRecords(page,state);await page.reload();
  28 |  await page.getByRole('button',{name:'Open workout menu',exact:true}).click();
  29 |  await page.getByRole('button',{name:'Session history',exact:true}).click();
  30 |  await expect(page.getByRole('dialog')).toContainText('Your 13 finished sessions.');
  31 |  await page.getByRole('button',{name:'Correct Recorded day 1',exact:true}).click();
  32 |  await expect(page.getByRole('heading',{name:'Recorded day 1 in progress',exact:true})).toBeVisible();
  33 |  expect((await readBrowserRecords(page)).workout.exercises[0].sets).toEqual([8]);
  34 | });
  35 | test('chosen units, remaining-set loads and personal routine survive return without recording old work',async({page},info)=>{
  36 |  await page.getByLabel('Workout units').selectOption('kg');
  37 |  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  38 |  const bench=page.getByRole('region',{name:'Bench Press',exact:true});
  39 |  await page.getByLabel('Bench Press set 1 weight (kg)',{exact:true}).fill('80');
  40 |  await bench.locator('.workout-set').first().getByRole('button',{name:'Save set weight',exact:true}).click();
  41 |  await page.getByRole('button',{name:'Use this load for remaining Bench Press sets',exact:true}).click();
  42 |  await page.getByRole('button',{name:'Bench Press set 1: 8 reps',exact:true}).click();
  43 |  await expect(page.getByText('Got it. Bench Press, set 1: 80 kg × 8 reps.',{exact:true})).toBeVisible();
  44 |  await expect(page.getByRole('button',{name:'Bench Press set 2: 8 reps',exact:true})).toBeEnabled();
  45 |  await page.getByRole('button',{name:'Saved routines',exact:true}).click();
  46 |  await page.getByLabel('Routine name').fill('Personal upper');
  47 |  await page.getByRole('button',{name:'Save current lineup as routine',exact:true}).click();
  48 |  await expect(page.getByRole('button',{name:'Start routine Personal upper',exact:true})).toBeDisabled();
  49 |  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  50 |  await page.getByRole('button',{name:'Finish workout',exact:true}).click();await page.getByRole('button',{name:'Save partial workout',exact:true}).click();
  51 |  await page.reload();await page.getByRole('button',{name:'Saved routines',exact:true}).click();
  52 |  await expect(page.getByRole('dialog')).toContainText('Previous reference 80 kg');
  53 |  await page.screenshot({path:info.outputPath('review-routine.png')});
  54 |  await page.getByRole('button',{name:'Start routine Personal upper',exact:true}).click();
  55 |  await expect(page.getByRole('heading',{name:'Personal upper in progress',exact:true})).toBeVisible();
  56 |  await expect(page.getByRole('button',{name:'Bench Press set 1: 8 reps',exact:true})).toBeDisabled();
  57 |  const saved=await readBrowserRecords(page);
  58 |  expect(saved.workout.exercises[0].sets).toEqual([null,null,null]);
  59 |  expect(saved.workout.history.at(-1).exercises[0].sets).toEqual([8,null,null]);
  60 |  expect(saved.workout.routines).toHaveLength(1);
  61 |  await page.getByRole('button',{name:'Saved routines',exact:true}).click();await page.getByRole('button',{name:'Remove routine Personal upper',exact:true}).click();await page.getByRole('button',{name:'Confirm remove routine',exact:true}).click();
  62 |  await expect.poll(async()=>(await readBrowserRecords(page)).workout.routines.length).toBe(0);
  63 |  expect((await readBrowserRecords(page)).workout.history).toHaveLength(1);
  64 | });
  65 | test('confirming the existing zero reference updates all remaining load fields',async({page})=>{
  66 |  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  67 |  const bench=page.getByRole('region',{name:'Bench Press',exact:true});
  68 |  await page.getByLabel('Bench Press set 1 weight (lb)',{exact:true}).fill('0');
  69 |  await bench.locator('.workout-set').first().getByRole('button',{name:'Save set weight',exact:true}).click();
  70 |  await page.getByRole('button',{name:'Use this load for remaining Bench Press sets',exact:true}).click();
> 71 |  await expect(page.getByLabel('Bench Press set 2 weight (lb)',{exact:true})).toHaveValue('0');
     |                                                                              ^ Error: expect(locator).toHaveValue(expected) failed
  72 |  expect((await readBrowserRecords(page)).workout.exercises[0].sets).toEqual([null,null,null]);
  73 | });
  74 | 
```