import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const persona=process.argv[2]||'beginner', phase=process.argv[3]||'onboard';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9227');
const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes(`auditPersona=${persona}`));
page.setDefaultTimeout(15000);
const dir=new URL(`./evidence/${persona}/`,import.meta.url);
async function snap(name){
 const aria=await page.locator('body').ariaSnapshot();
 await fs.writeFile(new URL(name+'.txt',dir),aria);
 await page.screenshot({path:fileURLToPath(new URL(name+'.png',dir)),fullPage:true});
 console.log(name+'\n'+aria.slice(-18000));
}
const button=(name)=>page.getByRole('button',{name,exact:typeof name==='string'});
async function close(){await button('Close dialog').last().click();}
try{
 if(phase==='onboard'){
  await snap('01-welcome');await button('Meet Spot').click();
  for(let i=0;i<4;i++){await snap(`02-tour-${i+1}`);await button(i<3?'Next':'Let’s make this official').click();}
  await snap('03-account');await button('Try on this device first').click();
  await page.getByLabel('Your name').fill(persona==='beginner'?'Casey Beginner':'Morgan New Tracker');
  await page.getByRole('radio',{name:persona==='beginner'?'A little of both':'Food & meals',exact:true}).check();
  await snap('04-local-setup');await button('That’s me. Let’s go.').click();await button('Let’s do this').waitFor();await snap('05-ready');await button('Let’s do this').click();await page.getByRole('textbox',{name:'Message Rep & Plate'}).waitFor();await snap('06-first-chat');
 }
 if(phase==='inspect')await snap(process.argv[4]||'inspect');
 if(phase==='targets'){
  await button('Nutrition').click();await snap('07-nutrition-empty');await button('Edit daily targets').click();await snap('08-target-guide');await close();
  await button('Kitchen').click();await button('See the whole journey').click();await snap('09-first-week');
 }
 if(phase==='manual-open'){
  await button('Nutrition').click();await button('Edit daily targets').click();await page.getByText('New to targets?',{exact:true}).click();await snap('10-targets-expanded');await close();
  await button('Enter meal manually').click();await snap('11-manual-meal-empty');
 }
 if(phase==='manual-save'){
  await page.getByLabel('Meal name',{exact:true}).fill(persona==='beginner'?'Label yogurt':'After-training yogurt');
  for(const [label,value] of [['Calories','215'],['Protein (g)','18.3'],['Carbs (g)','33'],['Fat (g)','0.4']])await page.getByLabel(label,{exact:true}).fill(value);
  await snap('12-manual-reviewed');await button('Save changes').click();await snap('13-manual-saved');
 }
 if(phase==='repeat-backfill'){
  const title=persona==='beginner'?'Label yogurt':'After-training yogurt';
  await button(`Edit ${title}`).click();await snap('14-edit-decimals');
  await page.getByLabel('Meal name',{exact:true}).fill(title+' corrected');await button('Save changes').click();await snap('15-name-only-correction-saved');
  await button(`Edit ${title} corrected`).click();await button('Repeat meal').click();await snap('16-repeat-review');
  await page.getByLabel('Meal date',{exact:true}).fill('2026-09-29');await page.getByRole('textbox',{name:'Notes',exact:true}).fill('Same single serving yesterday.');await button('Save changes').click();
  await snap('17-repeat-saved-current-view');await button('Previous day').click();await snap('18-yesterday-repeat');
  await button(`Edit ${title} corrected`).click();await page.getByLabel('Meal name',{exact:true}).fill('Yesterday yogurt');await button('Save changes').click();await snap('19-backfill-corrected');
  await button('Log a meal').click();await snap('20-selected-day-chat');
 }
 if(phase==='repeat-continue'){
  const title=persona==='beginner'?'Label yogurt':'After-training yogurt';
  await page.getByRole('textbox',{name:'Notes',exact:true}).fill('Same single serving yesterday.');await button('Save changes').click();await snap('17-repeat-saved-current-view');await button('Previous day').click();await snap('18-yesterday-repeat');
  await button(`Edit ${title} corrected`).click();await page.getByLabel('Meal name',{exact:true}).fill('Yesterday yogurt');await button('Save changes').click();await snap('19-backfill-corrected');await button('Log a meal').click();await snap('20-selected-day-chat');
 }
 if(phase==='coffee-unknown'){
  await button('Nutrition').click();if(await button('Return to today').count())await button('Return to today').click();await button('Enter meal manually').click();
  await page.getByLabel('Meal name',{exact:true}).fill('Coffee — menu calories only');await page.getByLabel('Calories',{exact:true}).fill('170');await snap('21-calories-only-before-save');await button('Save changes').click();await snap('22-calories-only-saved');
 }
 if(phase==='chat-send'){
  await button('Chat').click();if(await button('Use today instead').count())await button('Use today instead').click();
  await page.getByRole('textbox',{name:'Message Rep & Plate'}).fill(process.argv[4]);await snap((process.argv[5]||'23')+'-before-live-message');
  await button('Send message').click();await snap((process.argv[5]||'24')+'-live-pending');
 }
 if(phase==='train-open'){await button('Workouts').click();await snap('30-train');}
 if(phase==='you'){await button('Your profile').click();await snap('50-you');}
 if(phase==='activity-open'){await button('Log walk or cardio').click();await snap('31-activity-form');}
 if(phase==='activity-save'){await page.getByLabel('Minutes',{exact:true}).fill('20');await page.getByRole('textbox',{name:'Notes',exact:true}).fill('Easy neighborhood walk.');await button('Save activity').click();await snap('32-activity-saved');await button('Start workout').click();await snap('34-active-workout');}
 if(phase==='workout-start'){await button('Start workout').click();await snap('34-active-workout');}
 if(phase==='workout-use'){
  await page.getByText('How to approach Bench Press',{exact:true}).click();await page.getByText('Rest timer',{exact:true}).click();await snap('35-technique-rest');
  const region=page.getByRole('region',{name:'Bench Press',exact:true});
  await region.getByRole('spinbutton',{name:'Bench Press set 1 weight (lb)'}).fill('15');await region.getByRole('button',{name:'Save set weight',exact:true}).nth(0).click();await button('Bench Press set 1: 8 reps').click();await snap('36-first-set');
 }
 if(phase==='workout-rest-finish'){
  await button('Start 90-second rest').click();await snap('37-rest-started');
  await page.getByRole('combobox',{name:'Bench Press set 1 effort',exact:true}).selectOption('6');
  await button('Finish workout').click();await snap('38-partial-finish');
 }
 if(phase==='workout-correct-finish'){
  await page.getByRole('spinbutton',{name:'Reps',exact:true}).fill('7');await button('Save reps').click();await button('Finish workout').click();await button('Save partial workout').click();await snap('43-corrected-workout');await button('Choose your next workout').click();await button('View history').click();await snap('44-history');
 }
 if(phase==='fit-workout'){
  await button('Workouts').click();await page.getByRole('combobox',{name:'Workout units',exact:true}).selectOption('kg');await button('Log walk or cardio').click();await page.getByLabel('Activity',{exact:true}).fill('Easy run');await page.getByLabel('Minutes',{exact:true}).fill('25');await button('Save activity').click();await snap('32-activity-saved');await button('Start workout').click();await button('Adjust Bench Press').click();await snap('34-adjust-workout');
 }
 if(phase==='fit-sets'){
  await page.getByRole('spinbutton',{name:'Weight (kg)',exact:true}).fill('20');await button('Save exercise').click();await snap('35-shared-exercise-load');
  for(let set=1;set<=3;set++)await button(`Bench Press set ${set}: 8 reps`).click();
  await button('Move Seated Cable Row earlier').click();await page.getByRole('combobox',{name:'Jump to exercise',exact:true}).selectOption({label:'Seated Cable Row'});await snap('36-flexible-sets');
  await page.getByText('How to approach Seated Cable Row',{exact:true}).click();await page.getByText('Rest timer',{exact:true}).click();await button('Start 90-second rest').click();await snap('37-fit-technique-rest');await button('End rest').click();await button('Finish workout').click();await button('Save partial workout').click();await button('Choose your next workout').click();await button('View history').click();await snap('44-history');
 }
 if(phase==='profile-inspect'){await close();await button('Your profile').click();await snap('50-you');}
 if(phase==='week-prefs'){
  await button('Open your weekly review').click();await snap('51-weekly-review');await close();await button('Food & routine preferences Your choices, exclusions, and cooking time').click();await snap('52-preferences');
 }
 if(phase==='reload'){await page.reload();await page.getByRole('button',{name:'Your profile',exact:true}).waitFor();await snap('60-reloaded');}
 if(phase==='prefs-expand'){await page.getByRole('dialog',{name:'Food & routine preferences',exact:true}).waitFor();await page.locator('summary').filter({hasText:'Meals & cooking'}).click();await page.locator('summary').filter({hasText:'Workout routine'}).click();await snap('54-preferences-expanded');}
 if(phase==='prefs-save-reload'){
  await page.getByRole('spinbutton',{name:'Cooking time (minutes)',exact:true}).fill('20');await page.getByRole('textbox',{name:'Workout preferences',exact:true}).fill(persona==='beginner'?'Learning the basics; short sessions and walks.':'Regular gym sessions; kilogram weights.');await button('Save food & routine preferences').click();await snap('55-preferences-saved');await page.reload();await button('Your profile').waitFor();await button('Your profile').click();await snap('60-reloaded');await button('Food & routine preferences Your choices, exclusions, and cooking time').click();await page.getByRole('dialog',{name:'Food & routine preferences',exact:true}).waitFor();await page.locator('summary').filter({hasText:'Meals & cooking'}).click();await page.locator('summary').filter({hasText:'Workout routine'}).click();await snap('61-preferences-persisted');await close();
 }
 if(phase==='raw-macro-defaults'){
  await button('Nutrition').click();await button('Enter meal manually').click();const raw=await page.getByRole('dialog').locator('input').evaluateAll(nodes=>nodes.map(n=>({name:n.name,value:n.value,required:n.required})));await fs.writeFile(new URL('raw-manual-defaults.json',dir),JSON.stringify(raw,null,2));await snap('62-raw-manual-defaults');await close();
 }
 if(phase==='double-repeat'){
  await button('Edit After-training yogurt corrected').click();await button('Repeat meal').click();await snap('63-repeat-portion-choice');await page.getByRole('textbox',{name:'Meal name',exact:true}).fill('Double yogurt portion');for(const [label,value]of [['Calories','430'],['Protein (g)','36.6'],['Carbs (g)','66'],['Fat (g)','0.8']])await page.getByLabel(label,{exact:true}).fill(value);await page.getByRole('textbox',{name:'Notes',exact:true}).fill('Two of the original label servings; manually doubled all four values.');await snap('64-double-manual-math');await button('Save changes').click();await snap('65-double-repeat-saved');
 }
 if(phase==='click'){await button(process.argv[4]).click();await snap(process.argv[5]||'clicked');}
}catch(e){await snap('HARNESS-'+phase).catch(()=>{});console.error(e.message);process.exitCode=1;}
await browser.close();
