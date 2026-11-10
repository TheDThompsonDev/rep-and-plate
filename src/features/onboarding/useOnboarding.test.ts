// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useOnboarding, type OnboardingAdapter } from './useOnboarding';
import { defaultFocus } from './model';
import { draftKey, emptyDraft, parseDraft } from './draft';
import { initialState, today, type AppState } from '../../domain';
import { applyFitnessSetup } from '../progress/fitness-goal';
import { applyNutritionSetup } from '../progress/nutrition-setup';

// Hook-level guards for the setup flow. The adapter is injected, so these run
// against an in-memory device; account paths (Supabase) are out of scope here.

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Flow = ReturnType<typeof useOnboarding>;

/** In-memory device: one onboarding record, draft slots, and a write log. */
function fakeAdapter(seed: { record?: object; drafts?: Record<string, object> } = {}) {
  let record: string | null = seed.record ? JSON.stringify(seed.record) : null;
  const drafts = new Map(Object.entries(seed.drafts ?? {}).map(([key, value]) => [key, JSON.stringify(value)]));
  const writes: string[] = [];
  let draftWrites = 0;
  let rejectWrite: (value: string) => boolean = () => false;
  const adapter: OnboardingAdapter = {
    read: async () => record,
    write: async value => {
      writes.push(value);
      if (rejectWrite(value)) throw new DOMException('Fixture marker write rejected', 'QuotaExceededError');
      record = value;
    },
    owner: async () => null,
    client: async () => null,
    verifyOwner: vi.fn(async () => undefined),
    readDraft: async key => drafts.get(key) ?? null,
    writeDraft: async (key, value) => {
      draftWrites++;
      if (value === null) drafts.delete(key);
      else drafts.set(key, value);
    },
  };
  return {
    adapter,
    drafts,
    writes,
    record: () => (record === null ? null : JSON.parse(record)),
    draftWrites: () => draftWrites,
    rejectWrites: (when: (value: string) => boolean) => { rejectWrite = when; },
  };
}

let roots: { unmount: () => void }[] = [];
function render(use: () => Flow) {
  const latest = { current: null as Flow | null, renders: 0 };
  function Probe() { latest.current = use(); latest.renders++; return null; }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Probe)));
  roots.push(root);
  return {
    flow: () => { if (!latest.current) throw Error('hook did not render'); return latest.current; },
    rerender: () => act(() => root.render(createElement(Probe))),
    renders: () => latest.renders,
  };
}
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
async function until(ready: () => boolean, what: string) {
  for (let i = 0; i < 50 && !ready(); i++) await settle();
  if (!ready()) throw Error(`timed out waiting for ${what}`);
}
async function loaded(adapter: OnboardingAdapter, use?: (flow: Flow) => void) {
  const rendered = render(() => { const flow = useOnboarding(adapter); use?.(flow); return flow; });
  expect(rendered.flow().loading).toBe(true);
  await until(() => !rendered.flow().loading, 'the hook to finish loading');
  return rendered;
}
/** The save Onboarding.tsx's `complete()` passes to `finish`: name, goals, weight, details and targets in one state. */
function saveLikeOnboarding(flow: () => Flow, into: { state: AppState | null; recordAtSave: unknown }) {
  return vi.fn(async (normalizedName: string) => {
    const { fitness, nutrition, weightEntry } = flow().draft;
    const base = initialState();
    const named = { ...base, profile: { ...base.profile, name: normalizedName }, spot: { ...base.spot, introSeen: true } };
    const started = fitness ? applyFitnessSetup(named, fitness, today(), weightEntry) : named;
    into.state = nutrition ? applyNutritionSetup(started, nutrition) : started;
  });
}
const fitnessFixture = { kind: 'lose' as const, unit: 'lb' as const, cadence: 'weekly' as const, currentWeight: '180', targetWeight: '165', trainingDays: '', equipment: [], experience: '' as const };
const baselineFixture = { age: 34, heightCm: 170, sex: 'female' as const, activity: 'light' as const, calorieApproach: 'lose' as const };
const targetsFixture = { calories: 1800, protein: 90, carbs: 225, fat: 60 };

afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  roots = [];
});

