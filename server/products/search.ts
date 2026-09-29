import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Config } from '../ai.ts'
import { normalizeUSDA } from './usda.ts'
import type { FoodProduct } from '../../src/features/products/contracts.ts'
import { productSearchRequestSchema, type ProductSearchResult } from '../../src/features/products/search-contract.ts'

const API = 'https://api.nal.usda.gov/fdc/v1'
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
class SearchError extends Error { constructor(readonly status: number) { super('USDA search failed') } }

/** Name search returns suggestions, never a confirmed identity or a catalog write.
 * The local catalog is indexed by GTIN only; avoid scanning 440k JSON rows by name.
 */
export async function searchUSDAProducts(query: string, key?: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<ProductSearchResult> {
  const input = productSearchRequestSchema.safeParse({ query })
  if (!input.success) return { status: 'invalid', products: [], message: 'Enter a product name or receipt description between 2 and 160 characters.' }
  if (!key?.trim()) return { status: 'unavailable', products: [], message: 'USDA search is not configured. You can scan the barcode or enter the package label instead.' }
  const requestSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(18000)]) : AbortSignal.timeout(18000)
  async function post(path: string, body: unknown): Promise<unknown> {
    const url = new URL(`${API}${path}`)
    url.searchParams.set('api_key', key!.trim())
    const response = await fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: requestSignal })
    if (!response.ok) throw new SearchError(response.status)
    return response.json()
  }
  try {
    // Preserve the user's words. Abbreviations are not expanded or treated as barcode matches.
    const found = record(await post('/foods/search', { query: input.data.query, dataType: ['Branded'], pageSize: 16, pageNumber: 1 }))
    if (!Array.isArray(found.foods)) throw new SearchError(502)
    const ids = [...new Set(found.foods.map(row => record(row).fdcId).filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0))].slice(0, 16)
    if (!ids.length) return { status: 'not-found', products: [], message: 'No USDA candidates found. Try the full product name and brand, or scan its barcode.' }
    const details = await post('/foods', { fdcIds: ids, format: 'full' })
    if (!Array.isArray(details)) throw new SearchError(502)
    const allowed = new Set(ids.map(String))
    const productsById = new Map<string, FoodProduct>()
    for (const raw of details) {
      const product = normalizeUSDA(raw)
      if (product && allowed.has(product.source.id)) productsById.set(product.source.id, product)
    }
    const products = ids.map(id => productsById.get(String(id))).filter((value): value is FoodProduct => !!value).slice(0, 8)
    if (!products.length) return { status: 'not-found', products: [], message: 'No usable packaged-food candidates were returned. Try another description or check the package label.' }
    return { status: 'candidates', products, message: 'Possible USDA products—not confirmed receipt matches. Compare the brand, package and serving before choosing.' }
  } catch (error) {
    if (error instanceof SearchError && error.status === 429) return { status: 'rate-limited', products: [], message: 'USDA’s request limit was reached. Try again later or scan the package barcode.' }
    return { status: 'unavailable', products: [], message: requestSignal.aborted ? 'Product search was interrupted or took too long. Please try again.' : 'USDA search is unavailable right now. Please retry or enter the label manually.' }
  }
}

export function createProductSearchApi(config: Config, search = searchUSDAProducts) {
  let active = 0
  let attempts: number[] = []
  const cache = new Map<string, { expires: number; value: ProductSearchResult }>()
  return async (req: IncomingMessage, res: ServerResponse) => {
    const json = (status: number, value: unknown) => { if (!res.destroyed && !res.writableEnded) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value)) } }
    if ((req.url ?? '').split('?')[0] !== '/api/products/search' || req.method !== 'POST') return json(404, { error: 'Not found.' })
    let hostname = ''
    try { hostname = new URL(`http://${req.headers.host}`).hostname } catch { /* Rejected below. */ }
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(hostname) || (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)) return json(403, { error: 'Request origin is not allowed.' })
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: 'Send JSON.' })
    attempts = attempts.filter(time => Date.now() - time < 60000)
    if (active >= 2 || attempts.length >= 20) return json(429, { error: 'Please wait a moment before searching again.' })
    active++; attempts.push(Date.now())
    const controller = new AbortController()
    const timer = setTimeout(() => { controller.abort(); if (!req.complete) { json(408, { error: 'The search request took too long.' }); req.destroy() } }, 20000)
    const disconnect = () => { if (!res.writableEnded) controller.abort() }
    res.on('close', disconnect)
    try {
      const chunks: Buffer[] = []
      let size = 0
      for await (const part of req) { const chunk = Buffer.from(part); size += chunk.length; if (size > 4096) return json(413, { error: 'Use a shorter product description.' }); chunks.push(chunk) }
      let body: unknown
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { return json(400, { error: 'The search request could not be read.' }) }
      const parsed = productSearchRequestSchema.safeParse(body)
      if (!parsed.success) return json(400, { status: 'invalid', products: [], message: 'Enter a product name or receipt description between 2 and 160 characters.' })
      const query = parsed.data.query.replace(/\s+/g, ' ')
      const cacheKey = query.toLocaleLowerCase('en-US')
      const hit = cache.get(cacheKey)
      if (hit && hit.expires > Date.now()) return json(200, { ...hit.value, cached: true })
      const result = await search(query, config.usdaKey, controller.signal)
      if (controller.signal.aborted) return json(503, { error: 'Product search was interrupted. Please try again.' })
      if (result.status === 'candidates' || result.status === 'not-found') {
        if (cache.size >= 100) cache.delete(cache.keys().next().value!)
        cache.set(cacheKey, { value: result, expires: Date.now() + (result.status === 'candidates' ? 300000 : 60000) })
      }
      return json(200, result)
    } catch { return json(503, { error: 'Product search could not finish. Please try again.' }) }
    finally { clearTimeout(timer); res.off('close', disconnect); active-- }
  }
}
