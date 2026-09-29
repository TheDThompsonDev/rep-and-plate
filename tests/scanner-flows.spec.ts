import { test, expect, type Page } from '@playwright/test';

const product = {id:'usda-123',gtin:'00012345678905',name:'Test oats',brand:'Oat Farm',ingredients:'Whole grain oats',serving:{label:'1/2 cup',amount:40,unit:'g'},nutrition:{calories:150,protein:5,carbs:27,fat:3},basis:'serving',source:{provider:'usda',id:'123',url:'https://fdc.nal.usda.gov/food-details/123/nutrients',fetchedAt:'2026-09-25T12:00:00Z',updatedAt:null,release:null},verification:'source',version:'2026-09'};
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('fuel.prototype.v1')!));
async function openScanner(page: Page) {
  await page.getByRole('button',{name:'Open chat menu'}).click();
  await page.getByRole('dialog',{name:'Your space',exact:true}).getByRole('button',{name:'Scan a barcode',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('Scan a food barcode');
}
async function lookup(page: Page) {
  await page.getByLabel('Or enter the barcode numbers').fill('012345678905');
  await page.getByRole('button',{name:'Look up',exact:true}).click();
}
test.beforeEach(async ({page}) => {
  await page.route('**/api/status',route => route.fulfill({json:{available:false,jev:false}}));
  await page.route('**/api/chat',route => route.abort());
});
test('barcode groceries remain separate from confirmed consumption',async ({page}) => {
  let requests = 0;
  await page.route('**/api/products/lookup',route => {requests++;return route.fulfill({json:{status:'found',products:[product],message:'USDA match'}});});
  await page.goto('/');
  const before = await stored(page);
  await openScanner(page); await lookup(page);
  await expect(page.getByRole('heading',{name:'Test oats'})).toBeVisible();
  expect((await stored(page)).meals).toEqual(before.meals);
  await page.getByLabel('Number of servings').fill('4');
  await page.getByRole('button',{name:'Add to groceries',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const groceries = await stored(page);
  expect(groceries.meals).toEqual(before.meals);
  expect(groceries.groceries.at(-1).items[0].servingsPurchased).toBe(4);
  await openScanner(page); await lookup(page);
  await page.getByLabel('Number of servings').fill('0.5');
  await page.getByRole('button',{name:'Log what I ate',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const consumed = await stored(page);
  expect(consumed.meals).toHaveLength(before.meals.length + 1);
  expect(consumed.meals.at(-1).calories).toBe(75);
  expect(requests).toBe(2);
});
test('manual label confirmation is private and resolves the next scan without a lookup',async ({page}) => {
  let requests = 0;
  await page.route('**/api/products/lookup',route => {requests++;return route.fulfill({json:{status:'not-found',products:[],message:'No matching USDA product.'}});});
  await page.goto('/'); const before = await stored(page);
  await openScanner(page); await lookup(page);
  await page.getByRole('button',{name:'Use a nutrition label instead'}).click();
  await page.getByLabel('Product name',{exact:true}).fill('My oat package');
  await page.getByLabel('Serving shown on label').fill('1 cup');
  await page.getByLabel('Calories (kcal)').fill('300');
  await page.getByLabel('Protein (g)').fill('10');
  await page.getByLabel('Carbs (g)').fill('54');
  await page.getByLabel('Fat (g)').fill('6');
  await expect(page.getByRole('button',{name:'Save my label'})).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Save my label'}).click();
  await expect(page.getByRole('dialog')).toContainText('Scan a food barcode');
  expect((await stored(page)).meals).toEqual(before.meals);
  await lookup(page);
  await expect(page.getByRole('heading',{name:'My oat package'})).toBeVisible();
  expect(requests).toBe(1);
  expect((await stored(page)).products[0].verification).toBe('user-confirmed');
  await page.keyboard.press('Escape'); await page.reload();
  await openScanner(page); await lookup(page);
  await expect(page.getByRole('heading',{name:'My oat package'})).toBeVisible();
  expect(requests).toBe(1);
});
test('invalid and ambiguous barcodes require deliberate review',async ({page}) => {
  let requests = 0;
  await page.route('**/api/products/lookup',route => {requests++;return route.fulfill({json:{status:'ambiguous',products:[product,{...product,id:'usda-456',name:'Test oats large package'}],message:'Compare these records.'}});});
  await page.goto('/'); const before = await stored(page);
  await openScanner(page);
  await page.getByLabel('Or enter the barcode numbers').fill('012345678900');
  await page.getByRole('button',{name:'Look up',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Check the numbers');
  expect(requests).toBe(0);
  await lookup(page);
  await expect(page.getByRole('heading',{name:'Which package do you have?'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Add to groceries',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:/Test oats large package/}).click();
  await expect(page.getByRole('heading',{name:'Test oats large package'})).toBeVisible();
  await page.keyboard.press('Escape');
  expect((await stored(page)).meals).toEqual(before.meals);
  expect((await stored(page)).groceries).toEqual(before.groceries);
});

test('uploaded EAN barcode image resolves through the browser decoder',async ({page})=>{
  let received='';
  await page.route('**/api/products/lookup',route=>{received=route.request().postDataJSON().barcode;return route.fulfill({json:{status:'found',products:[{...product,gtin:'04006381333931'}],message:'USDA match'}});});
  await page.goto('/');await openScanner(page);
  const left=['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const even=['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
  const code='4006381333931';const parity='LGLLGG';
  const bits='101'+code.slice(1,7).split('').map((digit,index)=>(parity[index]==='L'?left:even)[Number(digit)]).join('')+'01010'+code.slice(7).split('').map(digit=>left[Number(digit)].replace(/[01]/g,bit=>bit==='0'?'1':'0')).join('')+'101';
  const bars=bits.split('').map((bit,index)=>bit==='1'?`<rect x="${30+index*3}" y="15" width="3" height="120"/>`:'').join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="345" height="155"><rect width="345" height="155" fill="white"/><g fill="black">${bars}</g></svg>`;
  await page.getByLabel('Upload barcode photo',{exact:true}).setInputFiles({name:'barcode.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
  await expect(page.getByRole('heading',{name:'Test oats'})).toBeVisible();
  expect(received).toBe('04006381333931');
});
