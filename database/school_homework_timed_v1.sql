-- school_homework_timed_v1: optional time limit for quizzes and the moment a student starts
alter table public.school_homework add column if not exists time_limit_minutes integer check (time_limit_minutes between 1 and 240);
alter table public.school_homework_drafts add column if not exists started_at timestamptz;
