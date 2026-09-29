begin;
-- Metadata only. No prompts, replies, error messages, receipts or image paths.
create table if not exists public.health_generation_events (
  id uuid primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  operation text not null check (operation in ('/api/chat','/api/products/label','/api/plans/workout','/api/plans/meals','/api/shopping/prices','/api/voice')),
  provider text not null check (provider in ('qwen','openai','jev')),
  model text not null check (length(model)<=100),
  fallback boolean not null,
  outcome text not null check (outcome in ('success','error','cancelled','timeout')),
  error_code text check (length(error_code)<=100),
  duration_ms bigint not null check(duration_ms>=0),
  input_tokens bigint check(input_tokens>=0),
  cached_input_tokens bigint check(cached_input_tokens>=0),
  output_tokens bigint check(output_tokens>=0),
  input_audio_tokens bigint check(input_audio_tokens>=0),
  audio_seconds numeric check(audio_seconds>=0),
  token_cost_usd numeric check(token_cost_usd>=0)
);
create index if not exists health_generation_events_created on public.health_generation_events(created_at);
create index if not exists health_generation_events_user on public.health_generation_events(user_id,created_at);
alter table public.health_generation_events enable row level security;
revoke all on public.health_generation_events from public,anon,authenticated;
grant select,insert,delete on public.health_generation_events to service_role;

-- Only return old temporary captures in an account-owned UUID path. Never touch
-- persistent health-record-media attachments or delete storage metadata directly.
create or replace function public.health_expired_capture_candidates()
returns table(name text,created_at timestamptz) language sql security definer set search_path='' as $$
  select o.name,o.created_at from storage.objects o
  where o.bucket_id='health-captures' and o.created_at<now()-interval '24 hours'
    and o.name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.(jpg|png|webp|m4a|webm|ogg|wav)$'
  order by o.created_at limit 500;
$$;
create or replace function public.health_prune_operations()
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_chat bigint; v_events bigint; v_leases bigint; v_usage bigint;
begin
  delete from public.health_chat_requests where expires_at<now();
  get diagnostics v_chat=row_count;
  delete from public.health_api_leases where started_at<now()-interval '5 minutes';
  get diagnostics v_leases=row_count;
  delete from public.health_api_usage where day<(now() at time zone 'UTC')::date-2;
  get diagnostics v_usage=row_count;
  delete from public.health_generation_events where created_at<now()-interval '90 days';
  get diagnostics v_events=row_count;
  return jsonb_build_object('chat',v_chat,'leases',v_leases,'usage',v_usage,'events',v_events);
end $$;
revoke all on function public.health_expired_capture_candidates(),public.health_prune_operations() from public,anon,authenticated;
grant execute on function public.health_expired_capture_candidates(),public.health_prune_operations() to service_role;
commit;
