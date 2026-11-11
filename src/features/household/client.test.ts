import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHouseholdClient } from './shared-client';

function clientWith(response: unknown) {
  const rpc = vi.fn().mockResolvedValue(response);
  const client = { rpc } as unknown as SupabaseClient;
  const verifyOwner = vi.fn().mockResolvedValue({ user: { id: 'account-a' } });
  return { rpc, verifyOwner, api: createHouseholdClient({ getClient: async () => client, verifyOwner }) };
}
describe('household authenticated client', () => {
  it('requires a linked account before sending any RPC', async () => {
    const verifyOwner = vi.fn();
    const api = createHouseholdClient({ getClient: async () => null, verifyOwner });
    await expect(api.loadHouseholdState()).rejects.toThrow('Sign in');
    expect(verifyOwner).not.toHaveBeenCalled();
  });
  it('validates ownership before and after reading private reservations', async () => {
    const { api, verifyOwner } = clientWith({ data: { households: [], batches: [], reservations: [] }, error: null });
    await expect(api.loadHouseholdState()).resolves.toEqual({ households: [], batches: [], reservations: [] });
    expect(verifyOwner).toHaveBeenCalledTimes(2);
  });
  it('discards a result when the account switches during a request', async () => {
    const { api, verifyOwner } = clientWith({ data: { households: [], batches: [], reservations: [] }, error: null });
    verifyOwner.mockResolvedValueOnce({ user: { id: 'account-a' } }).mockResolvedValueOnce({ user: { id: 'account-b' } });
    await expect(api.loadHouseholdState()).rejects.toThrow('account changed');
  });
  it('makes an unavailable migration a clear recoverable error', async () => {
    const { api } = clientWith({ data: null, error: { message: 'Could not find the function public.rp_household_state' } });
    await expect(api.loadHouseholdState()).rejects.toThrow('not available on this server yet');
  });
  it('does not send an invalid portion to the server', async () => {
    const { api, rpc } = clientWith({ data: null, error: null });
    await expect(api.reserveHouseholdPortions('batch', 0, 'request')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('preserves a duplicate request key so the server can return the same reservation', async () => {
    const reservation = { id: '11111111-1111-4111-8111-111111111111', householdId: '22222222-2222-4222-8222-222222222222', batchId: '33333333-3333-4333-8333-333333333333', portions: 0.5, status: 'reserved' };
    const { api, rpc } = clientWith({ data: reservation, error: null });
    await api.reserveHouseholdPortions(reservation.batchId, 0.5, 'stable-request');
    await api.reserveHouseholdPortions(reservation.batchId, 0.5, 'stable-request');
    expect(rpc).toHaveBeenLastCalledWith('rp_household_reserve', { p_batch_id: reservation.batchId, p_portions: 0.5, p_request_key: 'stable-request' });
  });
});
