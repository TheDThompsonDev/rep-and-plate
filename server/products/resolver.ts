import { normalizeGTIN, type ProductLookup } from '../../src/features/products/contracts.ts'
import { ProductCatalog } from './catalog.ts'
import { lookupUSDA } from './usda.ts'

const freshnessMs = 30 * 24 * 60 * 60 * 1000
function forCaller<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) return Promise.reject(signal.reason ?? new Error('Lookup cancelled.'))
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error('Lookup cancelled.'))
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
export function createProductResolver(options: {
  key?: string; catalogPath?: string
  provider?: typeof lookupUSDA
  now?: () => number
}) {
  const catalog = new ProductCatalog(options.catalogPath)
  const provider = options.provider ?? lookupUSDA
  const now = options.now ?? Date.now
  const misses = new Map<string, number>()
  const inFlight = new Map<string, Promise<ProductLookup>>()
  const remote = (gtin: string) => {
    const existing = inFlight.get(gtin)
    if (existing) return existing
    if (inFlight.size >= 20) return Promise.resolve<ProductLookup>({ status: 'unavailable', products: [], message: 'Food lookup is busy. Please try again shortly.' })
    const pending = Promise.resolve().then(() => provider(gtin, options.key, AbortSignal.timeout(45000)))
      .finally(() => { inFlight.delete(gtin) })
    inFlight.set(gtin, pending)
    return pending
  }
  return {
    async lookup(barcode: string, signal?: AbortSignal): Promise<ProductLookup> {
      if (signal?.aborted) throw signal.reason ?? new Error('Lookup cancelled.')
      const gtin = normalizeGTIN(barcode)
      if (!gtin) return { status: 'invalid', products: [], message: 'Enter a valid UPC, EAN, or GTIN barcode.' }
      const cached = catalog.lookup(gtin)
      const cachedResult = (message?: string): ProductLookup => ({
        status: cached.length > 1 || catalog.outcome(gtin) === 'ambiguous' ? 'ambiguous' : 'found', products: cached.slice(0, 20), cached: true,
        message: message ?? (cached.length > 1 || catalog.outcome(gtin) === 'ambiguous' ? 'USDA has multiple or incomplete matches for this barcode. Compare the package and serving size.' : 'Found in Rep & Plate’s USDA catalog. Check it against your package.'),
      })
      if (cached.length && cached.every(product => now() - Date.parse(product.source.fetchedAt) < freshnessMs)) return cachedResult()
      if (cached.length && !options.key) return cachedResult('Saved USDA information. Live refresh is unavailable; compare it with the current package.')
      if ((misses.get(gtin) ?? 0) > now()) return { status: 'not-found', products: [], cached: true, message: 'No exact USDA match. Add a photo of the nutrition label.' }
      let result: ProductLookup
      try { result = await forCaller(remote(gtin), signal) }
      catch (error) {
        if (signal?.aborted) throw error
        if (cached.length) return cachedResult('Showing a saved USDA record because current information could not be confirmed. Check your package before using it.')
        return { status: 'unavailable', products: [], message: 'USDA is unavailable right now. Try again or add a photo of the nutrition label.' }
      }
      if (signal?.aborted) throw signal.reason ?? new Error('Lookup cancelled.')
      if ((result.status === 'found' || result.status === 'ambiguous') && result.products.length) {
        if (result.products.some(product => product.gtin !== gtin || product.source.provider !== 'usda')) {
          return { status: 'unavailable', products: [], message: 'The source returned a mismatched barcode. Add a photo of the nutrition label.' }
        }
        catalog.save(result.products, undefined, { gtin, status: result.status })
        return { ...result, products: result.products.slice(0, 20), status: result.products.length > 20 ? 'ambiguous' : result.status }
      }
      if (cached.length) return cachedResult('Showing a saved USDA record because current information could not be confirmed. Check your package before using it.')
      if (result.status === 'not-found') {
        if (misses.size >= 1000) misses.delete(misses.keys().next().value!)
        misses.set(gtin, now() + 5 * 60 * 1000)
      }
      return result
    },
    close() { catalog.close() },
  }
}
