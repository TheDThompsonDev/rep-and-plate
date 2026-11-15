-- Private preview: Supabase sign-up is open and /api/cloud/config publishes the project URL and
-- publishable key, so any new account could previously store snapshots, up to 500 MB of record
-- media and household rows. Only approved testers (enabled health_beta_members rows) may now
-- ADD cloud data. Reads and deletes are unchanged, so a removed tester can still see and erase
-- what they stored, and account deletion stays independent of membership.
begin;

create or replace function public.health_beta_member(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null
    and exists(select 1 from public.health_beta_members where user_id=p_user and enabled);
$$;
-- Server-side triggers only: callers can never probe another user's membership.
revoke all on function public.health_beta_member(uuid) from public,anon,authenticated;

-- Snapshots: covers direct table writes and every snapshot RPC, which run as the caller.
create or replace function public.health_guard_snapshot_beta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.health_beta_member(new.user_id) then
    raise exception 'Cloud backup is limited to approved testers' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.health_guard_snapshot_beta() from public,anon,authenticated;
drop trigger if exists health_snapshot_beta_guard on public.fuel_snapshots;
create trigger health_snapshot_beta_guard before insert or update on public.fuel_snapshots
  for each row execute function public.health_guard_snapshot_beta();

-- Storage: captures already required membership in their insert policy; record media did not.
-- Same body as 20260929_sync.sql plus the membership check, applied to both buckets.
create or replace function public.health_guard_media_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare account_id uuid; used_bytes bigint; used_count bigint;
begin
 if new.bucket_id not in ('health-captures','health-record-media') then return new; end if;
 account_id:=split_part(new.name,'/',1)::uuid;
 perform pg_advisory_xact_lock(hashtextextended(account_id::text,72929));
 if not public.health_account_active(account_id) then raise exception 'Account unavailable' using errcode='42501'; end if;
 if not public.health_beta_member(account_id) then raise exception 'Photo storage is limited to approved testers' using errcode='42501'; end if;
 select count(*),coalesce(sum(coalesce((metadata->>'size')::bigint,10000000)),0) into used_count,used_bytes
 from storage.objects where bucket_id=new.bucket_id and split_part(name,'/',1)=account_id::text;
 if (new.bucket_id='health-captures' and used_count>=50) or
    (new.bucket_id='health-record-media' and (used_count>=5000 or used_bytes+coalesce((new.metadata->>'size')::bigint,10000000)>500000000))
 then raise exception 'Photo storage limit reached' using errcode='54000'; end if;
 return new;
end $$;
revoke all on function public.health_guard_media_insert() from public,anon,authenticated;

-- Households: every write goes through SECURITY DEFINER RPCs that read auth.uid(), so guard the
-- inserts at the tables instead of re-declaring each RPC. Service-role writes (no JWT user) pass.
create or replace function public.rp_household_guard_beta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.health_beta_member(auth.uid()) then
    raise exception 'Households are limited to approved testers' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.rp_household_guard_beta() from public,anon,authenticated;
drop trigger if exists rp_households_beta_guard on public.rp_households;
create trigger rp_households_beta_guard before insert on public.rp_households
  for each row execute function public.rp_household_guard_beta();
drop trigger if exists rp_household_members_beta_guard on public.rp_household_members;
create trigger rp_household_members_beta_guard before insert on public.rp_household_members
  for each row execute function public.rp_household_guard_beta();
drop trigger if exists rp_household_invites_beta_guard on public.rp_household_invites;
create trigger rp_household_invites_beta_guard before insert on public.rp_household_invites
  for each row execute function public.rp_household_guard_beta();
drop trigger if exists rp_household_batches_beta_guard on public.rp_household_batches;
create trigger rp_household_batches_beta_guard before insert on public.rp_household_batches
  for each row execute function public.rp_household_guard_beta();
drop trigger if exists rp_household_reservations_beta_guard on public.rp_household_reservations;
create trigger rp_household_reservations_beta_guard before insert on public.rp_household_reservations
  for each row execute function public.rp_household_guard_beta();

commit;
