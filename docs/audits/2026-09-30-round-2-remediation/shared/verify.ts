import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {initialState,today} from '../../../../src/domain';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844}});
const page=await context.newPage();
const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const state=initialState();state.meals=[{id:'verify-yogurt',title:'Verification yogurt',category:'Breakfast',day:today(),time:'9:00 AM',source:'Manual entry',confidence:'confirmed',note:'Synthetic verification record',calories:215,protein:18.3,carbs:33,fat:0.4}];
await page.addInitScript(state=>{localStorage.setItem('fuel.prototype.v1',JSON.stringify(state));localStorage.setItem('rep-and-plate.onboarding.v1',JSON.stringify({version:1,mode:'guest',focus:'Food & meals'}));},state);
const dir=new URL('./evidence/',import.meta.url);await fs.mkdir(dir,{recursive:true});
async function capture(name:string){await fs.writeFile(new URL(name+'.txt',dir),await page.locator('body').ariaSnapshot());await page.screenshot({path:fileURLToPath(new URL(name+'.png',dir)),fullPage:true});}
await page.goto('http://127.0.0.1:5173/#nutrition');await page.getByText('Recorded calories · no daily target',{exact:true}).waitFor();await capture('01-goal-free');
await page.getByRole('button',{name:'Enter meal manually',exact:true}).click();await capture('02-deliberate-manual-values');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
await page.getByRole('button',{name:'Edit Verification yogurt',exact:true}).click();await page.getByRole('button',{name:'Repeat meal',exact:true}).click();await page.getByLabel('Portion multiplier',{exact:true}).fill('1.5');await page.getByRole('button',{name:'Apply portion',exact:true}).click();await capture('03-reviewed-scaling');await page.getByRole('button',{name:'Save changes',exact:true}).click();
await page.getByRole('button',{name:'Your profile',exact:true}).click();await page.getByRole('button',{name:'Open your weekly review',exact:true}).click();await capture('04-weekly-without-targets');
await fs.writeFile(new URL('console.json',dir),JSON.stringify(errors,null,2));await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log('Four UI evidence pairs captured; zero browser errors.');
