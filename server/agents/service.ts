import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { AgentAction, AgentRequest, ManageRequest, AgentConnection, AgentContext } from '../../src/features/connections/contracts.ts';
import type { AgentStore, Document, StoredConnection } from './store.ts';

const DAY = 86_400_000;
export class AgentError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) { super(message); }
}
const error = (status: number, code: string, message: string): never => { throw new AgentError(status, code, message); };
const publicConnection = ({ tokenHash: _hash, ...connection }: StoredConnection): AgentConnection => connection;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function authenticate(document: Document, token: string, now: number) {
  const connection = document.connections.find(c => c.id === token.split('.')[1]);
  if (!connection || connection.revokedAt || Date.parse(connection.expiresAt) <= now || !timingSafeEqual(Buffer.from(hash(token), 'hex'), Buffer.from(connection.tokenHash, 'hex')))
    return error(401, 'INVALID_TOKEN', 'This connection is expired, revoked, or invalid. Connect again.');
  return connection;
}
function expire(document: Document, now: number) {
  for (const action of document.actions) if (action.status === 'pending' && Date.parse(action.expiresAt) <= now) { action.status = 'expired'; action.resolvedAt = action.expiresAt; }
}
function checkContentCapacity(document: Document) {
  // Reserve room below the SQL limit for later resolution/revocation timestamps.
  if (Buffer.byteLength(JSON.stringify(document), 'utf8') > 4_500_000)
    return error(409, 'CAPACITY', 'This profile has reached its connection storage limit. Existing proposals and request receipts remain available.');
}

