// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { initialState } from '../../domain';

// Owner-switch and account-dialog semantics extracted from App.tsx (audit Q2).
// Ledger PERSONA-PLAN-002: an owner change, restore or reset closes record-bound
// editors and cancels pending capture; a guest who signs in from chat keeps the draft.

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../api-fetch', () => ({ isHostedBrowser: () => false }));

type Hook = ReturnType<(typeof import('./useAccountSession'))['useAccountSession']>;
let roots: Array<{ unmount: () => void }> = [];

async function mount() {
  const { useAccountSession } = await import('./useAccountSession');
  const calls: string[] = [];
  const options = {
    setState: vi.fn((value: unknown) => { calls.push(`setState:${typeof value === 'function' ? 'fn' : 'value'}`); }),
    cancelPendingAI: vi.fn(() => { calls.push('cancelPendingAI'); }),
    clearCaptureDrafts: vi.fn((keep?: boolean) => { calls.push(`clearCaptureDrafts:${keep ?? false}`); }),
    reconnect: vi.fn(() => { calls.push('reconnect'); }),
    openDialog: vi.fn((kind: 'cloud') => { calls.push(`open:${kind}`); }),
    closeDialog: vi.fn((kind: 'cloud') => { calls.push(`close:${kind}`); }),
  };
  const latest = { current: null as Hook | null, renders: 0 };
  function Harness() {
    latest.current = useAccountSession(options);
    latest.renders++;
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Harness)));
  roots.push(root);
  const api = () => { if (!latest.current) throw Error('hook did not render'); return latest.current; };
  return { api, calls, options, renders: () => latest.renders, rerender: () => act(() => root.render(createElement(Harness))) };
}

async function accountChange(owner: string | null) {
  const { invalidateCloudSync } = await import('../cloud/sync-control');
  if (owner === null) localStorage.removeItem('health.records.owner');
  else localStorage.setItem('health.records.owner', owner);
  act(() => { invalidateCloudSync(); });
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});
afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  roots = [];
});

describe('useAccountSession', () => {
  it('resets drafts and cancels pending capture only when the owner actually changes', async () => {
    const { calls } = await mount();
    await accountChange(null);
    expect(calls).toEqual(['reconnect']);
    await accountChange('owner-a');
    expect(calls).toEqual(['reconnect', 'clearCaptureDrafts:false', 'cancelPendingAI', 'reconnect']);
    await accountChange('owner-a');
    expect(calls.slice(4)).toEqual(['reconnect']);
  });

  it('keeps the guest composer draft through the sign-in it asked for, once', async () => {
    const { api, calls } = await mount();
    act(() => api().openChatAccount('signup'));
    expect(api().chatAccountMode).toBe('signup');
    expect(calls).toEqual(['open:cloud']);
    await accountChange('owner-a');
    expect(calls.slice(1)).toEqual(['clearCaptureDrafts:true', 'cancelPendingAI', 'reconnect']);
    // The next switch is an ordinary owner change again.
    await accountChange('owner-b');
    expect(calls.slice(4)).toEqual(['clearCaptureDrafts:false', 'cancelPendingAI', 'reconnect']);
    // Signing out and back in without asking from chat again must not reuse the consumed flag.
    await accountChange(null);
    await accountChange('owner-c');
    expect(calls.slice(7)).toEqual(['clearCaptureDrafts:false', 'cancelPendingAI', 'reconnect', 'clearCaptureDrafts:false', 'cancelPendingAI', 'reconnect']);
  });

  it('does not preserve the draft when the dialog was dismissed or opened for a signed-in owner', async () => {
    const { api, calls } = await mount();
    act(() => api().openChatAccount());
    act(() => api().dismissCloud('closed'));
    expect(api().chatAccountMode).toBeNull();
    expect(calls).toEqual(['open:cloud', 'close:cloud', 'reconnect']);
    await accountChange('owner-a');
    expect(calls.slice(3)).toEqual(['clearCaptureDrafts:false', 'cancelPendingAI', 'reconnect']);

    act(() => api().openChatAccount());
    await accountChange('owner-b');
    expect(calls.slice(7)).toEqual(['clearCaptureDrafts:false', 'cancelPendingAI', 'reconnect']);
  });

  it('frames the dialog for chat or the profile and re-probes when it closes', async () => {
    const { api, calls } = await mount();
    expect(api().profileAccountMode).toBe('signin');
    act(() => api().openProfileAccount('signup'));
    expect(api().profileAccountMode).toBe('signup');
    expect(api().chatAccountMode).toBeNull();
    act(() => api().openChatAccount('signin'));
    expect(api().chatAccountMode).toBe('signin');
    act(() => api().dismissCloud('ready'));
    expect(api().chatAccountMode).toBeNull();
    expect(api().profileAccountMode).toBe('signup');
    expect(calls).toEqual(['open:cloud', 'open:cloud', 'close:cloud', 'reconnect']);
  });

  it('restore and reset cancel capture, clear drafts and replace records in the same order as before', async () => {
    const { api, calls, options } = await mount();
    const restored = initialState();
    act(() => api().restoreRecords(restored));
    expect(calls).toEqual(['cancelPendingAI', 'clearCaptureDrafts:false', 'setState:value']);
    expect(options.setState).toHaveBeenLastCalledWith(restored);
    act(() => api().resetRecords());
    expect(calls.slice(3)).toEqual(['cancelPendingAI', 'setState:value', 'clearCaptureDrafts:false']);
    expect(options.setState.mock.calls[1][0]).toEqual(initialState());
  });

  it('subscribes once: re-renders do not resubscribe or re-probe', async () => {
    const { calls, rerender } = await mount();
    rerender();
    rerender();
    await accountChange('owner-a');
    expect(calls).toEqual(['clearCaptureDrafts:false', 'cancelPendingAI', 'reconnect']);
  });
});
