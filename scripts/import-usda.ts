import { parseArgs } from 'node:util'
import { importUSDA } from '../server/products/importer.ts'

const { values } = parseArgs({ options: {
  file: { type: 'string' }, release: { type: 'string' }, catalog: { type: 'string' },
  'dry-run': { type: 'boolean', default: false }, batch: { type: 'string' }, limit: { type: 'string' },
  help: { type: 'boolean' },
} })
if (values.help || !values.file || !values.release) {
  console.log(`Import an already downloaded and unzipped official USDA Branded Foods JSON file.
Usage: npx tsx scripts/import-usda.ts --file <file.json> --release <YYYY-MM> [options]
  --dry-run          Validate/count without creating or changing the catalog
  --catalog <path>   SQLite path (default .fuel-data/catalog.sqlite)
  --batch <number>   Atomic batch size, 1–2000 (default 250)
  --limit <number>   Stop after this many additional records; rerun to resume
Identical input and release resumes automatically. Never downloads files or needs an API key.
Official downloads: https://fdc.nal.usda.gov/download-datasets/`)
  process.exit(values.help ? 0 : 1)
}
const abort = new AbortController()
process.once('SIGINT', () => abort.abort(new Error('Import interrupted. Rerun to resume committed batches.')))
let notices = 0
try {
  const report = await importUSDA({
    file: values.file, release: values.release, catalogPath: values.catalog, dryRun: values['dry-run'],
    batchSize: values.batch ? Number(values.batch) : undefined,
    limit: values.limit ? Number(values.limit) : undefined,
    signal: abort.signal,
    onProgress: row => console.log(JSON.stringify(row)),
    onMalformed: (index, reason) => { if (notices++ < 20) console.error(`Record ${index}: ${reason}`) },
  })
  console.log(JSON.stringify({ ...report, reportedIssues: notices }))
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Import failed. Committed batches can be resumed.')
  process.exitCode = 1
}
