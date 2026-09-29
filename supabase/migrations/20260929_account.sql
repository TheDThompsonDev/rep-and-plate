begin;
-- A retriable deletion stays closed to new writes until Auth deletion succeeds.
create table if not exists public.health_account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.health_account_deletions enable row level security;
revoke all on public.health_account_deletions from public, anon, authenticated;

create or replace function public.health_account_active(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users where id=p_user)
    and not exists(select 1 from public.health_account_deletions where user_id=p_user);
$$;
revoke all on function public.health_account_active(uuid) from public,anon;
grant execute on function public.health_account_active(uuid) to authenticated,service_role;

create or replace function public.health_begin_account_deletion(p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Serialize with beta admission and this account's snapshot writes.
  perform pg_advisory_xact_lock(72928001);
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,72929));
  if not exists(select 1 from auth.users where id=p_user) then raise exception 'Account missing'; end if;
  insert into public.health_account_deletions(user_id) values(p_user) on conflict do nothing;
  update public.health_beta_members set enabled=false where user_id=p_user;
end $$;
revoke all on function public.health_begin_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.health_begin_account_deletion(uuid) to service_role;

create or replace function public.health_save_snapshot(p_user uuid,p_state jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,72929));
  if auth.uid() is null or auth.uid() is distinct from p_user or not public.health_account_active(p_user)
    then raise exception 'Account unavailable' using errcode='42501'; end if;
  return public.fuel_save_snapshot(p_state,p_expected_revision);
end $$;

-- Old direct snapshot RPCs and table writes must respect the same deletion gate.
-- Restrictive policies compose with the existing owner policy, never broaden it.
drop policy if exists health_snapshot_active on public.fuel_snapshots;
create policy health_snapshot_active on public.fuel_snapshots as restrictive
  for all to authenticated using(public.health_account_active(auth.uid()))
  with check(public.health_account_active(auth.uid()));

create or replace function public.health_guard_snapshot_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,72929));
  if not public.health_account_active(new.user_id) then
    raise exception 'Account unavailable' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.health_guard_snapshot_write() from public,anon,authenticated;
drop trigger if exists health_snapshot_write_guard on public.fuel_snapshots;
create trigger health_snapshot_write_guard before insert or update on public.fuel_snapshots
  for each row execute function public.health_guard_snapshot_write();

create or replace function public.health_capture_allowed(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and split_part(p_name,'/',1)=auth.uid()::text
    and public.health_account_active(auth.uid())
    and exists(select 1 from public.health_beta_members where user_id=auth.uid() and enabled)
    and (select count(*) from storage.objects where bucket_id='health-captures' and split_part(name,'/',1)=auth.uid()::text)<50;
$$;

create or replace function public.health_cleanup_deleted_account()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.health_api_usage where owner=old.id::text;
  delete from public.health_api_leases where user_id=old.id;
  return old;
end $$;
revoke all on function public.health_cleanup_deleted_account() from public,anon,authenticated;
drop trigger if exists health_account_cleanup on auth.users;
create trigger health_account_cleanup after delete on auth.users
  for each row execute function public.health_cleanup_deleted_account();
commit;
