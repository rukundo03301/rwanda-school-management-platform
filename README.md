# Rwanda School Management Platform

Cloud-based, multi-tenant school management platform for Rwanda. Intended for nursery, primary, secondary, TVET and universities. Each institution has its own official branding, school-specific homepage, roles and tenant-owned records. **All school finance amounts and private owner payment tracking use Rwandan francs (RWF).**

## Development status

**First implemented slice: Platform Owner Control Center** (feature branch \`feature/platform-owner-console-v1\`). This is code under development, not a released or deployed service. The owner console lets authorized platform operators:

- View tenants and auto-generated Company/School IDs, create new tenant applications, pause/reactivate/suspend/archive/request deletion.
- Set each school's private monthly RWF fee and first due date; manually mark payments received, restart a one-month countdown, and see upcoming/overdue schools.
- View/create/assign/resolve platform support tickets.
- Approve verified platform staff access requests, assign granular permissions and revoke access.
- Keep internal payment channel labels; no payment checkout, automatic invoicing, or automatic charges to school tenants.
- Review audit history; sensitive actions require MFA.
- Create each school's separate logo/hero-image homepage and approved announcements, without showing any private billing to the school.
- Run an optional, private GitHub Actions daily email digest of overdue and upcoming school fees (Brevo credentials and activation required).

The console login supports email/password and a configurable Google OAuth provider, plus password recovery and MFA. Staff permissions are editable through a table of ON/OFF switches. The app uses Next.js, Supabase Auth and server-side protected API routes. All protected data access is through verified server-side identity and least-privilege staff permissions. Existing schools' student/student-fee data is NOT being accessed by platform support.

**No Supabase tables were created directly.** The SQL is currently source-controlled in \`database/platform_owner_console.sql\`. Before deployment, it must become a Supabase CLI-generated migration and pass local security tests. Native GitHub-to-Supabase deployment must be verified first.

## Development locally

Node 22+ recommended. Install dependencies, copy \`.env.example\` to \`.env.local\`, supply only your environment's credentials, run:

\`\`\`bash
npm install
npm test
npm run dev
\`\`\`

Open \`http://localhost:3000/platform\`. Production builds: \`npm run build\`. A dependency lockfile should be committed before production; current CI uses \`npm install\` on this development branch.

### Environment variables (do not commit secrets)

- \`NEXT_PUBLIC_SUPABASE_URL\`: verified Supabase project API URL
- \`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\`: Supabase frontend publishable key
- \`SUPABASE_SECRET_KEY\`: Supabase secret/service-role key, **server only**
- \`PLATFORM_OWNER_USER_ID\`: immutable UUID of the confirmed Supabase Auth account designated as platform owner

The verified owner's immutable Auth UUID bootstraps platform ownership. Other users must request access and be approved by the owner; selecting a role does not grant permissions.

### Supabase GitHub-first migration workflow

Use the official Supabase CLI: \`supabase migration new platform_owner_console\`. Copy the versioned GitHub SQL source into its generated migration. Test migration and RLS locally/isolated, review PR, then merge using exactly **one** verified migration deployer (native Supabase GitHub integration or GitHub Actions, not both). **Never create/edit tables directly in the Supabase dashboard.**

Project currently designated: APEX (\`stgqhkhfpnqmsiyrvvhe\`). This existing project name does not affect school/company IDs.

See [Release Readiness](docs/OWNER_CONSOLE_RELEASE_READINESS.md) for the full test and release gates.

## Owner-only monthly payment reminders

Read [Private Monthly Payments and Email Reminders](docs/PRIVATE_MONTHLY_PAYMENTS_AND_REMINDERS.md). The system never sends payment alerts to the schools. The operator manually records monthly receipts; the database computes the following month's date and the email job lists due-soon/overdue schools. A Brevo verified sender, API key, GitHub Actions secrets, and an explicit enable flag are required before any email can be sent.

## Product specifications

- [Owner login, Google, password recovery and staff access](docs/OWNER_AUTH_AND_ACCESS_CONTROLS.md)
- [Product and module flow](docs/PRODUCT_FLOW_AND_MODULE_PLAN.md)
- [School onboarding and unique branding](docs/MODULE_01_SCHOOL_ONBOARDING_UX_SPEC.md)
- [Tenant owner, role portals and Android/iOS architecture](docs/PLATFORM_TENANT_CONSOLE_ROLE_PORTALS_AND_MOBILE_SPEC.md)

## Scope boundaries

Actual payment initiation, real Mobile Money/bank verification, school-managed ticket submissions, physical tenant deletion, school authentication, school academics and native mobile builds are **not yet implemented**. These require separate tested increments. The first release prioritizes the platform owner's management plane.


## School onboarding (Module 1B, stacked development branch)

See [School owner onboarding flow](docs/SCHOOL_ONBOARDING_MODULE_1B.md): verified school owner invitations; unique Company/School IDs; branded school-specific sign-in; 5-step saved setup; real logo/photo uploads; separate private homepage drafts and public publication; explicit review and platform activation.

This module is a draft PR based on the earlier owner-console feature branch. No production Supabase deployment, mobile app, or school-role academic system has been claimed.


## School homepage and role-specific entry (Module 1B)

An active school's public homepage uses its own official brand and approved content. The school may publish its About statement, **Mission**, **Vision**, **Leadership/School Owner profile** (with approved photograph), contact details and up to three school announcements or advertisements. The portal login prominently asks the user to choose **School Owner / Administrator / Teacher / Staff / Parent / Student**. This is a navigation choice only: access still requires verified school-bound membership and relevant record permissions. The school owner setup portal works in development; teacher, staff, parent and student operational dashboards remain future modules.

The platform's monthly RWF fees and owner reminders do **not** appear on school sites or school member dashboards. See [School Module 1B flow](docs/SCHOOL_ONBOARDING_MODULE_1B.md).


## School Administration (Module 2, stacked development branch)

A verified School Owner can open the school-specific Administration dashboard after tenant activation. Features include:
- School overview, approved local staff directory, school role invitations and administrative audit.
- School Administrator access managed by the owner through a readable ON/OFF permission table, reason-required changes and multifactor verification.
- Verified email-linked invitation claiming; teachers and staff may accept membership but do not yet receive a finished academic workspace.
- Academic years, official class/section definitions, subject catalog and class-subject assignment, each limited to the school that created them.
- Strict separation from the SaaS platform owner's private RWF monthly payment clock and global tenant controls.

See [School Administration Module 2](docs/SCHOOL_ADMINISTRATION_MODULE_2.md) for detailed workflow, security model and release gates. This is GitHub code under review, not a live deployment, full academic portal, Android APK or iOS application.


## Module 3: Student Admissions and Verified Families (development)

A school owner or authorized admissions administrator can record a real application, review admission, enroll an approved student in an appropriate class, and invite verified parents. Applications and student records are separate; Student IDs and initial class assignments are created only after authorized admission. Family links require school verification and confirmed-email parent acceptance. School administrators get additional ON/OFF permissions for admissions, enrollment and guardian access. Parent screens show only child names, Student IDs and classes after their links are approved.

All child-related records are school-scoped and protected by server authentication and private database access. The module intentionally does not implement attendance, grades, homework, tuition, teacher rosters or student self-registration.

See [Student Admissions Module 3](docs/STUDENT_ADMISSIONS_MODULE_3.md). This remains a draft, GitHub-only module with no changes deployed to APEX or released phone apps.


## Module 4: Teacher Classrooms, Homework and Student Learning

Verified teachers can work with their own assigned class/subject roster, save lesson plans, draft/publish homework, record class attendance and read submissions. School Owners/authorized academic managers assign teachers; the School Owner can invite student accounts only after school and guardian checks. Verified students receive separate personalized learning screens for their own subjects, published homework, responses and attendance. Teachers cannot access unrelated classes and students cannot select arbitrary Student IDs.

See [Classrooms Module 4](docs/CLASSROOMS_MODULE_4.md) for privacy, business flow and release tests. This is GitHub-only development, not a deployed school, Android app or iPhone app. Native mobile distribution remains a later release layer.


## Module 5 — Rwanda Curriculum and School Academic Reports (development)

Schools can use official NESA assessment guidance to configure versioned local curriculum sources, subject-specific weekly teaching periods, syllabus units and competencies. A built-in read-only NESA P1–P6 2025–26 reference distinguishes exam paper marks from CA-MIS marks. Teachers record end-unit, project and end-term assessments; original paper marks are normalized to the school's verified curriculum maximum before the documented 25/25/50 General/Professional Education calculation.

School Owners must approve curricula and term reports before verified student/guardian accounts can view a school-issued, printable, institution-branded term report. Grades, school curriculum permissions and report publications remain tenant-scoped and audited, with versioned withdrawal/reissue rather than silent overwrites. Lower-primary LEGRA, TVET, nursery, international and higher education require separate verified grading engines and are not assigned the General Education formula automatically.

Read [Module 5 Curriculum & Reports](docs/RWANDA_CURRICULUM_ASSESSMENTS_REPORTS_MODULE_5.md). This is GitHub draft code, not a government-issued certificate, CA-MIS integration, deployed APEX migration, or released Android/iPhone application.


## Module 6 — School Timetables, Community and Private Family Messaging

Each branded school gains a verified community portal: weekly timetables with class/teacher/room conflict checks; private teacher-to-guardian conversations linked to actual enrolled pupils; calendar entries for exams, meetings and holidays; targeted school announcements; and a parent daily-school overview of linked children's homework deadlines, attendance records and released reports. Owners delegate calendar/announcement access to school administrators with ON/OFF permission switches and MFA. Messages create in-app notifications; external email and SMS delivery is NOT yet configured.

See [Module 6 School Communications](docs/MODULE_06_SCHOOL_COMMUNICATIONS.md). This is a **GitHub development draft**, not a production APEX or Vercel deployment or Android/iPhone application.
