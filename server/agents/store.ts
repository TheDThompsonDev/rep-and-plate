import type { AgentAction, AgentConnection, AgentContext } from '../../src/features/connections/contracts.ts';

export type StoredConnection = AgentConnection & { tokenHash: string };
export type Document = { connections: StoredConnection[]; actions: AgentAction[]; context: AgentContext | null; publishedAt: string | null; dataUpdatedAt: string | null };
export type Versioned = { version: number; document: Document };
export const emptyDocument = (): Document => ({ connections: [], actions: [], context: null, publishedAt: null, dataUpdatedAt: null });
export interface AgentStore {
  read(owner: string): Promise<Versioned>;
  owner(connectionId: string): Promise<string | null>;
  compareAndSet(owner: string, version: number, document: Document): Promise<boolean>;
}
