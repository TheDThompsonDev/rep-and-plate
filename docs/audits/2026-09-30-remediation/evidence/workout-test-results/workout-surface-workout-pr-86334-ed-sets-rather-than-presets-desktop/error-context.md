# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: workout-surface.spec.ts >> workout previews and recent history use completed recorded sets rather than presets
- Location: tests\workout-surface.spec.ts:40:1

# Error details

```
Error: page.reload: net::ERR_CONNECTION_REFUSED
Call log:
  - waiting for navigation until "load"

```

# Test source

```ts
  1  | import {commitSeededRecords, readBrowserRecords } from "./record-fixture";
  2  | import { test, expect, type Page } from "./app-fixture";
  3  | 
  4  | const stored=(page:Page)=>readBrowserRecords(page);
  5  | test.beforeEach(async({page})=>{
  6  |   await page.route('**/api/status',route=>route.fulfill({json:{available:false,jev:false}}));
  7  |   await page.goto('/#workouts');
  8  | });
  9  | 
  10 | test('workout options show an honest empty history and preserve an active session while browsing',async({page})=>{
  11 |   await expect(page.locator('.spot-empty')).toContainText('No reps yet.');
  12 |   await expect(page.locator('.workout-preview').first()).toContainText('No finished session recorded');
  13 |   await expect(page.getByText('Your bench has increased 15 lb in 7 weeks.',{exact:true})).toHaveCount(0);
  14 |   await expect(page.getByText(/Last time:/)).toHaveCount(0);
  15 |   await page.getByRole('button',{name:'Start workout',exact:true}).click();
  16 |   await page.getByLabel('Bench Press set 1 weight (lb)',{exact:true}).fill('45');
  17 |   await page.getByRole('region',{name:'Bench Press',exact:true}).locator('.workout-set').first().getByRole('button',{name:'Save set weight',exact:true}).click();
  18 |   await page.getByRole('button',{name:'Bench Press set 1: 8 reps',exact:true}).click();
  19 |   const active=(await stored(page)).workout;
  20 |   await page.getByRole('button',{name:'Browse workout options',exact:true}).click();
  21 |   await expect(page.getByRole('region',{name:'Your active workout'})).toContainText('1 of 12 sets recorded');
  22 |   await expect(page.getByRole('button',{name:'Create a workout for me',exact:true})).toBeDisabled();
  23 |   await page.getByRole('button',{name:'Lower Body ~35 min',exact:true}).click();
  24 |   await expect(page.getByRole('heading',{name:'Lower Body · ~35 min',exact:true})).toBeVisible();
  25 |   await expect(page.getByRole('button',{name:'Start workout',exact:true})).toHaveCount(0);
  26 |   await page.getByRole('button',{name:'Continue current workout',exact:true}).click();
  27 |   await expect(page.getByRole('heading',{name:'Upper Body in progress',exact:true})).toBeVisible();
  28 |   expect((await stored(page)).workout).toEqual(active);
  29 |   await page.reload();
  30 |   await expect(page.getByRole('heading',{name:'Upper Body in progress',exact:true})).toBeVisible();
  31 |   expect((await stored(page)).workout).toEqual(active);
  32 |   await page.getByRole('button',{name:'Open workout menu',exact:true}).click();
  33 |   await page.getByRole('button',{name:'Session history',exact:true}).click();
  34 |   await expect(page.getByRole('dialog')).toContainText('Upper Body · In progress');
  35 |   await page.getByRole('button',{name:'Resume workout',exact:true}).click();
  36 |   await expect(page.getByRole('dialog')).toHaveCount(0);
  37 |   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  38 | });
  39 | 
  40 | test('workout previews and recent history use completed recorded sets rather than presets',async({page})=>{
  41 |   await page.evaluate(()=>{
  42 |     const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
  43 |     const exercise={name:'Bench Press',weight:95,target:8,previous:[99,99,99],sets:[8,null,6]};
  44 |     const saved={title:'Recorded upper body',startedAt:'2026-09-23T12:00:00Z',finishedAt:'2026-09-23T13:00:00Z',exercises:[exercise]};
  45 |     state.workout.history=[saved,saved,{...saved,title:'Unfinished upper body',startedAt:'2026-09-24T12:00:00Z',finishedAt:null},{...saved,title:'Sample history',startedAt:'2026-09-25T12:00:00Z',finishedAt:'2026-09-25T13:00:00Z'}];
  46 |     localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  47 |   });
  48 |   await commitSeededRecords(page);
> 49 |   await page.reload();const before=(await stored(page)).workout;
     |              ^ Error: page.reload: net::ERR_CONNECTION_REFUSED
  50 |   await expect(page.locator('.workout-preview').first()).toContainText('Last recorded: 95 lb · 8, 6 reps');
  51 |   await expect(page.locator('.workout-preview').first()).not.toContainText('99');
  52 |   await expect(page.locator('.workout-insight').first()).toContainText('2 sets across your latest finished session');
  53 |   await page.getByRole('button',{name:'View history',exact:true}).click();
  54 |   const dialog=page.getByRole('dialog');
  55 |   await expect(dialog.getByRole('heading',{name:'Recorded upper body · Saved',exact:true})).toHaveCount(1);
  56 |   await expect(dialog).toContainText('95 lb × 8, 95 lb × 6');
  57 |   await expect(dialog).not.toContainText('Unfinished upper body');
  58 |   await expect(dialog).not.toContainText('Sample history');
  59 |   await expect(dialog).not.toContainText('99');
  60 |   await page.keyboard.press('Escape');
  61 |   expect((await stored(page)).workout).toEqual(before);
  62 |   await page.getByRole('button',{name:'Start workout',exact:true}).click();
  63 |   await expect(page.getByRole('region',{name:'Bench Press',exact:true})).toContainText('Last recorded: 95 lb · 8, 6 reps');
  64 | });
  65 | 
```