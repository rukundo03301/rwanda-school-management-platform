-- Repair: nine school tables created by earlier migrations were never added to the tenant purge
-- manifest, so platform_verify_tenant_scope() raised "Tenant purge blocked" and no demo school could
-- be purged. The manifest is read live and extended, never replaced from memory.
do $$
declare current_list text[]; merged text;
 want text[]:=array['school_assets','school_board_meetings','school_board_members','school_homework_drafts',
  'school_homework_questions','school_maintenance_requests','school_social_links','school_stock_items','school_stock_movements'];
begin
 current_list:=public.platform_tenant_scope_manifest();
 if not (want<@current_list) then
  select 'select array['||string_agg(quote_literal(t),',' order by t)||']::text[]'
  into merged
  from (select distinct t from unnest(current_list||want) as t) u;
  execute 'create or replace function public.platform_tenant_scope_manifest() '||
   'returns text[] language sql immutable security invoker '||
   'set search_path=pg_catalog,public as '||quote_literal(merged);
 end if;
end $$;
revoke all on function public.platform_tenant_scope_manifest() from public,anon,authenticated;
grant execute on function public.platform_tenant_scope_manifest() to service_role;
