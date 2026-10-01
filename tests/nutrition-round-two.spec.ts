import { test, expect } from './app-fixture';
import { initialState, today } from '../src/domain';
import { readBrowserRecords } from './record-fixture';

test('manual entry requires all known values and preserves explicit zeros and decimals',async({page})=>{
 await page.goto('/#nutrition');
 await page.getByRole('button',{name:'Enter meal manually',exact:true}).click();
 for(const label of ['Calories','Protein (g)','Carbs (g)','Fat (g)'])await expect(page.getByLabel(label,{exact:true})).toHaveValue('');
 await page.getByLabel('Meal name',{exact:true}).fill('Menu coffee');await page.getByLabel('Calories',{exact:true}).fill('170');
 await page.getByRole('button',{name:'Save changes',exact:true}).click();
 expect((await readBrowserRecords(page)).meals).toHaveLength(0);
 await page.getByLabel('Protein (g)',{exact:true}).fill('0');await page.getByLabel('Carbs (g)',{exact:true}).fill('18.3');await page.getByLabel('Fat (g)',{exact:true}).fill('0.4');await page.getByRole('button',{name:'Save changes',exact:true}).click();
 expect((await readBrowserRecords(page)).meals[0]).toMatchObject({calories:170,protein:0,carbs:18.3,fat:0.4});
});

test('goal-free summaries and reviewed fractional repeat keep original and stock unchanged',async({page})=>{
 const state=initialState();state.meals=[{id:'source',title:'Yogurt',category:'Breakfast',day:today(),time:'9:00 AM',source:'Manual entry',confidence:'confirmed',note:'',calories:215,protein:18.3,carbs:33,fat:0.4}];
 await page.addInitScript(state=>localStorage.setItem('fuel.prototype.v1',JSON.stringify(state)),state);
 await page.goto('/#nutrition');
 await expect(page.getByText('Recorded calories · no daily target',{exact:true})).toBeVisible();
 await expect(page.getByRole('progressbar')).toHaveCount(0);
 await page.getByRole('button',{name:'Edit Yogurt',exact:true}).click();await page.getByRole('button',{name:'Repeat meal',exact:true}).click();
 await page.getByLabel('Portion multiplier',{exact:true}).fill('1.5');await page.getByRole('button',{name:'Apply portion',exact:true}).click();
 await expect(page.getByLabel('Protein (g)',{exact:true})).toHaveValue('27.45');await expect(page.getByLabel('Fat (g)',{exact:true})).toHaveValue('0.6');
 expect((await readBrowserRecords(page)).meals).toHaveLength(1);
 await page.getByRole('button',{name:'Save changes',exact:true}).click();const saved=await readBrowserRecords(page);
 expect(saved.meals).toHaveLength(2);expect(saved.meals[0]).toEqual(state.meals[0]);expect(saved.meals[1]).toMatchObject({calories:322.5,protein:27.45,fat:0.6});expect(saved.pantryEvents).toEqual(state.pantryEvents);
 await page.getByRole('button',{name:'Your profile',exact:true}).click();await expect(page.getByText('Tracking without daily targets.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Open your weekly review',exact:true}).click();await expect(page.getByRole('dialog').getByText(/reached your current/)).toHaveCount(0);
});
