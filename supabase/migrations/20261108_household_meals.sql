begin;
-- Shared prepared food only. Personal intake, measurements and workouts stay in private account records.
create table if not exists public.rp_households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create table if not exists public.rp_household_members (
  household_id uuid not null references public.rp_households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null default 'Household member' check(length(trim(display_name)) between 1 and 60),
  joined_at timestamptz not null default now(),
  primary key(household_id, user_id)
);
create index if not exists rp_household_members_user on public.rp_household_members(user_id);
create table if not exists public.rp_household_invites (
  code uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.rp_households(id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);
create table if not exists public.rp_household_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.rp_households(id) on delete cascade,
  published_by uuid not null references auth.users(id) on delete cascade,
  source_ref text not null check(length(source_ref) between 1 and 100),
  title text not null check(length(trim(title)) between 1 and 200),
  total_portions numeric not null check(total_portions > 0 and total_portions <= 1000 and round(total_portions,4)=total_portions),
  claimed_portions numeric not null default 0 check(claimed_portions >= 0 and claimed_portions <= total_portions),
  per_portion jsonb not null,
  created_at timestamptz not null default now(),
  unique(published_by, source_ref)
);
create table if not exists public.rp_household_reservations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.rp_households(id) on delete cascade,
  batch_id uuid not null references public.rp_household_batches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  portions numeric not null check(portions > 0 and portions <= 1000 and round(portions,4)=portions),
  request_key text not null check(length(request_key) between 1 and 100),
  status text not null default 'reserved' check(status in ('reserved','logged','released')),
  created_at timestamptz not null default now(),
  unique(user_id,request_key)
);
create index if not exists rp_household_reservations_batch on public.rp_household_reservations(batch_id);

