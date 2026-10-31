import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const folder=new URL('./evidence/capture-deep/',import.meta.url);await fs.mkdir(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--remote-debugging-port=9226']});
const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Chicago'});
const page=await context.newPage();page.setDefaultTimeout(15000);
const record={startedAt:new Date().toISOString(),mode:'UI guest, synthetic receipt image, unmocked local provider',steps:[],pageErrors:[],consoleErrors:[]};
page.on('pageerror',e=>record.pageErrors.push(e.message));page.on('console',m=>{if(m.type()==='error')record.consoleErrors.push(m.text())});
async function capture(name){await fs.writeFile(new URL(name+'.txt',folder),await page.locator('body').ariaSnapshot());await page.screenshot({path:fileURLToPath(new URL(name+'.png',folder)),fullPage:true});record.steps.push(name);await fs.writeFile(new URL('results.json',folder),JSON.stringify(record,null,2));}
await page.goto('http://127.0.0.1:5173');await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByRole('button',{name:'Try on this device first'}).click();await page.getByLabel('Your name').fill('Capture audit');await page.getByRole('button',{name:'That’s me. Let’s go.',exact:true}).click();await page.getByRole('button',{name:'Let’s do this',exact:true}).click();
await page.getByRole('textbox',{name:'Message Rep & Plate'}).waitFor();
await page.getByRole('button',{name:'Kitchen',exact:true}).click();await page.getByRole('button',{name:'Add a receipt',exact:true}).click();
const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:/^Choose a photo/}).click();await(await chooser).setFiles('tests/fixtures/grocery-receipt.png');
await page.getByAltText('Your grocery receipt').waitFor();await capture('01-receipt-preview');
await page.getByRole('button',{name:'Send to Rep & Plate',exact:true}).click();
try{await page.waitForFunction(()=>{const r=JSON.parse(localStorage.getItem('fuel.prototype.v1')||'{}').messages?.filter(m=>m.role==='user'&&m.ai).at(-1);return r&&(r.aiStatus==='complete'||r.aiStatus==='error');},null,{timeout:150000});}catch(e){record.requestError=e.message;}
await capture('02-receipt-result');console.log('Receipt captured; CDP 9226 available for follow-up');
await new Promise(()=>{});
