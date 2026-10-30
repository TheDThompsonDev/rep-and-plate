import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--remote-debugging-port=9227']});
for(const persona of ['beginner','fit-new-tracker']){
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Chicago'});
 const page=await context.newPage();
 const errors=[];
 const dir=new URL(`./evidence/${persona}/`,import.meta.url);await fs.mkdir(dir,{recursive:true});
 const record=async(kind,text)=>{errors.push({at:new Date().toISOString(),kind,text});await fs.writeFile(new URL('console.json',dir),JSON.stringify(errors,null,2));};
 page.on('pageerror',e=>void record('pageerror',e.message));
 page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')void record(m.type(),m.text());});
 await fs.writeFile(new URL('console.json',dir),'[]');
 await page.goto(`http://127.0.0.1:5173/?auditPersona=${persona}`);
}
console.log('Audit contexts ready at CDP9227');
await new Promise(()=>{});
