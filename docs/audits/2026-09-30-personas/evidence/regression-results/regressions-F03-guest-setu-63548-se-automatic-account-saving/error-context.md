# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regressions.spec.ts >> F03 guest setup does not promise automatic account saving
- Location: docs\audits\2026-09-30-personas\regressions.spec.ts:10:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByText('Your account saves changes automatically. Other accounts keep separate records.', { exact: true })
Expected: 0
Received: 1
Timeout:  1500ms

Call log:
  - Expect "toHaveCount" getByText('Your account saves changes automatically. Other accounts keep separate records.', { exact: true }) with timeout 1500ms
  - waiting for getByText('Your account saves changes automatically. Other accounts keep separate records.', { exact: true })
    15 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- main "Welcome to Rep & Plate" [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]: Rep & Plate®
    - button "Sign in" [ref=e6] [cursor=pointer]
  - generic [ref=e9]:
    - img "Spot connecting pasta photos with red string on a conspiracy board." [ref=e11]
    - generic [ref=e12]:
      - generic "Your setup" [ref=e13]:
        - generic [ref=e14]: 01 · Meet Spot
        - generic [ref=e15]: 02 · Your account
        - generic [ref=e16]: 03 · Make it yours
      - paragraph [ref=e17]: YOUR PACE. SPOT’S ENTHUSIASM.
      - heading "What should I call you?" [active] [level=1] [ref=e18]
      - paragraph [ref=e19]: One tiny introduction before I become unnecessarily invested in your day.
      - generic [ref=e20]:
        - generic [ref=e21]:
          - text: Your name
          - generic [ref=e22]: (optional)
          - textbox "Your name (optional)" [ref=e23]:
            - /placeholder: What you like to be called
        - group "Where would you like to start?" [ref=e24]:
          - generic [ref=e26] [cursor=pointer]:
            - radio "Food & meals" [ref=e27]
            - text: Food & meals
          - generic [ref=e28] [cursor=pointer]:
            - radio "Movement & workouts" [ref=e29]
            - text: Movement & workouts
          - generic [ref=e30] [cursor=pointer]:
            - radio "A little of both" [checked] [ref=e31]
            - text: A little of both
        - paragraph [ref=e34]: Your account saves changes automatically. Other accounts keep separate records.
        - button "That’s me. Let’s go." [ref=e35] [cursor=pointer]
      - button "Back to account" [ref=e38] [cursor=pointer]
  - generic [ref=e39]: GOOD FOOD. SOLID WORK. BRIGHTER DAYS.
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
  9  | test('F02 native retains a decimal entered one keystroke at a time',async({page})=>{await seed(page,true);await page.goto('http://127.0.0.1:8081');await page.getByRole('button',{name:'Nutrition',exact:true}).click();await page.getByRole('button',{name:'Edit Decimal meal',exact:true}).click();const field=page.getByRole('textbox',{name:'protein (g)',exact:true});await field.fill('');await field.pressSequentially('18.3',{delay:100});await expect(field).toHaveValue('18.3');});
> 10 | test('F03 guest setup does not promise automatic account saving',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('button',{name:'Try on this device first',exact:true}).click();await expect(page.getByText('Your account saves changes automatically. Other accounts keep separate records.',{exact:true})).toHaveCount(0);});
     |                                                                                                                                                                                                                                                                                                                                                                                                  ^ Error: expect(locator).toHaveCount(expected) failed
  11 | async function workout(page:Page){let state=initialState();let w=startPlan(state.workout,'upper');w=setWorkoutLoad(w,0,0,45);w=recordSet(w,0,0,5);state.workout={...w,status:'finished',finishedAt:new Date().toISOString()};await page.addInitScript(state=>{localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));localStorage.setItem('rep-and-plate.onboarding.v1',JSON.stringify({version:1,mode:'guest',focus:'Movement & workouts'}));},state);await page.goto('/#you');}
  12 | test('F04 recorded activity counts a day with a saved workout',async({page})=>{await workout(page);await expect(page.getByRole('region',{name:'Your recorded activity'})).toContainText('1of 7 days');});
  13 | test('F05 profile workout history includes the recorded load',async({page})=>{await workout(page);await page.getByRole('button',{name:/^Workout history/}).click();await expect(page.getByRole('dialog',{name:'Workout history',exact:true})).toContainText('45 lb');});
  14 | 
```