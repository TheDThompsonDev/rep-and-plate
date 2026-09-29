import {commitSeededRecords, readBrowserRecords } from "./record-fixture";
import { test,expect,type Page,type Route } from "./app-fixture";
import type { PreferenceProposal } from '../src/features/preferences/proposals';

const stored=(page:Page)=>readBrowserRecords(page);
async function send(page:Page,text:string) {
  await page.getByRole('textbox',{name:'Message Rep & Plate'}).fill(text);
  await page.getByRole('button',{name:'Send message',exact:true}).click();
}
function reply(route:Route,proposal:PreferenceProposal,repeat=false) {
  const request=route.request().postDataJSON();
  const result={requestId:request.requestId,reply:'Review these preferences before I save them.',decision:'conversation',receipt:null,meal:null,sources:[],warnings:[],preferenceProposal:proposal};
  const record=JSON.stringify({type:'result',result})+'\n';
  return route.fulfill({contentType:'application/x-ndjson',body:record+(repeat?record:'')});
}
test.beforeEach(async({page})=>{
  await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));
});

test('chat preference proposals wait for approval and survive refresh without duplicate additions',async({page})=>{
  const text='Please remember that I avoid peanuts and cook for two.';
  const proposal:PreferenceProposal={evidence:text,description:'Remember your food exclusion and household size.',changes:[{field:'restrictions',operation:'add',value:'peanuts'},{field:'householdSize',operation:'set',value:'2'}]};
  const requests:any[]=[];
  await page.route('**/api/chat',route=>{requests.push(route.request().postDataJSON());return reply(route,proposal,true);});
  await page.goto('/');const before=await stored(page);
  await send(page,text);
  const card=page.getByRole('region',{name:'Review preference changes'});
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(text);
  expect((await stored(page)).preferences).toEqual(before.preferences);
  await card.getByText('Review before and after',{exact:true}).click();
  await expect(card).toContainText('Now: None specified');
  await expect(card).toContainText('After saving: peanuts');
  await expect(card).toContainText('After saving: 2');
  await card.getByRole('button',{name:'Save these preferences'}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
  await expect(card).toContainText('Saved with your approval.');
  let state=await stored(page);
  expect(state.preferences.restrictions).toEqual(['peanuts']);
  expect(state.preferences.householdSize).toBe(2);
  expect(state.messages.filter((message:any)=>message.preferenceProposal)).toHaveLength(1);
  expect(state.messages.find((message:any)=>message.preferenceProposal).preferenceStatus).toBe('accepted');
  await page.reload();
  await expect(card).toContainText('Preferences saved');
  await expect(page.getByRole('button',{name:'Save these preferences'})).toHaveCount(0);
  expect((await stored(page)).preferences).toEqual(state.preferences);
  // A separate, repeated request still needs its own approval and cannot duplicate a list entry.
  await send(page,text);
  await expect(card).toHaveCount(2);
  expect(requests[1].context.preferences.restrictions).toEqual(['peanuts']);
  await card.last().getByRole('button',{name:'Save these preferences'}).click();
  state=await stored(page);expect(state.preferences.restrictions).toEqual(['peanuts']);
  expect(state.meals).toEqual(before.meals);
});

test('dismissing a proposed dislike leaves preferences unchanged after reload',async({page})=>{
  const text='I did not like that mushroom dinner.';
  const proposal:PreferenceProposal={evidence:text,description:'Check whether you want mushrooms remembered as a dislike.',changes:[{field:'dislikes',operation:'add',value:'mushrooms'}]};
  await page.route('**/api/chat',route=>reply(route,proposal));
  await page.goto('/');const before=await stored(page);
  await send(page,text);
  const card=page.getByRole('region',{name:'Review preference changes'});
  await expect(card).toContainText('Nothing changes until you save');
  await card.getByRole('button',{name:'Not now',exact:true}).click();
  await expect(card).toContainText('Not saved.');
  expect((await stored(page)).preferences).toEqual(before.preferences);
  await page.reload();
  await expect(card).toContainText('Left your preferences as they were');
  await expect(card.getByRole('button')).toHaveCount(0);
  expect((await stored(page)).preferences).toEqual(before.preferences);
  expect((await stored(page)).messages.find((message:any)=>message.preferenceProposal).preferenceStatus).toBe('dismissed');
});

test('removing an exclusion is explicitly labeled and removes only the approved item',async({page})=>{
  const text='Remove dairy-free from my food exclusions. Keep peanuts excluded.';
  const proposal:PreferenceProposal={evidence:text,description:'Remove dairy-free while keeping your other exclusions.',changes:[{field:'restrictions',operation:'remove',value:'dairy-free'}]};
  await page.route('**/api/chat',route=>reply(route,proposal));
  await page.goto('/');
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
    state.preferences={restrictions:['dairy-free','peanuts'],dislikes:[],favorites:[],equipment:[],cookingMinutes:null,householdSize:1,budget:'unknown',workoutPreferences:'',updatedAt:new Date().toISOString()};
    localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  });await commitSeededRecords(page);
  await page.reload();
  await send(page,text);
  const card=page.getByRole('region',{name:'Review preference changes'});
  await expect(card.locator('.fuel-preference-removal')).toContainText('Remove food exclusion');
  await expect(card.locator('.fuel-preference-removal')).toContainText('dairy-free');
  expect((await stored(page)).preferences.restrictions).toEqual(['dairy-free','peanuts']);
  await card.getByText('Review before and after',{exact:true}).click();
  await expect(card).toContainText('Now: dairy-free, peanuts');
  await expect(card).toContainText('After saving: peanuts');
  await card.getByRole('button',{name:'Save these preferences'}).click();
  expect((await stored(page)).preferences.restrictions).toEqual(['peanuts']);
});
