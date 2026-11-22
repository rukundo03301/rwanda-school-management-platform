# Module 4: Teaching, Attendance and Homework

**Development state:** GitHub branch feature/teaching-attendance-homework-v1, based on Module 3 student admissions. Not merged, not deployed to APEX, no Android/iPhone binary. The earlier owner console, school onboarding, school admin and admissions modules remain stacked dependencies.

## Role-specific workflows

**School Owner / Academic Administrator** visits /s/{schoolCode}/teaching?mode=manage. Authorized academic managers assign only verified, active teacher accounts to a current academic year class and a subject officially offered by that class. Only an owner or administrator with guardians.manage can issue an optional student-account invitation, after an active verified guardian link and offline confirmation of appropriate guardian consent. This action requires MFA. A student's email cannot be the linked guardian's email.

**Teacher** visits /s/{schoolCode}/teaching after school-specific sign-in. Their server-verified teacher membership and active class/subject assignments determine which classes, enrolled students, lessons, homework and submissions they can see. They can publish text lessons, issue homework with due dates, record attendance for current enrolled pupils, and read submitted homework text. Teachers cannot access other schools/classes or create grades in this module.

**Student** visits /s/{schoolCode}/learning. School-issued invitations are matched to a verified student email; there is no open self-registration. An approved student sees only their current class, lesson posts, homework, attendance and own submissions. They may submit or revise text homework before the due date. They do not see other students or teacher-wide class data. Independent student accounts must be school/guardian approved; nursery students do not automatically receive accounts.

**Parent / Guardian** visits /s/{schoolCode}/family and selects an already verified child. The read-only learning link shows only that child's current-year lessons, homework and attendance after the server verifies the exact active guardian-child link. Parents cannot submit as students or view other students' responses.

## Technical implementation

Database source: database/school_learning_v1.sql (fifth migration). Private school-scoped tables: school_teacher_assignments, school_lessons, school_homework, school_attendance, school_student_access_invitations, school_student_accounts, school_homework_submissions, school_learning_audit.

All have Row Level Security enabled; direct anon/authenticated grants are revoked, and only verified server APIs access data. Cross-school keys bind teacher assignment to real class-subject links and attendance to real enrollments. Security-invoker database functions recheck authorization during mutations; audit entries record IDs and action types.

API: GET/POST /api/school/[code]/classroom (teacher mode and academic management mode) and GET/POST /api/school/[code]/learning (student and guardian mode).

UI: /s/[code]/teaching and /s/[code]/learning, connected from role-specific School Portal, private School Administration and Family Portal.

CI: Node unit/security checks, Next.js production build and five migration files applied in order to an isolated local Supabase stack. No remote database deploy commands.

## Deliberate boundaries

This is not a grading, exams, term report, messaging, financial, full curriculum or automated timetabling module. Text-only lessons and homework; no attachments or teacher marks yet. The same student receives one class attendance entry per school day, not one per subject. Homework revision history, attendance corrections/reviewer workflow and larger-school pagination remain future work. No live school email, identity check, guardian consent workflow or age-suitability compliance is verified by a code-only build.

**Before release:** verify real MFA and email configurations; test two isolated synthetic school tenants and separate roles; block wrong-class teacher attendance and wrong-student homework submissions; reject expired invitation and revoked guardian links; test current academic year and school pause status; audit Rwanda child data/privacy/legal consent and data retention; test Android/iOS browsers. Apply all releases through a single GitHub-first migration pipeline after review. No direct APEX SQL edits.

**Next:** school examinations, marking/teacher feedback, publishing grades and school reports, followed by communication and verified school fee views in separate modules.
