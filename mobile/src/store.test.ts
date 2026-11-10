// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Component,
  act,
  createElement,
  useEffect,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { initialState, type AppState } from "../../src/domain";
import { PROCESSING_DRAFT_NOTICE, applyAIResult } from "../../src/ai-client";
import { invalidateCloudSync } from "../../src/features/cloud/sync-control";
import { resultFixture } from "../../tests/ai-fixtures";
// vi.mock calls are hoisted above this import by Vitest; the factories below
// replace the modules before the store is evaluated.
import { HealthProvider, useHealth, useLoadedHealth } from "./store";

// Store-level guards for the native readiness gate (ledger READINESS-001) and
// the chat request lifecycle. Device, auth and network modules are replaced
// with factories: the real `react-native` entry is Flow and cannot be parsed.

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const device = vi.hoisted(() => {
  const loads: Deferred<unknown>[] = [];
  return {
    owner: null as string | null,
    loads,
    loadDevice: vi.fn((): Promise<unknown> => {
      let resolve!: (value: unknown) => void, reject!: (reason: unknown) => void;
      const promise = new Promise<unknown>((res, rej) => { resolve = res; reject = rej; });
      loads.push({ promise, resolve, reject });
      return promise;
    }),
    saveDevice: vi.fn(async (_state: unknown): Promise<void> => undefined),
    chat: vi.fn((..._args: unknown[]): unknown => undefined),
  };
});
vi.mock("react-native", () => ({
  AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) },
  Platform: { OS: "web" },
}));
vi.mock("./storage", () => ({
  loadDevice: () => device.loadDevice(),
  saveDevice: (state: unknown) => device.saveDevice(state),
  spotVisit: { get: async () => null, touch: async () => undefined },
  deviceOwnership: { get: async () => device.owner, set: async () => undefined },
}));
vi.mock("./auth", () => ({ sessionSignal: () => new AbortController().signal }));
vi.mock("./api", () => ({
  chat: (...args: unknown[]) => device.chat(...args),
  loadConnection: async () => null,
}));

type Store = ReturnType<typeof useHealth>;
class Boundary extends Component<{ children?: ReactNode; onError: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}
let roots: { unmount: () => void }[] = [];
/** Mounts HealthProvider with a probe beneath it, the way mobile/App.tsx consumes the store. */
function mount(extra: ReactNode[] = []) {
  const latest = { current: null as Store | null };
  function Probe() { latest.current = useHealth(); return null; }
  const root = createRoot(document.createElement("div"), { onCaughtError: () => {} });
  act(() => root.render(createElement(HealthProvider, null, createElement(Probe), ...extra)));
  roots.push(root);
  return () => { if (!latest.current) throw Error("store did not render"); return latest.current; };
}
const settle = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
function named(name: string): AppState {
  const state = initialState();
  state.profile.name = name;
  return state;
}

beforeEach(() => {
  device.owner = null;
  device.loads.length = 0; // the hoisted loadDevice holds this same array
  device.loadDevice.mockClear();
  device.saveDevice.mockClear();
  device.chat.mockReset();
});
afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  roots = [];
});

