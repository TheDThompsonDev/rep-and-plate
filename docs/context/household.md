# Household prepared meals

Household sharing uses authenticated Supabase RPCs and an additive migration,
`supabase/migrations/20261108_household_meals.sql`. The migration must be reviewed
and applied to the intended environment before sharing can work there. Merely
shipping the interface does not install the schema. No migration is applied by
opening this feature.

## User flow

1. Create a household or join with an explicit invitation code. The chosen name
   is visible to household members. Owner-created codes replace the previous
   code and expire after seven days.
2. Choose a prepared personal recipe batch. Its remaining portions and reviewed
   per-portion nutrition become an immutable shared batch. The parent app records
   a `householdTransfers` entry, removing these portions from personal leftovers.
   Sharing does not count as intake and does not deduct raw ingredients again.
3. Each member reviews the amount actually eaten. A transaction reserves the
   portion, and the parent app saves that person's private meal, deduplicated by
   `householdReservationId`. The reservation is then marked logged.
4. A failed/unknown save keeps a recoverable reservation. Retrying uses the same
   reservation and never allocates another portion. A saved private meal whose
   acknowledgement failed can be confirmed again without another meal entry.
5. Undoing/removing a private household meal durably removes the private record,
   then releases its reservation through the RPC. A failed release stays visible
   in household meals for a safe retry. Release is idempotent. A personal
   recipe preparation with transferred portions cannot be undone as though the
   food were still available locally.

## Account and data boundaries

- Shared: household name, explicitly supplied member names, selected prepared
  batch title, portion quantities and preparation nutrition snapshot.
- Private: each member's reservations, diary, weight, goals, workouts and other
  account records. A member cannot query another member's reservations.
- Both web and native verify the current account and record owner before and
  after each RPC. A result from an account that changed mid-request is discarded.
- RLS permits selected shared records to members. Only guarded RPCs can write
  household tables. Nutrition snapshots have no update endpoint.
- Reservation allocation locks the batch and validates membership under a row
  lock. Stable user-scoped request keys prevent repeated requests allocating
  portions twice. Releasing a reservation locks the batch before the reservation
  and changes both in one transaction.
- The owner can remove members or transfer ownership. A member can leave after
  transferring ownership if necessary. Removing access never assumes reserved
  food was eaten or uneaten; recorded/reserved portions remain allocated. Former
  members can return their own unlogged portions without retaining shared kitchen
  access. A logged meal must be undone through private Nutrition records.

## Integration contracts

`HouseholdDialog` and native `HouseholdMeals` receive prepared candidates,
`loggedReservationIds`, and an optional display name. `onPublished` records the
transfer idempotently; `onLogMeal` saves privately by reservation ID and returns
true only when that private save succeeds. The UI already presents the explicit
portion review and confirmation. The callback must not silently log a second
record for the same reservation.

`createHouseholdClient` in `shared-client.ts` accepts an account client getter and
owner verifier. The web wrapper uses `getCloudClient` / `requireBrowserOwner`;
native uses `cloudClient` / `requireDeviceOwner`. No browser storage is imported
by the shared factory.

## Verification limits

Pure-domain and mocked-client tests cover fractional snapshot arithmetic,
idempotent transfer bookkeeping, rejected mismatched/released reservations,
material pantry-review matching, account-switch rejection and recoverable server
setup errors. They do not establish live PostgreSQL/RLS behavior.

Before enabling sharing for invited users, exercise the migration with two real
test accounts: create/join, nonmember denial, selected batch sharing, concurrent
attempts for the last portion, duplicate request replay, own-versus-other-user
reservation access, undo replay, account switch, expired invitation, removed
membership and private-save acknowledgement recovery. Verify native and web
against the same account records. No live concurrency or physical-device result
is implied by the implementation.
