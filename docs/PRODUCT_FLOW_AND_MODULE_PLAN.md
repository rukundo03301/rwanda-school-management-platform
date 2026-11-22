# Rwanda School Management Platform — Product and Build Flow

**Status:** Planning specification; no implementation or deployment verified.
**Branch:** `planning/module-01-foundation`
**Repository:** `rukundo03301/rwanda-school-management-platform`
**Design currency:** RWF (Rwandan francs).
**Design scope:** Nursery/pre-primary, primary, secondary, TVET, university; single school, campuses, and educational groups.

## 1. Architecture and data ownership

Platform admin (SaaS operator) -> organization/group -> school tenant -> campus -> authorized role membership. Each school has an immutable tenant UUID and a human-readable school code. Every school has its own logo, brand colors, homepage, public profile, onboarding, login identity, academic configuration, fee schedule, and content. Public school sites cannot reveal private student records.

One person can have multiple school-scoped memberships or roles. Enforce access in the application, database row-level security (RLS), private file storage, background tasks and exports. Test explicitly that a teacher, parent or admin at school A cannot access school B data. Never rely on a tenant ID supplied by an untrusted browser to authorize data access.

## 2. End-to-end school lifecycle

1. Platform operator provisions school tenant (or reviews approved self-service application).
2. Owner receives secure invitation and activates access.
3. School uploads verified logo, chooses color/theme, enters its actual name, school contact information, official photos, programs, policies and homepage content.
4. Owner configures campuses and education levels, academic year, terms/semesters, grades/classes/programs, language and grading models.
5. Owner configures staff, role memberships, approval limits and invitation rules.
6. School previews its homepage, tests mobile/login/access, then publishes its branded public site.
7. School manages admissions, school operations, staff, and learning independently.

## 3. Student and family lifecycle

Admission application -> document review -> approval/rejection -> guardian linkage and student ID -> enrollment -> correct campus/class/program -> fee assessment and RWF invoice -> payment reconciliation -> student portal/rosters -> attendance, teaching, assignments -> assessment and marks -> moderation/approval -> report card/transcript publication -> promotion, transfer, graduation or alumni archive.

The system must keep student identity and academic/financial history stable across years, and restrict disclosure on transfer.

## 4. Teacher and student teaching cycle

Academic setup -> teacher assignment -> lesson plan and materials (files, links, optional video) -> class timetable -> homework/quiz/project publishing -> student submission and deadline handling -> grading/feedback -> authorized release -> guardian/student visibility -> school-wide academic reporting. For nursery, replace unsuitable academic features with child development and care workflows.

## 5. Parents and communications

Only validated guardian-child relationships grant access to a child. Parents see linked child progress, published attendance/grades, school notices, fee statements and receipts. Secure teacher-parent conversations use school-scoped permissions, records retention and age-appropriate controls; SMS/email/push providers are integrations, not assumed connected.

## 6. Finance and administration

Student registration/fee rules -> RWF invoice -> installment plan -> payment received (mobile money/bank/cash as approved) -> receipt -> allocation/reconciliation -> arrears -> ledgers, budgets, approvals and audit reports. Handle RWF with exact integer minor-unit/decimal accounting as appropriate, not floating point. Maintain segregation of duties; reverse or adjust posted entries with audit trails.

Staff workflows: employee onboarding -> roles/contracts -> timetable/leave/attendance -> payroll integration -> performance and offboarding. Operations: kitchen/meal counts, dietary safeguards, stock/procurement, library, transport/pickup permissions, boarding, maintenance and disciplinary case management with restricted visibility.

## 7. University and TVET flow

Programs/faculties -> admission -> curriculum, course catalog, prerequisites and credit rules -> semester registration -> section placement -> tuition -> teaching and assessments -> GPA/transcript and graduation audit. TVET adds practical competency and placement requirements.

## 8. Technical deployment flow

All code, configurations, migration SQL and tests belong in GitHub. Feature branch -> pull request -> lint/typecheck/unit tests -> local/isolated database migrations and RLS tests -> review -> merge to protected `main` -> exactly one approved migration deployment mechanism (Supabase native GitHub integration OR GitHub Actions, never both) -> deployment health and permissions verification -> Vercel frontend deployment once authorized. Never manually create or modify production schema via Supabase dashboard. Secure secrets are stored outside source code.

**Current verification:** GitHub private repo accessible. Supabase project `stgqhkhfpnqmsiyrvvhe` (name APEX) ACTIVE_HEALTHY with no public tables and no migrations at last check. Native GitHub-Supabase integration and Vercel deployment are NOT yet verified. Do not deploy a test migration to production merely to prove connectivity. No actual application built yet.

## 9. Build order and completion gates

0. Define data model, UX flows, acceptance criteria, and Rwanda compliance/hosting review.
1. Multi-tenant foundation, registration/invitations, role model, school branding, homepage builder and publishing.
2. Admissions, student/guardian records and enrollment.
3. Academic calendars/classes/courses/timetables and teacher assignment.
4. Learning materials, homework, assignments, submissions.
5. Assessment, moderated gradebooks, report cards and transcripts.
6. Parent/student portals and secure communications.
7. RWF fees, payments, receivables, accounting and reconciliation.
8. Staff, discipline, kitchen, transport, inventory, boarding and other operations.
9. University and TVET specialization.
10. Enterprise analytics, multi-school reporting and authorized external integrations.

Before accepting each module: working API and UI (not just mockups), happy-path and failure-path tests, multi-tenant isolation, mobile UX, audit and data validation, compatibility with completed modules and an explicit release/rollback plan. Do not mark any module complete before its evidence is available.

## 10. Module 1 acceptance scenario

Create two demo schools A and B with distinct logo/colors/homepages. Owner A can create school staff and configure a campus; owner B can do the same independently. Each visits a school-specific landing and login page. A's accounts cannot see B's dashboard, files or records, including via direct API requests. Branding is editable by an authorized school owner; public homepage edits are previewed before publication. Audit logs show approvals and sensitive changes. Mobile and desktop flows are tested. No real student data used.


## Module 1 onboarding update (current decision)

Owner onboarding is a short **five-step wizard** (not a long nine-step form): 1) school details and automatic Company ID + School ID, 2) official logo, campus photographs and live branded preview, 3) homepage setup, 4) basic academics/admin team and RWF preferences, 5) preview, approval and launch. Registration is minimal and codes are **generated by the system**, never chosen or typed by school owners. School owning company and school have distinct immutable IDs, and a multi-school company reuses its Company ID while each school gets a separate School ID. Extra curriculum, payments, and staff details are deferred to appropriate later modules. See [Module 1 onboarding UX spec](./MODULE_01_SCHOOL_ONBOARDING_UX_SPEC.md) for the authoritative flow, testing and security requirements.

## Decisions still pending

- School group and independent SaaS model (recommend supporting both).
- Confirm native Supabase-GitHub integration target project and main-branch deployment.
- Confirm Vercel authorization and deployment strategy.
- Determine hosting and cross-border data protection requirements in Rwanda before processing actual children's records.
- Brand name and first real school's content, which must be supplied by the school, not invented.
