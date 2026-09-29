begin;
-- Expected identity is checked atomically with the mutation, so an auth change
-- after a client's preflight cannot upload A's records to B or delete B's copy.
create or replace function public.health_save_snapshot(p_user uuid,p_state jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_user then raise exception 'Account changed' using errcode='42501'; end if;
  return public.fuel_save_snapshot(p_state,p_expected_revision);
end $$;
create or replace function public.health_delete_snapshot(p_user uuid,p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from p_user then raise exception 'Account changed' using errcode='42501'; end if;
  return public.fuel_delete_snapshot(p_expected_revision);
end $$;
revoke all on function public.health_save_snapshot(uuid,jsonb,bigint),public.health_delete_snapshot(uuid,bigint) from public,anon;
grant execute on function public.health_save_snapshot(uuid,jsonb,bigint),public.health_delete_snapshot(uuid,bigint) to authenticated;
-- Server-only beta admission, shared across all Vercel instances.
create table if not exists public.health_beta_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true
);
create table if not exists public.health_api_usage (
  owner text not null, day date not null, calls integer not null default 0,
  ai_calls integer not null default 0, primary key(owner, day)
);
create table if not exists public.health_api_leases (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  started_at timestamptz not null default now(), released boolean not null default false
);
create index if not exists health_api_leases_time on public.health_api_leases(started_at);
create table if not exists public.health_chat_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null, input_hash text not null,
  lease uuid not null, expires_at timestamptz not null,
  result jsonb, primary key(user_id, request_id)
);
alter table public.health_beta_members enable row level security;
alter table public.health_api_usage enable row level security;
alter table public.health_api_leases enable row level security;
alter table public.health_chat_requests enable row level security;
revoke all on public.health_beta_members, public.health_api_usage, public.health_api_leases, public.health_chat_requests from public, anon, authenticated;

create or replace function public.health_admit(p_user uuid, p_expensive boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_day date := (now() at time zone 'UTC')::date; v_lease uuid;
begin
  -- Serialize the short admission transaction, including the global cap.
  perform pg_advisory_xact_lock(72928001);
  if not exists(select 1 from public.health_beta_members where user_id=p_user and enabled) then
    return jsonb_build_object('allowed',false,'lease','');
  end if;
  delete from public.health_api_leases where started_at < now() - interval '5 minutes';
  delete from public.health_api_usage where day < v_day - 2;
  delete from public.health_chat_requests where expires_at < now() - interval '1 day';
  if (select count(*) from public.health_api_leases where user_id=p_user and started_at > now()-interval '1 minute') >= 30
    or (select count(*) from public.health_api_leases where user_id=p_user and not released and started_at > now()-interval '4 minutes') >= 2
    or (select count(*) from public.health_api_leases where not released and started_at > now()-interval '4 minutes') >= 10 then
    return jsonb_build_object('allowed',false,'lease','');
  end if;
  insert into public.health_api_usage(owner,day) values(p_user::text,v_day),('global',v_day) on conflict do nothing;
  if exists(select 1 from public.health_api_usage where day=v_day and
    ((owner=p_user::text and (calls>=500 or (p_expensive and ai_calls>=100))) or
     (owner='global' and (calls>=5000 or (p_expensive and ai_calls>=1000))))) then
    return jsonb_build_object('allowed',false,'lease','');
  end if;
  update public.health_api_usage set calls=calls+1,ai_calls=ai_calls+case when p_expensive then 1 else 0 end
    where day=v_day and owner in(p_user::text,'global');
  insert into public.health_api_leases(user_id) values(p_user) returning id into v_lease;
  return jsonb_build_object('allowed',true,'lease',v_lease);
end $$;
create or replace function public.health_release(p_lease uuid)
returns void language sql security definer set search_path = '' as $$
  update public.health_api_leases set released=true where id=p_lease;
$$;
create or replace function public.health_chat_claim(p_user uuid,p_request uuid,p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row public.health_chat_requests; v_lease uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || p_request::text,0));
  select * into v_row from public.health_chat_requests where user_id=p_user and request_id=p_request;
  if found then
    if v_row.input_hash <> p_hash then return jsonb_build_object('status','mismatch'); end if;
    if v_row.result is not null and v_row.expires_at>now() then return jsonb_build_object('status','cached','result',v_row.result); end if;
    if v_row.result is null and v_row.expires_at>now() then return jsonb_build_object('status','busy'); end if;
  end if;
  insert into public.health_chat_requests(user_id,request_id,input_hash,lease,expires_at)
    values(p_user,p_request,p_hash,v_lease,now()+interval '4 minutes')
    on conflict(user_id,request_id) do update set lease=v_lease,expires_at=now()+interval '4 minutes',result=null;
  return jsonb_build_object('status','new','lease',v_lease);
end $$;
create or replace function public.health_chat_finish(p_user uuid,p_request uuid,p_lease uuid,p_result jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.health_chat_requests set result=p_result,expires_at=now()+interval '10 minutes'
    where user_id=p_user and request_id=p_request and lease=p_lease and result is null and expires_at>now();
  return found;
end $$;
create or replace function public.health_chat_fail(p_user uuid,p_request uuid,p_lease uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.health_chat_requests where user_id=p_user and request_id=p_request and lease=p_lease and result is null;
$$;
revoke all on function public.health_admit(uuid,boolean),public.health_release(uuid),public.health_chat_claim(uuid,uuid,text),public.health_chat_finish(uuid,uuid,uuid,jsonb),public.health_chat_fail(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.health_admit(uuid,boolean),public.health_release(uuid),public.health_chat_claim(uuid,uuid,text),public.health_chat_finish(uuid,uuid,uuid,jsonb),public.health_chat_fail(uuid,uuid,uuid) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('health-captures','health-captures',false,6291456,array['image/jpeg','image/png','image/webp','audio/mp4','audio/webm','audio/ogg','audio/wav'])
  on conflict(id) do nothing;
create or replace function public.health_capture_allowed(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and split_part(p_name,'/',1)=auth.uid()::text
    and exists(select 1 from public.health_beta_members where user_id=auth.uid() and enabled)
    and (select count(*) from storage.objects where bucket_id='health-captures' and split_part(name,'/',1)=auth.uid()::text)<50;
$$;
revoke all on function public.health_capture_allowed(text) from public,anon;
grant execute on function public.health_capture_allowed(text) to authenticated;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='health_capture_insert') then
    create policy health_capture_insert on storage.objects for insert to authenticated
      with check(bucket_id='health-captures' and public.health_capture_allowed(name));
    create policy health_capture_select on storage.objects for select to authenticated
      using(bucket_id='health-captures' and (storage.foldername(name))[1]=auth.uid()::text);
    create policy health_capture_delete on storage.objects for delete to authenticated
      using(bucket_id='health-captures' and (storage.foldername(name))[1]=auth.uid()::text);
  end if;
end $$;
commit;
