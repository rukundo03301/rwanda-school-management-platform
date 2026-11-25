-- school_learning_materials_v1
--
-- Teaching materials that an assigned teacher adds for one of their own
-- class and subject pairs (a YouTube or other https link). A material is
-- hidden from students until the teacher switches it on. The table is
-- RLS-enabled with no anon or authenticated privileges: every read and write
-- goes through the school API, which checks the signed-in member's role.

create table if not exists public.school_learning_materials (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 teacher_id uuid not null references auth.users(id) on delete restrict,
 title text not null check(length(btrim(title)) between 3 and 160),
 kind text not null check(kind in ('video','link','document')),
 url text not null check(url ~ '^https://[^[:space:]]+$' and length(url)<=500),
 description text not null default '' check(length(description)<=1000),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 foreign key(school_id,teacher_id,class_id,subject_id)
  references public.school_teacher_assignments(school_id,teacher_id,class_id,subject_id)
  on delete restrict
);
create index if not exists school_learning_materials_class_idx
 on public.school_learning_materials(school_id,class_id,published,created_at desc);
create index if not exists school_learning_materials_teacher_idx
 on public.school_learning_materials(school_id,teacher_id,created_at desc);

alter table public.school_learning_materials enable row level security;
revoke all on table public.school_learning_materials from public,anon,authenticated;
grant all on table public.school_learning_materials to service_role;

-- Register the table with the tenant erasure manifest so a school purge still
-- removes it and the drift check does not block purges. The existing list is
-- read from the live function and extended, never replaced from memory.
do $$
declare current_list text[];
        merged text;
begin
 current_list:=public.platform_tenant_scope_manifest();
 if not ('school_learning_materials'=any(current_list)) then
  select 'select array['||string_agg(quote_literal(t),',' order by t)||']::text[]'
  into merged
  from unnest(current_list||array['school_learning_materials']) as t;
  execute 'create or replace function public.platform_tenant_scope_manifest() '||
   'returns text[] language sql immutable security invoker '||
   'set search_path=pg_catalog,public as '||quote_literal(merged);
 end if;
end $$;
revoke all on function public.platform_tenant_scope_manifest() from public,anon,authenticated;
grant execute on function public.platform_tenant_scope_manifest() to service_role;
