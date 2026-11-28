-- school_material_files_v1
--
-- Study material files (PDF, Word, PowerPoint, images) uploaded by an assigned
-- teacher for one of their own class and subject pairs. Files live in a
-- PRIVATE storage bucket; students and teachers only receive short-lived signed
-- links from the school API after a role and class check. RLS is enabled with no
-- anon or authenticated privileges on the table.

create table if not exists public.school_material_files (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 teacher_id uuid not null references auth.users(id) on delete restrict,
 title text not null check(length(btrim(title)) between 3 and 160),
 description text not null default '' check(length(description)<=1000),
 file_name text not null check(length(file_name) between 1 and 120),
 mime_type text not null,
 size_bytes integer not null check(size_bytes between 1 and 10485760),
 storage_path text not null unique,
 status text not null default 'pending' check(status in ('pending','ready')),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(school_id,id),
 foreign key(school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 foreign key(school_id,teacher_id,class_id,subject_id)
  references public.school_teacher_assignments(school_id,teacher_id,class_id,subject_id)
  on delete restrict
);
create index if not exists school_material_files_class_idx
 on public.school_material_files(school_id,class_id,published,status,created_at desc);
create index if not exists school_material_files_teacher_idx
 on public.school_material_files(school_id,teacher_id,created_at desc);

alter table public.school_material_files enable row level security;
revoke all on table public.school_material_files from public,anon,authenticated;
grant all on table public.school_material_files to service_role;

-- Private bucket: not public, 10 MB limit, only the approved document types.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('school-materials','school-materials',false,10485760,array[
 'application/pdf',
 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
 'image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;

-- Register with the tenant erasure manifest (extends the live list).
do $$
declare current_list text[];
        merged text;
begin
 current_list:=public.platform_tenant_scope_manifest();
 if not ('school_material_files'=any(current_list)) then
  select 'select array['||string_agg(quote_literal(t),',' order by t)||']::text[]'
  into merged
  from unnest(current_list||array['school_material_files']) as t;
  execute 'create or replace function public.platform_tenant_scope_manifest() '||
   'returns text[] language sql immutable security invoker '||
   'set search_path=pg_catalog,public as '||quote_literal(merged);
 end if;
end $$;
revoke all on function public.platform_tenant_scope_manifest() from public,anon,authenticated;
grant execute on function public.platform_tenant_scope_manifest() to service_role;
