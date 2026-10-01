import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { emptyDocument, type AgentStore, type Document } from './store.ts';

export class SqliteAgentStore implements AgentStore {
  private db: DatabaseSync;
  constructor(path = resolve('.fuel-data/agents.sqlite')) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS agent_documents(owner TEXT PRIMARY KEY, version INTEGER NOT NULL, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agent_connections(id TEXT PRIMARY KEY, owner TEXT NOT NULL);`);
  }
  async read(owner: string) {
    const row = this.db.prepare('SELECT version, document FROM agent_documents WHERE owner=?').get(owner) as { version: number; document: string } | undefined;
    return row ? { version: row.version, document: JSON.parse(row.document) as Document } : { version: 0, document: emptyDocument() };
  }
  async owner(id: string) {
    const row = this.db.prepare('SELECT owner FROM agent_connections WHERE id=?').get(id) as { owner: string } | undefined;
    return row?.owner ?? null;
  }
  async compareAndSet(owner: string, version: number, document: Document) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.db.prepare('SELECT version FROM agent_documents WHERE owner=?').get(owner) as { version: number } | undefined;
      if ((current?.version ?? 0) !== version) { this.db.exec('ROLLBACK'); return false; }
      this.db.prepare('INSERT INTO agent_documents VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET version=excluded.version, document=excluded.document').run(owner, version + 1, JSON.stringify(document));
      for (const connection of document.connections) this.db.prepare('INSERT INTO agent_connections VALUES(?,?) ON CONFLICT(id) DO NOTHING').run(connection.id, owner);
      this.db.exec('COMMIT');
      return true;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
