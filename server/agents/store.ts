import type { AgentAction, AgentConnection, AgentContext } from '../../src/features/connections/contracts.ts';
import type { CoachingState } from '../../src/features/coaching/contracts.ts';

/** `oauthClientId` marks a connection made by signing in (Connect in Claude) rather than by a key. */
export type StoredConnection = AgentConnection & { tokenHash: string; oauthClientId?: string };
export type Document = { connections: StoredConnection[]; actions: AgentAction[]; context: AgentContext | null; publishedAt: string | null; dataUpdatedAt: string | null; coaching?: CoachingState };
export type Versioned = { version: number; document: Document };
export const emptyDocument = (): Document => ({ connections: [], actions: [], context: null, publishedAt: null, dataUpdatedAt: null });
export interface AgentStore {
  read(owner: string): Promise<Versioned>;
  owner(connectionId: string): Promise<string | null>;
  compareAndSet(owner: string, version: number, document: Document): Promise<boolean>;
}
