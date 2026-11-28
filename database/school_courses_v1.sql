-- school_courses_v1
--
-- Courses for every school and every level: one course is a class and subject pair.
-- A teacher groups homework, quizzes and materials into modules (weeks or units),
-- can protect a quiz with an access code that only they see and give to students,
-- and students tick off materials as done. Homework counts as done once submitted.
-- All tables are RLS-enabled with no anon or authenticated privileges: every read
-- and write goes through the school API, which checks the member's role.

create table if not exists public.school_course_modules (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 class_id uuid not null,
 subject_id uuid not null,
 title text not null check (length(btrim(title)) between 2 and 140),
 summary text not null default '' check (length(summary)<=2000),
 position integer not null default 0 check (position between 0 and 10000),
 opens_at timestamptz,
 published boolean not null default true,
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (school_id,id),
 foreign key (school_id,class_id) references public.school_classes(school_id,id) on delete restrict,
 foreign key (school_id,subject_id) references public.school_subjects(school_id,id) on delete restrict
);
create index if not exists school_course_modules_course_idx
 on public.school_course_modules(school_id,class_id,subject_id,position);
alter table public.school_course_modules enable row level security;
revoke all on table public.school_course_modules from public,anon,authenticated;
grant all on table public.school_course_modules to service_role;

-- Homework, quizzes and materials can sit in a module; deleting a module keeps the items.
alter table public.school_homework add column if not exists module_id uuid;
alter table public.school_homework add column if not exists access_code text
 check (access_code is null or length(access_code) between 4 and 40);
alter table public.school_learning_materials add column if not exists module_id uuid;
do $$ begin
 if not exists (select 1 from pg_constraint where conname='school_homework_module_fk') then
  alter table public.school_homework add constraint school_homework_module_fk
   foreign key (school_id,module_id) references public.school_course_modules(school_id,id) on delete set null (module_id);
 end if;
 if not exists (select 1 from pg_constraint where conname='school_learning_materials_module_fk') then
  alter table public.school_learning_materials add constraint school_learning_materials_module_fk
   foreign key (school_id,module_id) references public.school_course_modules(school_id,id) on delete set null (module_id);
 end if;
end $$;
create index if not exists school_homework_module_idx on public.school_homework(school_id,module_id);
create index if not exists school_learning_materials_module_idx on public.school_learning_materials(school_id,module_id);

-- A student marks a material as done (homework is done when it is submitted).
create table if not exists public.school_material_completions (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 material_id uuid not null,
 student_id uuid not null,
 completed_at timestamptz not null default now(),
 primary key (material_id,student_id),
 foreign key (school_id,material_id) references public.school_learning_materials(school_id,id) on delete cascade,
 foreign key (school_id,student_id) references public.school_students(school_id,id) on delete cascade
);
create index if not exists school_material_completions_student_idx
 on public.school_material_completions(school_id,student_id);
alter table public.school_material_completions enable row level security;
revoke all on table public.school_material_completions from public,anon,authenticated;
grant all on table public.school_material_completions to service_role;

-- Register the new tenant tables with the purge manifest (read live, extended, never replaced from memory).
do $$
declare current_list text[]; merged text; want text[]:=array['school_course_modules','school_material_completions'];
begin
 current_list:=public.platform_tenant_scope_manifest();
 if not (want<@current_list) then
  select 'select array['||string_agg(quote_literal(t),',' order by t)||']::text[]' into merged
  from (select distinct t from unnest(current_list||want) as t) u;
  execute 'create or replace function public.platform_tenant_scope_manifest() '||
   'returns text[] language sql immutable security invoker set search_path=pg_catalog,public as '||quote_literal(merged);
 end if;
end $$;
revoke all on function public.platform_tenant_scope_manifest() from public,anon,authenticated;
grant execute on function public.platform_tenant_scope_manifest() to service_role;
