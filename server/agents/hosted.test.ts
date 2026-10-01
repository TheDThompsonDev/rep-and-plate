import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { agentAdmission } from './hosted.ts';

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
