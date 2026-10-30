import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ACTIVE = 'fuel.prototype.v1';
const PREFIX = 'fuel.prototype.v1.corrupt-';

/** localStorage stand-in: data keys are own enumerable properties so the
 * production `Object.keys(localStorage)` listing works; methods are hidden. */
function memoryStorage(reject: (key: string) => boolean = () => false): Storage {
  const store: Record<string, string> = {};
  const api = {
    getItem: (key: string) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
    setItem: (key: string, value: string) => {
      if (reject(key)) throw new DOMException('Quota exceeded', 'QuotaExceededError');
      store[key] = String(value);
    },
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
  const domain = await import('../domain');
  const records = await import('./browser-records');
  const hook = await import('./useBrowserRecords');
  const drain = () => records.browserRecordTransaction(async () => undefined);
  return { domain, records, hook, drain };
}

beforeEach(() => { vi.resetModules(); storage = memoryStorage(); vi.stubGlobal('localStorage', storage); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('opening device records', () => {
  it('an explicit save after reading a corrupt snapshot leaves a copy of that snapshot behind', async () => {
    // Only pre-existing entry points: this is the mount path App has always run.
    storage.setItem(ACTIVE, '{broken');
    const { domain, records } = await load();
    const opened = domain.readState();
    expect(opened.meals).toEqual([]);
    await records.persistBrowserRecords(opened);
    const kept = copies();
    expect(kept).toHaveLength(1);
    expect(storage.getItem(kept[0])).toBe('{broken');
  });

  it('keeps a corrupt snapshot in place, copies it aside, and skips the passive mount write', async () => {
    storage.setItem(ACTIVE, '{broken');
    const { domain, records, hook, drain } = await load();
    const opened = domain.readStoredState();
    expect(opened.status).toBe('unreadable');
    expect(opened.state.meals).toEqual([]);
    expect(opened.state.profile.name).toBe('friend');
    await hook.persistOpenedRecords(opened, opened.state);
    await drain();
    expect(storage.getItem(ACTIVE)).toBe('{broken');
    const kept = copies();
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatch(/^fuel\.prototype\.v1\.corrupt-\d{13}$/);
    expect(storage.getItem(kept[0])).toBe('{broken');
    expect(records.unreadableBrowserRecords()).toMatchObject({ reason: 'invalid', copy: 'kept', key: kept[0] });
    expect(records.unreadableRecordsMessage(records.unreadableBrowserRecords()!)).toMatch(/could not be opened/);
    // A deliberate later save may replace the active key only now that the copy exists.
    const next = domain.initialState();
    next.profile.name = 'After the notice';
    await records.persistBrowserRecords(next);
    expect(JSON.parse(storage.getItem(ACTIVE)!).profile.name).toBe('After the notice');
    expect(storage.getItem(kept[0])).toBe('{broken');
  });

  it('treats a snapshot from a newer app version as unreadable and preserves it', async () => {
    const { domain, records, hook, drain } = await load();
    const future = JSON.stringify({ ...domain.initialState(), version: 2, futureField: { kept: true } });
    storage.setItem(ACTIVE, future);
    const opened = domain.readStoredState();
    expect(opened).toMatchObject({ status: 'unreadable', reason: 'unsupported-version' });
    await hook.persistOpenedRecords(opened, opened.state);
    await drain();
    expect(storage.getItem(ACTIVE)).toBe(future);
    const kept = copies();
    expect(kept).toHaveLength(1);
    expect(storage.getItem(kept[0])).toBe(future);
    expect(records.unreadableRecordsMessage(records.unreadableBrowserRecords()!)).toMatch(/newer version/);
  });

  it('initializes an empty device and writes its first durable snapshot on mount', async () => {
    const { domain, records, hook } = await load();
    const opened = domain.readStoredState();
    expect(opened.status).toBe('fresh');
    await hook.persistOpenedRecords(opened, opened.state);
    expect(JSON.parse(storage.getItem(ACTIVE)!)).toEqual(JSON.parse(JSON.stringify(opened.state)));
    expect(copies()).toEqual([]);
    expect(records.unreadableBrowserRecords()).toBeNull();
  });

  it('loads a valid version 1 snapshot unchanged', async () => {
    const { domain, records, hook } = await load();
    const saved = domain.initialState();
    saved.profile.name = 'Returning';
    saved.meals.push({ ...domain.demoState().meals[0], id: 'kept-meal', example: false });
    const raw = JSON.stringify(saved);
    storage.setItem(ACTIVE, raw);
    const opened = domain.readStoredState();
    expect(opened.status).toBe('loaded');
    expect(opened.state).toEqual(domain.upgradeChat(domain.stateSchema.parse(JSON.parse(raw))));
    expect(opened.state.meals.map(meal => meal.id)).toEqual(['kept-meal']);
    await hook.persistOpenedRecords(opened, opened.state);
    expect(JSON.parse(storage.getItem(ACTIVE)!)).toEqual(JSON.parse(raw));
    expect(copies()).toEqual([]);
    expect(records.unreadableBrowserRecords()).toBeNull();
  });

  it('keeps at most three preserved copies, reuses an identical one, and adds nothing on a second read', async () => {
    const { domain, drain } = await load();
    for (const stamp of ['1000000000000', '1000000000001', '1000000000002'])
      storage.setItem(`${PREFIX}${stamp}`, `old ${stamp}`);
    storage.setItem(ACTIVE, 'not json');
    domain.readStoredState();
    domain.readStoredState(); // a re-render reads again
    await drain();
    let kept = copies();
    expect(kept).toHaveLength(3);
    expect(kept).not.toContain(`${PREFIX}1000000000000`);
    expect(storage.getItem(`${PREFIX}1000000000001`)).toBe('old 1000000000001');
    expect(storage.getItem(kept[2])).toBe('not json');
    // A later session that meets the same blob reuses its copy instead of rotating older ones out.
    vi.resetModules();
    const again = await load();
    again.domain.readStoredState();
    await again.drain();
    expect(copies()).toEqual(kept);
    kept = copies();
    expect(storage.getItem(kept[0])).toBe('old 1000000000001');
  });

  it('refuses to overwrite an unreadable snapshot whose copy could not be kept', async () => {
    storage = memoryStorage(key => key.startsWith(PREFIX));
    vi.stubGlobal('localStorage', storage);
    storage.setItem(ACTIVE, '{broken');
    const { domain, records, drain } = await load();
    expect(domain.readStoredState().status).toBe('unreadable');
    await drain();
    expect(records.unreadableBrowserRecords()).toMatchObject({ copy: 'failed', key: null });
    expect(records.unreadableRecordsMessage(records.unreadableBrowserRecords()!)).toMatch(/could not be kept/);
    const next = domain.initialState();
    next.profile.name = 'Must not land';
    await expect(records.persistBrowserRecords(next)).rejects.toThrow(/could not be opened/);
    expect(storage.getItem(ACTIVE)).toBe('{broken');
    expect(copies()).toEqual([]);
  });

  it('announces the kept copy to subscribers once the copy settles', async () => {
    storage.setItem(ACTIVE, '{broken');
    const { domain, records } = await load();
    const seen: string[] = [];
    const notified = new Promise<void>(resolve => {
      records.onBrowserRecordNotice(() => { seen.push(records.unreadableBrowserRecords()!.copy); resolve(); });
    });
    domain.readStoredState();
    expect(seen).toEqual([]);
    await notified;
    expect(seen).toEqual(['kept']);
  });
});

describe('copies belong to the archive they were taken from', () => {
  const owner = 'https://project.supabase.co:11111111-1111-4111-8111-111111111111';
  const guestCopies = () => copies().filter(key => /^fuel\.prototype\.v1\.corrupt-\d+(-\d+)?$/.test(key));

  it("copies a signed-in account's unreadable snapshot under that account, not as a guest copy", async () => {
    storage.setItem('health.records.owner', owner);
    storage.setItem(`health.account.${encodeURIComponent(owner)}`, '{broken');
    storage.setItem(ACTIVE, '{broken');
    const { domain, records, drain } = await load();
    await records.hydrateBrowserRecords();
    expect(domain.readStoredState().status).toBe('unreadable');
    await drain();
    const kept = copies();
    expect(kept).toHaveLength(1);
    expect(kept[0]).toBe(records.corruptRecordsKey(owner, kept[0].slice(PREFIX.length).split('.')[0]));
    expect(kept[0].endsWith(encodeURIComponent(':11111111-1111-4111-8111-111111111111'))).toBe(true);
    expect(records.corruptRecordsOwner(kept[0])).toBe(owner);
    expect(storage.getItem(kept[0])).toBe('{broken');
    expect(guestCopies()).toEqual([]);
    expect(records.unreadableBrowserRecords()).toMatchObject({ copy: 'kept', key: kept[0] });
  });

  it('bounds and deduplicates copies per archive, so an account never rotates out guest copies', async () => {
    for (const stamp of ['1000000000000', '1000000000001', '1000000000002'])
      storage.setItem(`${PREFIX}${stamp}`, `guest ${stamp}`);
    storage.setItem(`${PREFIX}1000000000003.${encodeURIComponent('https://project.supabase.co:other')}`, 'other account');
    storage.setItem('health.records.owner', owner);
    storage.setItem(ACTIVE, 'not json');
    const { domain, records, drain } = await load();
    domain.readStoredState();
    await drain();
    expect(guestCopies()).toEqual(['1000000000000', '1000000000001', '1000000000002'].map(stamp => `${PREFIX}${stamp}`));
    expect(storage.getItem(`${PREFIX}1000000000003.${encodeURIComponent('https://project.supabase.co:other')}`)).toBe('other account');
    const own = copies().filter(key => records.corruptRecordsOwner(key) === owner);
    expect(own).toHaveLength(1);
    expect(storage.getItem(own[0])).toBe('not json');
    // The same account meeting the same blob again reuses its copy.
    vi.resetModules();
    const again = await load();
    again.domain.readStoredState();
    await again.drain();
    expect(copies().filter(key => again.records.corruptRecordsOwner(key) === owner)).toEqual(own);
  });

  it('reads a guest copy as unowned and ignores keys that are not copies', async () => {
    const { records } = await load();
    expect(records.corruptRecordsKey(null, '1000000000000')).toBe(`${PREFIX}1000000000000`);
    expect(records.corruptRecordsOwner(`${PREFIX}1000000000000`)).toBeNull();
    expect(records.corruptRecordsOwner(`${PREFIX}1000000000000-2`)).toBeNull();
    expect(records.corruptRecordsOwner(records.corruptRecordsKey(owner, '1000000000000-2'))).toBe(owner);
    expect(records.corruptRecordsOwner(ACTIVE)).toBeUndefined();
    expect(records.corruptRecordsOwner(`health.account.${encodeURIComponent(owner)}`)).toBeUndefined();
  });
});
