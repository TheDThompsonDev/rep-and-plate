// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { initialState } from '../../domain';
import { AccountAccessError } from '../../account-access';
import type { ConnectionSession } from './useConnections';

// A signed-in owner whose device records were never confirmed could open Connections, read a
// sentence telling them to go elsewhere, and find a button that would not press. These tests hold
// the way out in place.

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const session = vi.fn<() => Promise<ConnectionSession>>();
vi.mock('./browser', () => ({ browserConnections: { session: () => session(), foreground: () => true } }));

let root: ReturnType<typeof createRoot> | null = null;
let host: HTMLElement;
const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await Promise.resolve(); }); };

async function open(props: { onClose?: () => void; onAccount?: () => void } = {}) {
  const { default: ConnectionsHub } = await import('./ConnectionsHub');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(createElement(ConnectionsHub, { state: initialState(), onApply: async () => {}, open: true, onClose: props.onClose ?? (() => {}), onAccount: props.onAccount })));
  await settle();
}
const button = (name: string) => [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === name);

beforeEach(() => { session.mockReset(); document.body.innerHTML = ''; });
afterEach(() => { act(() => root?.unmount()); root = null; });

describe('Connections when the account is not ready', () => {
  it('offers the way to confirm device records instead of a dead end', async () => {
    session.mockRejectedValue(new AccountAccessError('setup', 'Open Your account and confirm these device records are yours before using the beta.'));
    const onClose = vi.fn(), onAccount = vi.fn();
    await open({ onClose, onAccount });
    const alert = document.querySelector('[role="alert"]')!;
    expect(alert.textContent).toContain('confirm that the records on this device belong to your account');
    const go = button('Open your account')!;
    expect(go.disabled).toBe(false);
    act(() => go.click());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAccount).toHaveBeenCalledTimes(1);
    // Nothing can be connected yet, and the page says it is not busy.
    expect(button('Connect an assistant')!.disabled).toBe(true);
    expect(document.querySelector('.connections-content')!.getAttribute('aria-busy')).toBe('false');
  });

  it('offers sign-in when there is no session', async () => {
    session.mockRejectedValue(new AccountAccessError('signin', 'Sign in to chat with Spot.'));
    const onAccount = vi.fn();
    await open({ onAccount });
    expect(document.querySelector('[role="alert"]')!.textContent).toContain('Sign in to your Rep & Plate account to connect an assistant.');
    expect(document.body.textContent).not.toContain('chat with Spot');
    act(() => button('Sign in')!.click());
    expect(onAccount).toHaveBeenCalledTimes(1);
  });

  it('still shows other errors as plain text', async () => {
    session.mockRejectedValue(new Error('Connections could not reach your account. Please retry.'));
    await open({ onAccount: vi.fn() });
    expect(document.querySelector('[role="alert"]')!.textContent).toBe('Connections could not reach your account. Please retry.');
    expect(button('Open your account')).toBeUndefined();
  });
});