create or replace function public.rp_household_is_member(p_household_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and exists(select 1 from public.rp_household_members
    where household_id=p_household_id and user_id=auth.uid());
$$;
alter table public.rp_households enable row level security;
alter table public.rp_household_members enable row level security;
alter table public.rp_household_invites enable row level security;
alter table public.rp_household_batches enable row level security;
alter table public.rp_household_reservations enable row level security;
drop policy if exists rp_household_read on public.rp_households;
create policy rp_household_read on public.rp_households for select to authenticated using(public.rp_household_is_member(id));
drop policy if exists rp_household_own_membership on public.rp_household_members;
create policy rp_household_own_membership on public.rp_household_members for select to authenticated using(user_id=auth.uid());
drop policy if exists rp_household_batch_read on public.rp_household_batches;
create policy rp_household_batch_read on public.rp_household_batches for select to authenticated using(public.rp_household_is_member(household_id));
drop policy if exists rp_household_own_reservations on public.rp_household_reservations;
create policy rp_household_own_reservations on public.rp_household_reservations for select to authenticated using(user_id=auth.uid());
revoke all on public.rp_households,public.rp_household_members,public.rp_household_invites,public.rp_household_batches,public.rp_household_reservations from anon,authenticated;
grant select on public.rp_households,public.rp_household_members,public.rp_household_batches,public.rp_household_reservations to authenticated;

create or replace function public.rp_household_batch_json(p public.rp_household_batches)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('id',p.id,'householdId',p.household_id,'title',p.title,
    'totalPortions',p.total_portions,'remainingPortions',p.total_portions-p.claimed_portions,
    'perPortion',p.per_portion,'sourceBatchId',case when p.published_by=auth.uid() then p.source_ref else null end);
$$;
create or replace function public.rp_household_reservation_json(p public.rp_household_reservations)
returns jsonb language sql stable set search_path = public, pg_temp as $$
  select jsonb_build_object('id',p.id,'householdId',p.household_id,'batchId',p.batch_id,'portions',p.portions,'status',p.status);
$$;
create or replace function public.rp_household_create(p_name text,p_member_name text default 'Household member')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to share household meals.'; end if;
  if length(trim(p_name)) not between 1 and 80 or p_name is null then raise exception 'Enter a household name with up to 80 characters.'; end if;
  if p_member_name is null or length(trim(p_member_name)) not between 1 and 60 then raise exception 'Enter your household name with up to 60 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':membership',0));
  if (select count(*) from public.rp_household_members where user_id=auth.uid()) >= 10 then raise exception 'You can belong to at most 10 households.'; end if;
  insert into public.rp_households(owner_id,name) values(auth.uid(),trim(p_name)) returning id into v_id;
  insert into public.rp_household_members(household_id,user_id,display_name) values(v_id,auth.uid(),trim(p_member_name));
  return v_id;
end; $$;
create or replace function public.rp_household_invite(p_household_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_code uuid;
begin
  if auth.uid() is null or not exists(select 1 from public.rp_households where id=p_household_id and owner_id=auth.uid()) then raise exception 'Only the household creator can invite members.'; end if;
  perform 1 from public.rp_households where id=p_household_id and owner_id=auth.uid() for no key update;
  if not found then raise exception 'Only the household owner can invite members.'; end if;
  delete from public.rp_household_invites where household_id=p_household_id;
  insert into public.rp_household_invites(household_id) values(p_household_id) returning code into v_code;
  return v_code::text;
end; $$;
create or replace function public.rp_household_join(p_code text,p_member_name text default 'Household member')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare v_household uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to join a household.'; end if;
  if p_member_name is null or length(trim(p_member_name)) not between 1 and 60 then raise exception 'Enter your household name with up to 60 characters.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':membership',0));
  if p_code is null or p_code !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Enter the complete household invitation code.'; end if;
  select household_id into v_household from public.rp_household_invites where code=p_code::uuid and expires_at>now();
  if v_household is null then raise exception 'Invite not found or expired. Ask for a new code.'; end if;
  perform 1 from public.rp_households where id=v_household for no key update;
  if not exists(select 1 from public.rp_household_invites where code=p_code::uuid and household_id=v_household and expires_at>now()) then raise exception 'Invite not found or expired. Ask for a new code.'; end if;
  if not public.rp_household_is_member(v_household) and (select count(*) from public.rp_household_members where household_id=v_household)>=20 then raise exception 'This household already has 20 members.'; end if;
  if not public.rp_household_is_member(v_household) and (select count(*) from public.rp_household_members where user_id=auth.uid())>=10 then raise exception 'You can belong to at most 10 households.'; end if;
  insert into public.rp_household_members(household_id,user_id,display_name) values(v_household,auth.uid(),trim(p_member_name)) on conflict do nothing;
  return v_household;
end; $$;
create or replace function public.rp_household_state()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sign in to view household meals.'; end if;
  return jsonb_build_object(
    'households',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'name',h.name,'isOwner',h.owner_id=auth.uid(),'memberCount',(select count(*) from public.rp_household_members m where m.household_id=h.id),'members',(select jsonb_agg(jsonb_build_object('userId',m.user_id,'name',m.display_name,'isOwner',m.user_id=h.owner_id,'isMe',m.user_id=auth.uid()) order by m.joined_at) from public.rp_household_members m where m.household_id=h.id)) order by h.created_at) from public.rp_households h where public.rp_household_is_member(h.id)),'[]'::jsonb),
    'batches',coalesce((select jsonb_agg(public.rp_household_batch_json(b) order by b.created_at desc) from public.rp_household_batches b where public.rp_household_is_member(b.household_id)),'[]'::jsonb),
    'reservations',coalesce((select jsonb_agg(public.rp_household_reservation_json(r) order by r.created_at desc) from public.rp_household_reservations r where r.user_id=auth.uid()),'[]'::jsonb)
  );