export class AgentService {
  constructor(public store: AgentStore, private clock = Date.now, private snapshot?: (owner: string) => Promise<{ context: AgentContext; updatedAt: string; revision: number } | null>) {}
  async tokenOwner(token: string) {
    if (!/^rpagent\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.[A-Za-z0-9_-]{43}$/.test(token)) return error(401, 'INVALID_TOKEN', 'Supply a valid connection token.');
    const owner = await this.store.owner(token.split('.')[1]);
    if (!owner) return error(401, 'INVALID_TOKEN', 'This connection is invalid.');
    authenticate((await this.store.read(owner)).document, token, this.clock());
    return owner;
  }
  private async update<T>(owner: string, operation: (document: Document, now: number) => T) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const { document, version } = await this.store.read(owner);
      const before = JSON.stringify(document);
      const now = this.clock();
      expire(document, now);
      const result = operation(document, now);
      if (JSON.stringify(document) === before || await this.store.compareAndSet(owner, version, document)) return result;
    }
    throw new AgentError(409, 'BUSY', 'Another request changed these records. Retry the same request.', true);
  }
  async manage(owner: string, request: ManageRequest) {
    return this.update(owner, (document, now): unknown => {
      const at = new Date(now).toISOString();
      switch (request.operation) {
        case 'list': return { connections: document.connections.map(publicConnection), actions: document.actions, publishedAt: document.publishedAt };
        case 'create': {
          if (document.connections.length >= 100) return error(409, 'CAPACITY', 'This profile has reached its connection limit (100).');
          const id = randomUUID();
          const token = `rpagent.${id}.${randomBytes(32).toString('base64url')}`;
          const connection: StoredConnection = { id, name: request.name, scopes: [...new Set(request.scopes)], createdAt: at, expiresAt: new Date(now + request.expiresInDays * DAY).toISOString(), revokedAt: null, tokenHash: hash(token) };
          document.connections.push(connection);
          checkContentCapacity(document);
          return { connection: publicConnection(connection), token };
        }
        case 'publish': {
          if (request.dataUpdatedAt && Date.parse(request.dataUpdatedAt) > now + 60_000) return error(400, 'INVALID_TIMESTAMP', 'Data update time cannot be in the future. Check your device clock.');
          document.context = request.context; document.publishedAt = at; document.dataUpdatedAt = request.dataUpdatedAt;
          checkContentCapacity(document);
          return { publishedAt: at };
        }
        case 'revoke': {
          const connection = document.connections.find(c => c.id === request.connectionId);
          if (!connection) return error(404, 'NOT_FOUND', 'Connection not found.');
          connection.revokedAt ??= at;
          for (const action of document.actions) if (action.connectionId === connection.id && action.status === 'pending') { action.status = 'revoked'; action.resolvedAt = at; }
          return { connection: publicConnection(connection) };
        }
        case 'resolve': {
          const action = document.actions.find(a => a.id === request.actionId);
          if (!action) return error(404, 'NOT_FOUND', 'Proposal not found.');
          if (action.status === request.status) return { action };
          if (action.status !== 'pending') return error(409, 'ALREADY_RESOLVED', `This proposal is ${action.status}.`);
          action.status = request.status; action.resolvedAt = at;
          return { action };
        }
      }
    });
  }
  async execute(owner: string, token: string, request: AgentRequest) {
    if (request.operation === 'context.read') {
      const connection = authenticate((await this.store.read(owner)).document, token, this.clock());
      if (!connection.scopes.some(s => s.endsWith(':read'))) return error(403, 'SCOPE_REQUIRED', 'This connection does not have read access.');
    }
    const snapshot = request.operation === 'context.read' && this.snapshot ? await this.snapshot(owner) : null;
    return this.update(owner, (document, now): unknown => {
      const connection = authenticate(document, token, now);
      const canPropose = connection.scopes.includes('meals:propose');
      switch (request.operation) {
        case 'capabilities': return { version: 1, connection: publicConnection(connection), scopes: connection.scopes, operations: ['capabilities', ...(connection.scopes.some(s => s.endsWith(':read')) ? ['context.read'] : []), ...(canPropose ? ['meals.propose', 'actions.get'] : [])], context: { mode: this.snapshot ? 'cloud_snapshot' : 'published_snapshot', publishedAt: document.publishedAt }, limits: { proposalExpiresInDays: 7, maxActions: 1000 }, guidance: 'Meal proposals require review in Rep & Plate. Proposing never logs consumption. Context is a saved snapshot, not a live device feed. Accepted means logged on the reviewing device; cloud synchronization may follow separately.' };
        case 'context.read': {
          if (!connection.scopes.some(s => s.endsWith(':read'))) return error(403, 'SCOPE_REQUIRED', 'This connection does not have read access.');
          const context = this.snapshot ? snapshot?.context : document.context;
          if (!context) return error(409, 'CONTEXT_UNAVAILABLE', this.snapshot ? 'Open Rep & Plate and synchronize your records to the cloud.' : 'Open Connections in Rep & Plate and publish current context.');
          const result: Record<string, unknown> = { day: context.day, timezone: context.timezone };
          for (const field of ['nutrition', 'pantry', 'preferences', 'workouts'] as const) if (connection.scopes.includes(`${field}:read`)) result[field] = context[field];
          result.truncated = context.truncated.filter(field => connection.scopes.includes(`${field}:read`));
          const dataUpdatedAt = snapshot?.updatedAt ?? document.dataUpdatedAt ?? null;
          const ageSeconds = dataUpdatedAt ? Math.max(0, Math.floor((now - Date.parse(dataUpdatedAt)) / 1000)) : null;
          return { context: result, publishedAt: document.publishedAt, mode: this.snapshot ? 'cloud_snapshot' : 'published_snapshot', ageSeconds, dataUpdatedAt, sourceRevision: snapshot?.revision ?? null, stale: ageSeconds === null || ageSeconds > 300 };
        }
        case 'meals.propose': {
          if (!canPropose) return error(403, 'SCOPE_REQUIRED', 'This connection cannot propose meals.');
          const previous = document.actions.find(a => a.connectionId === connection.id && a.requestId === request.requestId);
          if (previous) {
            if (JSON.stringify(previous.meal) !== JSON.stringify(request.meal)) return error(409, 'REQUEST_CONFLICT', 'This request ID was used for a different meal. Use a new request ID.');
            return { action: previous, replayed: true };
          }
          if (document.actions.length >= 1000) return error(409, 'CAPACITY', 'This profile has reached its proposal limit (1000). Previous requests remain available.');
          const action: AgentAction = { id: randomUUID(), connectionId: connection.id, connectionName: connection.name, requestId: request.requestId, meal: request.meal, status: 'pending', createdAt: new Date(now).toISOString(), expiresAt: new Date(now + 7 * DAY).toISOString(), resolvedAt: null };
          document.actions.push(action);
          checkContentCapacity(document);
          return { action, replayed: false };
        }
        case 'actions.get': {
          if (!canPropose) return error(403, 'SCOPE_REQUIRED', 'This connection cannot read meal proposals.');
          const action = document.actions.find(a => a.id === request.actionId && a.connectionId === connection.id);
          if (!action) return error(404, 'NOT_FOUND', 'Proposal not found.');
          return { action };
        }
      }
    });
  }
}
