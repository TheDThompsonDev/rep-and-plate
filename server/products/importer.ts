import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { compose } from 'node:stream'
import { parser } from 'stream-json'
import { pick } from 'stream-json/filters/pick.js'
import { streamArray } from 'stream-json/streamers/stream-array.js'
import type { FoodProduct } from '../../src/features/products/contracts.ts'
import { ProductCatalog, type ImportProgress } from './catalog.ts'
import { normalizeUSDA } from './usda.ts'

export type ImportReport = ImportProgress & { fingerprint: string; release: string; dryRun: boolean; resumed: boolean }
export type ImportOptions = {
  file: string; release: string; catalogPath?: string; dryRun?: boolean
  batchSize?: number; limit?: number; signal?: AbortSignal
  onProgress?: (report: ImportReport) => void
  onMalformed?: (index: number, reason: string) => void
}

/** Reads the unzipped, official USDA { BrandedFoods: [...] } JSON download.
 * Memory is one source record plus at most batchSize normalized products.
 * Resume scans the input again, skipping atomically committed records.
 */
export async function importUSDA(options: ImportOptions): Promise<ImportReport> {
  if (!options.release.trim()) throw new Error('A USDA release name/date is required.')
  const batchSize = options.batchSize ?? 250
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 2000) throw new Error('Batch size must be between 1 and 2000.')
  if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1)) throw new Error('Limit must be a positive integer.')
  const hash = createHash('sha256').update(options.release).update('\0')
  for await (const chunk of createReadStream(options.file, { signal: options.signal })) hash.update(chunk)
  const fingerprint = hash.digest('hex')
  const catalog = options.dryRun ? null : new ProductCatalog(options.catalogPath)
  try {
    const saved = catalog?.progress(fingerprint)
    const report: ImportReport = {
      processed: 0, imported: 0, skipped: 0, malformed: 0, complete: false,
      ...saved, fingerprint, release: options.release, dryRun: !!options.dryRun, resumed: !!saved,
    }
    if (saved?.complete) return report
    const resumeAfter = saved?.processed ?? 0
    const records = compose(
      createReadStream(options.file, { signal: options.signal }),
      parser.asStream(), pick.asStream({ filter: 'BrandedFoods' }), streamArray.asStream(),
    )
    let batch: FoodProduct[] = []
    let retired: { id: string; updatedAt: string }[] = []
    let sinceCommit = 0
    let stopped = false
    const commit = () => {
      catalog?.save(batch, { fingerprint, release: options.release, progress: report }, undefined, retired)
      batch = []; retired = []; sinceCommit = 0
      options.onProgress?.({ ...report })
    }
    try {
      for await (const entry of records) {
        const index = Number(entry.key) + 1
        if (index <= resumeAfter) continue
        if (options.signal?.aborted) throw options.signal.reason ?? new Error('Import cancelled.')
        report.processed = index
        const raw: unknown = entry.value
        if (!raw || typeof raw !== 'object' || typeof (raw as Record<string, unknown>).fdcId !== 'number') {
          report.malformed++
          options.onMalformed?.(index, 'Record is missing a numeric FDC identifier.')
        } else {
          const product = normalizeUSDA(raw, options.release)
          if (product) { batch.push(product); report.imported++ }
          else {
            report.skipped++
            const source = raw as Record<string, unknown>
            if (typeof source.discontinuedDate === 'string' && Number.isSafeInteger(source.fdcId)) {
              const date = Date.parse(source.discontinuedDate)
              if (Number.isFinite(date)) retired.push({ id: `usda:${source.fdcId}`, updatedAt: new Date(date).toISOString().slice(0, 10) })
            }
            options.onMalformed?.(index, 'No usable current branded product with a valid barcode.')
          }
        }
        if (++sinceCommit >= batchSize) commit()
        if (options.limit && index - resumeAfter >= options.limit) { stopped = true; break }
      }
      if (report.processed === 0) throw new Error('No BrandedFoods records found. Use the unzipped official Branded Foods JSON download.')
      report.complete = !stopped
      commit()
      return report
    } finally { records.destroy() }
  } finally { catalog?.close() }
}