end; $$;
create or replace function public.rp_household_publish(p_household_id uuid,p_source_ref text,p_title text,p_portions numeric,p_per_portion jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_batch public.rp_household_batches; v_key text; v_value numeric;
begin
  if not public.rp_household_is_member(p_household_id) then raise exception 'You are not a member of this household.'; end if;
  perform 1 from public.rp_household_members where household_id=p_household_id and user_id=auth.uid() for key share;
  if not found then raise exception 'You are not a member of this household.'; end if;
  if p_source_ref is null or length(p_source_ref) not between 1 and 100 then raise exception 'Choose a saved prepared batch.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':publish:'||p_source_ref,0));
  select * into v_batch from public.rp_household_batches where published_by=auth.uid() and source_ref=p_source_ref;
  if found then
    if v_batch.household_id<>p_household_id then raise exception 'This prepared batch is already shared with another household.'; end if;
    return public.rp_household_batch_json(v_batch);
  end if;
  if p_title is null or length(trim(p_title)) not between 1 and 200 then raise exception 'Enter a meal name with up to 200 characters.'; end if;
  if p_portions is null or p_portions<=0 or p_portions>1000 or round(p_portions,4)<>p_portions or p_portions::text in ('NaN','Infinity','-Infinity') then raise exception 'Choose a valid available portion amount.'; end if;
  if p_per_portion is null or jsonb_typeof(p_per_portion)<>'object' then raise exception 'This meal needs reviewed nutrition per portion.'; end if;
  foreach v_key in array array['calories','protein','carbs','fat'] loop
    if jsonb_typeof(p_per_portion->v_key) is distinct from 'number' then raise exception 'This meal needs reviewed nutrition per portion.'; end if;
    v_value := (p_per_portion->>v_key)::numeric;
    if v_value<0 or v_value>200000000 then raise exception 'This meal needs valid reviewed nutrition.'; end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text||':batch-limit',0));
  if (select count(*) from public.rp_household_batches where household_id=p_household_id)>=500 then raise exception 'This household has reached its shared batch limit.'; end if;
  insert into public.rp_household_batches(household_id,published_by,source_ref,title,total_portions,per_portion)
    values(p_household_id,auth.uid(),p_source_ref,trim(p_title),p_portions,jsonb_build_object('calories',p_per_portion->'calories','protein',p_per_portion->'protein','carbs',p_per_portion->'carbs','fat',p_per_portion->'fat')) returning * into v_batch;
  return public.rp_household_batch_json(v_batch);
