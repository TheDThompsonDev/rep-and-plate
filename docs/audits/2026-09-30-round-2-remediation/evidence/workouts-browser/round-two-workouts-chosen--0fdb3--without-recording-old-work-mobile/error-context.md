# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: round-two-workouts.spec.ts >> chosen units, remaining-set loads and personal routine survive return without recording old work
- Location: tests\round-two-workouts.spec.ts:20:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('region', { name: 'Bench Press', exact: true }).locator('.workout-set').first().getByRole('button', { name: 'Save set weight', exact: true })
    - locator resolved to <button type="button">Save set weight</button>
    - locator resolved to <button disabled type="button">Save set weight</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    52 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=f1e4]:
  - link "Skip to content" [ref=f1e5] [cursor=pointer]:
    - /url: "#main"
  - main [ref=f1e7]:
    - region "Workouts" [ref=f1e8]:
      - generic [ref=f1e9]:
        - button "Open workout menu" [ref=f1e10] [cursor=pointer]
        - button "Rep & Plate home" [ref=f1e12] [cursor=pointer]:
          - generic [ref=f1e13]: Rep & Plate
        - generic [ref=f1e15]:
          - button "Today’s nutrition in chat" [ref=f1e16] [cursor=pointer]
          - button "Your profile" [ref=f1e19] [cursor=pointer]
      - generic [ref=f1e23]:
        - button "Saved routines" [ref=f1e24] [cursor=pointer]
        - generic [ref=f1e25]:
          - text: Workout units
          - combobox "Workout units" [ref=f1e26]:
            - option "lb"
            - option "kg" [selected]
        - button "Log walk or cardio" [ref=f1e27] [cursor=pointer]
      - generic [ref=f1e28]:
        - generic [ref=f1e37]:
          - heading "Upper Body in progress" [level=1] [ref=f1e38]
          - paragraph [ref=f1e39]: 0 of 4 exercises completed.
          - generic [ref=f1e40]:
            - progressbar "Workout progress" [ref=f1e41]
            - generic [ref=f1e42]: 0%
        - generic [ref=f1e43]:
          - generic [ref=f1e44]:
            - text: Jump to exercise
            - combobox "Jump to exercise" [ref=f1e45]:
              - option "Choose an exercise" [disabled] [selected]
              - option "Bench Press"
              - option "Incline Dumbbell Press"
              - option "Seated Cable Row"
              - option "Triceps Pushdown"
          - group [ref=f1e46]:
            - generic "Rest timer" [ref=f1e47] [cursor=pointer]
            - option "30 seconds"
            - option "60 seconds"
            - option "90 seconds" [selected]
            - option "120 seconds"
            - option "180 seconds"
            - option "300 seconds"
        - button "Browse workout options" [ref=f1e48] [cursor=pointer]
        - region "Bench Press" [ref=f1e52]:
          - generic [ref=f1e53]:
            - img "Bench Press illustration" [ref=f1e54]
            - generic [ref=f1e55]:
              - heading "Bench Press" [level=2] [ref=f1e56]
              - button "Adjust Bench Press" [ref=f1e57] [cursor=pointer]: Choose load · 3 × 8
              - paragraph [ref=f1e58]: No finished session recorded for this exercise yet.
            - generic [ref=f1e59]: 1 of 4
          - group [ref=f1e60]:
            - generic "How to approach Bench Press" [ref=f1e61] [cursor=pointer]
          - generic [ref=f1e62]:
            - generic [ref=f1e63]:
              - generic [ref=f1e64]:
                - generic [ref=f1e65]: "1"
                - generic [ref=f1e66]:
                  - strong [ref=f1e67]: Set 1
                  - generic [ref=f1e68]: Choose load · How many reps?
              - generic [ref=f1e69]:
                - generic [ref=f1e70]:
                  - text: Bench Press set 1 weight (kg)
                  - spinbutton "Bench Press set 1 weight (kg)" [ref=f1e71]
                - button "Save set weight" [disabled] [ref=f1e72]
                - generic [ref=f1e73]: 0 = bodyweight. Record the load you actually used.
              - generic [ref=f1e74]:
                - 'button "Bench Press set 1: 6 reps" [disabled] [ref=f1e75]': "6"
                - 'button "Bench Press set 1: 7 reps" [disabled] [ref=f1e76]': "7"
                - 'button "Bench Press set 1: 8 reps" [disabled] [ref=f1e77]': "8"
                - 'button "Bench Press set 1: 9 reps" [disabled] [ref=f1e78]': "9"
                - button "Other reps" [disabled] [ref=f1e79]
                - button "Use voice" [ref=f1e80] [cursor=pointer]
            - generic [ref=f1e85]:
              - generic [ref=f1e86]:
                - generic [ref=f1e87]: "2"
                - generic [ref=f1e88]:
                  - strong [ref=f1e89]: Set 2
                  - generic [ref=f1e90]: Choose load · Not recorded
              - generic [ref=f1e91]:
                - generic [ref=f1e92]:
                  - text: Bench Press set 2 weight (kg)
                  - spinbutton "Bench Press set 2 weight (kg)" [ref=f1e93]
                - button "Save set weight" [disabled] [ref=f1e94]
                - generic [ref=f1e95]: 0 = bodyweight. Record the load you actually used.
            - generic [ref=f1e96]:
              - generic [ref=f1e97]:
                - generic [ref=f1e98]: "3"
                - generic [ref=f1e99]:
                  - strong [ref=f1e100]: Set 3
                  - generic [ref=f1e101]: Choose load · Not recorded
              - generic [ref=f1e102]:
                - generic [ref=f1e103]:
                  - text: Bench Press set 3 weight (kg)
                  - spinbutton "Bench Press set 3 weight (kg)" [ref=f1e104]
                - button "Save set weight" [disabled] [ref=f1e105]
                - generic [ref=f1e106]: 0 = bodyweight. Record the load you actually used.
          - generic [ref=f1e107]:
            - button "Move Bench Press earlier" [disabled] [ref=f1e108]
            - button "Move Bench Press later" [ref=f1e109] [cursor=pointer]
        - region "Incline Dumbbell Press" [ref=f1e111]:
          - generic [ref=f1e112]:
            - img "Incline Dumbbell Press illustration" [ref=f1e113]
            - generic [ref=f1e114]:
              - heading "Incline Dumbbell Press" [level=2] [ref=f1e115]
              - button "Adjust Incline Dumbbell Press" [ref=f1e116] [cursor=pointer]: Choose load · 3 × 10
              - paragraph [ref=f1e117]: No finished session recorded for this exercise yet.
            - generic [ref=f1e118]: 2 of 4
          - group [ref=f1e119]:
            - generic "How to approach Incline Dumbbell Press" [ref=f1e120] [cursor=pointer]
          - generic [ref=f1e121]:
            - generic [ref=f1e122]:
              - generic [ref=f1e123]:
                - generic [ref=f1e124]: "1"
                - generic [ref=f1e125]:
                  - strong [ref=f1e126]: Set 1
                  - generic [ref=f1e127]: Choose load · How many reps?
              - generic [ref=f1e128]:
                - generic [ref=f1e129]:
                  - text: Incline Dumbbell Press set 1 weight (kg)
                  - spinbutton "Incline Dumbbell Press set 1 weight (kg)" [ref=f1e130]
                - button "Save set weight" [disabled] [ref=f1e131]
                - generic [ref=f1e132]: 0 = bodyweight. Record the load you actually used.
              - generic [ref=f1e133]:
                - 'button "Incline Dumbbell Press set 1: 8 reps" [disabled] [ref=f1e134]': "8"
                - 'button "Incline Dumbbell Press set 1: 9 reps" [disabled] [ref=f1e135]': "9"
                - 'button "Incline Dumbbell Press set 1: 10 reps" [disabled] [ref=f1e136]': "10"
                - 'button "Incline Dumbbell Press set 1: 11 reps" [disabled] [ref=f1e137]': "11"
                - button "Other reps" [disabled] [ref=f1e138]
                - button "Use voice" [ref=f1e139] [cursor=pointer]
            - generic [ref=f1e144]:
              - generic [ref=f1e145]:
                - generic [ref=f1e146]: "2"
                - generic [ref=f1e147]:
                  - strong [ref=f1e148]: Set 2
                  - generic [ref=f1e149]: Choose load · Not recorded
              - generic [ref=f1e150]:
                - generic [ref=f1e151]:
                  - text: Incline Dumbbell Press set 2 weight (kg)
                  - spinbutton "Incline Dumbbell Press set 2 weight (kg)" [ref=f1e152]
                - button "Save set weight" [disabled] [ref=f1e153]
                - generic [ref=f1e154]: 0 = bodyweight. Record the load you actually used.
            - generic [ref=f1e155]:
              - generic [ref=f1e156]:
                - generic [ref=f1e157]: "3"
                - generic [ref=f1e158]:
                  - strong [ref=f1e159]: Set 3
                  - generic [ref=f1e160]: Choose load · Not recorded
              - generic [ref=f1e161]:
                - generic [ref=f1e162]:
                  - text: Incline Dumbbell Press set 3 weight (kg)
                  - spinbutton "Incline Dumbbell Press set 3 weight (kg)" [ref=f1e163]
                - button "Save set weight" [disabled] [ref=f1e164]
                - generic [ref=f1e165]: 0 = bodyweight. Record the load you actually used.
          - generic [ref=f1e166]:
            - button "Move Incline Dumbbell Press earlier" [ref=f1e167] [cursor=pointer]
            - button "Move Incline Dumbbell Press later" [ref=f1e168] [cursor=pointer]
        - region "Seated Cable Row" [ref=f1e170]:
          - generic [ref=f1e171]:
            - img "Seated Cable Row illustration" [ref=f1e172]
            - generic [ref=f1e173]:
              - heading "Seated Cable Row" [level=2] [ref=f1e174]
              - button "Adjust Seated Cable Row" [ref=f1e175] [cursor=pointer]: Choose load · 3 × 12
              - paragraph [ref=f1e176]: No finished session recorded for this exercise yet.
            - generic [ref=f1e177]: 3 of 4
          - group [ref=f1e178]:
            - generic "How to approach Seated Cable Row" [ref=f1e179] [cursor=pointer]
          - generic [ref=f1e180]:
            - generic [ref=f1e181]:
              - generic [ref=f1e182]:
                - generic [ref=f1e183]: "1"
                - generic [ref=f1e184]:
                  - strong [ref=f1e185]: Set 1
                  - generic [ref=f1e186]: Choose load · How many reps?
              - generic [ref=f1e187]:
                - generic [ref=f1e188]:
                  - text: Seated Cable Row set 1 weight (kg)
                  - spinbutton "Seated Cable Row set 1 weight (kg)" [ref=f1e189]
                - button "Save set weight" [disabled] [ref=f1e190]
                - generic [ref=f1e191]: 0 = bodyweight. Record the load you actually used.
              - generic [ref=f1e192]:
                - 'button "Seated Cable Row set 1: 10 reps" [disabled] [ref=f1e193]': "10"
                - 'button "Seated Cable Row set 1: 11 reps" [disabled] [ref=f1e194]': "11"
                - 'button "Seated Cable Row set 1: 12 reps" [disabled] [ref=f1e195]': "12"
                - 'button "Seated Cable Row set 1: 13 reps" [disabled] [ref=f1e196]': "13"
                - button "Other reps" [disabled] [ref=f1e197]
                - button "Use voice" [ref=f1e198] [cursor=pointer]
            - generic [ref=f1e203]:
              - generic [ref=f1e204]:
                - generic [ref=f1e205]: "2"
                - generic [ref=f1e206]:
                  - strong [ref=f1e207]: Set 2
                  - generic [ref=f1e208]: Choose load · Not recorded
              - generic [ref=f1e209]:
                - generic [ref=f1e210]:
                  - text: Seated Cable Row set 2 weight (kg)
                  - spinbutton "Seated Cable Row set 2 weight (kg)" [ref=f1e211]
                - button "Save set weight" [disabled] [ref=f1e212]
                - generic [ref=f1e213]: 0 = bodyweight. Record the load you actually used.
            - generic [ref=f1e214]:
              - generic [ref=f1e215]:
                - generic [ref=f1e216]: "3"
                - generic [ref=f1e217]:
                  - strong [ref=f1e218]: Set 3
                  - generic [ref=f1e219]: Choose load · Not recorded
              - generic [ref=f1e220]:
                - generic [ref=f1e221]:
                  - text: Seated Cable Row set 3 weight (kg)
                  - spinbutton "Seated Cable Row set 3 weight (kg)" [ref=f1e222]
                - button "Save set weight" [disabled] [ref=f1e223]
                - generic [ref=f1e224]: 0 = bodyweight. Record the load you actually used.
          - generic [ref=f1e225]:
            - button "Move Seated Cable Row earlier" [ref=f1e226] [cursor=pointer]
            - button "Move Seated Cable Row later" [ref=f1e227] [cursor=pointer]
        - region "Triceps Pushdown" [ref=f1e229]:
          - generic [ref=f1e230]:
            - img "Triceps Pushdown illustration" [ref=f1e231]
            - generic [ref=f1e232]:
              - heading "Triceps Pushdown" [level=2] [ref=f1e233]
              - button "Adjust Triceps Pushdown" [ref=f1e234] [cursor=pointer]: Choose load · 3 × 12
              - paragraph [ref=f1e235]: No finished session recorded for this exercise yet.
            - generic [ref=f1e236]: 4 of 4
          - group [ref=f1e237]:
            - generic "How to approach Triceps Pushdown" [ref=f1e238] [cursor=pointer]
          - generic [ref=f1e239]:
            - generic [ref=f1e240]:
              - generic [ref=f1e241]:
                - generic [ref=f1e242]: "1"
                - generic [ref=f1e243]:
                  - strong [ref=f1e244]: Set 1
                  - generic [ref=f1e245]: Choose load · How many reps?
              - generic [ref=f1e246]:
                - generic [ref=f1e247]:
                  - text: Triceps Pushdown set 1 weight (kg)
                  - spinbutton "Triceps Pushdown set 1 weight (kg)" [ref=f1e248]
                - button "Save set weight" [disabled] [ref=f1e249]
                - generic [ref=f1e250]: 0 = bodyweight. Record the load you actually used.
              - generic [ref=f1e251]:
                - 'button "Triceps Pushdown set 1: 10 reps" [disabled] [ref=f1e252]': "10"
                - 'button "Triceps Pushdown set 1: 11 reps" [disabled] [ref=f1e253]': "11"
                - 'button "Triceps Pushdown set 1: 12 reps" [disabled] [ref=f1e254]': "12"
                - 'button "Triceps Pushdown set 1: 13 reps" [disabled] [ref=f1e255]': "13"
                - button "Other reps" [disabled] [ref=f1e256]
                - button "Use voice" [ref=f1e257] [cursor=pointer]
            - generic [ref=f1e262]:
              - generic [ref=f1e263]:
                - generic [ref=f1e264]: "2"
                - generic [ref=f1e265]:
                  - strong [ref=f1e266]: Set 2
                  - generic [ref=f1e267]: Choose load · Not recorded
              - generic [ref=f1e268]:
                - generic [ref=f1e269]:
                  - text: Triceps Pushdown set 2 weight (kg)
                  - spinbutton "Triceps Pushdown set 2 weight (kg)" [ref=f1e270]
                - button "Save set weight" [disabled] [ref=f1e271]
                - generic [ref=f1e272]: 0 = bodyweight. Record the load you actually used.
            - generic [ref=f1e273]:
              - generic [ref=f1e274]:
                - generic [ref=f1e275]: "3"
                - generic [ref=f1e276]:
                  - strong [ref=f1e277]: Set 3
                  - generic [ref=f1e278]: Choose load · Not recorded
              - generic [ref=f1e279]:
                - generic [ref=f1e280]:
                  - text: Triceps Pushdown set 3 weight (kg)
                  - spinbutton "Triceps Pushdown set 3 weight (kg)" [ref=f1e281]
                - button "Save set weight" [disabled] [ref=f1e282]
                - generic [ref=f1e283]: 0 = bodyweight. Record the load you actually used.
          - generic [ref=f1e284]:
            - button "Move Triceps Pushdown earlier" [ref=f1e285] [cursor=pointer]
            - button "Move Triceps Pushdown later" [disabled] [ref=f1e286]
        - generic [ref=f1e287]:
          - img "Incline Dumbbell Press illustration" [ref=f1e288]
          - generic [ref=f1e289]:
            - generic [ref=f1e290]: UP NEXT
            - strong [ref=f1e291]: Incline Dumbbell Press
            - generic [ref=f1e292]: Choose load · 3 × 10
        - generic [ref=f1e296]:
          - strong [ref=f1e297]: One set at a time. You’ve got this.
          - paragraph [ref=f1e298]: 0 of 12 sets recorded. Keep going at your pace.
        - button "Finish workout" [disabled] [ref=f1e299]
      - generic [ref=f1e303]:
        - textbox "Message about your workout" [ref=f1e304]:
          - /placeholder: Tell me how that set went…
        - button "Use voice" [ref=f1e305] [cursor=pointer]
      - navigation "Workouts navigation" [ref=f1e309]:
        - button "Chat" [ref=f1e310] [cursor=pointer]
        - button "Nutrition" [ref=f1e315] [cursor=pointer]
        - button "Scan a barcode" [ref=f1e319] [cursor=pointer]:
          - generic [ref=f1e326]: Scan
        - button "Workouts" [ref=f1e327] [cursor=pointer]
        - button "Kitchen" [ref=f1e335] [cursor=pointer]
