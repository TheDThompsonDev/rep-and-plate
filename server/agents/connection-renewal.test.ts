import { afterEach, describe, expect, it } from 'vitest';
import { AgentService } from './service.ts';
import { SqliteAgentStore } from './sqlite.ts';
import type { AgentConnection } from '../../src/features/connections/contracts.ts';

const DAY = 86_400_000;
const owner = 'renewal-owner';
const start = Date.parse('2026-11-10T15:00:00Z');
const cleanup: (() => void)[] = [];
afterEach(() => { for (const close of cleanup.splice(0)) close(); });

async function fixture(expiresInDays = 30) {
  const store = new SqliteAgentStore(':memory:'); cleanup.push(() => store.close());
  const clock = { now: start };
  const service = new AgentService(store, () => clock.now);
  const created = await service.manage(owner, { operation: 'create', name: 'Daily coach', scopes: ['coaching:read', 'coaching:write'], expiresInDays }) as { connection: AgentConnection; token: string };
  const read = () => service.execute(owner, created.token, { operation: 'coaching.read' }) as Promise<{ nextSteps: string[] }>;
  const renew = (days = 90) => service.manage(owner, { operation: 'renew', connectionId: created.connection.id, expiresInDays: days }) as Promise<{ connection: AgentConnection }>;
  return { service, clock, read, renew, ...created };
}

describe('keeping a connection going', () => {
  it('lets a connection last a year and refuses longer', async () => {
    const f = await fixture(365);
    expect(Date.parse(f.connection.expiresAt)).toBe(start + 365 * DAY);
    await expect(f.service.manage(owner, { operation: 'create', name: 'Forever', scopes: ['coaching:read'], expiresInDays: 366 })).rejects.toMatchObject({ status: 400 });
  });

  it('extends the same access key, so the assistant is not set up again', async () => {
    const f = await fixture();
    f.clock.now = start + 25 * DAY;
    const renewed = await f.renew(90);
    expect(Date.parse(renewed.connection.expiresAt)).toBe(start + 115 * DAY);
    f.clock.now = start + 100 * DAY; // long after the original 30 days
    await expect(f.read()).resolves.toHaveProperty('nextSteps');
  });

  it('brings back a key that ran out recently, but not one that was disconnected or left too long', async () => {
    const f = await fixture();
    f.clock.now = start + 33 * DAY;
    await expect(f.read()).rejects.toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
    await f.renew(30);
    await expect(f.read()).resolves.toHaveProperty('nextSteps');

    const stale = await fixture();
    stale.clock.now = start + 61 * DAY + 1;
    await expect(stale.renew()).rejects.toMatchObject({ status: 409, code: 'EXPIRED' });

    const gone = await fixture();
    await gone.service.manage(owner, { operation: 'revoke', connectionId: gone.connection.id });
    await expect(gone.renew()).rejects.toMatchObject({ status: 409, code: 'DISCONNECTED' });
    await expect(gone.read()).rejects.toMatchObject({ status: 401 });
    await expect(gone.service.manage('someone-else', { operation: 'renew', connectionId: gone.connection.id, expiresInDays: 90 })).rejects.toMatchObject({ status: 404 });
  });

  it('never shortens access', async () => {
    const f = await fixture(365);
    const renewed = await f.renew(30);
    expect(renewed.connection.expiresAt).toBe(f.connection.expiresAt);
  });

  it('has the assistant mention renewal first when the key is close to running out, and only then', async () => {
    const f = await fixture();
    expect((await f.read()).nextSteps.join(' ')).not.toContain('stops working');
    f.clock.now = start + 20 * DAY;
    const soon = await f.read();
    expect(soon.nextSteps[0]).toContain('stops working in 10 days');
    expect(soon.nextSteps.length).toBeLessThanOrEqual(4);
    // The app's own view is not an assistant conversation and gets no such line.
    const app = await f.service.manage(owner, { operation: 'coaching.read' }) as { nextSteps: string[] };
    expect(app.nextSteps.join(' ')).not.toContain('stops working');
    await f.renew(90);
    expect((await f.read()).nextSteps.join(' ')).not.toContain('stops working');
  });
});
