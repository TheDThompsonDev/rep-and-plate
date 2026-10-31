# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: round-two-workouts.spec.ts >> all older sessions remain visible and can be reopened for correction
- Location: tests\round-two-workouts.spec.ts:23:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Recorded day 1 in progress', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Recorded day 1 in progress', exact: true }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'Recorded day 1 in progress', exact: true })

```

```yaml
- link "Skip to content":
  - /url: "#main"
- main:
  - region "Workouts":
    - button "Open workout menu"
    - button "Rep & Plate home": Rep & Plate
    - button "Today’s nutrition in chat"
    - button "Your profile"
    - button "Saved routines"
    - text: Workout units
    - combobox "Workout units":
      - option "lb" [selected]
      - option "kg"
    - button "Log walk or cardio"
    - heading "What should you do today?" [level=1]
    - paragraph: Your next workout, with room for how you feel today.
    - button "Create a workout for me"
    - button "Upper Body ~42 min" [pressed]
    - button "Lower Body ~35 min"
    - button "Full Body ~30 min"
    - text: Workout option
    - heading "Upper Body · ~42 min" [level=2]
    - paragraph: A balanced session for your chest, back, and arms.
    - paragraph: Example rep targets. Choose a comfortable load before logging; no weight is prescribed. Use 0 only for bodyweight work.
    - button "Start workout"
    - img "Dumbbells on a gym bench"
    - heading "Exercises" [level=2]
    - text: 4 exercises · ~42 min
    - button "1 Bench Press illustration Bench Press Choose load · 3 × 8 No finished session recorded for this exercise yet.":
      - text: "1"
      - img "Bench Press illustration"
      - strong: Bench Press
      - text: Choose load · 3 × 8 No finished session recorded for this exercise yet.
    - button "2 Incline Dumbbell Press illustration Incline Dumbbell Press Choose load · 3 × 10 No finished session recorded for this exercise yet.":
      - text: "2"
      - img "Incline Dumbbell Press illustration"
      - strong: Incline Dumbbell Press
      - text: Choose load · 3 × 10 No finished session recorded for this exercise yet.
    - button "3 Seated Cable Row illustration Seated Cable Row Choose load · 3 × 12 No finished session recorded for this exercise yet.":
      - text: "3"
      - img "Seated Cable Row illustration"
      - strong: Seated Cable Row
      - text: Choose load · 3 × 12 No finished session recorded for this exercise yet.
    - button "4 Triceps Pushdown illustration Triceps Pushdown Choose load · 3 × 12 No finished session recorded for this exercise yet.":
      - text: "4"
      - img "Triceps Pushdown illustration"
      - strong: Triceps Pushdown
      - text: Choose load · 3 × 12 No finished session recorded for this exercise yet.
    - heading "Your recent training" [level=2]
    - button "View history"
    - button "5 sets across your latest 5 finished sessions. Only the sets you recorded are counted.":
      - strong: 5 sets across your latest 5 finished sessions.
      - paragraph: Only the sets you recorded are counted.
    - 'button "Last finished: Recorded day 13 Sep 13, 2026 · 1 exercise with recorded sets."':
      - strong: "Last finished: Recorded day 13"
      - paragraph: Sep 13, 2026 · 1 exercise with recorded sets.
    - navigation "Workouts navigation":
      - button "Chat"
      - button "Nutrition"
      - button "Scan a barcode": Scan
      - button "Workouts"
      - button "Kitchen"
    - dialog "Session history":
      - heading "Session history" [level=2]
      - button "Close dialog"
      - paragraph: Your 13 finished sessions. Unrecorded sets are not included.
      - heading "Recorded day 13 · Saved" [level=3]
      - paragraph: Sep 13, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 13"
      - heading "Recorded day 12 · Saved" [level=3]
      - paragraph: Sep 12, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 12"
      - heading "Recorded day 11 · Saved" [level=3]
      - paragraph: Sep 11, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 11"
      - heading "Recorded day 10 · Saved" [level=3]
      - paragraph: Sep 10, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 10"
      - heading "Recorded day 9 · Saved" [level=3]
      - paragraph: Sep 9, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 9"
      - heading "Recorded day 8 · Saved" [level=3]
      - paragraph: Sep 8, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 8"
      - heading "Recorded day 7 · Saved" [level=3]
      - paragraph: Sep 7, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 7"
      - heading "Recorded day 6 · Saved" [level=3]
      - paragraph: Sep 6, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 6"
      - heading "Recorded day 5 · Saved" [level=3]
      - paragraph: Sep 5, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 5"
      - heading "Recorded day 4 · Saved" [level=3]
      - paragraph: Sep 4, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 4"
      - heading "Recorded day 3 · Saved" [level=3]
      - paragraph: Sep 3, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 3"
      - heading "Recorded day 2 · Saved" [level=3]
      - paragraph: Sep 2, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 2"
      - heading "Recorded day 1 · Saved" [level=3]
      - paragraph: Sep 1, 2026
      - paragraph:
        - strong: Personal press
        - text: ": 100 lb × 8"
      - button "Correct Recorded day 1"
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
> 32 |  await expect(page.getByRole('heading',{name:'Recorded day 1 in progress',exact:true})).toBeVisible();
     |                                                                                         ^ Error: expect(locator).toBeVisible() failed
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
  65 | 
```