```

# Test source

```ts
  1  | import {test,expect} from './app-fixture';
  2  | import {readBrowserRecords} from './record-fixture';
  3  | 
  4  | test.beforeEach(async({page})=>{await page.route('**/api/status',r=>r.fulfill({json:{available:false,jev:false}}));await page.goto('/#workouts');});
  5  | test('rest survives navigation, reload and elapsed wall time',async({page})=>{
  6  |  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  7  |  await page.getByText('Rest timer',{exact:true}).click();
  8  |  await page.getByRole('button',{name:'Start 90-second rest',exact:true}).click();
  9  |  const end=(await readBrowserRecords(page)).workout.restUntil;
  10 |  expect(end).toBeGreaterThan(Date.now());
  11 |  await page.getByRole('button',{name:'Nutrition',exact:true}).click();await page.getByRole('button',{name:'Workouts',exact:true}).click();
  12 |  await page.getByText(/^\d+s rest$/).click();
  13 |  await expect(page.getByLabel('Rest remaining')).toContainText(/\d+s remaining/);
  14 |  expect((await readBrowserRecords(page)).workout.restUntil).toBe(end);
  15 |  await page.reload();await page.getByText(/^\d+s rest$/).click();
  16 |  expect((await readBrowserRecords(page)).workout.restUntil).toBe(end);
  17 |  await page.getByRole('button',{name:'End rest',exact:true}).click();
  18 |  await expect.poll(async()=>(await readBrowserRecords(page)).workout.restUntil).toBeNull();
  19 | });
  20 | test('chosen units, remaining-set loads and personal routine survive return without recording old work',async({page},info)=>{
  21 |  await page.getByLabel('Workout units').selectOption('kg');
  22 |  await page.getByRole('button',{name:'Start workout',exact:true}).click();
  23 |  const bench=page.getByRole('region',{name:'Bench Press',exact:true});
  24 |  await page.getByLabel('Bench Press set 1 weight (kg)',{exact:true}).fill('80');
> 25 |  await bench.locator('.workout-set').first().getByRole('button',{name:'Save set weight',exact:true}).click();
     |                                                                                                      ^ Error: locator.click: Test timeout of 30000ms exceeded.
  26 |  await page.getByRole('button',{name:'Use this load for remaining Bench Press sets',exact:true}).click();
  27 |  await page.getByRole('button',{name:'Bench Press set 1: 8 reps',exact:true}).click();
  28 |  await expect(page.getByText('Got it. Bench Press, set 1: 80 kg × 8 reps.',{exact:true})).toBeVisible();
  29 |  await expect(page.getByRole('button',{name:'Bench Press set 2: 8 reps',exact:true})).toBeEnabled();
  30 |  await page.getByRole('button',{name:'Saved routines',exact:true}).click();
  31 |  await page.getByLabel('Routine name').fill('Personal upper');
  32 |  await page.getByRole('button',{name:'Save current lineup as routine',exact:true}).click();
  33 |  await expect(page.getByRole('button',{name:'Start routine Personal upper',exact:true})).toBeDisabled();
  34 |  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  35 |  await page.getByRole('button',{name:'Finish workout',exact:true}).click();await page.getByRole('button',{name:'Save partial workout',exact:true}).click();
  36 |  await page.reload();await page.getByRole('button',{name:'Saved routines',exact:true}).click();
  37 |  await expect(page.getByRole('dialog')).toContainText('Previous reference 80 kg');
  38 |  await page.screenshot({path:info.outputPath('review-routine.png')});
  39 |  await page.getByRole('button',{name:'Start routine Personal upper',exact:true}).click();
  40 |  await expect(page.getByRole('heading',{name:'Personal upper in progress',exact:true})).toBeVisible();
  41 |  await expect(page.getByRole('button',{name:'Bench Press set 1: 8 reps',exact:true})).toBeDisabled();
  42 |  const saved=await readBrowserRecords(page);
  43 |  expect(saved.workout.exercises[0].sets).toEqual([null,null,null]);
  44 |  expect(saved.workout.history.at(-1).exercises[0].sets).toEqual([8,null,null]);
  45 |  expect(saved.workout.routines).toHaveLength(1);
  46 |  await page.getByRole('button',{name:'Saved routines',exact:true}).click();await page.getByRole('button',{name:'Remove routine Personal upper',exact:true}).click();await page.getByRole('button',{name:'Confirm remove routine',exact:true}).click();
  47 |  await expect.poll(async()=>(await readBrowserRecords(page)).workout.routines.length).toBe(0);
  48 |  expect((await readBrowserRecords(page)).workout.history).toHaveLength(1);
  49 | });
  50 | 
```