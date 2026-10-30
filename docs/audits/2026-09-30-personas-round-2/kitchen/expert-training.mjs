export default async({pages,step,snap,close,stored})=>{
 const who='expert',p=pages[who];
 await step(who,'06-kg-session-start',async()=>{await p.getByLabel('Workout units').selectOption('kg');await p.getByRole('button',{name:'Start workout',exact:true}).click();});
 await step(who,'07-first-recorded-set',async()=>{await p.getByLabel('Bench Press set 1 weight (kg)',{exact:true}).fill('80');await p.locator('.workout-set').filter({has:p.getByLabel('Bench Press set 1 weight (kg)',{exact:true})}).getByRole('button',{name:'Save set weight',exact:true}).click();await p.getByRole('button',{name:'Bench Press set 1: 8 reps',exact:true}).click();await p.getByLabel('Bench Press set 1 effort',{exact:true}).selectOption('8');});
 await step(who,'08-second-set-load-required',async()=>{await p.getByLabel('Bench Press set 2 weight (kg)',{exact:true}).scrollIntoViewIfNeeded();});
 await step(who,'09-second-set-and-equipment-change',async()=>{await p.getByLabel('Bench Press set 2 weight (kg)',{exact:true}).fill('80');await p.locator('.workout-set').filter({has:p.getByLabel('Bench Press set 2 weight (kg)',{exact:true})}).getByRole('button',{name:'Save set weight',exact:true}).click();await p.getByRole('button',{name:'Bench Press set 2: 7 reps',exact:true}).click();await p.getByRole('button',{name:'Move Seated Cable Row earlier',exact:true}).click();});
 await step(who,'10-adjust-after-recording',async()=>{await p.getByRole('button',{name:'Adjust Bench Press',exact:true}).click();});
 console.log((await p.getByRole('dialog').ariaSnapshot()).slice(0,5000));
};
