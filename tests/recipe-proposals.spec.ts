import { test, expect, type Page } from '@playwright/test';

const stored=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('fuel.prototype.v1')!));
const card=(page:Page)=>page.getByRole('region',{name:'Review prepared meal portion'});
async function send(page:Page,text:string) {
  await page.getByRole('textbox',{name:'Message Rep & Plate'}).fill(text);
  await page.getByRole('button',{name:'Send message',exact:true}).click();
}
async function setup(page:Page) {
  await page.route('**/api/status',route=>route.fulfill({json:{available:true,jev:true}}));
  await page.route('**/api/chat',route=>{
    const request=route.request().postDataJSON();
    const portions=Number(request.text.match(/([\d.]+) portions?/)?.[1]);
    const result={requestId:request.requestId,decision:'conversation',reply:'Review this portion from your saved batch.',meal:null,receipt:null,sources:[],warnings:[],recipePortionProposal:{batchId:'prepared-oats',portions,category:'Breakfast',evidence:request.text}};
    // Repeated transport frames cannot create a second proposal or consumption.
    const frame=JSON.stringify({type:'result',result})+'\n';
    return route.fulfill({contentType:'application/x-ndjson',body:frame+frame});
  });
  await page.goto('/#chat');
  await page.evaluate(()=>{
    const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);
    const createdAt='2026-09-25T12:00:00Z';
    state.meals=[];state.messages=[];
    const item={id:'oats',receiptText:'OATS',name:'Rolled oats',quantity:'1 box',serving:'1/2 cup',servingsPurchased:10,nutrition:{calories:150,protein:5,carbs:27,fat:3},match:'user',note:'',sources:[],needsReview:false,availability:'available'};
    state.groceries=[{id:'recipe-shop',fingerprint:'recipe-proposal-fixture',store:'Fixture market',date:'2026-09-25',note:'',sources:[],items:[item]}];
    state.pantryEvents=[{id:'prepared-event',lotId:'recipe-shop::oats',kind:'prepared',servings:-6,createdAt,note:'Transferred to prepared batch; not eaten.'}];
    state.recipeBatches=[{id:'prepared-oats',name:'Prepared oatmeal',createdAt,totalPortions:4,ingredients:[{id:'recipe-ingredient',name:'Rolled oats',lotId:'recipe-shop::oats',servings:6,servingLabel:'1/2 cup',nutrition:{calories:900,protein:30,carbs:162,fat:18},sourceUrls:[]}],nutrition:{calories:900,protein:30,carbs:162,fat:18},preparationEventIds:['prepared-event'],consumptions:[]}];
    localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));
  });
  await page.reload();
}

test('prepared portion proposals require confirmation, log once, and persist dismissal',async({page})=>{
  await setup(page);const before=await stored(page);
  await send(page,'I ate 1.5 portions of my prepared oatmeal.');
  await expect(card(page)).toHaveCount(1);
  await expect(card(page)).toContainText('337.5 cal');
  let state=await stored(page);
  expect(state.meals).toEqual([]);expect(state.pantryEvents).toEqual(before.pantryEvents);expect(state.recipeBatches).toEqual(before.recipeBatches);
  expect(state.messages.at(-1).recipePortionProposalStatus).toBe('pending');
  await card(page).getByRole('button',{name:'Log portion',exact:true}).evaluate(button=>{(button as HTMLButtonElement).click();(button as HTMLButtonElement).click();});
  await expect(card(page)).toContainText('Portion logged');
  state=await stored(page);
  expect(state.meals).toHaveLength(1);
  expect(state.meals[0]).toMatchObject({title:'Prepared oatmeal',category:'Breakfast',calories:337.5,protein:11.25,carbs:60.75,fat:6.75,recipeBatchId:'prepared-oats',recipePortions:1.5});
  expect(state.recipeBatches[0].consumptions).toHaveLength(1);
  expect(state.recipeBatches[0].consumptions[0].portions).toBe(1.5);
  expect(state.pantryEvents).toEqual(before.pantryEvents);
  expect(state.groceries).toEqual(before.groceries);
  const accepted=state;
  await page.reload();await expect(card(page)).toContainText('Portion logged');
  await expect(card(page).getByRole('button',{name:'Log portion',exact:true})).toHaveCount(0);
  await send(page,'I ate 1 portion of my prepared oatmeal.');
  await expect(card(page)).toHaveCount(2);
  await card(page).last().getByRole('button',{name:'Not now',exact:true}).click();
  await expect(card(page).last()).toContainText('Not logged');
  state=await stored(page);
  expect(state.meals).toEqual(accepted.meals);expect(state.recipeBatches).toEqual(accepted.recipeBatches);expect(state.pantryEvents).toEqual(before.pantryEvents);
  expect(state.messages.at(-1).recipePortionProposalStatus).toBe('dismissed');
  await page.reload();await expect(card(page).last()).toContainText('Not logged');
  expect((await stored(page)).recipeBatches).toEqual(accepted.recipeBatches);
});

test('pending proposal reacts to current leftovers before allowing consumption',async({page})=>{
  await setup(page);const before=await stored(page);
  await send(page,'I ate 3 portions of my prepared oatmeal.');
  await expect(card(page).first().getByRole('button',{name:'Log portion',exact:true})).toBeEnabled();
  await send(page,'I ate 2 portions of my prepared oatmeal.');
  await expect(card(page)).toHaveCount(2);
  await card(page).last().getByRole('button',{name:'Log portion',exact:true}).click();
  await expect(card(page).last()).toContainText('Portion logged');
  await expect(card(page).first()).toContainText('Only 2 portions remain');
  await expect(card(page).first().getByRole('button',{name:'Log portion',exact:true})).toBeDisabled();
  const state=await stored(page);
  expect(state.meals).toHaveLength(1);expect(state.meals[0].calories).toBe(450);
  expect(state.recipeBatches[0].consumptions).toHaveLength(1);expect(state.pantryEvents).toEqual(before.pantryEvents);
  await page.reload();
  await expect(card(page).first().getByRole('button',{name:'Log portion',exact:true})).toBeDisabled();
  expect((await stored(page)).meals).toEqual(state.meals);
});
