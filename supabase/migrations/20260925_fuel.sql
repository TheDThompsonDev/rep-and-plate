-- Fuel initial private snapshot storage. Run in the intended Supabase project.
-- No data import, user creation, shared catalog grants, or existing-table deletion.
begin;

create table if not exists public.fuel_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  revision bigint not null check (revision > 0),
  updated_at timestamptz not null default now(),
  constraint fuel_snapshot_object check (jsonb_typeof(state) = 'object' and coalesce(state->>'version' = '1', false)),
  constraint fuel_snapshot_size check (octet_length(state::text) <= 5000000)
);
alter table public.fuel_snapshots enable row level security;
alter table public.fuel_snapshots force row level security;
revoke all on table public.fuel_snapshots from public, anon, authenticated;
grant select, insert, update, delete on table public.fuel_snapshots to authenticated;

-- Revisions never restart after deletion, so a stale device cannot overwrite a new copy.
create sequence if not exists public.fuel_snapshot_revisions;
revoke all on sequence public.fuel_snapshot_revisions from public, anon, authenticated;
grant usage on sequence public.fuel_snapshot_revisions to authenticated;
select setval('public.fuel_snapshot_revisions', greatest(
  (select last_value from public.fuel_snapshot_revisions),
  coalesce((select max(revision) from public.fuel_snapshots), 1)
), true);

drop policy if exists fuel_snapshot_select_own on public.fuel_snapshots;
create policy fuel_snapshot_select_own on public.fuel_snapshots for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists fuel_snapshot_insert_own on public.fuel_snapshots;
create policy fuel_snapshot_insert_own on public.fuel_snapshots for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists fuel_snapshot_update_own on public.fuel_snapshots;
create policy fuel_snapshot_update_own on public.fuel_snapshots for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists fuel_snapshot_delete_own on public.fuel_snapshots;
create policy fuel_snapshot_delete_own on public.fuel_snapshots for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.fuel_save_snapshot(p_state jsonb, p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  saved_revision bigint;
  saved_at timestamptz;
begin
  if current_user_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 9007199254740991 then
    raise exception 'Invalid expected revision' using errcode = '22023';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' or p_state->>'version' is distinct from '1' or octet_length(p_state::text) > 5000000 then
    raise exception 'Invalid snapshot' using errcode = '22023';
  end if;
  if p_expected_revision = 0 then
    insert into public.fuel_snapshots(user_id, state, revision, updated_at)
    values (current_user_id, p_state, nextval('public.fuel_snapshot_revisions'), now())
    on conflict (user_id) do nothing
    returning revision, updated_at into saved_revision, saved_at;
  else
    update public.fuel_snapshots
    set state = p_state, revision = nextval('public.fuel_snapshot_revisions'), updated_at = now()
    where user_id = current_user_id and revision = p_expected_revision
    returning revision, updated_at into saved_revision, saved_at;
  end if;
  if saved_revision is null then raise exception 'Snapshot changed; load latest' using errcode = '40001'; end if;
  return jsonb_build_object('user_id', current_user_id, 'revision', saved_revision, 'updated_at', saved_at);
end;
$$;
revoke all on function public.fuel_save_snapshot(jsonb, bigint) from public, anon;
grant execute on function public.fuel_save_snapshot(jsonb, bigint) to authenticated;

create or replace function public.fuel_delete_snapshot(p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  deleted_user_id uuid;
begin
  if current_user_id is null then raise exception 'Sign in required' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 1 then raise exception 'Invalid expected revision' using errcode = '22023'; end if;
  delete from public.fuel_snapshots where user_id = current_user_id and revision = p_expected_revision returning user_id into deleted_user_id;
  if deleted_user_id is null then raise exception 'Snapshot changed; load latest' using errcode = '40001'; end if;
  return jsonb_build_object('deleted', true);
end;
$$;
revoke all on function public.fuel_delete_snapshot(bigint) from public, anon;
grant execute on function public.fuel_delete_snapshot(bigint) to authenticated;

commit;
