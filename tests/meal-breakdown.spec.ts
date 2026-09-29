import { test, expect } from '@playwright/test';

test('Milk, syrup and oil remain visible in a meal estimate and save only once', async ({page})=>{
  await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));
  await page.route('**/api/chat',route=>{
    const {requestId}=route.request().postDataJSON();
    return route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:{requestId,reply:'Here is the estimate, including the milk, syrup, and cooking oil.',decision:'meal',receipt:null,sources:[],warnings:[],meal:{title:'Breakfast with chai',category:'Breakfast',portion:'One breakfast',note:'Review the amounts before adding.',calories:380,protein:20,carbs:26,fat:22.5,sources:[],components:[
      {name:'Whole milk in chai',portion:'1 cup',nutrition:{calories:150,protein:8,carbs:12,fat:8}},
      {name:'Syrup in chai',portion:'1 tbsp',nutrition:{calories:50,protein:0,carbs:13,fat:0}},
      {name:'Olive oil',portion:'1 tsp',nutrition:{calories:40,protein:0,carbs:0,fat:4.5}},
      {name:'Eggs',portion:'2 eggs',nutrition:{calories:140,protein:12,carbs:1,fat:10}},
    ]}}})+'\n'});
  });
  await page.goto('/');
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('fuel.prototype.v1')!));
  await page.getByRole('textbox',{name:'Message Rep & Plate'}).fill('I ate eggs in oil and drank chai with milk and syrup.');
  await page.getByRole('button',{name:'Send message',exact:true}).click();
  await page.getByText("What's in this estimate",{exact:false}).click();
  const breakdown=page.locator('.meal-proposal-breakdown');
  for(const name of ['Whole milk in chai','Syrup in chai','Olive oil','Eggs']) await expect(breakdown.getByText(name,{exact:true})).toBeVisible();
  expect((await page.evaluate(()=>JSON.parse(localStorage.getItem('fuel.prototype.v1')!))).meals).toEqual(before.meals);
  await page.getByRole('button',{name:'Yep, add to Breakfast',exact:true}).click();
  await page.reload();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('fuel.prototype.v1')!));
  expect(after.meals).toHaveLength(before.meals.length+1);
  expect(after.meals.at(-1)).toMatchObject({calories:380,components:[{name:'Whole milk in chai'},{name:'Syrup in chai'},{name:'Olive oil'},{name:'Eggs'}]});
  expect(after.pantryEvents).toEqual(before.pantryEvents);
  await expect(page.getByRole('button',{name:'Yep, add to Breakfast',exact:true})).toHaveCount(0);
});
