import { test, expect, type Page } from "./app-fixture"
import { resultFixture } from './ai-fixtures'
import type { FoodProduct } from '../src/features/products/contracts'

const candidate = (incomplete = false): FoodProduct => ({
  id: 'usda:101', gtin: '00012345678905', name: 'Fixture Old Fashioned Oats', brand: 'Fixture brand', ingredients: 'Whole grain oats.',
  serving: { label: '1/2 cup dry (40 g)', amount: 40, unit: 'g' }, basis: '100g',
  nutrition: { calories: 375, protein: incomplete ? null : 12.5, carbs: 67.5, fat: 7.5 },
  source: { provider: 'usda', id: '101', url: 'https://fdc.nal.usda.gov/food-details/101/nutrients', fetchedAt: '2026-09-25T12:00:00Z', updatedAt: '2026-04-01', release: null },
  verification: 'source', version: 'fixture-version',
})
const stored = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('fuel.prototype.v1')!))
async function seed(page: Page) {
  await page.goto('/')
  const receipt = resultFixture('receipt-candidates').receipt!
  receipt.items = [{ ...receipt.items[0], receiptText: 'QKR OAT 42OZ', name: 'Receipt oats', quantity: '2 packages', serving: 'Old estimated serving', servingsPurchased: 16 }]
  await page.evaluate(receipt => {
    const state = JSON.parse(localStorage.getItem('fuel.prototype.v1')!)
    state.groceries = [receipt]
    localStorage.setItem('fuel.prototype.v1', JSON.stringify(state))
  }, receipt)
  await page.reload()
}
async function openSearch(page: Page) {
  await page.getByRole('button', { name: 'Open chat menu' }).click()
  await page.getByRole('button', { name: 'Your groceries', exact: true }).click()
  await page.getByRole('button', { name: 'Check purchase details', exact: true }).click()
  await page.locator('.fuel-grocery-item').first().locator('summary').click()
  await page.getByRole('button', { name: /^(Find USDA product|Review USDA matches)$/ }).click()
  await expect(page.getByRole('heading', { name: 'Find this receipt item', exact: true })).toBeVisible()
}
test.beforeEach(async ({ page }) => {
  await page.route('**/api/status', route => route.fulfill({ json: { available: true, jev: true, usda: true } }))
  await page.route('**/api/chat', route => route.abort())
  await page.route('**/api/products/search', route => route.abort())
})

test('Automatically suggested receipt candidates remain unselected until the user reviews them', async ({page})=>{
  await seed(page)
  await page.evaluate(product=>{
    const state=JSON.parse(localStorage.getItem('fuel.prototype.v1')!)
    state.groceries[0].items[0].productCandidates=[product]
    localStorage.setItem('fuel.prototype.v1',JSON.stringify(state))
  },candidate())
  await page.reload()
  const before=await stored(page)
  await openSearch(page)
  await expect(page.getByRole('radio',{name:/Fixture Old Fashioned Oats/})).not.toBeChecked()
  await expect(page.getByRole('status')).toContainText('None has been selected')
  await expect(page.getByRole('button',{name:'Use this product',exact:true})).toHaveCount(0)
  await page.getByRole('radio',{name:/Fixture Old Fashioned Oats/}).check()
  await expect(page.getByRole('button',{name:'Use this product',exact:true})).toBeDisabled()
  await page.getByRole('button',{name:'Keep current details',exact:true}).click()
  expect((await stored(page)).groceries).toEqual(before.groceries)
  expect((await stored(page)).meals).toEqual(before.meals)
})

