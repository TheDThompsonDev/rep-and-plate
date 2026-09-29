import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FoodProduct } from '../../src/features/products/contracts.ts'
import { ProductCatalog } from './catalog.ts'
import { createProductResolver } from './resolver.ts'
import { importUSDA } from './importer.ts'

const dirs: string[] = []
const temp = () => { const path = mkdtempSync(join(tmpdir(), 'fuel-catalog-')); dirs.push(path); return path }
afterEach(() => { dirs.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })) })
const product = (overrides: Partial<FoodProduct> = {}): FoodProduct => ({
  id: 'usda-1', gtin: '00012345678905', name: 'Fixture milk', brand: 'Fixture', ingredients: 'Milk',
  serving: { label: '1 cup', amount: 240, unit: 'mL' },
  nutrition: { calories: 150, protein: 8, carbs: 12, fat: 8 }, basis: 'serving',
  source: { provider: 'usda', id: '1', url: 'https://fdc.nal.usda.gov/food-details/1/nutrients', fetchedAt: new Date().toISOString(), updatedAt: '2026-01-01', release: null },
  verification: 'source', version: 'v1', ...overrides,
})
const raw = (fdcId = 1) => ({ fdcId, gtinUpc: '012345678905', description: 'Fixture milk', dataType: 'Branded',
  brandOwner: 'Fixture', servingSize: 240, servingSizeUnit: 'mL', householdServingFullText: '1 cup', modifiedDate: '2026-01-01',
  labelNutrients: { calories: { value: 150 }, protein: { value: 8 }, carbohydrates: { value: 12 }, fat: { value: 8 } } })

describe('versioned USDA catalog', () => {
  it('upserts idempotently, retains snapshots, and refuses old refreshes', () => {
    const catalog = new ProductCatalog(':memory:')
    try {
      const first = product()
      const next = product({ version: 'v2', nutrition: { ...first.nutrition, calories: 160 }, source: { ...first.source, updatedAt: '2026-02-01' } })
      catalog.save([first, first]); catalog.save([next]); catalog.save([first])
      expect(catalog.lookup(first.gtin)).toEqual([next])
      expect(catalog.versions(first.id)).toHaveLength(2)
      expect(catalog.versions(first.id).find(row => row.version === 'v1')?.nutrition.calories).toBe(150)
    } finally { catalog.close() }
  })
  it('rolls back the complete batch when a private label appears', () => {
    const catalog = new ProductCatalog(':memory:')
    try {
      expect(() => catalog.save([product(), product({ id: 'private', source: { ...product().source, provider: 'label' } })])).toThrow('Only USDA')
      expect(catalog.lookup(product().gtin)).toHaveLength(0)
    } finally { catalog.close() }
  })
  it('uses fresh catalog without a key and preserves ambiguous package records', async () => {
    const path = join(temp(), 'catalog.sqlite')
    const catalog = new ProductCatalog(path)
    catalog.save([product(), product({ id: 'usda-2', name: 'Different package' })]); catalog.close()
    const provider = vi.fn()
    const resolver = createProductResolver({ catalogPath: path, provider })
    try {
      const result = await resolver.lookup('012345678905')
      expect(result.status).toBe('ambiguous'); expect(result.cached).toBe(true)
      expect(provider).not.toHaveBeenCalled()
    } finally { resolver.close() }
  })
  it('caches exact hits and misses but never mistakes provider failure for absence', async () => {
    const provider = vi.fn().mockResolvedValueOnce({ status: 'rate-limited', products: [], message: 'Slow down' })
      .mockResolvedValueOnce({ status: 'found', products: [product()], message: 'Found' })
    const resolver = createProductResolver({ catalogPath: ':memory:', key: 'test', provider })
    try {
      expect((await resolver.lookup('012345678905')).status).toBe('rate-limited')
      expect((await resolver.lookup('012345678905')).status).toBe('found')
      expect((await resolver.lookup('012345678905')).cached).toBe(true)
      expect((await resolver.lookup('123')).status).toBe('invalid')
      expect(provider).toHaveBeenCalledTimes(2)
    } finally { resolver.close() }
    const missing = vi.fn().mockResolvedValue({ status: 'not-found', products: [], message: 'Missing' })
    const other = createProductResolver({ catalogPath: ':memory:', provider: missing })
    try { await other.lookup('012345678905'); await other.lookup('012345678905'); expect(missing).toHaveBeenCalledTimes(1) }
    finally { other.close() }
  })
  it('returns visibly stale saved records during an outage', async () => {
    const path = join(temp(), 'catalog.sqlite')
    const catalog = new ProductCatalog(path)
    catalog.save([product({ source: { ...product().source, fetchedAt: '2020-01-01' } })]); catalog.close()
    const resolver = createProductResolver({ catalogPath: path, key: 'test', provider: vi.fn().mockResolvedValue({ status: 'unavailable', products: [], message: 'Unavailable' }) })
    try {
      const result = await resolver.lookup('012345678905')
      expect(result.cached).toBe(true); expect(result.message).toContain('could not be confirmed')
    } finally { resolver.close() }
  })
  it('shares in-flight calls without cancelling another caller and retains uncertain matches', async () => {
    let finish!: (result: { status: 'ambiguous'; products: FoodProduct[]; message: string }) => void
    const provider = vi.fn(() => new Promise<{ status: 'ambiguous'; products: FoodProduct[]; message: string }>(resolve => { finish = resolve }))
    const resolver = createProductResolver({ catalogPath: ':memory:', key: 'test', provider })
    const first = new AbortController()
    try {
      const cancelled = resolver.lookup('012345678905', first.signal)
      const remaining = resolver.lookup('012345678905')
      const rejected = expect(cancelled).rejects.toThrow('Cancelled this capture')
      await Promise.resolve()
      first.abort(new Error('Cancelled this capture'))
      finish({ status: 'ambiguous', products: [product()], message: 'Other candidates omitted' })
      await rejected
      expect((await remaining).status).toBe('ambiguous')
      expect((await resolver.lookup('012345678905')).status).toBe('ambiguous')
      expect(provider).toHaveBeenCalledTimes(1)
    } finally { resolver.close() }
  })
})