describe("HealthProvider", () => {
  it("useLoadedHealth throws above the readiness gate and returns typed records beneath it", async () => {
    const caught: Error[] = [];
    const seen: string[] = [];
    function Above() { useLoadedHealth(); return null; }
    function Below() {
      const h = useLoadedHealth();
      useEffect(() => { seen.push(h.state.profile.name); }, [h.state.profile.name]);
      return null;
    }
    function Gate() { const h = useHealth(); return h.state ? createElement(Below) : null; }
    const store = mount([
      createElement(Boundary, { onError: error => { caught.push(error); } }, createElement(Above)),
      createElement(Gate),
    ]);
    expect(store().state).toBeNull();
    expect(caught.map(error => error.message)).toEqual([
      expect.stringMatching(/records are not loaded yet.*beneath the readiness gate/),
    ]);
    expect(seen).toEqual([]);
    await settle();
    device.loads[0].resolve(named("Loaded"));
    await settle();
    expect(store().recordsReady).toBe(true);
    expect(store().state?.profile.name).toBe("Loaded");
    expect(seen).toEqual(["Loaded"]);
  });

  it("an owner switch during a slow load rejects the previous owner's records", async () => {
    device.owner = "acct:A";
    const store = mount();
    await settle();
    expect(device.loadDevice).toHaveBeenCalledTimes(1);
    // The account changes before A's records arrive.
    device.owner = "acct:B";
    act(() => invalidateCloudSync());
    await settle();
    expect(device.loadDevice).toHaveBeenCalledTimes(2);
    device.loads[0].resolve(named("Stale A"));
    await settle();
    expect(store().state).toBeNull();
    expect(store().recordsReady).toBe(false);
    expect(store().change(s => ({ ...s, profile: { ...s.profile, name: "Edit" } }))).toBe(false);
    expect(device.saveDevice).not.toHaveBeenCalled();
    device.loads[1].resolve(named("B"));
    await settle();
    expect(store().state?.profile.name).toBe("B");
    expect(store().recordsReady).toBe(true);
    expect(store().change(s => ({ ...s, profile: { ...s.profile, name: "B edited" } }))).toBe(true);
    expect(device.saveDevice).toHaveBeenCalledTimes(1);
    expect((device.saveDevice.mock.calls[0][0] as AppState).profile.name).toBe("B edited");
  });

  it("send holds a second message while a reply is in flight and applies the reply once", async () => {
    const store = mount();
    await settle();
    device.loads[0].resolve(initialState());
    await settle();
    const reply = deferred<unknown>();
    device.chat.mockReturnValue(reply.promise);

    let first: ReturnType<ReturnType<typeof store>["send"]>;
    act(() => { first = store().send("Oats and milk for breakfast"); });
    await settle();
    expect(store().busy).toBe(true);
    expect(device.chat).toHaveBeenCalledTimes(1);
    const pending = store().state!.messages.filter(m => m.role === "user");
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ text: "Oats and milk for breakfast", aiStatus: "pending" });

    // A message typed during the reply is held in the composer, not sent or dropped.
    act(() => { void store().send("a second message while busy"); });
    await settle();
    expect(device.chat).toHaveBeenCalledTimes(1);
    expect(store().state!.messages.filter(m => m.role === "user")).toHaveLength(1);
    expect(store().draft).toBe("a second message while busy");
    expect(store().notice).toBe(PROCESSING_DRAFT_NOTICE);
    expect(store().busy).toBe(true);

    const result = resultFixture(pending[0].id);
    reply.resolve(result);
    await act(() => first);
    await settle();
    expect(store().busy).toBe(false);
    expect(store().progress).toBe("");
    const answers = () => store().state!.messages.filter(m => m.role === "assistant" && m.requestId === pending[0].id);
    expect(answers()).toHaveLength(1);
    expect(store().state!.messages.find(m => m.id === pending[0].id)?.aiStatus).toBe("complete");
    expect(store().state!.groceries).toHaveLength(1);

    // A replayed result for the same request adds nothing.
    act(() => { store().change(s => applyAIResult(s, result)); });
    expect(answers()).toHaveLength(1);
    expect(store().state!.groceries).toHaveLength(1);

    // The store is free for the next message.
    device.chat.mockReturnValue(new Promise(() => {}));
    act(() => { void store().send("next"); });
    await settle();
    expect(device.chat).toHaveBeenCalledTimes(2);
    expect(store().busy).toBe(true);
  });

  it("send stamps the user message with an ISO instant for day dividers", async () => {
    const store = mount();
    await settle();
    device.loads[0].resolve(initialState());
    await settle();
    device.chat.mockReturnValue(new Promise(() => {}));
    act(() => { void store().send("Stamped question"); });
    await settle();
    const sent = store().state!.messages.find(m => m.role === "user" && m.text === "Stamped question")!;
    expect(sent.at).toEqual(expect.any(String));
    expect(new Date(sent.at!).toISOString()).toBe(sent.at);
  });
});
