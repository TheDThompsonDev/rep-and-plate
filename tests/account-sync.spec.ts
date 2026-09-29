import {test,expect,type Page} from '@playwright/test';
import {mockCloud,stored} from './cloud-fixture';
import {initialState} from '../src/domain';
async function enter(page:Page,name=''){
 await page.goto('/');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('fixture@example.test');await page.getByLabel('Password',{exact:true}).fill('test-password-only');
 await page.locator('form').getByRole('button',{name:'Sign in',exact:true}).click();
 if(name)await page.getByLabel('Your name').fill(name);
 await page.getByRole('checkbox',{name:/These device records are mine/}).check();await page.getByRole('button',{name:'That’s me. Let’s go.'}).click();
 await page.getByRole('button',{name:'Let’s do this'}).click();
}
test('account saves automatically, survives reload, and pulls a change from another device',async({page})=>{
 const cloud=await mockCloud(page);await enter(page,'Ada');
 const status=page.getByRole('complementary',{name:'Account save status'});
 await expect(status).toContainText('Saved to your account');expect(cloud.remote.state.profile.name).toBe('Ada');
 await page.reload();await expect(status).toContainText('Saved to your account');
 cloud.remote={...cloud.remote,revision:cloud.remote.revision+1,state:{...cloud.remote.state,profile:{...cloud.remote.state.profile,name:'Ada from phone'}}};
 await expect.poll(async()=>(await stored(page)).profile.name,{timeout:15000}).toBe('Ada from phone');
});
test('a fresh signed-in device automatically restores its existing account records',async({page})=>{
 const cloud=await mockCloud(page);const state=initialState();state.profile.name='Returning friend';
 cloud.remote={user_id:'11111111-1111-4111-8111-111111111111',revision:9,updated_at:new Date().toISOString(),state};
 await enter(page);await expect(page.getByRole('complementary',{name:'Account save status'})).toContainText('Saved to your account');
 expect((await stored(page)).profile.name).toBe('Returning friend');expect(cloud.saveCalls).toBe(0);
});
test('existing local records conflict safely with a different account copy and preserve recovery copy',async({page})=>{
 const cloud=await mockCloud(page);const state=initialState();state.profile.name='Local history';
 await page.addInitScript(state=>{if(!localStorage.getItem('fuel.prototype.v1'))localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));},state);
 cloud.remote={user_id:'11111111-1111-4111-8111-111111111111',revision:9,updated_at:new Date().toISOString(),state:{...state,profile:{...state.profile,name:'Cloud history'}}};
 await enter(page);const status=page.getByRole('complementary',{name:'Account save status'});
 await expect(status).toContainText('Two copies need your review');expect(cloud.saveCalls).toBe(0);expect((await stored(page)).profile.name).toBe('Local history');
 await status.getByRole('button',{name:'Use account copy'}).click();await expect(status).toContainText('Saved to your account');
 expect((await stored(page)).profile.name).toBe('Cloud history');
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('health.sync.recovery.')).map(k=>JSON.parse(localStorage.getItem(k)!).profile.name))).toContain('Local history');
});
test('large restored photos survive reload when the localStorage compatibility mirror exceeds quota',async({page})=>{
 test.setTimeout(60000);
 const cloud=await mockCloud(page),state=initialState();state.profile.name='Photo keeper';
 const photo=Buffer.alloc(4_000_000,65),user='11111111-1111-4111-8111-111111111111';
 state.messages[0].image=`rp-media:${user}/${'a'.repeat(64)}.png`;
 cloud.remote={user_id:user,revision:9,updated_at:new Date().toISOString(),state};
 await page.route('https://fuelcloudtest.supabase.co/storage/v1/object/**',route=>route.fulfill({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'image/png',body:photo}));
 await enter(page);
 const status=page.getByRole('complementary',{name:'Account save status'});
 await expect(status).toContainText('Saved to your account',{timeout:20000});
 const inspect=()=>page.evaluate(async()=>{
  const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('rep-and-plate-records',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const raw=await new Promise<string>((resolve,reject)=>{const request=database.transaction('records','readonly').objectStore('records').get('fuel.prototype.v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const state=JSON.parse(raw),mirror=localStorage.getItem('fuel.prototype.v1');database.close();
  return {name:state.profile.name,imageLength:state.messages[0].image?.length,mirrorLength:mirror?.length??0};
 });
 const saved=await inspect();expect(saved.imageLength).toBeGreaterThan(5_000_000);expect(saved.mirrorLength).toBeLessThan(saved.imageLength);
 await page.reload();await expect(status).toContainText('Saved to your account',{timeout:20000});
 expect(await inspect()).toEqual(saved);expect(cloud.saveCalls).toBe(0);
 await page.getByRole('button',{name:'Your profile',exact:true}).click();await expect(page.getByRole('heading',{name:'Looking ahead, Photo keeper.'})).toBeVisible();
});
test('an interrupted account switch cannot hydrate or upload another account’s active copy',async({page})=>{
 const cloud=await mockCloud(page);await enter(page,'Account A');
 const status=page.getByRole('complementary',{name:'Account save status'});await expect(status).toContainText('Saved to your account');
 await page.evaluate(async()=>{
  const database=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('rep-and-plate-records',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  const original=JSON.parse(localStorage.getItem('fuel.prototype.v1')!);original.profile.name='Account B private records';
  // Simulate the precise crash window: B's account/active copies reached disk,
  // while A's owner marker still remains. A's account archive is unchanged.
  await new Promise<void>((resolve,reject)=>{const tx=database.transaction('records','readwrite');tx.objectStore('records').put(JSON.stringify(original),'fuel.prototype.v1');tx.objectStore('records').put(JSON.stringify(original),'health.account.other-account');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  database.close();localStorage.setItem('fuel.prototype.v1',JSON.stringify(original));
 });
 await page.reload();await expect(status).toContainText('Saved to your account');
 expect((await stored(page)).profile.name).toBe('Account A');expect(cloud.remote.state.profile.name).toBe('Account A');
});
test('signing out during a photo restore never applies or uploads the former account’s pending copy',async({page})=>{
 const cloud=await mockCloud(page),state=initialState(),user='11111111-1111-4111-8111-111111111111';state.profile.name='Pending cloud copy';state.messages[0].image=`rp-media:${user}/${'b'.repeat(64)}.png`;
 cloud.remote={user_id:user,revision:9,updated_at:new Date().toISOString(),state};
 let release!:()=>void,seen!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),started=new Promise<void>(resolve=>{seen=resolve;});
 await page.route('https://fuelcloudtest.supabase.co/storage/v1/object/**',async route=>{seen();await gate;await route.fulfill({headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'image/png',body:Buffer.from('test-photo')});});
 await enter(page);await started;
 await page.evaluate(async()=>{const path='/src/features/cloud/client.ts';const {getCloudClient}=await import(path);await (await getCloudClient()).auth.signOut({scope:'local'});});
 release();await expect(page.getByRole('button',{name:'Sign in',exact:true})).toBeVisible();
 await page.reload();expect((await stored(page)).profile.name).not.toBe('Pending cloud copy');expect(cloud.saveCalls).toBe(0);
});