describe('useOnboarding (guest device)', () => {
  it('walks welcome → tour → account → setup → goals → nutrition → ready and saves everything together on finish', async () => {
    const device = fakeAdapter();
    const { flow } = await loaded(device.adapter);
    expect(flow()).toMatchObject({ step: 'welcome', entered: false, available: false, localMode: false });

    act(() => flow().startTour());
    expect(flow()).toMatchObject({ step: 'intro', slide: 0 });
    act(() => flow().setSlide(4));
    act(() => flow().nextAfterTour());
    expect(flow()).toMatchObject({ step: 'account', mode: 'signup' });
    act(() => flow().tryLocal());
    expect(flow()).toMatchObject({ step: 'setup', localMode: true });

    act(() => flow().patchDraft({ name: 'Dana', focus: 'Movement & workouts' }));
    await act(() => flow().prepare('Dana'));
    expect(flow()).toMatchObject({ step: 'goals', error: '', busy: false });
    await settle();
    // The unfinished setup is journaled where a later visit resumes it.
    expect(parseDraft(device.drafts.get(draftKey(null)) ?? null)).toMatchObject({ step: 'goals', slide: 4, name: 'Dana', focus: 'Movement & workouts', localMode: true });

    act(() => flow().patchDraft({ fitness: fitnessFixture }));
    act(() => flow().setStep('nutrition'));
    act(() => flow().patchDraft({ nutrition: { baseline: baselineFixture, targets: targetsFixture } }));
    act(() => flow().setStep('ready'));

    const saved = { state: null as AppState | null, recordAtSave: undefined as unknown };
    const saveProfile = saveLikeOnboarding(flow, saved);
    saveProfile.mockImplementationOnce(async name => { saved.recordAtSave = device.record(); await saveLikeOnboarding(flow, saved)(name); });
    await act(() => flow().finish(flow().draft.focus, '  Dana  ', saveProfile));

    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(saveProfile).toHaveBeenCalledWith('Dana');
    expect(saved.recordAtSave).toBeNull(); // profile saved before the onboarding record says "done"
    const state = saved.state!;
    expect(state.profile.name).toBe('Dana');
    expect(state.profile.fitnessGoal).toEqual({ kind: 'lose', unit: 'lb', cadence: 'weekly', targetWeight: 165 });
    expect(state.bodyWeights).toEqual([{ id: flow().draft.weightEntry, day: today(), value: 180, unit: 'lb' }]);
    expect(state.profile.nutritionBaseline).toEqual(baselineFixture);
    expect(state.profile).toMatchObject({ ...targetsFixture, targetsConfigured: true });

    expect(device.record()).toEqual({ version: 1, mode: 'guest', focus: 'Movement & workouts', firstLogPending: true });
    expect(flow()).toMatchObject({ entered: true, firstLog: 'Movement & workouts', step: 'welcome', error: '' });
    expect(device.drafts.has(draftKey(null))).toBe(false);

    await act(() => flow().dismissFirstLog());
    expect(flow().firstLog).toBeNull();
    expect(device.record()).toMatchObject({ firstLogPending: false });
  });

  it('takes the quick-start path without collecting goals or changing targets', async () => {
    const device = fakeAdapter();
    const { flow } = await loaded(device.adapter);
    act(() => flow().tryLocal());
    act(() => flow().patchDraft({ name: 'Alex' }));
    await act(() => flow().prepare('Alex', 'ready'));
    expect(flow().step).toBe('ready');
    const saved = { state: null as AppState | null, recordAtSave: undefined };
    await act(() => flow().finish(flow().draft.focus, 'Alex', saveLikeOnboarding(flow, saved)));
    expect(saved.state!.profile.targetsConfigured).toBe(false);
    expect(saved.state!.profile.fitnessGoal).toBeUndefined();
    expect(flow().entered).toBe(true);
    expect(flow().firstLog).toBe(defaultFocus);
  });

  it('completes with goals and targets both skipped, saving only the name', async () => {
    const device = fakeAdapter();
    const { flow } = await loaded(device.adapter);
    act(() => flow().tryLocal());
    act(() => flow().patchDraft({ name: 'Sam' }));
    await act(() => flow().prepare('Sam'));
    // FitnessSetup onSkip, then NutritionSetup onSkip (Onboarding.tsx:501,507).
    act(() => flow().patchDraft({ fitness: null, nutrition: null, nutritionSession: undefined }));
    act(() => flow().setStep('nutrition'));
    act(() => flow().patchDraft({ nutrition: null }));
    act(() => flow().setStep('ready'));
    const saved = { state: null as AppState | null, recordAtSave: undefined };
    await act(() => flow().finish(flow().draft.focus, 'Sam', saveLikeOnboarding(flow, saved)));
    const base = initialState().profile;
    expect(saved.state!.profile).toMatchObject({ name: 'Sam', calories: base.calories, protein: base.protein, targetsConfigured: false });
    expect(saved.state!.profile.fitnessGoal).toBeUndefined();
    expect(saved.state!.profile.nutritionBaseline).toBeUndefined();
    expect(saved.state!.bodyWeights ?? []).toEqual([]);
    expect(device.record()).toEqual({ version: 1, mode: 'guest', focus: defaultFocus, firstLogPending: true });
    expect(flow().entered).toBe(true);
  });

  it('saves nutrition details only, leaving the default targets untouched', async () => {
    const device = fakeAdapter();
    const { flow } = await loaded(device.adapter);
    act(() => flow().tryLocal());
    act(() => flow().patchDraft({ name: 'Ira' }));
    await act(() => flow().prepare('Ira'));
    act(() => flow().patchDraft({ fitness: null }));
    act(() => flow().setStep('nutrition'));
    act(() => flow().patchDraft({ nutrition: { baseline: baselineFixture } }));
    act(() => flow().setStep('ready'));
    const saved = { state: null as AppState | null, recordAtSave: undefined };
    await act(() => flow().finish(flow().draft.focus, 'Ira', saveLikeOnboarding(flow, saved)));
    const base = initialState().profile;
    expect(saved.state!.profile.nutritionBaseline).toEqual(baselineFixture);
    expect(saved.state!.profile).toMatchObject({ calories: base.calories, protein: base.protein, carbs: base.carbs, fat: base.fat, targetsConfigured: false });
    expect(flow().entered).toBe(true);
  });

  it('refuses to finish without a name and writes nothing', async () => {
    const device = fakeAdapter();
    const { flow } = await loaded(device.adapter);
    act(() => flow().tryLocal());
    const saveProfile = vi.fn(async () => {});
    await act(() => flow().finish(defaultFocus, '   ', saveProfile));
    expect(flow().error).toMatch(/Enter the name/);
    expect(saveProfile).not.toHaveBeenCalled();
    expect(device.writes).toEqual([]);
    expect(flow().entered).toBe(false);
  });

  it('resumes an unfinished guest setup from its draft', async () => {
    const device = fakeAdapter({
      drafts: { [draftKey(null)]: { ...emptyDraft('weight-1'), step: 'goals', slide: 3, name: 'Dana', localMode: true } },
    });
    const { flow } = await loaded(device.adapter);
    expect(flow()).toMatchObject({ step: 'goals', slide: 3, localMode: true, entered: false });
    expect(flow().draft).toMatchObject({ name: 'Dana', weightEntry: 'weight-1' });
    expect(flow().notice).toMatch(/Welcome back/);
  });

  it('replays the tour for an entered user without touching the record or the draft', async () => {
    const device = fakeAdapter({ record: { version: 1, mode: 'guest', focus: 'Food & meals', firstLogPending: false } });
    const { flow } = await loaded(device.adapter);
    expect(flow()).toMatchObject({ entered: true, replaying: false, firstLog: null });
    const draftWritesBefore = device.draftWrites();

    act(() => flow().replay());
    expect(flow()).toMatchObject({ entered: true, replaying: true, step: 'intro', slide: 0 });
    act(() => flow().setSlide(2));
    act(() => flow().nextAfterTour());
    expect(flow()).toMatchObject({ entered: true, replaying: false, step: 'welcome' });

    act(() => flow().replay());
    act(() => flow().closeReplay());
    expect(flow()).toMatchObject({ entered: true, replaying: false, step: 'welcome' });
    await settle();
    expect(device.writes).toEqual([]);
    expect(device.draftWrites()).toBe(draftWritesBefore);
    expect(device.record()).toEqual({ version: 1, mode: 'guest', focus: 'Food & meals', firstLogPending: false });
  });

  it('attempts a failing first-prompt marker save once, not on every render', async () => {
    const device = fakeAdapter({ record: { version: 1, mode: 'guest', focus: 'Food & meals', firstLogPending: true } });
    // Reject the marker a few times, then accept: a hook that retried on every
    // render would then stop looping and show the extra attempts instead of hanging.
    device.rejectWrites(value => value.includes('"firstLogPending":false') && device.writes.length <= 3);
    const tracked = true; // the user already logged something (App.tsx:210)
    const { flow, rerender, renders } = await loaded(device.adapter, ({ firstLog, dismissFirstLog }) => {
      useEffect(() => { if (firstLog && tracked) void dismissFirstLog(); }, [firstLog, dismissFirstLog]);
    });
    await until(() => device.writes.length > 0, 'the marker write');
    await settle();
    expect(flow().error).toMatch(/Fixture marker write rejected/);
    expect(flow().firstLog).toBe('Food & meals');

    const before = renders();
    for (let i = 0; i < 5; i++) { rerender(); act(() => flow().setSlide(i)); }
    await settle();
    expect(renders()).toBeGreaterThan(before);
    expect(device.writes).toHaveLength(1);
    expect(device.record()).toMatchObject({ firstLogPending: true });
  });
});
