import type { SupabaseClient } from '@supabase/supabase-js';
import { householdReservationSchema, householdStateSchema, sharedBatchSchema, type HouseholdBatchCandidate } from './contracts';
import { householdPortionsSchema } from './domain';

/** Native supplies its device-account check. No browser storage is imported here. */
export type HouseholdClientAdapter = {
  getClient: () => Promise<SupabaseClient | null>;
  verifyOwner: (client: SupabaseClient) => Promise<{ user: { id: string } }>;
};
export function createHouseholdClient(adapter: HouseholdClientAdapter) {
  async function call(name: string, args: Record<string, unknown> = {}) {
    const client = await adapter.getClient();
    if (!client) throw Error('Sign in to your account to share household meals.');
    const session = await adapter.verifyOwner(client);
    const userId = session.user.id;
    const { data, error } = await client.rpc(name, args);
    const current = await adapter.verifyOwner(client);
    if (current.user.id !== userId) throw Error('Your account changed. Open household meals again.');
    if (error) {
      if (/function .*does not exist|could not find the function|relation .*does not exist/i.test(error.message))
        throw Error('Household sharing is not available on this server yet.');
      const safe = /^(Choose|Enter|Only|You |This |That |Not |The |A |Sign in|Invite|Shared)/.test(error.message);
      throw Error(safe ? error.message : 'Household sharing could not finish. Please try again.');
    }
    return data as unknown;
  }
  return {
    async loadHouseholdState() { return householdStateSchema.parse(await call('rp_household_state')); },
    async createHousehold(name: string, memberName = 'Household member') {
      if (!name.trim() || name.trim().length > 80) throw Error('Enter a household name with up to 80 characters.');
      return call('rp_household_create', { p_name: name.trim(), p_member_name: memberName.trim() || 'Household member' });
    },
    async joinHousehold(code: string, memberName = 'Household member') {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code.trim()))
        throw Error('Enter the complete household invitation code.');
      return call('rp_household_join', { p_code: code.trim(), p_member_name: memberName.trim() || 'Household member' });
    },
    async inviteHouseholdMember(householdId: string) {
      const code = await call('rp_household_invite', { p_household_id: householdId });
      if (typeof code !== 'string') throw Error('The invitation could not be created.');
      return code;
    },
    async publishHouseholdBatch(householdId: string, candidate: HouseholdBatchCandidate) {
      householdPortionsSchema.parse(candidate.remainingPortions);
      return sharedBatchSchema.parse(await call('rp_household_publish', {
        p_household_id: householdId, p_source_ref: candidate.id,
        p_title: candidate.title, p_portions: candidate.remainingPortions, p_per_portion: candidate.perPortion,
      }));
    },
    async reserveHouseholdPortions(batchId: string, portions: number, requestKey: string) {
      householdPortionsSchema.parse(portions);
      return householdReservationSchema.parse(await call('rp_household_reserve', {
        p_batch_id: batchId, p_portions: portions, p_request_key: requestKey,
      }));
    },
    async markHouseholdPortionLogged(reservationId: string) { return call('rp_household_mark_logged', { p_reservation_id: reservationId }); },
    /** Call when undoing the associated private meal; each release restores stock once. */
    async releaseHouseholdPortion(reservationId: string) { return call('rp_household_release', { p_reservation_id: reservationId }); },
    async leaveHousehold(householdId: string) { return call('rp_household_leave', { p_household_id: householdId }); },
    async removeHouseholdMember(householdId: string, memberId: string) { return call('rp_household_remove_member', { p_household_id: householdId, p_user_id: memberId }); },
    async transferHouseholdOwnership(householdId: string, memberId: string) { return call('rp_household_transfer_ownership', { p_household_id: householdId, p_user_id: memberId }); },
  };
}
export type HouseholdClient = ReturnType<typeof createHouseholdClient>;
