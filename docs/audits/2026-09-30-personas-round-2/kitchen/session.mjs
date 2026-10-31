import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
const root=path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
const browser=await chromium.launch({headless:true});
const pages={},records={};
for(const persona of ['expert','six-months']){
 const context=await browser.newContext({viewport:persona==='expert'?{width:390,height:844}:{width:1440,height:1000},timezoneId:'America/Chicago'});
 const page=await context.newPage();page.setDefaultTimeout(15000);pages[persona]=page;records[persona]={mode:'Fresh guest profile through UI. Real local API; no mocked calls or injected product records.',actions:[],console:[],pageErrors:[]};
 await fs.mkdir(path.join(root,persona),{recursive:true});
 page.on('console',message=>{if(['error','warning'].includes(message.type())){records[persona].console.push({type:message.type(),text:message.text(),at:new Date().toISOString()});void flush();}});
 page.on('pageerror',error=>{records[persona].pageErrors.push(error.message);void flush();});
}
async function flush(){await fs.writeFile(path.join(root,'sessions.json'),JSON.stringify(records,null,2));}
async function snap(persona,name,details){const p=pages[persona];const file=path.join(root,persona,name);await fs.writeFile(file+'.txt',await p.locator('body').ariaSnapshot());await p.screenshot({path:file+'.png',fullPage:true});records[persona].actions.push({name,details,url:p.url(),at:new Date().toISOString(),snapshot:persona+'/'+name+'.txt',screenshot:persona+'/'+name+'.png'});await flush();console.log('CAPTURE',persona,name);}
async function step(persona,name,fn){try{await fn(pages[persona]);await snap(persona,name);}catch(error){records[persona].actions.push({name,error:error.message,classification:'Script/locator failure unless rerun establishes product behavior'});await snap(persona,name+'-error').catch(()=>{});console.log('STEP ERROR',persona,name,error.message);}}
async function close(persona){const p=pages[persona];const button=p.getByRole('button',{name:'Close dialog',exact:true});if(await button.count())await button.last().click();}
async function stored(persona){return pages[persona].evaluate(async()=>{const {browserRecordTransaction,browserGet}=await import('/src/platform/browser-records.ts');return browserRecordTransaction(async()=>JSON.parse(await browserGet('fuel.prototype.v1')));});}
console.log('READY');
for await(const line of readline.createInterface({input:process.stdin,crlfDelay:Infinity})){
 try{const command=JSON.parse(line);if(command.close){await flush();await browser.close();break;}console.log(await eval(`(async()=>{${command.code}\n})()`));await flush();console.log('DONE');}catch(error){console.log('COMMAND ERROR',error.stack);}
}
