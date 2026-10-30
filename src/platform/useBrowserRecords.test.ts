// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppState } from '../domain';

// Hook-level guards for the device-records boundary. Ledger RECEIPT-JOURNEY-002
// and READINESS-001 rely on functional edits executing synchronously at the
// action boundary and on the mount write never replacing an unreadable blob.

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const ACTIVE = 'fuel.prototype.v1';
const PREFIX = 'fuel.prototype.v1.corrupt-';
const JOURNAL = 'health.pending.guest';

/** localStorage stand-in whose data keys are own enumerable properties, so the
 * production `Object.keys(localStorage)` listing works; methods stay hidden. */
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
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

async function load() {
  const domain = await import('../domain');
  const records = await import('./browser-records');
  const hook = await import('./useBrowserRecords');
  const drain = () => records.browserRecordTransaction(async () => undefined);
  return { domain, records, hook, drain };
}

type Rendered = ReturnType<(typeof import('./useBrowserRecords'))['useBrowserRecords']>;
let roots: Array<{ unmount: () => void }> = [];
/** Mounts the hook the way App does and exposes the latest tuple plus a render count. */
function render(use: () => Rendered) {
  const latest = { current: null as Rendered | null, renders: 0 };
  function Probe() { latest.current = use(); latest.renders++; return null; }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Probe)));
  roots.push(root);
  const tuple = () => { if (!latest.current) throw Error('hook did not render'); return latest.current; };
  return { tuple, renders: () => latest.renders };
}

beforeEach(() => {
  vi.resetModules();
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('indexedDB', undefined);
});
afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  roots = [];
  vi.unstubAllGlobals();
});

describe('useBrowserRecords', () => {
  it('skips the passive mount write for an unreadable snapshot and leaves the blob in place', async () => {
    storage.setItem(ACTIVE, '{broken');
    const { hook, drain } = await load();
    const onError = vi.fn();
    const { tuple } = render(() => hook.useBrowserRecords(onError));
    expect(tuple()[0].meals).toEqual([]);
    await settle();
    await drain();
    expect(storage.getItem(ACTIVE)).toBe('{broken');
    expect(storage.getItem(JOURNAL)).toBeNull();
    const kept = copies();
    expect(kept).toHaveLength(1);
    expect(storage.getItem(kept[0])).toBe('{broken');
    expect(onError).not.toHaveBeenCalled();
  });

  it('gives a fresh device its first durable snapshot on mount', async () => {
    const { hook, drain } = await load();
    const onError = vi.fn();
    const { tuple } = render(() => hook.useBrowserRecords(onError));
    await settle();
    await drain();
    expect(JSON.parse(storage.getItem(ACTIVE)!)).toEqual(JSON.parse(JSON.stringify(tuple()[0])));
    expect(copies()).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it('applies functional updates synchronously and journals them before React renders', async () => {
    const { records, hook, drain } = await load();
    const { tuple, renders } = render(() => hook.useBrowserRecords(() => {}));
    await settle();
    await drain();
    // Block the durable writer: every later save waits behind this transaction.
    void records.browserRecordTransaction(() => new Promise<void>(() => {}));
    const [, setState, current] = tuple();
    const rendersBefore = renders();
    // Two chained updates from one event handler, outside act: the second must
    // see the first, and both must be journaled before any render happens.
    setState(s => ({ ...s, profile: { ...s.profile, name: 'Saved' } }));
    setState(s => ({ ...s, profile: { ...s.profile, name: `${s.profile.name} twice` } }));
    expect(current.current.profile.name).toBe('Saved twice');
    expect(renders()).toBe(rendersBefore);
    expect(JSON.parse(storage.getItem(JOURNAL)!).profile.name).toBe('Saved twice');
    expect(JSON.parse(storage.getItem(ACTIVE)!).profile.name).not.toBe('Saved twice');
    // A refresh right now (new module registry, same storage) opens the journaled edit.
    vi.resetModules();
    const fresh = await load();
    await fresh.records.hydrateBrowserRecords();
    expect(fresh.domain.readState().profile.name).toBe('Saved twice');
    // Subscribers render the accepted state once React runs.
    await settle();
    expect(tuple()[0].profile.name).toBe('Saved twice');
    expect(renders()).toBeGreaterThan(rendersBefore);
  });

  it('ignores an update that returns the current state', async () => {
    const { hook, drain } = await load();
    const { tuple, renders } = render(() => hook.useBrowserRecords(() => {}));
    await settle();
    await drain();
    const [, setState] = tuple();
    const rendersBefore = renders();
    setState(s => s);
    expect(storage.getItem(JOURNAL)).toBeNull();
    await settle();
    expect(renders()).toBe(rendersBefore);
  });

  it('reports a rejected durable write through the latest failure callback and keeps the edit visible', async () => {
    let rejectActive = false;
    storage = memoryStorage(key => rejectActive && key === ACTIVE);
    vi.stubGlobal('localStorage', storage);
    const { hook, drain } = await load();
    const first = vi.fn(), second = vi.fn();
    let onError = first;
    const { tuple } = render(() => hook.useBrowserRecords(onError));
    await settle();
    await drain();
    expect(first).not.toHaveBeenCalled();
    // App passes a fresh callback on every render; the hook must call the latest one.
    onError = second;
    act(() => tuple()[1]((s: AppState) => ({ ...s, profile: { ...s.profile, name: 'Rerender' } })));
    await settle();
    await drain();
    rejectActive = true;
    act(() => tuple()[1]((s: AppState) => ({ ...s, profile: { ...s.profile, name: 'Unsaved edit' } })));
    await settle();
    await drain().catch(() => {});
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(tuple()[0].profile.name).toBe('Unsaved edit');
    expect(JSON.parse(storage.getItem(ACTIVE)!).profile.name).toBe('Rerender');
    // The synchronous journal still holds the edit for the next hydrate.
    expect(JSON.parse(storage.getItem(JOURNAL)!).profile.name).toBe('Unsaved edit');
  });
});
