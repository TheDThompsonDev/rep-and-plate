# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regressions.spec.ts >> F02 native retains a decimal entered one keystroke at a time
- Location: docs\audits\2026-09-30-personas\regressions.spec.ts:9:1

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator:  getByRole('textbox', { name: 'protein (g)', exact: true })
Expected: "18.3"
Received: "183"
Timeout:  1500ms

Call log:
  - Expect "toHaveValue" getByRole('textbox', { name: 'protein (g)', exact: true }) with timeout 1500ms
  - waiting for getByRole('textbox', { name: 'protein (g)', exact: true })
    15 × locator resolved to <input rows="1" dir="auto" value="183" autocorrect="on" autocomplete="on" spellcheck="true" inputmode="decimal" aria-label="protein (g)" autocapitalize="sentences" virtualkeyboardpolicy="auto" class="css-11aywtz r-6taxm2 r-1jpgo0j r-b5xy7o r-t23y2h r-rs99b7 r-lrpfzh r-ubezar r-1pl7oy7 r-kq9wsh"/>
       - unexpected value "183"

```

```yaml
- textbox "protein (g)": "183"
```

# Test source

```ts
  1  | // These checks deliberately assert the expected user behavior. They are expected
  2  | // to fail on the audited revision; product code is not changed by this audit.
  3  | import {test,expect,type Page} from '@playwright/test';
  4  | import {initialState,today} from '../../../src/domain';
  5  | import {startPlan,recordSet} from '../../../src/workouts';
  6  | import {setWorkoutLoad} from '../../../src/features/progress/set-loads';
  7  | async function seed(page:Page,native=false){const state=initialState();state.meals=[{id:'audit-meal',title:'Decimal meal',category:'Breakfast',calories:215,protein:18.3,carbs:33,fat:0.4,day:today(),time:'9:00 AM',source:'Audit fixture',confidence:'estimated',note:'Synthetic audit record'}];await page.addInitScript(({state,native})=>{localStorage.setItem(native?'dannys-health.native.v1':'fuel.prototype.v1',JSON.stringify(state));localStorage.setItem('rep-and-plate.onboarding.v1',JSON.stringify({version:1,mode:'guest',focus:'Food & meals'}));},{state,native});}
  8  | test('F01 web permits a name-only correction to a meal with decimal macros',async({page})=>{await seed(page);await page.goto('/#nutrition');await page.getByRole('button',{name:'Edit Decimal meal',exact:true}).click();await page.getByLabel('Meal name',{exact:true}).fill('Renamed decimal meal');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);});
> 9  | test('F02 native retains a decimal entered one keystroke at a time',async({page})=>{await seed(page,true);await page.goto('http://127.0.0.1:8081');await page.getByRole('button',{name:'Nutrition',exact:true}).click();await page.getByRole('button',{name:'Edit Decimal meal',exact:true}).click();const field=page.getByRole('textbox',{name:'protein (g)',exact:true});await field.fill('');await field.pressSequentially('18.3',{delay:100});await expect(field).toHaveValue('18.3');});
     |                                                                                                                                                                                                                                                                                                                                                                                                                                                                       ^ Error: expect(locator).toHaveValue(expected) failed
  10 | test('F03 guest setup does not promise automatic account saving',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('button',{name:'Try on this device first',exact:true}).click();await expect(page.getByText('Your account saves changes automatically. Other accounts keep separate records.',{exact:true})).toHaveCount(0);});
  11 | async function workout(page:Page){let state=initialState();let w=startPlan(state.workout,'upper');w=setWorkoutLoad(w,0,0,45);w=recordSet(w,0,0,5);state.workout={...w,status:'finished',finishedAt:new Date().toISOString()};await page.addInitScript(state=>{localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));localStorage.setItem('rep-and-plate.onboarding.v1',JSON.stringify({version:1,mode:'guest',focus:'Movement & workouts'}));},state);await page.goto('/#you');}
  12 | test('F04 recorded activity counts a day with a saved workout',async({page})=>{await workout(page);await expect(page.getByRole('region',{name:'Your recorded activity'})).toContainText('1of 7 days');});
  13 | test('F05 profile workout history includes the recorded load',async({page})=>{await workout(page);await page.getByRole('button',{name:/^Workout history/}).click();await expect(page.getByRole('dialog',{name:'Workout history',exact:true})).toContainText('45 lb');});
  14 | 
```