end; $$;
create or replace function public.rp_household_reserve(p_batch_id uuid,p_portions numeric,p_request_key text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_batch public.rp_household_batches; v_reservation public.rp_household_reservations;
begin
  if auth.uid() is null then raise exception 'Sign in to record your portion.'; end if;
  if p_request_key is null or length(p_request_key) not between 1 and 100 then raise exception 'This portion needs a request identifier.'; end if;
  if p_portions is null or p_portions<=0 or p_portions>1000 or round(p_portions,4)<>p_portions or p_portions::text in ('NaN','Infinity','-Infinity') then raise exception 'Choose a valid portion amount.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':reserve:'||p_request_key,0));
  select * into v_reservation from public.rp_household_reservations where user_id=auth.uid() and request_key=p_request_key;
  if found then
    if v_reservation.batch_id<>p_batch_id or v_reservation.portions<>p_portions then raise exception 'This request was already used for a different portion.'; end if;
    return public.rp_household_reservation_json(v_reservation);
  end if;
  select * into v_batch from public.rp_household_batches where id=p_batch_id for update;
  if not found or not public.rp_household_is_member(v_batch.household_id) then raise exception 'This shared meal is not available to your account.'; end if;
  perform 1 from public.rp_household_members where household_id=v_batch.household_id and user_id=auth.uid() for key share;
  if not found then raise exception 'This shared meal is not available to your account.'; end if;
  if v_batch.total_portions-v_batch.claimed_portions<p_portions then raise exception 'Not enough portions remain. Refresh the household meal.'; end if;
  insert into public.rp_household_reservations(household_id,batch_id,user_id,portions,request_key)
    values(v_batch.household_id,v_batch.id,auth.uid(),p_portions,p_request_key) returning * into v_reservation;
  update public.rp_household_batches set claimed_portions=claimed_portions+p_portions where id=v_batch.id;
  return public.rp_household_reservation_json(v_reservation);
end; $$;
create or replace function public.rp_household_mark_logged(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_reservation public.rp_household_reservations;
begin
  select * into v_reservation from public.rp_household_reservations where id=p_reservation_id and user_id=auth.uid() for update;
  if not found then raise exception 'This portion does not belong to your account.'; end if;
  if v_reservation.status='released' then raise exception 'This portion has already been returned.'; end if;
  update public.rp_household_reservations set status='logged' where id=v_reservation.id;
end; $$;
create or replace function public.rp_household_release(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_reservation public.rp_household_reservations;
begin
  -- Serialize in the same batch-then-reservation order as allocation.
  select * into v_reservation from public.rp_household_reservations where id=p_reservation_id and user_id=auth.uid();
  if not found then raise exception 'This portion does not belong to your account.'; end if;
  perform 1 from public.rp_household_batches where id=v_reservation.batch_id for update;
  select * into v_reservation from public.rp_household_reservations where id=p_reservation_id and user_id=auth.uid() for update;
  if v_reservation.status='released' then return; end if;
  update public.rp_household_batches set claimed_portions=claimed_portions-v_reservation.portions where id=v_reservation.batch_id;
  update public.rp_household_reservations set status='released' where id=v_reservation.id;
end; $$;

revoke all on function public.rp_household_is_member(uuid),public.rp_household_batch_json(public.rp_household_batches),public.rp_household_reservation_json(public.rp_household_reservations),public.rp_household_create(text,text),public.rp_household_invite(uuid),public.rp_household_join(text,text),public.rp_household_state(),public.rp_household_publish(uuid,text,text,numeric,jsonb),public.rp_household_reserve(uuid,numeric,text),public.rp_household_mark_logged(uuid),public.rp_household_release(uuid) from public,anon,authenticated;
grant execute on function public.rp_household_is_member(uuid),public.rp_household_create(text,text),public.rp_household_invite(uuid),public.rp_household_join(text,text),public.rp_household_state(),public.rp_household_publish(uuid,text,text,numeric,jsonb),public.rp_household_reserve(uuid,numeric,text),public.rp_household_mark_logged(uuid),public.rp_household_release(uuid) to authenticated;

create or replace function public.rp_household_remove_member(p_household_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid;
begin
  if auth.uid() is null or p_user_id is null then raise exception 'Sign in to manage household membership.'; end if;
  select owner_id into v_owner from public.rp_households where id=p_household_id for no key update;
  if not found or (auth.uid()<>v_owner and auth.uid()<>p_user_id) then raise exception 'Only the household owner can remove another member.'; end if;
  if p_user_id=v_owner then raise exception 'Choose another household owner before leaving.'; end if;
  -- Revoking access never guesses whether reserved food was eaten. The member can
  -- still return their own reservation, and an existing private log can be undone.
  delete from public.rp_household_members where household_id=p_household_id and user_id=p_user_id;
end; $$;
create or replace function public.rp_household_leave(p_household_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Sign in to leave a household.'; end if;
  perform public.rp_household_remove_member(p_household_id,auth.uid());
end; $$;
create or replace function public.rp_household_transfer_ownership(p_household_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_owner uuid;
begin
  if auth.uid() is null or p_user_id is null then raise exception 'Sign in to manage household membership.'; end if;
  select owner_id into v_owner from public.rp_households where id=p_household_id for no key update;
  if not found or v_owner<>auth.uid() then raise exception 'Only the household owner can choose a new owner.'; end if;
  if not exists(select 1 from public.rp_household_members where household_id=p_household_id and user_id=p_user_id) then raise exception 'Choose a current household member.'; end if;
  update public.rp_households set owner_id=p_user_id where id=p_household_id;
end; $$;
revoke all on function public.rp_household_remove_member(uuid,uuid),public.rp_household_leave(uuid),public.rp_household_transfer_ownership(uuid,uuid) from public,anon,authenticated;
grant execute on function public.rp_household_remove_member(uuid,uuid),public.rp_household_leave(uuid),public.rp_household_transfer_ownership(uuid,uuid) to authenticated;

commit;
