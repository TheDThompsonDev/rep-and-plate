import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { FoodProduct } from '../../src/features/products/contracts.ts'

// Hosted instances have a read-only deployment directory. This is only an
// opportunistic public USDA cache; durable user data always lives in Supabase.
export const defaultCatalogPath = process.env.VERCEL ? '/tmp/rep-and-plate-catalog.sqlite' : resolve('.fuel-data/catalog.sqlite')
export type ImportProgress = { processed: number; imported: number; skipped: number; malformed: number; complete: boolean }

/** Server-only USDA records. Private label corrections never enter this shared catalog. */
export class ProductCatalog {
  private db: DatabaseSync
  constructor(path = defaultCatalogPath) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS product_versions (
        id TEXT NOT NULL, version TEXT NOT NULL, gtin TEXT NOT NULL,
        payload TEXT NOT NULL, PRIMARY KEY(id, version));
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY, gtin TEXT NOT NULL, version TEXT NOT NULL,
        updated_at TEXT NOT NULL, payload TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS products_gtin ON products(gtin);
      CREATE TABLE IF NOT EXISTS imports (
        fingerprint TEXT PRIMARY KEY, release TEXT NOT NULL, progress TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS lookup_outcomes (gtin TEXT PRIMARY KEY, status TEXT NOT NULL);
      PRAGMA user_version = 1;`)
  }
  lookup(gtin: string): FoodProduct[] {
    return this.db.prepare('SELECT payload FROM products WHERE gtin = ? ORDER BY id LIMIT 21').all(gtin)
      .map(row => JSON.parse(String(row.payload)) as FoodProduct)
  }
  versions(id: string): FoodProduct[] {
    return this.db.prepare('SELECT payload FROM product_versions WHERE id = ? ORDER BY version').all(id)
      .map(row => JSON.parse(String(row.payload)) as FoodProduct)
  }
  progress(fingerprint: string): ImportProgress | null {
    const row = this.db.prepare('SELECT progress FROM imports WHERE fingerprint = ?').get(fingerprint)
    return row ? JSON.parse(String(row.progress)) as ImportProgress : null
  }
  outcome(gtin: string): string | null {
    const row = this.db.prepare('SELECT status FROM lookup_outcomes WHERE gtin = ?').get(gtin)
    return row ? String(row.status) : null
  }
  save(products: FoodProduct[], checkpoint?: { fingerprint: string; release: string; progress: ImportProgress }, outcome?: { gtin: string; status: 'found' | 'ambiguous' }, retired: { id: string; updatedAt: string }[] = []) {
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const version = this.db.prepare('INSERT OR IGNORE INTO product_versions(id, version, gtin, payload) VALUES (?, ?, ?, ?)')
      const current = this.db.prepare(`INSERT INTO products(id, gtin, version, updated_at, payload) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET gtin=excluded.gtin, version=excluded.version,
        updated_at=excluded.updated_at, payload=excluded.payload
        WHERE excluded.updated_at >= products.updated_at`)
      for (const product of products) {
        if (product.source.provider !== 'usda') throw new Error('Only USDA products belong in the shared catalog.')
        const payload = JSON.stringify(product)
        version.run(product.id, product.version, product.gtin, payload)
        // FDC dates are ISO dates. An undated import must not replace a dated record.
        current.run(product.id, product.gtin, product.version, product.source.updatedAt ?? '', payload)
      }
      const remove = this.db.prepare('DELETE FROM products WHERE id = ? AND updated_at <= ?')
      for (const product of retired) remove.run(product.id, product.updatedAt)
      if (checkpoint) this.db.prepare(`INSERT INTO imports(fingerprint, release, progress) VALUES (?, ?, ?)
        ON CONFLICT(fingerprint) DO UPDATE SET progress=excluded.progress`)
        .run(checkpoint.fingerprint, checkpoint.release, JSON.stringify(checkpoint.progress))
      if (outcome) this.db.prepare(`INSERT INTO lookup_outcomes(gtin, status) VALUES (?, ?)
        ON CONFLICT(gtin) DO UPDATE SET status=excluded.status`).run(outcome.gtin, outcome.status)
      this.db.exec('COMMIT')
    } catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  close() { this.db.close() }
}