test('A USDA receipt candidate changes groceries only after product and quantity confirmation', async ({ page }) => {
  const requests: { query: string }[] = []
  await page.route('**/api/products/search', route => {
    requests.push(route.request().postDataJSON())
    return route.fulfill({ json: { status: 'candidates', products: [candidate()], message: 'Possible products, not confirmed receipt matches.' } })
  })
  await seed(page)
  const before = await stored(page)
  await openSearch(page)
  expect(requests).toHaveLength(0)
  await expect(page.getByLabel('Product name or receipt description')).toHaveValue('Receipt oats')
  await page.getByLabel('Product name or receipt description').fill('Fixture old fashioned oats')
  await page.getByRole('button', { name: 'Search USDA', exact: true }).click()
  await page.getByRole('radio', { name: /Fixture Old Fashioned Oats/ }).check()
  await expect(page.getByRole('button', { name: 'Use this product', exact: true })).toBeDisabled()
  await expect(page.getByLabel('Total labeled servings purchased')).toHaveValue('')
  await expect(page.getByLabel('Review selected product')).toContainText('For one labeled serving: 150 kcal')
  await expect(page.getByRole('link', { name: 'View USDA source' })).toHaveAttribute('href', candidate().source.url!)
  expect((await stored(page)).groceries).toEqual(before.groceries)
  await page.getByLabel('Total labeled servings purchased').fill('30')
  await page.getByRole('checkbox', { name: 'I checked the product, serving and purchased amount against my package.' }).check()
  await page.getByRole('button', { name: 'Use this product', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your groceries', exact: true })).toBeVisible()
  const after = await stored(page)
  const item = after.groceries[0].items[0]
  expect(item.receiptText).toBe('QKR OAT 42OZ')
  expect(item.quantity).toBe('2 packages')
  expect(item.servingsPurchased).toBe(30)
  expect(item.nutrition).toEqual({ calories: 150, protein: 5, carbs: 27, fat: 3 })
  expect(item.productSnapshot.basis).toBe('100g')
  expect(item.productSnapshot.version).toBe('fixture-version')
  expect(item.needsReview).toBe(false)
  expect(after.meals).toEqual(before.meals)
  expect(after.pantryEvents ?? []).toEqual(before.pantryEvents ?? [])
  expect(requests).toEqual([{ query: 'Fixture old fashioned oats' }])
  await page.reload()
  expect((await stored(page)).groceries[0].items[0].servingsPurchased).toBe(30)
})

test('Incomplete product details remain unknown and the old serving count is never carried over', async ({ page }) => {
  await page.route('**/api/products/search', route => route.fulfill({ json: { status: 'candidates', products: [candidate(true)], message: 'Compare this possible product with your package.' } }))
  await seed(page)
  const before = await stored(page)
  await openSearch(page)
  await page.getByRole('button', { name: 'Search USDA', exact: true }).click()
  await page.getByRole('radio', { name: /Fixture Old Fashioned Oats/ }).check()
  await expect(page.getByLabel('Review selected product')).toContainText('Unknown')
  await expect(page.getByLabel('Review selected product')).toContainText('still need review')
  await page.getByRole('checkbox', { name: 'I checked the product, serving and purchased amount against my package.' }).check()
  await page.getByRole('button', { name: 'Use this product', exact: true }).click()
  const after = await stored(page)
  expect(after.groceries[0].items[0].servingsPurchased).toBeNull()
  expect(after.groceries[0].items[0].nutrition).toBeNull()
  expect(after.groceries[0].items[0].productSnapshot.nutrition.protein).toBeNull()
  expect(after.groceries[0].items[0].needsReview).toBe(true)
  expect(after.meals).toEqual(before.meals)
})

test('Search failure and cancellation preserve the original receipt item', async ({ page }) => {
  await page.route('**/api/products/search', route => route.fulfill({ json: { status: 'rate-limited', products: [], message: 'USDA is busy. Please try again later.' } }))
  await seed(page)
  const before = await stored(page)
  await openSearch(page)
  await page.getByRole('button', { name: 'Search USDA', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('USDA is busy')
  await page.getByRole('button', { name: 'Keep current details', exact: true }).click()
  expect((await stored(page)).groceries).toEqual(before.groceries)
  expect((await stored(page)).meals).toEqual(before.meals)
})

test('A receipt barcode match updates the existing purchase after quantity review, without a duplicate',async({page})=>{
  await seed(page);const before=await stored(page);await openSearch(page);
  await page.route('**/api/products/lookup',r=>r.fulfill({json:{status:'found',products:[candidate()],message:'Exact barcode'}}));
  await page.getByRole('button',{name:'Scan this package barcode'}).click();
  await page.getByLabel('Or enter the barcode numbers').fill('012345678905');
  await page.getByRole('button',{name:'Look up',exact:true}).click();
  await page.getByRole('button',{name:'Review this receipt match'}).click();
  await expect(page.getByLabel('Total labeled servings purchased')).toHaveValue('');
  expect((await stored(page)).groceries).toEqual(before.groceries);
  await page.getByLabel('Total labeled servings purchased').fill('30');
  await page.getByRole('checkbox',{name:'I checked the product, serving and purchased amount against my package.'}).check();
  await page.getByRole('button',{name:'Use this product',exact:true}).click();
  const after=await stored(page);expect(after.groceries).toHaveLength(1);expect(after.groceries[0].items[0].servingsPurchased).toBe(30);expect(after.meals).toEqual(before.meals);
})
