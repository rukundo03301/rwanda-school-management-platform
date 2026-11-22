# Module 3: Student Admissions and Verified Families

STATUS: Development code in feature/student-admissions-v1. This branch is stacked on School Administration Module 2, and is not merged or deployed. No live APEX migration, school child records or release binaries have been created.

## Core business process

1. Verified School Owner or a local School Administrator specifically granted Admissions.Manage creates an application with first name, surname, optional date of birth and requested academic year. PostgreSQL generates an Application ID. This is NOT an enrolled student.
2. The school reviews the application. An authorized reviewer may mark it under review or reject it; rejection does not create a student or enrollment.
3. To admit, reviewer needs Admissions.Manage plus Enrollments.Manage and multifactor authentication. They choose an active class of the same school and academic year.
4. One transactional SQL function locks the application and class, checks class capacity, creates a permanent Student ID and one active school/year/class enrollment and marks the application admitted. Any error rolls back the entire operation.
5. The student registry lists only actual approved school students. Staff can see application status and initial class enrollment, within their permissions.
6. School personnel with Guardians.Manage verify a guardian-child relationship through an approved offline process. They select the correct student, input a verified guardian email and relationship, attest to completing the check, and issue a school-bound invitation valid for 14 days.
7. A parent signs in at that school's own branded Parent/Guardian portal. Before acceptance, no child names or personal details are revealed. After authenticating a matching email-confirmed Supabase account and accepting an unexpired invitation, the database creates the parent-child link and parent role membership.
8. Parent can view ONLY the linked child's name, Student ID, relationship and current class. The school may revoke one guardian-child link with an audit reason and MFA. Other authorized links are not affected.
9. Class homework, attendance, school fee balances, reports and teacher messages are NOT yet active in this module; they require additional privacy-scoped academic modules.

## Access-control matrix for school administrators

- admissions.read: View school applications, enrolled students and initial class placement.
- admissions.manage: Create, review, admit or reject school applications (admit also requires enrollments.manage).
- enrollments.manage: Approve class placement together with admissions management.
- guardians.manage: Issue verified guardian invites and revoke family relationships.

The School Owner may configure each administrator using an ON/OFF switch table, requiring MFA and an audit reason. The School Owner controls only this school; a local administrator cannot access platform-owner manual payment records or another school's students. Permission selection on login is NEVER permission assignment.

## Implemented routes and files

Private administration dashboard: /s/[code]/admissions.
Private parent/guardian dashboard: /s/[code]/family.
Authenticated APIs: /api/school/[code]/admissions and /api/school/[code]/family.
Shared role validation: lib/school-admissions.mjs, lib/school-admissions-permissions.mjs.
GitHub migration source: database/school_admissions_v1.sql.
School Administration nav and Parent Portal gateway link to their respective interfaces.

The database stores school_admissions_permissions, school_admission_applications, school_students, school_student_enrollments, school_guardian_invitations, school_guardian_links and school_admissions_audit.

Each child-related table has RLS enabled and direct anon/authenticated database grants revoked. Verified server-side Auth checks the active tenant, school membership and permissions on every access. Composite school-scoped foreign keys bind student, class and academic year. Audit records store IDs, action descriptions and reasons rather than children's names or identity documents.

## Limits and production-readiness

- No public child self-registration or student login enrollment; those need school approval, age/privacy protection, anti-abuse design and consent.
- No uploaded IDs, medical records, biometric data or private child photos.
- The guardian relationship attestation records staff confirmation of offline verification; it does not independently verify identity or custody rights.
- This is initial class placement. Transfers, promotions, withdrawals, waitlists, corrections and sibling grouping need separate workflows.
- Basic list views show a limited first page of up to 250 records; pagination and definitive counts remain to be implemented for larger schools.
- Email invitations depend on configured Supabase Auth and redirects; provider acceptance is not delivery confirmation. Existing users can sign in and accept a matching invitation.
- Rwandan child-data privacy, legal authorization, retention/erasure and hosting review are mandatory before processing real records.
- Final release requires passing Next.js build, unit/static security tests and all four isolated SQL migrations, followed by live end-to-end testing with synthetic test-school accounts: authorization, MFA, wrong-school class assignment, capacity, concurrent admission, guardian claim, expired/revoked invites and data isolation.
- No manual SQL edits in the production APEX dashboard. Deploy only after staged reviews through a single GitHub-first pipeline.
- Android and iPhone apps and teacher/student full dashboards are future deliverables, not part of this code release.

NEXT: Teacher/class assignments, attendance and homework, then student and parent reporting using verified student relationships.
