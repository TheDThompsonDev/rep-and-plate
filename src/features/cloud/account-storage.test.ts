import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ACTIVE = 'fuel.prototype.v1';
const PREFIX = 'fuel.prototype.v1.corrupt-';
const deletedId = '11111111-1111-4111-8111-111111111111';
const deleted = `https://project.supabase.co:${deletedId}`;
const other = 'https://project.supabase.co:22222222-2222-4222-8222-222222222222';

/** localStorage stand-in whose data keys are enumerable own properties, so the
 * production `Object.keys(localStorage)` listing works. */
function memoryStorage(): Storage {
  const store: Record<string, string> = {};
  const api = {
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const key of Object.keys(store)) delete store[key]; },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  };
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(api)))
    Object.defineProperty(store, name, { ...descriptor, enumerable: false });
  return store as unknown as Storage;
}

let storage: Storage;
const copies = () => Object.keys(storage).filter(key => key.startsWith(PREFIX)).sort();
async function load() {
  const records = await import('../../platform/browser-records');
  const accounts = await import('./account-storage');
  return { records, accounts };
}
function seedCopies(records: Awaited<ReturnType<typeof load>>['records']) {
  const keys = {
    deleted: records.corruptRecordsKey(deleted, '1000000000001'),
    other: records.corruptRecordsKey(other, '1000000000002'),
    guest: records.corruptRecordsKey(null, '1000000000003'),
  };
  storage.setItem(keys.deleted, 'deleted account copy');
  storage.setItem(keys.other, 'other account copy');
  storage.setItem(keys.guest, 'guest copy');
  return keys;
}

beforeEach(() => { vi.resetModules(); storage = memoryStorage(); vi.stubGlobal('localStorage', storage); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('clearBrowserAccount and preserved copies of unreadable snapshots', () => {
  it("deleting an account that is not selected removes only that account's copies", async () => {
    const { records, accounts } = await load();
    const keys = seedCopies(records);
    storage.setItem('health.records.owner', other);
    storage.setItem(ACTIVE, 'selected records');
    await accounts.clearBrowserAccount(deletedId);
    expect(storage.getItem(keys.deleted)).toBeNull();
    expect(storage.getItem(keys.other)).toBe('other account copy');
    expect(storage.getItem(keys.guest)).toBe('guest copy');
    expect(storage.getItem(ACTIVE)).toBe('selected records');
    expect(storage.getItem('health.records.owner')).toBe(other);
  });

  it("clearing the selected account removes its copies and keeps the guest's and another account's", async () => {
    const { records, accounts } = await load();
    const keys = seedCopies(records);
    storage.setItem('health.records.owner', deleted);
    storage.setItem(`health.account.${encodeURIComponent(deleted)}`, 'deleted archive');
    storage.setItem(ACTIVE, 'deleted archive');
    await accounts.clearBrowserAccount();
    expect(storage.getItem(keys.deleted)).toBeNull();
    expect(storage.getItem(`health.account.${encodeURIComponent(deleted)}`)).toBeNull();
    expect(storage.getItem(ACTIVE)).toBeNull();
    expect(storage.getItem('health.records.owner')).toBeNull();
    expect(storage.getItem(keys.other)).toBe('other account copy');
    expect(storage.getItem(keys.guest)).toBe('guest copy');
    expect(copies()).toEqual([keys.guest, keys.other].sort());
  });

  it('deleting the selected account by id removes its copies once', async () => {
    const { records, accounts } = await load();
    const keys = seedCopies(records);
    storage.setItem('health.records.owner', deleted);
    storage.setItem(ACTIVE, 'deleted archive');
    await accounts.clearBrowserAccount(deletedId);
    expect(storage.getItem(keys.deleted)).toBeNull();
    expect(storage.getItem(ACTIVE)).toBeNull();
    expect(storage.getItem(keys.other)).toBe('other account copy');
    expect(storage.getItem(keys.guest)).toBe('guest copy');
  });
});
