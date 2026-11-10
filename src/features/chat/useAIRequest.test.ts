// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { initialState, type AppState } from '../../domain';
import { STOPPED_CAPTURE_MESSAGE } from '../../ai-client';
import type { AIResult } from '../../ai-contract';
import { resultFixture } from '../../../e2e-shared/ai-fixtures';

// Request lifecycle guards for the hook extracted from App.tsx (audit Q2).
// Ledger CHAT-COMPOSER-001: a stop or reset must reject the late result both
// through the fetch abort and, independently, through the generation counter.

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

vi.mock('../../api-fetch', () => ({
  apiFetch: (path: string, init?: RequestInit) => fetch(path, init),
  isHostedBrowser: () => false,
}));

type ChatCall = {
  request: { requestId: string; text: string };
  aborted: () => boolean;
  progress: (text: string) => void;
  result: (result: AIResult) => void;
  error: (message: string) => void;
};
let statusReply: () => { status: number; json?: unknown };
let statusCalls = 0;
let chats: ChatCall[] = [];
/** When false the fake stream keeps delivering after an abort, so the
 * generation counter is the only thing standing between a late result and the records. */
let honorAbort = true;
const encoder = new TextEncoder();

/** `/api/status` answers from `statusReply`; `/api/chat` hands back an NDJSON
 * stream the test drives by hand, erroring it when the request signal aborts. */
