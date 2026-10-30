import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const root = new URL('./evidence/',import.meta.url);
const personas=[
 {id:'expert',name:'Expert Audit',focus:'Movement & workouts',tour:false,prompt:'I finished bench press: 80 kg for 5 reps, then 80 kg for 5 reps. Please let me review before saving.'},
 {id:'beginner',name:'Beginner Audit',focus:'A little of both',tour:true,prompt:'I went for a 20 minute walk today. I would like to record it.'},
 {id:'six-months',name:'Six Months Audit',focus:'A little of both',tour:false,prompt:'I ate lunch today: 150 g cooked white rice, 150 g cooked chicken breast and 1 tablespoon olive oil. Show the components before I log it.'},
 {id:'fit-new-tracker',name:'Fit New Tracker Audit',focus:'Food & meals',tour:true,prompt:'I had two slices of toast with peanut butter for breakfast today. I do not know how much peanut butter. Help me log it without pretending the portion is certain.'},
 {id:'developer',name:'Developer Audit',focus:'A little of both',tour:false,prompt:null},
];
const browser=await chromium.launch({headless:true});
const results=[];
for(const persona of personas){
 const context=await browser.newContext({viewport:persona.id==='developer'?{width:1440,height:1000}:{width:390,height:844},timezoneId:'America/Chicago'});
 const page=await context.newPage(); page.setDefaultTimeout(12000);
 const record={...persona,mode:'unmocked local app, guest setup through UI',steps:[],pageErrors:[]};
 page.on('pageerror',e=>record.pageErrors.push(e.message));
 const folder=new URL(persona.id+'/',root);await fs.mkdir(folder,{recursive:true});
 async function capture(name){ const body=await page.locator('body').ariaSnapshot();await fs.writeFile(new URL(name+'.txt',folder),body); record.steps.push({step:name,url:page.url(),evidence:persona.id+'/'+name+'.txt'}); }
 async function dialog(button,name){await page.getByRole('button',{name:button,exact:typeof button==='string'}).click();await page.getByRole('dialog').waitFor();await capture(name);await page.getByRole('button',{name:'Close dialog',exact:true}).last().click();}
 try{
  await page.goto('http://127.0.0.1:5173');await capture('01-welcome');
  if(persona.tour){await page.getByRole('button',{name:'Meet Spot',exact:true}).click();for(let i=0;i<4;i++){await capture('02-tour-'+(i+1));await page.getByRole('button',{name:i<3?'Next':'Let’s make this official',exact:true}).click();}}
  else await page.getByRole('button',{name:'Create account',exact:true}).click();
  await capture('03-account');await page.getByRole('button',{name:'Try on this device first'}).click();
  await page.getByLabel('Your name').fill(persona.name);await page.getByRole('radio',{name:persona.focus,exact:true}).check();await capture('04-setup');
  await page.getByRole('button',{name:'That’s me. Let’s go.',exact:true}).click();await page.getByRole('button',{name:'Let’s do this',exact:true}).waitFor();await capture('05-ready');await page.getByRole('button',{name:'Let’s do this',exact:true}).click();
  await page.getByRole('textbox',{name:'Message Rep & Plate'}).waitFor();await capture('06-first-chat');
  if(persona.prompt){
   const start=Date.now();await page.getByRole('textbox',{name:'Message Rep & Plate'}).fill(persona.prompt);await page.getByRole('button',{name:'Send message',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('.fuel-ai-status')&&document.querySelectorAll('.fuel-message').length>0,{},{timeout:1000}).catch(()=>{});
   // Completion is determined from rendered proposal/error or the assistant reply following the user message.
   await page.waitForFunction(()=>{const t=document.querySelector('[aria-label="Capture conversation"]')?.textContent||'';return /Spot Check|Try again|Couldn.t|couldn’t|Retry|unavailable/.test(t)||document.querySelectorAll('.fuel-bubble.assistant').length>0;},{},{timeout:60000}).catch(()=>{record.liveWaitReachedLimit=true;});
   record.liveElapsedMs=Date.now()-start;await capture('07-live-response');
  }
  await page.getByRole('button',{name:'Nutrition',exact:true}).click();await capture('08-nutrition');await page.getByRole('button',{name:'Week',exact:true}).click();await capture('09-nutrition-week');await page.getByRole('button',{name:'Previous day',exact:true}).click();await capture('10-previous-day');await dialog('Edit daily targets','11-targets');
  await page.getByRole('button',{name:'Workouts',exact:true}).click();await capture('12-workouts');
  for(const name of ['Lower Body ~35 min','Full Body ~30 min','Upper Body ~42 min'])await page.getByRole('button',{name,exact:true}).click();
  await dialog('Create a workout for me','13-workout-builder');await dialog('View history','14-workout-history');
  await page.getByRole('button',{name:'Kitchen',exact:true}).click();await capture('15-kitchen');await page.getByRole('button',{name:'See the whole journey',exact:true}).click();await capture('16-first-week');
  await dialog('Open pantry','17-pantry');await dialog('Open recipes','18-recipes');await dialog('Open meal planner','19-planner');await dialog('Shopping preferences','20-food-preferences');
  await page.getByRole('button',{name:'Swaps, list & spending',exact:true}).click();await page.getByRole('dialog').waitFor();await capture('21-swaps');
  for(const [label,n] of [['Shopping list','22-shopping-list'],['Your spending','23-spending']]){await page.getByRole('tab',{name:label,exact:true}).click();await capture(n);}
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await dialog('Add a receipt','24-receipt-capture');await dialog('Scan a food','25-barcode');
  await page.getByRole('button',{name:'Your profile',exact:true}).click();await capture('26-profile');
  for(const [button,n] of [[/^Account & backups/,'27-account-backups'],[/^Connections Your/,'28-connections'],['Open your weekly review','29-weekly-review'],[/^Meals & captures/,'30-meals-captures'],[/^Workout history/,'31-profile-workout-history'],[/^Your data & privacy/,'32-privacy-help'],[/^About Rep & Plate/,'33-about']])await dialog(button,n);
  await page.getByLabel('Body weight',{exact:true}).fill(persona.id==='expert'?'180':'160');await page.getByRole('button',{name:'Save measurement',exact:true}).click();await capture('34-weight-saved');
  await page.reload();await page.getByRole('region',{name:'You',exact:true}).waitFor();await capture('35-return-after-reload');
  await page.screenshot({path:new URL('return.png',folder).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});record.completed=true;
 }catch(e){record.error=e.message;await capture('ERROR').catch(()=>{});record.completed=false;}
 results.push(record);await fs.writeFile(new URL('persona-walkthroughs.json',root),JSON.stringify(results,null,2));console.log(persona.id,record.completed?'completed':record.error);await context.close();
}
await browser.close();
