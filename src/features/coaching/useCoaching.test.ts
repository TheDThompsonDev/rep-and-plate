// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { initialState, today } from '../../domain';
import { invalidateCloudSync } from '../cloud/sync-control';
import type { ConnectionsPlatform } from '../connections/useConnections';
import { coachingBrief, coachingWeeklyReview, emptyCoachingState } from './model';
import { useCoaching, type CoachingController } from './useCoaching';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); });
const result = (goal: string) => {
  const state = { ...emptyCoachingState(), profile: { primaryGoal: goal, priorities: [], constraints: [], notes: '' } };
  return { state, brief: coachingBrief(state, today()), weekly: coachingWeeklyReview(state, today()), freshness: { mode: 'cloud_snapshot', dataUpdatedAt: null, sourceRevision: null, ageSeconds: null, stale: true } };
};
const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

describe('coaching account lifecycle', () => {
  it('does not invent an evidence update timestamp when reopening saved local records', async () => {
    const published: unknown[] = [];
    const records = initialState();
    const platform: ConnectionsPlatform = { session: async () => ({ identity: 'local-owner', mode: 'local', url: 'http://localhost', active: () => true, request: async input => {
      if (input.operation === 'publish') { published.push(input); return { publishedAt: new Date().toISOString() }; }
      return result('My saved goal');
    } }) };
    let controller!: CoachingController;
    const container = document.createElement('div'); const root = createRoot(container);
    function Harness() { controller = useCoaching(records, platform, false); return null; }
    await act(async () => { root.render(createElement(Harness)); });
    cleanups.push(() => act(() => root.unmount()));
    await act(async () => { await controller.refresh(); });
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ operation: 'publish', dataUpdatedAt: null });
    await act(async () => { await controller.refresh(); });
    expect(published).toHaveLength(1);
  });

  it('rejects a late response after an owner change and clears the old plan immediately', async () => {
    let resolveOld!: (value: unknown) => void;
    let active = true;
    const platform: ConnectionsPlatform = { session: async () => ({ identity: 'old-owner', mode: 'account', url: 'https://example.test', active: () => active, request: () => new Promise(resolve => { resolveOld = resolve; }) }) };
    let controller!: CoachingController;
    const container = document.createElement('div'); document.body.append(container);
    const root = createRoot(container);
    function Harness() { controller = useCoaching(initialState(), platform, false); return null; }
    await act(async () => { root.render(createElement(Harness)); });
    cleanups.push(() => { act(() => root.unmount()); container.remove(); });
    let request!: Promise<void>;
    await act(async () => { request = controller.refresh(); });
    await flush();
    await act(async () => { active = false; invalidateCloudSync(); });
    expect(controller.state).toBeNull();
    await act(async () => { resolveOld(result('Private previous goal')); await request; });
    expect(controller.state).toBeNull();
  });

  it('retains the last confirmed plan on connection failure, without claiming a successful save', async () => {
    let fail = false;
    const platform: ConnectionsPlatform = { session: async () => ({ identity: 'owner', mode: 'account', url: 'https://example.test', active: () => true, request: async () => { if (fail) throw Error('Connection unavailable'); return result('My confirmed goal'); } }) };
    let controller!: CoachingController;
    const container = document.createElement('div'); const root = createRoot(container);
    function Harness() { controller = useCoaching(initialState(), platform, false); return null; }
    await act(async () => { root.render(createElement(Harness)); });
    cleanups.push(() => act(() => root.unmount()));
    await act(async () => { await controller.refresh(); });
    expect(controller.state?.profile.primaryGoal).toBe('My confirmed goal');
    fail = true;
    await act(async () => { await controller.refresh(); });
    expect(controller.state?.profile.primaryGoal).toBe('My confirmed goal');
    expect(controller.error).toBe('Connection unavailable');
    expect(controller.notice).toBe('');
  });
});
