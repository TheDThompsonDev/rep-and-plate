export default async({pages,step,snap})=>{
 for(const who of ['expert','six-months']){
  await step(who,'01-fresh-onboarding',async p=>{await p.goto('http://127.0.0.1:5173');await p.getByRole('button',{name:'Create account',exact:true}).click();});
  await step(who,'02-guest-setup',async p=>{await p.getByRole('button',{name:'Try on this device first'}).click();await p.getByLabel('Your name').fill(who==='expert'?'Experienced lifter audit':'Six month tracker audit');await p.getByRole('radio',{name:who==='expert'?'Movement & workouts':'A little of both',exact:true}).check();});
  await step(who,'03-ready',async p=>{await p.getByRole('button',{name:'That’s me. Let’s go.',exact:true}).click();await p.getByRole('button',{name:'Let’s do this',exact:true}).waitFor();});
  await step(who,'04-first-chat',async p=>{await p.getByRole('button',{name:'Let’s do this',exact:true}).click();await p.getByRole('textbox',{name:'Message Rep & Plate'}).waitFor();});
 }
};
