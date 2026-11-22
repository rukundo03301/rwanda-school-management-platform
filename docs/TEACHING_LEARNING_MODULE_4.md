# Module 4 — Teaching, Attendance, Homework and Learning Portals

**Development status:** GitHub branch feature/teaching-learning-v1, stacked on Module 3. Not deployed to live APEX, Vercel or mobile app stores. No real student data has been created.

## School-specific roles

**School Owner / School Administrator:** School Owner or administrators with Academics.Manage may assign approved teachers to existing class/subject combinations and remove assignments with MFA. Teachers are approved local members, not people who merely clicked the Teacher button. Creating a student-portal invitation additionally requires school-family management permission for delegated admins, plus MFA. The school owner retains all local school privileges but cannot see your SaaS platform owner's private tenant fee clock.

**Teacher:** The Teacher Portal at /s/[code]/teacher opens only after membership and class-subject assignments are verified. It shows the teacher's current school classes and a minimum student roster (names and Student IDs), daily Present/Absent/Late/Excused attendance, class-specific lesson plans, published homework and text-submission counts. No guardian contact data, other teachers' classes, grades or platform billing.

**Student:** A student never self-registers into a class. School staff invite an enrolled student to an account tied to that student's own confirmed email. Adults 18+ can claim directly. Minors or unknown birthdate students require an active verified guardian-child link and explicit approval from that guardian. The student portal shows only that student's current-year class, published homework, recorded attendance and their own submitted text responses. Revoking the consenting guardian link blocks minor access on later checks.

**Parent/Guardian:** Parents use their approved family account to open the learning page for one specifically linked child. They can see published homework, recorded attendance and the child's submitted responses, and submit text-only homework on the child's behalf. Parents can approve a pending student portal request for a linked minor and see the proposed student email. Other students' data never appears, even with a guessed student ID.

## New schema and routes

GitHub SQL source: database/school_teaching_v1.sql (fifth migration). Eight private school-scoped tables, all with RLS and revoked direct anon/authenticated grants:
- school_teacher_assignments
- school_lesson_plans
- school_homework
- school_attendance
- school_homework_submissions
- school_student_portal_invitations
- school_student_accounts
- school_teaching_audit

School-scoped composite foreign keys and security-invoker RPCs check verified Auth UUID, active school, role membership and specific class/student relationships on every write. Attendance is one daily record per enrolled student, not one per subject. All teacher assignment, attendance and homework operations record school audit events.

Web routes: /s/[code]/teaching-admin (academic admin), /s/[code]/teacher (teacher), /s/[code]/learning (student), /s/[code]/learning?as=parent&studentId=... (linked guardian), /s/[code]/family (guardian connection and consent).

API routes: /api/school/[code]/teaching, /classroom, /student-access and /learning.

## Limits and release requirements

The interface is an initial school workflow, not a completed full syllabus/timetable, exam, transcript, messaging, fees, or report-card system. Student homework submissions are text-only, no images/files. No child ID-document uploads, health data or biometric information.

Before deployment: pass Node unit/security checks, Next.js production build, all FIVE isolated migrations, and interactive tests with two synthetic schools. Specifically test cross-school teacher/child access, revoked assignments, active/current-year enrollment, attendance date constraints, guardian-child link revocation, verified student invitation and minor consent, homework deadlines and attempted guessed IDs. Check Rwanda child privacy, consent, data-hosting and data-retention obligations.

No real notifications or invitation emails are claimed until actual provider setup and end-to-end verification. No mobile APK/iPhone release. Do not apply any migrations directly in APEX SQL Editor; release only through a single approved GitHub-first deployment path.

**Next module:** school calendar/timetable and exam/report-card features, followed by role-specific communications and RWF school finance. Platform owner's private monthly tenant payments stay entirely separate.
