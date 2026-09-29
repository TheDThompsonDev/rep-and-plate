import { describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { createProductSearchApi, searchUSDAProducts } from './search.ts'

const raw = (fdcId = 1, overrides: Record<string, unknown> = {}) => ({ fdcId, gtinUpc: '012345678905', description: `Fixture oats ${fdcId}`, brandOwner: 'Fixture brand', dataType: 'Branded', servingSize: 40, servingSizeUnit: 'g', householdServingFullText: '1/2 cup (40g)',
  labelNutrients: { calories: { value: 150 }, protein: { value: 5 }, carbohydrates: { value: 27 }, fat: { value: 3 } }, ...overrides })
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

describe('USDA receipt product candidates', () => {
  it('preserves the entered words and returns proposals, not exact receipt matches', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ foods: [{ fdcId: 1 }] })).mockResolvedValueOnce(json([raw()]))
    const result = await searchUSDAProducts(' QKR OAT 42OZ ', 'synthetic-key', undefined, fetcher)
    expect(result.status).toBe('candidates')
    expect(result.message).toContain('not confirmed')
    const [url, options] = fetcher.mock.calls[0]
    expect(new URL(String(url)).origin).toBe('https://api.nal.usda.gov')
    expect(JSON.parse(String(options?.body))).toEqual({ query: 'QKR OAT 42OZ', dataType: ['Branded'], pageSize: 16, pageNumber: 1 })
    expect(result.products[0].source.provider).toBe('usda')
    expect(result.products[0].nutrition.calories).toBe(150)
    expect(JSON.stringify(result)).not.toContain('synthetic-key')
  })
  it('returns at most eight distinct candidates in search order and ignores unrelated details', async () => {
    const ids = Array.from({ length: 16 }, (_, n) => n + 1)
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ foods: ids.flatMap(fdcId => [{ fdcId }, { fdcId }]) }))
      .mockResolvedValueOnce(json([raw(999), ...[...ids].reverse().map(id => raw(id)), raw(1)]))
    const result = await searchUSDAProducts('rolled oats', 'synthetic', undefined, fetcher)
    expect(result.products.map(product => product.source.id)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).fdcIds).toHaveLength(16)
  })
  it('keeps incomplete nutrition null and excludes discontinued or invalid barcode records', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ foods: [{ fdcId: 1 }, { fdcId: 2 }, { fdcId: 3 }] }))
      .mockResolvedValueOnce(json([raw(1, { labelNutrients: { calories: { value: 0 } } }), raw(2, { discontinuedDate: '2026-01-01' }), raw(3, { gtinUpc: 'bad' })]))
    const result = await searchUSDAProducts('plain oats', 'synthetic', undefined, fetcher)
    expect(result.products).toHaveLength(1)
    expect(result.products[0].nutrition).toEqual({ calories: 0, protein: null, carbs: null, fat: null })
  })
  it('distinguishes missing products, unavailable providers and rate limits without raw errors', async () => {
    expect((await searchUSDAProducts('oats')).status).toBe('unavailable')
    expect((await searchUSDAProducts('x', 'key')).status).toBe('invalid')
    const empty = vi.fn<typeof fetch>().mockResolvedValue(json({ foods: [] }))
    expect((await searchUSDAProducts('oats', 'key', undefined, empty)).status).toBe('not-found')
    expect(empty).toHaveBeenCalledTimes(1)
    const limited = vi.fn<typeof fetch>().mockResolvedValue(json({ error: 'private information' }, 429))
    expect((await searchUSDAProducts('oats', 'key', undefined, limited)).status).toBe('rate-limited')
    const broken = vi.fn<typeof fetch>().mockRejectedValue(new Error('sensitive request URL with key'))
    const result = await searchUSDAProducts('oats', 'key', undefined, broken)
    expect(result.status).toBe('unavailable'); expect(JSON.stringify(result)).not.toContain('sensitive')
  })
  it('validates HTTP boundaries and caches only successful searches without persisting products', async () => {
    const search = vi.fn<typeof searchUSDAProducts>().mockResolvedValue({ status: 'not-found', products: [], message: 'Try the full name.' })
    const api = createProductSearchApi({ usdaKey: 'fixture', model: 'fixture', jevModel: 'fixture' }, search)
    const server = createServer((req, res) => void api(req, res))
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/products/search`
    const post = (body: string, origin?: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body })
    try {
      expect((await post('{')).status).toBe(400)
      expect((await post(JSON.stringify({ query: 'x' }))).status).toBe(400)
      expect((await post(JSON.stringify({ query: 'oats' }), 'https://unrelated.example')).status).toBe(403)
      expect((await post(JSON.stringify({ query: 'oats', extra: 'x'.repeat(5000) }))).status).toBe(413)
      await post(JSON.stringify({ query: '  Whole  milk  ' }))
      const hit = await post(JSON.stringify({ query: 'whole milk' }))
      expect((await hit.json()).cached).toBe(true)
      expect(search).toHaveBeenCalledTimes(1)
      expect(search.mock.calls[0][0]).toBe('Whole milk')
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  })
})
