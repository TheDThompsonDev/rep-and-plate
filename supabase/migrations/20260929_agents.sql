-- Apply after the beta and account migrations. No browser role can access tokens,
-- documents, or this CAS function. The server verifies owner and scoped token.
begin;
create table if not exists public.health_agent_documents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version bigint not null check(version > 0),
  document jsonb not null,
  constraint health_agent_document_bounds check (
    jsonb_typeof(document)='object' and octet_length(document::text)<=5000000
    and jsonb_typeof(document->'connections')='array'
    and jsonb_array_length(document->'connections')<=100
    and jsonb_typeof(document->'actions')='array'
    and jsonb_array_length(document->'actions')<=1000
  )
);
create table if not exists public.health_agent_connection_owners (
  connection_id uuid primary key,
  user_id uuid not null references public.health_agent_documents(user_id) on delete cascade
);
create index if not exists health_agent_owner_idx on public.health_agent_connection_owners(user_id);
alter table public.health_agent_documents enable row level security;
alter table public.health_agent_documents force row level security;
alter table public.health_agent_connection_owners enable row level security;
alter table public.health_agent_connection_owners force row level security;
revoke all on public.health_agent_documents,public.health_agent_connection_owners from public,anon,authenticated;
grant select,insert,update,delete on public.health_agent_documents,public.health_agent_connection_owners to service_role;

-- One bounded counter row per account. Agent polling must never consume the
-- core application's AI quotas or concurrency leases in health_admit.
create table if not exists public.health_agent_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  day date not null,
  day_calls integer not null check(day_calls between 0 and 5000),
  minute timestamptz not null,
  minute_calls integer not null check(minute_calls between 0 and 120)
);
alter table public.health_agent_usage enable row level security;
alter table public.health_agent_usage force row level security;
revoke all on public.health_agent_usage from public,anon,authenticated;
grant select,insert,update,delete on public.health_agent_usage to service_role;

create or replace function public.health_agent_admit(p_user uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_now timestamptz;
  v_day date;
  v_minute timestamptz;
  v_day_calls integer := 0;
  v_minute_calls integer := 0;
begin
  -- The same per-owner lock serializes admission, writes and account deletion.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,72929));
  v_now := clock_timestamp();
  v_day := (v_now at time zone 'UTC')::date;
  v_minute := date_trunc('minute',v_now);
  if not public.health_account_active(p_user)
    or not exists(select 1 from public.health_beta_members where user_id=p_user and enabled) then
    return jsonb_build_object('allowed',false,'lease','');
  end if;
  select case when day=v_day then day_calls else 0 end,
    case when minute=v_minute then minute_calls else 0 end
    into v_day_calls,v_minute_calls from public.health_agent_usage where user_id=p_user for update;
  v_day_calls := coalesce(v_day_calls,0);
  v_minute_calls := coalesce(v_minute_calls,0);
  if v_day_calls>=5000 or v_minute_calls>=120 then
    return jsonb_build_object('allowed',false,'lease','');
  end if;
  insert into public.health_agent_usage(user_id,day,day_calls,minute,minute_calls)
    values(p_user,v_day,v_day_calls+1,v_minute,v_minute_calls+1)
    on conflict(user_id) do update set day=excluded.day,day_calls=excluded.day_calls,
      minute=excluded.minute,minute_calls=excluded.minute_calls;
  return jsonb_build_object('allowed',true,'lease','');
end $$;
revoke all on function public.health_agent_admit(uuid) from public,anon,authenticated;
grant execute on function public.health_agent_admit(uuid) to service_role;

create or replace function public.health_agent_compare_set(p_user uuid,p_version bigint,p_document jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare current_version bigint;
begin
  -- Account deletion takes this same lock, so no later write resurrects its data.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,72929));
  if not public.health_account_active(p_user) then raise exception 'Account unavailable' using errcode='42501'; end if;
  if not exists(select 1 from public.health_beta_members where user_id=p_user and enabled) then
    raise exception 'Access unavailable' using errcode='42501';
  end if;
  if p_version is null or p_version<0 or p_version>=9007199254740991 then raise exception 'Invalid revision'; end if;
  select version into current_version from public.health_agent_documents where user_id=p_user for update;
  if coalesce(current_version,0)<>p_version then return false; end if;
  if p_document is null or jsonb_typeof(p_document)<>'object'
    or jsonb_typeof(p_document->'connections') is distinct from 'array'
    or jsonb_typeof(p_document->'actions') is distinct from 'array'
    or jsonb_array_length(p_document->'connections')>100
    or jsonb_array_length(p_document->'actions')>1000
    or octet_length(p_document::text)>5000000 then raise exception 'Invalid agent document'; end if;
  insert into public.health_agent_documents(user_id,version,document) values(p_user,p_version+1,p_document)
    on conflict(user_id) do update set version=excluded.version,document=excluded.document;
  insert into public.health_agent_connection_owners(connection_id,user_id)
    select (connection->>'id')::uuid,p_user from jsonb_array_elements(p_document->'connections') connection
    on conflict(connection_id) do nothing;
  if exists(select 1 from jsonb_array_elements(p_document->'connections') connection
    join public.health_agent_connection_owners owners on owners.connection_id=(connection->>'id')::uuid
    where owners.user_id<>p_user) then raise exception 'Connection owner conflict'; end if;
  return true;
end $$;
revoke all on function public.health_agent_compare_set(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.health_agent_compare_set(uuid,bigint,jsonb) to service_role;
commit;
