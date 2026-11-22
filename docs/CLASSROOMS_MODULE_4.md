# Module 4: Classrooms, Homework and Attendance

**Status:** GitHub development branch only. This module depends on Student Admissions Module 3, School Administration Module 2, School Onboarding Module 1B and Platform Owner Module 1. Not merged or deployed; no live APEX writes.

## School management and teacher access

The School Owner or an administrator with Academics.Manage may assign a VERIFIED school teacher to a class and a subject previously associated with that class. The assignment is school-scoped, independently checked in SQL, and can be revoked with MFA and an audit reason. An unapproved teacher, staff member, parent or student cannot view class rosters by selecting a role at login.

The teacher's institution-branded classroom workspace shows only currently assigned school-year classes, current enrolled students (name and Student ID only), lesson plans, homework and responses to that teacher's assignments. Teachers can create a lesson plan with objectives and lesson date; save a homework draft with due date in Kigali time; explicitly publish to their class; and mark attendance Present, Absent, Late, or Excused for actual enrolled students and valid current school-year dates. Homework responses are text-only, one submission per student/assignment. Grades and report publication are later modules.

## Independent student access

The School Owner can invite a school-enrolled student to a specific student account. The email-specific invitation expires in 14 days and is accepted only by a matching, email-confirmed Supabase Auth account. School approval and the necessary consent are attested; for students under 18 or with unknown age, a verified, active guardian relationship must exist before issuing AND claiming the invitation. This is a conservative product safeguard, not a representation of Rwanda's precise legal age thresholds. Nursery and young children can remain guardian-only without independent accounts.

Students cannot choose their own student records. The school binds each student to one approved school account. The student's learning workspace shows only their own current-year class, subjects, published class homework, own submitted responses, and own attendance. Draft homework, another child's personal record and other-school data are excluded. The School Owner can revoke the independent student account with MFA and an audit reason.

## Strict privacy / authorization

All eight classroom tables have school_id, RLS enabled and browser anonymous/authenticated grants revoked. Only the trusted server reads these tables after verifying Supabase Auth identity and school status. Sensitive mutations use security-invoker PostgreSQL functions callable by the server role only, re-checking active school membership, teacher assignments and student-specific ownership.

Database source: database/school_classrooms_v1.sql.
Backend: app/api/school/[code]/classroom/route.js and app/api/school/[code]/learning/route.js.
UI: app/s/[code]/classroom and app/s/[code]/learning.
Shared role checks: lib/school-classroom.mjs.
Automated checks: tests/school-classrooms.test.mjs.
The GitHub Actions local migration test applies this fifth migration after the preceding four modules.

The platform owner's private monthly RWF payments and global tenant console are never shared with teachers or students. Parents and guardians remain on their own separately verified accounts.

## Before release

1. All Node security/unit tests, production Next.js build and five isolated local migrations must pass.
2. Test two separate schools and teacher/students, wrong-school and wrong-class access, revoked teacher assignments, unpublished homework, duplicate submissions, attendance outside current year and future dates.
3. Test guardian verification, email-confirmed student invitation, age safeguard at claim time, expired/revoked invitations, removal of student access and prevention of account switching.
4. Test user flows end-to-end on mobile and desktop with synthetic data, real test Auth identities and MFA. Static and migration smoke tests alone are not sufficient.
5. Rwanda-specific legal, data protection, parental/guardian consent, retention and access reviews are prerequisites before processing real children's data.
6. Use an approved GitHub-first single deployer; no direct production SQL editor operations or APEX changes in this development stage.
7. No native Android or iPhone app has yet been built. Separate app builds must use the same verified APIs and authorization rules.

## Later functionality

Grades, published report cards, examinations, parent attendance views, full timetables, school tuition, messaging and native mobile release are separate modules, not fabricated placeholders.
