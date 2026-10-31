export default async({pages,step,snap,close,stored})=>{
 for(const who of ['expert','six-months']){
 const p=pages[who];
 await step(who,'28-recipe-first-setup',async()=>{await p.getByRole('button',{name:'Kitchen',exact:true}).click();await p.getByRole('button',{name:'Open recipes',exact:true}).click();await p.getByRole('button',{name:'Prepare a batch',exact:true}).click();await p.getByLabel('Batch name',{exact:true}).fill(who==='expert'?'Expert overnight oats':'Tracker overnight oats');await p.getByLabel('How many portions did the whole batch make?').fill('4');await p.getByRole('button',{name:'Set up ingredients in pantry'}).click();});
 for(const item of [{name:'Rolled oats',serving:'40 g',stock:'10',cal:'150',p:'5',c:'27',f:'3'},{name:'Whole milk',serving:'1 cup',stock:'8',cal:'150',p:'8',c:'12',f:'8'}])await step(who,'29-add-'+item.name.replaceAll(' ','-'),async()=>{await p.getByRole('button',{name:'Add ingredient manually'}).click();for(const [label,value] of Object.entries({'Ingredient name':item.name,'One labeled serving':item.serving,'Total labeled servings on hand':item.stock,'Calories per serving':item.cal,'Protein per serving (g)':item.p,'Carbs per serving (g)':item.c,'Fat per serving (g)':item.f}))await p.getByLabel(label,{exact:true}).fill(value);await p.getByRole('checkbox').check();await p.getByRole('button',{name:'Add confirmed ingredient'}).click();});
 await step(who,'30-return-to-recipe-and-prepare',async()=>{await close(who);await p.getByRole('checkbox',{name:/^Rolled oats/}).check();await p.getByLabel('Servings of Rolled oats used').fill('4');await p.getByRole('checkbox',{name:/^Whole milk/}).check();await p.getByLabel('Servings of Whole milk used').fill('2');await p.getByRole('button',{name:'Confirm prepared batch'}).click();});
 await step(who,'31-log-recipe-portion',async()=>{await p.getByLabel('How many portions did you eat?').fill('1.5');await p.getByRole('button',{name:'Log eaten portion',exact:true}).click();});
 await step(who,'32-recipe-portion-persists',async()=>{await close(who);await p.reload();await p.getByRole('button',{name:'Open recipes',exact:true}).click();});
 if(who==='six-months'){
 await step(who,'33-undo-portion',async()=>{await p.getByRole('button',{name:'Undo logged portion',exact:true}).click();await p.getByRole('button',{name:'Confirm remove logged portion',exact:true}).click();});
 await step(who,'34-log-correct-portion',async()=>{await p.getByLabel('How many portions did you eat?').fill('1');await p.getByRole('button',{name:'Log eaten portion',exact:true}).click();});
 }
 console.log(who,JSON.stringify({meals:(await stored(who)).meals,pantryEvents:(await stored(who)).pantryEvents}));
 await close(who);
 }
};
