begin;
-- Snapshot compare-and-swap conflicts are application conflicts, not failed
-- serializable transactions. PostgREST retries SQLSTATE40001; PT409 returns409.
-- Change only the known business-conflict raise in each existing function,
-- preserving every validation/ownership guard, function attribute and ACL.
do $migration$
declare
  target text;
  definition text;
  old_raise constant text := $old$raise exception 'Snapshot changed; load latest' using errcode = '40001';$old$;
  new_raise constant text := $new$raise exception 'Snapshot changed; load latest' using errcode = 'PT409';$new$;
begin
  foreach target in array array['public.fuel_save_snapshot(jsonb,bigint)','public.fuel_delete_snapshot(bigint)'] loop
    definition := pg_get_functiondef(target::regprocedure);
    if (length(definition)-length(replace(definition,old_raise,''))) <> length(old_raise) then
      raise exception 'Snapshot conflict migration precondition failed';
    end if;
    execute replace(definition,old_raise,new_raise);
  end loop;
end;
$migration$;
commit;
