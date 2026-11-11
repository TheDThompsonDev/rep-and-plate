import { getCloudClient, requireBrowserOwner } from '../cloud/client';
import { createHouseholdClient } from './shared-client';

export { createHouseholdClient } from './shared-client';
export type { HouseholdClient, HouseholdClientAdapter } from './shared-client';
const browser = createHouseholdClient({ getClient: getCloudClient, verifyOwner: requireBrowserOwner });
export const loadHouseholdState = browser.loadHouseholdState;
export const createHousehold = browser.createHousehold;
export const joinHousehold = browser.joinHousehold;
export const inviteHouseholdMember = browser.inviteHouseholdMember;
export const publishHouseholdBatch = browser.publishHouseholdBatch;
export const reserveHouseholdPortions = browser.reserveHouseholdPortions;
export const markHouseholdPortionLogged = browser.markHouseholdPortionLogged;
export const releaseHouseholdPortion = browser.releaseHouseholdPortion;
export const leaveHousehold = browser.leaveHousehold;
export const removeHouseholdMember = browser.removeHouseholdMember;
export const transferHouseholdOwnership = browser.transferHouseholdOwnership;
