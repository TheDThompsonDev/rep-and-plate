import { test, expect } from './app-fixture';
import { readBrowserRecords, seedBrowserRecords } from './record-fixture';
import { resultFixture } from '../e2e-shared/ai-fixtures';
import { openProfile } from '../e2e-shared/profile-navigation';
import { today } from '../src/domain';

test.beforeEach(async ({page}) => { await page.route('**/api/status', route => route.fulfill({json:{available:true,jev:false}})); });

test('familiar meals review a saved snapshot before adding a separate intake record', async ({page}) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Message Rep & Plate' }).waitFor();
  const state = await readBrowserRecords(page);
  const meal = {id:'usual-eggs',title:'My breakfast',day:today(),time:'8:00 AM',category:'Breakfast',source:'My saved meal',confidence:'estimated',note:'Saved portions',calories:350,protein:25,carbs:30,fat:14};
  await seedBrowserRecords(page,{...state,meals:[meal],dailyPreferences:{usualMealIds:[meal.id]}}); await page.reload();
  await page.getByRole('button',{name:'Today & usuals',exact:true}).click();
  await page.screenshot({path:test.info().outputPath('daily-experience.png')});
  await page.getByRole('button',{name:'Review My breakfast to log again',exact:true}).click();
  expect((await readBrowserRecords(page)).meals).toHaveLength(1);
  await expect(page.getByRole('dialog')).toContainText('Same portions');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  await expect.poll(async()=>(await readBrowserRecords(page)).meals.length).toBe(2);
  expect((await readBrowserRecords(page)).meals.at(-1)).toMatchObject({calories:350,protein:25,confidence:'estimated'});
});

test('menu decisions preserve food intake and retain explicit purpose through capture', async ({page}) => {
  const requests: {capturePurpose?:string;requestId:string}[]=[];
  await page.route('**/api/chat',async route=>{const req=route.request().postDataJSON();requests.push(req);await route.fulfill({contentType:'application/x-ndjson',body:JSON.stringify({type:'result',result:{...resultFixture(req.requestId),receipt:null,meal:null,decision:'conversation',reply:'Here are three choices from your menu.',sources:[],warnings:[]}})+'\n'});});
  await page.goto('/');await page.getByRole('button',{name:'Food help',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'What would help right now?'});
  await expect(dialog).toBeVisible();
  await page.screenshot({path:test.info().outputPath('food-help.png')});
  await dialog.getByRole('button',{name:'Choose an order'}).click();
  await dialog.getByLabel('Menu or order details').fill('Chicken tacos, a rice bowl, and a burger.');
  await dialog.getByRole('button',{name:'Help me choose',exact:true}).click();
  await expect.poll(()=>requests.length).toBe(1);expect(requests[0].capturePurpose).toBe('menu');
  await expect(page.getByText('Here are three choices from your menu.',{exact:true})).toBeVisible();
  const state=await readBrowserRecords(page);expect(state.meals).toHaveLength(0);expect(state.groceries??[]).toHaveLength(0);expect(state.captureInbox??[]).toHaveLength(0);
});

test('saved captures survive a reload and require an explicit send', async ({page}) => {
  await page.goto('/');await page.getByRole('button',{name:'Saved captures',exact:true}).click();
  const inbox=page.getByRole('region',{name:'Saved captures'});
  await inbox.getByRole('button',{name:/Send to Spot/}).first().click();
  await inbox.getByLabel('What happened?',{exact:true}).fill('Lunch screenshot to review later');
  await inbox.getByRole('button',{name:'Save capture',exact:true}).click();
  await expect.poll(async()=>(await readBrowserRecords(page)).captureInbox?.length).toBe(1);
  const id=(await readBrowserRecords(page)).captureInbox[0].id;await page.reload();
  expect((await readBrowserRecords(page)).captureInbox[0].id).toBe(id);expect((await readBrowserRecords(page)).messages).toHaveLength(0);expect((await readBrowserRecords(page)).meals).toHaveLength(0);
});

test('temporary life context expires without changing enduring preferences', async ({page}) => {
  await page.goto('/');await openProfile(page);await page.getByRole('button',{name:/Life right now/}).click();
  const panel=page.getByRole('dialog',{name:'Life right now'});
  const mode=panel.locator('section').filter({has:page.getByRole('heading',{name:'Life right now',exact:true})});
  await mode.getByLabel('What is changing?').selectOption('conference');
  await mode.getByLabel('What should Spot know?').fill('Hotel gym and restaurant meals');
  await mode.getByLabel('Available minutes').fill('20');await mode.getByRole('button',{name:'Save temporary mode',exact:true}).click();
  const saved=await readBrowserRecords(page);expect(saved.lifeContext.mode.kind).toBe('conference');expect(saved.preferences).toBeUndefined();
  await mode.getByRole('button',{name:'End mode now',exact:true}).click();
  expect((await readBrowserRecords(page)).lifeContext.mode).toBeUndefined();
});

test('training reuses exact previous loads only after review', async ({page}) => {
  await page.goto('/#workouts');await expect(page.getByRole('heading',{name:'What should you do today?',exact:true})).toBeVisible();const state=await readBrowserRecords(page);
  const exercise={name:'Bench Press',weight:135,weightConfirmed:true,target:8,previous:[],sets:[8,8,7],setWeights:[135,135,135]};
  const started=new Date().toISOString();
  await seedBrowserRecords(page,{...state,workout:{status:'active',title:'My workout',startedAt:started,finishedAt:null,exercises:[{...exercise,weight:0,weightConfirmed:false,sets:[null,null,null],setWeights:[null,null,null]}],history:[{title:'Previous workout',startedAt:'2026-01-01T12:00:00Z',finishedAt:'2026-01-01T13:00:00Z',exercises:[exercise]}]}});await page.reload();
  const reuse=page.getByRole('button',{name:'Use previous loads for remaining sets',exact:true});await expect(reuse).toBeVisible();
  expect((await readBrowserRecords(page)).workout.exercises[0].weightConfirmed).toBe(false);await reuse.click();
  expect((await readBrowserRecords(page)).workout.exercises[0].setWeights).toEqual([135,135,135]);
  expect((await readBrowserRecords(page)).workout.exercises[0].sets).toEqual([null,null,null]);
});