function fakeFetch(path: string, init?: RequestInit) {
  if (path === '/api/status') {
    statusCalls++;
    const reply = statusReply();
    return Promise.resolve({ ok: reply.status < 400, status: reply.status, json: async () => reply.json });
  }
  if (path === '/api/chat') {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
    let open = true;
    const send = (line: object) => { if (open) controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`)); };
    const finish = () => { if (open) { open = false; controller.close(); } };
    init?.signal?.addEventListener('abort', () => {
      if (honorAbort && open) { open = false; controller.error(new DOMException('The operation was aborted.', 'AbortError')); }
    }, { once: true });
    chats.push({
      request: JSON.parse(String(init?.body)),
      aborted: () => init?.signal?.aborted === true,
      progress: text => send({ type: 'progress', text }),
      result: result => { send({ type: 'result', result }); finish(); },
      error: message => { send({ type: 'error', error: message }); finish(); },
    });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}), body });
  }
  return Promise.reject(new Error(`Unexpected fetch ${path}`));
}

const flush = () => act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
const conversation = (requestId: string): AIResult => ({
  ...resultFixture(requestId), decision: 'conversation', receipt: null, meal: null, sources: [], warnings: [],
  reply: 'Noted.',
});

type Hook = ReturnType<(typeof import('./useAIRequest'))['useAIRequest']>;
let roots: Array<{ unmount: () => void }> = [];
async function mount(options: { captureDay?: string | null } = {}) {
  const { useAIRequest } = await import('./useAIRequest');
  const notify = vi.fn();
  const onAccountRequired = vi.fn();
  const latest = { current: null as { state: AppState; api: Hook } | null };
  function Harness() {
    const [state, setState] = useState<AppState>(initialState);
    const api = useAIRequest({ state, setState, captureDay: options.captureDay ?? null, notify, onAccountRequired });
    latest.current = { state, api };
    return null;
  }
  const root = createRoot(document.createElement('div'));
  act(() => root.render(createElement(Harness)));
  roots.push(root);
  const current = () => { if (!latest.current) throw Error('hook did not render'); return latest.current; };
  const api = () => current().api;
  const state = () => current().state;
  const unmount = () => act(() => root.unmount());
  return { api, state, notify, onAccountRequired, unmount };
}

beforeEach(() => {
  vi.resetModules();
  statusReply = () => ({ status: 200, json: { available: true, jev: false, model: 'test' } });
  statusCalls = 0;
  chats = [];
  honorAbort = true;
  vi.stubGlobal('fetch', fakeFetch);
});
afterEach(() => {
  for (const root of roots) act(() => root.unmount());
  roots = [];
  vi.unstubAllGlobals();
});

describe('useAIRequest status probe', () => {
  it('is null while probing, then mirrors /api/status, and re-probes on reconnect', async () => {
    // Each probe hangs until `answer` runs.
    let answer!: (value: unknown) => void;
    vi.stubGlobal('fetch', (path: string, init?: RequestInit) => path === '/api/status'
      ? (statusCalls++, Promise.resolve({ ok: true, status: 200, json: () => new Promise(resolve => { answer = resolve; }) }))
      : fakeFetch(path, init));
    const { api } = await mount();
    await flush();
    expect(api().aiStatus).toBeNull();
    await act(async () => { answer({ available: true, jev: true, model: 'qwen' }); await flush(); });
    expect(api().aiStatus).toEqual({ available: true, jev: true, model: 'qwen', access: undefined });
    expect(statusCalls).toBe(1);

    act(() => api().reconnect());
    expect(api().aiStatus).toBeNull();
    await flush();
    expect(statusCalls).toBe(2);
    await act(async () => { answer({ available: false, jev: false }); await flush(); });
    expect(api().aiStatus).toEqual({ available: false, jev: false, model: undefined, access: undefined });
  });

  it('maps 401 to sign-in access and 403 to restricted', async () => {
    statusReply = () => ({ status: 401 });
    const first = await mount();
    await flush();
    expect(first.api().aiStatus).toEqual({ available: false, jev: false, access: 'signin' });
    first.unmount();

    statusReply = () => ({ status: 403 });
    const second = await mount();
    await flush();
    expect(second.api().aiStatus).toMatchObject({ available: false, access: 'restricted' });
  });
});

describe('useAIRequest send lifecycle', () => {
  it('adds a pending capture, reports stages, applies the result and clears processing', async () => {
    const { api, state } = await mount({ captureDay: '2026-10-09' });
    await flush();
    act(() => { void api().sendAI('Oats with milk'); });
    expect(api().processing).toBe(true);
    expect(api().aiStage).toBe('Connecting to Rep & Plate…');
    expect(api().isBusy()).toBe(true);
    const pending = state().messages.at(-1)!;
    expect(pending).toMatchObject({ role: 'user', text: 'Oats with milk', ai: true, aiStatus: 'pending', captureDay: '2026-10-09' });
    expect(pending.at).toEqual(expect.any(String));
    await flush();
    expect(chats).toHaveLength(1);
    expect(chats[0].request).toMatchObject({ requestId: pending.id, text: 'Oats with milk' });

    await act(async () => { chats[0].progress('Reading your message…'); await flush(); });
    expect(api().aiStage).toBe('Reading your message…');

    await act(async () => { chats[0].result(conversation(pending.id)); await flush(); });
    expect(api().processing).toBe(false);
    expect(api().aiStage).toBe('');
    expect(api().isBusy()).toBe(false);
    expect(state().messages.find(m => m.id === pending.id)?.aiStatus).toBe('complete');
    expect(state().messages.at(-1)).toMatchObject({ role: 'assistant', text: 'Noted.' });
  });

  it('keeps the meal camera intent on the capture and its request', async () => {
    const { api, state } = await mount();
    await flush();
    const photo = 'data:image/jpeg;base64,cGxhdGU=';
    act(() => { void api().sendAI('Estimate this meal from my photo.', photo, undefined, 'meal'); });
    const pending = state().messages.at(-1)!;
    expect(pending).toMatchObject({ role: 'user', image: photo, captureIntent: 'meal' });
    await flush();
    expect(chats[0].request).toMatchObject({ requestId: pending.id, image: photo, captureIntent: 'meal' });
  });

  it('ignores a second send while one is in flight', async () => {
    const { api, state } = await mount();
    await flush();
    act(() => { void api().sendAI('First'); });
    act(() => { void api().sendAI('Second'); });
    await flush();
    expect(chats).toHaveLength(1);
    expect(state().messages.map(m => m.text)).toEqual(['First']);
  });

  it('stop marks the capture as a retryable error and the late result is rejected', async () => {
    honorAbort = false;
    const { api, state } = await mount();
    await flush();
    act(() => { void api().sendAI('Chicken and rice'); });
    await flush();
    const pending = state().messages.at(-1)!;
    act(() => api().stopResponse());
    expect(api().processing).toBe(false);
    expect(chats[0].aborted()).toBe(true);
    expect(state().messages.find(m => m.id === pending.id)).toMatchObject({ aiStatus: 'error', aiError: STOPPED_CAPTURE_MESSAGE });

    // The stream ignores the abort here, so only the generation guard keeps this out of the records.
    await act(async () => { chats[0].result(conversation(pending.id)); await flush(); });
    expect(state().messages.find(m => m.id === pending.id)?.aiStatus).toBe('error');
    expect(state().messages.some(m => m.role === 'assistant')).toBe(false);
  });

  it('cancelPendingAI aborts without touching the capture status', async () => {
    honorAbort = false;
    const { api, state } = await mount();
    await flush();
    act(() => { void api().sendAI('Salmon'); });
    await flush();
    const pending = state().messages.at(-1)!;
    act(() => api().cancelPendingAI());
    expect(api().processing).toBe(false);
    expect(api().aiStage).toBe('');
    expect(api().isBusy()).toBe(false);
    expect(chats[0].aborted()).toBe(true);
    await act(async () => { chats[0].result(conversation(pending.id)); await flush(); });
    expect(state().messages.find(m => m.id === pending.id)?.aiStatus).toBe('pending');
    expect(state().messages).toHaveLength(1);
    expect(api().processing).toBe(false);
  });

  it('records a provider error on the capture and retry sends it again', async () => {
    const { api, state } = await mount();
    await flush();
    act(() => { void api().sendAI('Burrito'); });
    await flush();
    const pending = state().messages.at(-1)!;
    await act(async () => { chats[0].error('Provider busy.'); await flush(); });
    expect(state().messages.find(m => m.id === pending.id)).toMatchObject({ aiStatus: 'error', aiError: 'Provider busy.' });
    expect(api().processing).toBe(false);

    act(() => api().retry(pending.id));
    expect(state().messages.find(m => m.id === pending.id)).toMatchObject({ aiStatus: 'pending', aiError: undefined });
    await flush();
    expect(chats).toHaveLength(2);
    expect(chats[1].request.requestId).toBe(pending.id);
    await act(async () => { chats[1].result(conversation(pending.id)); await flush(); });
    expect(state().messages.find(m => m.id === pending.id)?.aiStatus).toBe('complete');
    expect(state().messages).toHaveLength(2);
  });

  it('keeps offline captures and retries the same request after reconnect without duplication', async () => {
    statusReply = () => ({ status: 200, json: { available: false, jev: false } });
    const { api, state } = await mount();
    await flush();
    const captureId = 'a676fa48-ff37-4c15-a2d5-ec79e810701b';
    await act(async () => { expect(await api().sendAI('Help me choose from this menu', undefined, undefined, undefined, 'menu', captureId)).toBe('saved'); });
    expect(state().messages).toHaveLength(1);
    expect(state().messages[0]).toMatchObject({ id: captureId, capturePurpose: 'menu', aiStatus: 'error' });
    expect(state().meals).toHaveLength(0);
    statusReply = () => ({ status: 200, json: { available: true, jev: false } });
    act(() => api().reconnect());
    await flush();
    act(() => { void api().sendAI('Help me choose from this menu', undefined, undefined, undefined, 'menu', captureId); });
    await flush();
    expect(chats).toHaveLength(1);
    expect(chats[0].request).toMatchObject({ requestId: captureId, capturePurpose: 'menu' });
    await act(async () => { chats[0].result(conversation(captureId)); await flush(); });
    expect(state().messages.filter(m => m.id === captureId)).toHaveLength(1);
    await act(async () => { expect(await api().sendAI('Help me choose from this menu', undefined, undefined, undefined, 'menu', captureId)).toBe('complete'); });
    expect(chats).toHaveLength(1);
  });

  it('routes sign-in and unavailable states before any request is made', async () => {
    statusReply = () => ({ status: 401 });
    const gated = await mount();
    await flush();
    act(() => { void gated.api().sendAI('Hello'); });
    await flush();
    expect(gated.onAccountRequired).toHaveBeenCalledTimes(1);
    expect(gated.state().messages).toHaveLength(0);
    gated.unmount();

    statusReply = () => ({ status: 200, json: { available: false, jev: false } });
    const offline = await mount();
    await flush();
    act(() => { void offline.api().sendAI('Hello'); });
    await flush();
    expect(offline.notify).toHaveBeenCalledWith(
      'Connected chat isn’t available right now. Your capture is saved; reconnect and try again.',
    );
    expect(chats).toHaveLength(0);
    expect(offline.state().messages).toHaveLength(1);
    expect(offline.state().messages[0]).toMatchObject({ text: "Hello", aiStatus: "error" });
  });

  it('shows local processing briefly and aborts an in-flight request on unmount', async () => {
    const { api, unmount } = await mount();
    await flush();
    act(() => api().showLocalProcessing());
    expect(api().processing).toBe(true);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 650)); });
    expect(api().processing).toBe(false);

    act(() => { void api().sendAI('Tea'); });
    await flush();
    expect(chats[0].aborted()).toBe(false);
    unmount();
    expect(chats[0].aborted()).toBe(true);
  });
});
