-- school_homework_grading_v1
--
-- Lets an assigned teacher grade a homework submission and leave feedback.
-- The grade lives on the submission row, so the student and a verified
-- guardian read the same record the teacher wrote. No new access is granted:
-- the table stays RLS-enabled with no anon or authenticated privileges.

alter table public.school_homework_submissions
  add column if not exists score numeric(6,2),
  add column if not exists max_score numeric(6,2),
  add column if not exists feedback text,
  add column if not exists graded_at timestamptz,
  add column if not exists graded_by uuid;

do $$
begin
  if not exists(select 1 from pg_catalog.pg_constraint where conname='school_homework_submissions_grading_chk') then
    alter table public.school_homework_submissions add constraint school_homework_submissions_grading_chk check (
      ((score is null and max_score is null) or
       (score is not null and max_score is not null and max_score>0 and max_score<=1000 and score>=0 and score<=max_score))
      and (feedback is null or length(feedback)<=2000)
      and ((graded_at is null and graded_by is null) or (graded_at is not null and graded_by is not null))
    );
  end if;
end $$;
