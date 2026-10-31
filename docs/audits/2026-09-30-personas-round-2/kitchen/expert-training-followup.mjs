export default async({pages,step,snap,close,stored})=>{
 const who='expert',p=pages[who];await close(who);
 await step(who,'11-customize-unstarted-exercise',async()=>{await p.getByRole('button',{name:'Adjust Incline Dumbbell Press',exact:true}).click();await p.getByLabel('Exercise name or substitution').fill('Dumbbell Overhead Press');await p.getByLabel('Weight (kg)',{exact:true}).fill('20');await p.getByLabel('Number of sets').fill('2');await p.getByLabel('Target reps').fill('8');await p.getByRole('button',{name:'Save exercise',exact:true}).click();});
 await step(who,'12-alternate-exercise-log',async()=>{await p.getByRole('button',{name:'Dumbbell Overhead Press set 1: 8 reps',exact:true}).click();await p.getByLabel('Jump to exercise').selectOption({label:'Seated Cable Row'});});
 await step(who,'13-partial-finish-review',async()=>{await p.getByRole('button',{name:'Finish workout',exact:true}).click();});
 await step(who,'14-finished-with-history',async()=>{await p.getByRole('button',{name:'Save partial workout',exact:true}).click();await p.getByRole('button',{name:'View history',exact:true}).click();});
 await step(who,'15-reopen-history-correction',async()=>{await p.getByRole('button',{name:/^Correct /}).first().click();await p.getByRole('button',{name:'Edit Bench Press set 2',exact:true}).click();await p.getByLabel('Reps',{exact:true}).fill('6');await p.getByRole('button',{name:'Save reps',exact:true}).click();});
 await step(who,'16-refinished-correction',async()=>{await p.getByRole('button',{name:'Finish workout',exact:true}).click();await p.getByRole('button',{name:'Save partial workout',exact:true}).click();});
 console.log((await p.locator('body').ariaSnapshot()).slice(-3500));
};
