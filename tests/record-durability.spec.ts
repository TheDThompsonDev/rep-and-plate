import {test,expect} from '@playwright/test';
test('an immediate refresh restores the latest small edit even before its durable write completes',async({page})=>{
 await page.goto('/');await expect(page.getByRole('heading',{name:/Track your food/})).toBeVisible();
 await page.evaluate(async()=>{
  const storage=await import('/src/platform/browser-records.ts');
  const {initialState}=await import('/src/domain.ts');
  localStorage.setItem('rep-and-plate.onboarding.v1',JSON.stringify({version:1,mode:'guest',focus:'A little of both'}));
  // Hold the durable writer as if the browser closed mid-write. Only the
  // synchronous recovery journal can contain the new name at this point.
  void storage.browserRecordTransaction(()=>new Promise<void>(()=>{}));
  const state=initialState();state.profile.name='Survives immediate refresh';
  void storage.persistBrowserRecords(state);
 });
 await page.reload();
 await expect(page.getByRole('textbox',{name:'Message Rep & Plate'})).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fuel.prototype.v1')??'null')?.profile?.name)).toBe('Survives immediate refresh');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('health.pending.guest'))).toBeNull();
});
test('saving preferences journals the edit before an immediate navigation, without waiting for a React effect',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('rep-and-plate.onboarding.v1',JSON.stringify({version:1,mode:'guest',focus:'A little of both'})));
 await page.goto('/');
 await page.getByRole('button',{name:'Open chat menu'}).click();
 await page.getByRole('button',{name:'Food & routine preferences',exact:true}).click();
 await page.getByLabel('Foods to exclude or dietary restrictions').fill('peanuts');
 await page.evaluate(async()=>{const storage=await import('/src/platform/browser-records.ts');void storage.browserRecordTransaction(()=>new Promise<void>(()=>{}));});
 await Promise.all([
  page.waitForURL('**/',{waitUntil:'load'}),
  page.getByRole('button',{name:'Save food & routine preferences'}).evaluate((button:HTMLButtonElement)=>{button.click();location.reload();}),
 ]);
 await page.waitForLoadState('load');
 await page.getByRole('button',{name:'Open chat menu'}).click();
 await page.getByRole('button',{name:'Food & routine preferences',exact:true}).click();
 await expect(page.getByLabel('Foods to exclude or dietary restrictions')).toHaveValue('peanuts');
});
