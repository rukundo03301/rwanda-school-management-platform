-- school_homework_questions_v1
-- Question-based homework: teacher-authored questions with private answer keys,
-- release scheduling, late policy, student answer drafts, and explicit result release.
-- Additive only. New tables are RLS-enabled with no anon/authenticated access.

alter table public.school_homework
  add column if not exists objectives text check(objectives is null or length(objectives)<=2000),
  add column if not exists release_at timestamptz,
  add column if not exists late_policy text not null default 'accept_flag' check(late_policy in ('accept_flag','reject')),
  add column if not exists results_release text not null default 'manual' check(results_release in ('manual','auto')),
  add column if not exists version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

alter table public.school_homework_submissions
  add column if not exists answers jsonb,
  add column if not exists auto_score numeric(6,2),
  add column if not exists released_at timestamptz;

update public.school_homework_submissions set released_at=graded_at
 where graded_at is not null and released_at is null;

create table if not exists public.school_homework_questions (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 homework_id uuid not null,
 position integer not null check(position between 1 and 100),
 kind text not null check(kind in ('single','multi','truefalse','numeric','short','essay')),
 prompt text not null check(length(btrim(prompt)) between 1 and 2000),
 options jsonb not null default '[]'::jsonb,
 answer_key jsonb,
 marks numeric(6,2) not null check(marks>0 and marks<=100),
 tolerance numeric(10,4) not null default 0 check(tolerance>=0),
 unique(school_id,homework_id,position),
 unique(school_id,id),
 foreign key(school_id,homework_id) references public.school_homework(school_id,id) on delete cascade
);

create table if not exists public.school_homework_drafts (
 school_id uuid not null references public.platform_schools(id) on delete restrict,
 homework_id uuid not null,
 student_id uuid not null,
 answers jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 primary key(school_id,homework_id,student_id),
 foreign key(school_id,homework_id) references public.school_homework(school_id,id) on delete cascade,
 foreign key(school_id,student_id) references public.school_students(school_id,id) on delete restrict
);

-- Legacy text homework keeps its old behaviour: a grade is released at once.
create or replace function public.school_submission_release_legacy()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
 if new.graded_at is not null and new.released_at is null
    and not exists(select 1 from public.school_homework_questions q
      where q.school_id=new.school_id and q.homework_id=new.homework_id)
 then new.released_at:=new.graded_at; end if;
 return new;
end $$;
drop trigger if exists school_submission_release_legacy_trg on public.school_homework_submissions;
create trigger school_submission_release_legacy_trg
 before insert or update on public.school_homework_submissions
 for each row execute function public.school_submission_release_legacy();

alter table public.school_homework_questions enable row level security;
alter table public.school_homework_drafts enable row level security;
revoke all on public.school_homework_questions from public,anon,authenticated;
revoke all on public.school_homework_drafts from public,anon,authenticated;
grant all on public.school_homework_questions to service_role;
grant all on public.school_homework_drafts to service_role;
