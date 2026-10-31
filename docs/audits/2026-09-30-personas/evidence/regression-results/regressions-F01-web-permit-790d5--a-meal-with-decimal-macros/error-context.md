# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: regressions.spec.ts >> F01 web permits a name-only correction to a meal with decimal macros
- Location: docs\audits\2026-09-30-personas\regressions.spec.ts:8:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByRole('dialog')
Expected: 0
Received: 1
Timeout:  1500ms

Call log:
  - Expect "toHaveCount" getByRole('dialog') with timeout 1500ms
  - waiting for getByRole('dialog')
    15 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - link "Skip to content" [ref=e5] [cursor=pointer]:
    - /url: "#main"
  - main [ref=e7]:
    - region "Nutrition" [ref=e8]:
      - generic [ref=e9]:
        - button "Open nutrition menu" [ref=e10] [cursor=pointer]
        - button "Rep & Plate home" [ref=e12] [cursor=pointer]:
          - generic [ref=e13]: Rep & Plate
        - generic [ref=e15]:
          - button "Today’s nutrition in chat" [ref=e16] [cursor=pointer]
          - button "Your profile" [ref=e19] [cursor=pointer]
      - generic [ref=e23]:
        - generic [ref=e24]:
          - heading "Your day is coming together." [level=1] [ref=e25]
          - paragraph [ref=e26]: A clear picture of what fuels you.
        - generic [ref=e27]:
          - button "Previous day" [ref=e28] [cursor=pointer]
          - generic [ref=e31]: Today · Sep 30
          - button "Next day" [disabled] [ref=e32]
          - generic "Food log view" [ref=e35]:
            - button "Day" [pressed] [ref=e36] [cursor=pointer]
            - button "Week" [ref=e37] [cursor=pointer]
        - region "Today’s nutrition" [ref=e38]:
          - heading "Today’s nutrition" [level=2] [ref=e39]
          - paragraph [ref=e40]: 1,785 calories left
          - generic [ref=e41]:
            - button "View and edit today’s meals" [ref=e42] [cursor=pointer]:
              - generic [ref=e46]:
                - strong [ref=e47]: "215"
                - generic [ref=e48]: of 2,000 cal
            - generic [ref=e49]:
              - generic [ref=e50]:
                - generic [ref=e51]: Protein
                - generic [ref=e52]:
                  - strong [ref=e53]: 18.3g
                  - generic [ref=e54]: / 110g
                - progressbar "protein" [ref=e55]
              - generic [ref=e57]:
                - generic [ref=e58]: Carbs
                - generic [ref=e59]:
                  - strong [ref=e60]: 33g
                  - generic [ref=e61]: / 250g
                - progressbar "carbs" [ref=e62]
              - generic [ref=e64]:
                - generic [ref=e65]: Fats
                - generic [ref=e66]:
                  - strong [ref=e67]: 0.4g
                  - generic [ref=e68]: / 78g
                - progressbar "fat" [ref=e69]
          - generic [ref=e71]:
            - generic [ref=e72]: From 1 meal you logged
            - button "Edit daily targets" [ref=e73] [cursor=pointer]: Edit targets
        - button "Scan a food barcode" [ref=e77] [cursor=pointer]:
          - generic [ref=e84]:
            - strong [ref=e85]: Have a label? Scan it.
            - generic [ref=e86]: Check the portion, then add it to your day.
        - region "Today's logged meals" [ref=e89]:
          - generic [ref=e90]:
            - heading "What you’ve had" [level=2] [ref=e91]
            - button "Log a meal" [ref=e92] [cursor=pointer]
          - region "Breakfast meals" [ref=e95]:
            - generic [ref=e96]:
              - heading "Breakfast" [level=3] [ref=e97]
              - generic [ref=e98]: 215 cal
            - button "Edit Decimal meal" [ref=e99] [cursor=pointer]:
              - generic [ref=e104]:
                - strong [ref=e105]: Decimal meal
                - generic [ref=e106]: 9:00 AM · Estimated
                - generic [ref=e107]:
                  - generic [ref=e108]: 215 cal
                  - generic [ref=e109]: 18.3g protein
                  - generic [ref=e110]: 33g carbs
                  - generic [ref=e111]: 0.4g fat
        - generic [ref=e116]:
          - heading "A little inspiration for later" [level=2] [ref=e118]
          - paragraph [ref=e119]: Make room for something you’ll enjoy.
          - button "MEALS AHEAD What sounds good for your next meal? Explore your meal plan" [ref=e120] [cursor=pointer]:
            - generic [ref=e121]:
              - generic [ref=e122]: MEALS AHEAD
              - strong [ref=e123]: What sounds good for your next meal?
              - generic [ref=e124]: Explore your meal plan
        - generic [ref=e127]:
          - generic [ref=e128]:
            - heading "Your insights" [level=2] [ref=e129]
            - button "See all" [ref=e130] [cursor=pointer]
          - 'button "1 meal across 1 logged day. Average recorded intake: 215 calories per logged day." [ref=e134] [cursor=pointer]':
            - generic [ref=e139]:
              - strong [ref=e140]: 1 meal across 1 logged day.
              - generic [ref=e141]: "Average recorded intake: 215 calories per logged day."
        - heading "Your food, organized" [level=2] [ref=e145]
        - navigation "Food planning tools" [ref=e146]:
          - button "Pantry What you have" [ref=e147] [cursor=pointer]:
            - strong [ref=e154]: Pantry
            - generic [ref=e155]: What you have
          - button "Meal plan Your week" [ref=e156] [cursor=pointer]:
            - strong [ref=e159]: Meal plan
            - generic [ref=e160]: Your week
          - button "Recipes Meals & leftovers" [ref=e161] [cursor=pointer]:
            - strong [ref=e166]: Recipes
            - generic [ref=e167]: Meals & leftovers
        - generic [ref=e168]:
          - generic [ref=e169]:
            - heading "Smart swaps" [level=2] [ref=e170]
            - generic [ref=e171]: Your foods. Your portions.
          - button "Compare foods in your pantry Add two foods with confirmed serving details to compare them here." [ref=e172] [cursor=pointer]:
            - generic [ref=e177]:
              - strong [ref=e178]: Compare foods in your pantry
              - generic [ref=e179]: Add two foods with confirmed serving details to compare them here.
      - navigation "Nutrition navigation" [ref=e182]:
        - button "Chat" [ref=e183] [cursor=pointer]
        - button "Nutrition" [ref=e188] [cursor=pointer]
        - button "Scan a barcode" [ref=e192] [cursor=pointer]:
          - generic [ref=e199]: Scan
        - button "Workouts" [ref=e200] [cursor=pointer]
        - button "Kitchen" [ref=e208] [cursor=pointer]
  - dialog "The details are yours to adjust." [ref=e214]:
    - generic [ref=e215]:
      - heading "The details are yours to adjust." [level=2] [ref=e216]
      - button "Close dialog" [ref=e217] [cursor=pointer]
    - generic [ref=e221]:
      - generic [ref=e222]: This is an estimate. A quick correction is always welcome.
      - generic [ref=e226]:
        - text: Meal name
        - textbox "Meal name" [ref=e227]:
          - /placeholder: What did you have?
          - text: Renamed decimal meal
      - generic [ref=e228]:
        - text: Meal
        - combobox "Meal" [ref=e229]:
          - option "Breakfast" [selected]
          - option "Lunch"
          - option "Dinner"
          - option "Snack"
      - generic [ref=e230]:
        - generic [ref=e231]:
          - text: Calories
          - spinbutton "Calories" [ref=e232]: "215"
        - generic [ref=e233]:
          - text: Protein (g)
          - spinbutton "Protein (g)" [active] [ref=e234]: "18.3"
        - generic [ref=e235]:
          - text: Carbs (g)
          - spinbutton "Carbs (g)" [ref=e236]: "33"
        - generic [ref=e237]:
          - text: Fat (g)
          - spinbutton "Fat (g)" [ref=e238]: "0.4"
      - generic [ref=e239]:
        - text: Notes
        - textbox "Notes" [ref=e240]: Synthetic audit record
      - generic [ref=e241]: "Source: Audit fixture"
      - button "Save changes" [ref=e246] [cursor=pointer]
      - button "Remove this meal" [ref=e250] [cursor=pointer]
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
> 8  | test('F01 web permits a name-only correction to a meal with decimal macros',async({page})=>{await seed(page);await page.goto('/#nutrition');await page.getByRole('button',{name:'Edit Decimal meal',exact:true}).click();await page.getByLabel('Meal name',{exact:true}).fill('Renamed decimal meal');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);});
     |                                                                                                                                                                                                                                                                                                                                                                                                                      ^ Error: expect(locator).toHaveCount(expected) failed
  9  | test('F02 native retains a decimal entered one keystroke at a time',async({page})=>{await seed(page,true);await page.goto('http://127.0.0.1:8081');await page.getByRole('button',{name:'Nutrition',exact:true}).click();await page.getByRole('button',{name:'Edit Decimal meal',exact:true}).click();const field=page.getByRole('textbox',{name:'protein (g)',exact:true});await field.fill('');await field.pressSequentially('18.3',{delay:100});await expect(field).toHaveValue('18.3');});
  10 | test('F03 guest setup does not promise automatic account saving',async({page})=>{await page.goto('/');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('button',{name:'Try on this device first',exact:true}).click();await expect(page.getByText('Your account saves changes automatically. Other accounts keep separate records.',{exact:true})).toHaveCount(0);});
  11 | async function workout(page:Page){let state=initialState();let w=startPlan(state.workout,'upper');w=setWorkoutLoad(w,0,0,45);w=recordSet(w,0,0,5);state.workout={...w,status:'finished',finishedAt:new Date().toISOString()};await page.addInitScript(state=>{localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));localStorage.setItem('rep-and-plate.onboarding.v1',JSON.stringify({version:1,mode:'guest',focus:'Movement & workouts'}));},state);await page.goto('/#you');}
  12 | test('F04 recorded activity counts a day with a saved workout',async({page})=>{await workout(page);await expect(page.getByRole('region',{name:'Your recorded activity'})).toContainText('1of 7 days');});
  13 | test('F05 profile workout history includes the recorded load',async({page})=>{await workout(page);await page.getByRole('button',{name:/^Workout history/}).click();await expect(page.getByRole('dialog',{name:'Workout history',exact:true})).toContainText('45 lb');});
  14 | 
```