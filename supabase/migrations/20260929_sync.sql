begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('health-record-media','health-record-media',false,10000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists health_record_media_read on storage.objects;
create policy health_record_media_read on storage.objects for select to authenticated
using(bucket_id='health-record-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists health_record_media_insert on storage.objects;
create policy health_record_media_insert on storage.objects for insert to authenticated
with check(bucket_id='health-record-media' and (storage.foldername(name))[1]=(select auth.uid())::text
 and name ~ '^[a-f0-9-]+/[a-f0-9]{64}\.(jpg|png|webp)$'
 and public.health_account_active((select auth.uid())));
-- Persistent media is immutable. Full account deletion removes it through the
-- authenticated server workflow; temporary-capture cleanup never touches it.
create or replace function public.health_guard_media_insert()
returns trigger language plpgsql security definer set search_path='' as $$
declare account_id uuid; used_bytes bigint; used_count bigint;
begin
 if new.bucket_id not in ('health-captures','health-record-media') then return new; end if;
 account_id:=split_part(new.name,'/',1)::uuid;
 perform pg_advisory_xact_lock(hashtextextended(account_id::text,72929));
 if not public.health_account_active(account_id) then raise exception 'Account unavailable' using errcode='42501'; end if;
 select count(*),coalesce(sum(coalesce((metadata->>'size')::bigint,10000000)),0) into used_count,used_bytes
 from storage.objects where bucket_id=new.bucket_id and split_part(name,'/',1)=account_id::text;
 if (new.bucket_id='health-captures' and used_count>=50) or
    (new.bucket_id='health-record-media' and (used_count>=5000 or used_bytes+coalesce((new.metadata->>'size')::bigint,10000000)>500000000))
 then raise exception 'Photo storage limit reached' using errcode='54000'; end if;
 return new;
end $$;
revoke all on function public.health_guard_media_insert() from public,anon,authenticated;
drop trigger if exists health_media_insert_guard on storage.objects;
create trigger health_media_insert_guard before insert on storage.objects for each row execute function public.health_guard_media_insert();
commit;
