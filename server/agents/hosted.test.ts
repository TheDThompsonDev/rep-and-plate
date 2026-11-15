import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { agentAdmission, snapshotContext } from './hosted.ts';
import { initialState } from '../../src/domain.ts';

describe('hosted snapshot context', () => {
  it('ends the food window where the saved snapshot ends, in the account timezone', () => {
    // Live case on 2026-11-14: saved 2026-11-11 17:20 in Chicago, read three days later.
    const context = snapshotContext(initialState(), '2026-11-11T23:20:15.786176+00:00', 'America/Chicago', new Date('2026-11-14T18:00:00Z'));
    expect(context.day).toBe('2026-11-14');
    expect(context.nutrition.recordedThrough).toBe('2026-11-11');
    expect(context.nutrition.days.map(item => item.day)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11']);
  });
  it('uses the account day, not UTC, to decide what the snapshot covers', () => {
    // 03:00 UTC on the 12th is still the 11th in Chicago.
    const context = snapshotContext(initialState(), '2026-11-12T03:00:00Z', 'America/Chicago', new Date('2026-11-12T04:00:00Z'));
    expect(context.day).toBe('2026-11-11');
    expect(context.nutrition.days).toHaveLength(7);
    expect(context.nutrition).not.toHaveProperty('recordedThrough');
  });
  it('falls back to UTC for an unknown timezone and keeps the window for an unreadable save time', () => {
    const now = new Date('2026-11-14T12:00:00Z');
    expect(snapshotContext(initialState(), '2026-11-13T12:00:00Z', 'Not/AZone', now)).toMatchObject({ timezone: 'UTC', day: '2026-11-14', nutrition: { recordedThrough: '2026-11-13' } });
    expect(snapshotContext(initialState(), 'not a date', undefined, now).nutrition.days).toHaveLength(7);
  });
});

describe('hosted agent admission', () => {
  it('uses only the independent agent quota and never requests an app lease', async () => {
    const rpc = vi.fn(async () => ({ data: { allowed: true, lease: '' }, error: null }));
    const admit = agentAdmission({ rpc } as unknown as SupabaseClient);
    expect(await admit('owner')).toEqual({ allowed: true, lease: '' });
    expect(rpc.mock.calls).toEqual([['health_agent_admit', { p_user: 'owner' }]]);
    expect(rpc).not.toHaveBeenCalledWith('health_admit', expect.anything());
  });
  it('preserves quota denial and fails closed if admission cannot be verified', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { allowed: false, lease: '' }, error: null });
    const admit = agentAdmission({ rpc } as unknown as SupabaseClient);
    expect(await admit('owner')).toEqual({ allowed: false, lease: '' });
    rpc.mockResolvedValue({ data: null, error: { message: 'missing migration' } });
    await expect(admit('owner')).rejects.toThrow('AGENT_ADMISSION');
    rpc.mockResolvedValue({ data: { allowed: true, lease: 'unexpected-core-lease' }, error: null });
    await expect(admit('owner')).rejects.toThrow('AGENT_ADMISSION');
  });
});