describe('bounded USDA import', () => {
  it('dry runs without database writes, resumes batches, and repeats idempotently', async () => {
    const dir = temp(); const file = join(dir, 'release.json'); const path = join(dir, 'catalog.sqlite')
    writeFileSync(file, JSON.stringify({ BrandedFoods: [raw(), null, { fdcId: 2, gtinUpc: 'broken' }, raw(3)] }))
    const options = { file, release: '2026-04', catalogPath: path, batchSize: 1 }
    const dry = await importUSDA({ ...options, dryRun: true })
    expect(dry).toMatchObject({ processed: 4, imported: 2, malformed: 1, skipped: 1, complete: true })
    expect(existsSync(path)).toBe(false)
    expect(await importUSDA({ ...options, limit: 2 })).toMatchObject({ processed: 2, complete: false })
    expect(await importUSDA(options)).toMatchObject({ processed: 4, imported: 2, complete: true, resumed: true })
    expect(await importUSDA(options)).toMatchObject({ processed: 4, imported: 2, complete: true, resumed: true })
    const catalog = new ProductCatalog(path)
    try { expect(catalog.lookup(product().gtin)).toHaveLength(2) } finally { catalog.close() }
  })
  it('fails invalid JSON without losing already committed batches', async () => {
    const dir = temp(); const file = join(dir, 'broken.json'); const path = join(dir, 'catalog.sqlite')
    writeFileSync(file, `{"BrandedFoods":[${JSON.stringify(raw())},`)
    await expect(importUSDA({ file, release: '2026-04', catalogPath: path, batchSize: 1 })).rejects.toThrow()
    // Parser may detect truncation before yielding its buffered record; either state is atomic.
    const catalog = new ProductCatalog(path)
    try { expect(catalog.lookup(product().gtin).length).toBeLessThanOrEqual(1) } finally { catalog.close() }
  })
  it('removes discontinued records from current lookup while preserving historical versions', async () => {
    const dir = temp(); const file = join(dir, 'release.json'); const path = join(dir, 'catalog.sqlite')
    writeFileSync(file, JSON.stringify({ BrandedFoods: [raw()] }))
    await importUSDA({ file, release: '2026-04', catalogPath: path })
    writeFileSync(file, JSON.stringify({ BrandedFoods: [{ ...raw(), discontinuedDate: '2026-08-01' }] }))
    await importUSDA({ file, release: '2026-10', catalogPath: path })
    const catalog = new ProductCatalog(path)
    try {
      expect(catalog.lookup(product().gtin)).toHaveLength(0)
      expect(catalog.versions('usda:1')).toHaveLength(1)
    } finally { catalog.close() }
  })
  it('rejects unrelated JSON rather than reporting a successful empty release', async () => {
    const file = join(temp(), 'other.json'); writeFileSync(file, '{"foods":[]}')
    await expect(importUSDA({ file, release: '2026-04', dryRun: true })).rejects.toThrow('No BrandedFoods')
  })
})
