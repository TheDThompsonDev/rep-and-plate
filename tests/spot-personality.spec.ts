import {test,expect} from './app-fixture';
test('full Spot tour from You preserves records and the first draft when art fails',async({page})=>{
 await page.goto('/');
 const draft=page.getByRole('textbox',{name:'Message Rep & Plate'});await draft.fill('Keep this draft');
 const before=await page.evaluate(()=>localStorage.getItem('fuel.prototype.v1'));
 await page.route('**/images/spot/scenes/**',route=>route.abort());
 await page.getByRole('button',{name:'Your profile',exact:true}).click();
 await page.getByRole('button',{name:/Meet Spot/}).click();
 await expect(page.getByRole('heading',{name:'Hey. I’m Spot.'})).toBeVisible();
 await page.getByRole('button',{name:'Next',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Tell me what you ate.'})).toBeVisible();
 await page.getByRole('button',{name:'Back',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Hey. I’m Spot.'})).toBeVisible();
 await page.getByRole('button',{name:'Close tour',exact:true}).first().click();
 await page.getByRole('button',{name:'Rep & Plate home'}).click();
 await expect(draft).toHaveValue('Keep this draft');
 expect(await page.evaluate(()=>localStorage.getItem('fuel.prototype.v1'))).toBe(before);
});
