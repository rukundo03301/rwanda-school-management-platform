# Platform Tenant Console, Role-Specific Portals and Native Mobile Apps
**Project:** Rwanda School Management Platform
**Status:** Product design specification, NOT implemented.
**GitHub branch:** `planning/module-01-foundation`
**Target platforms:** Web, native Android, native iPhone (iOS)
**Default financial currency:** RWF (Rwandan francs)
**Related documents:** [Product flow](./PRODUCT_FLOW_AND_MODULE_PLAN.md) and [school onboarding UX](./MODULE_01_SCHOOL_ONBOARDING_UX_SPEC.md)

## 0. Non-negotiable product principle

This is **two layers of administration** plus distinct role-specific school portals:

1. **Platform operator/owner console**: manages *all* companies and school tenants across the SaaS. Only trusted platform owner(s) and specifically authorized support staff can enter. Shows tenant lifecycle, subscriptions, health, provisioning and audit logs; does **not** imply unlimited access to student academic, health, welfare or finance records.
2. **Company/school owner and administrator workspace**: manages only companies and schools for which the authenticated identity has an approved membership; controls staff, branding, academic administration, finances and operations within policy.
3. **School-member experiences**: teacher, parent/guardian, student, registrar, finance officer, principal, counselor, kitchen, boarding and transport roles each have context-specific home screens, navigation and scoped APIs.

A selected sign-up role is NEVER proof of access or a grant. Authentication answers "who are you?" and database-backed school memberships + actual teacher/student/guardian relationships answer "what can you access?"

## 1. Company / school hierarchy and IDs

```
SaaS platform
  └── Owning company or education group (Company ID: RW-CMP-******)
      ├── School tenant A (School ID: RW-SCH-******)
      │   ├── Campus A1
      │   └── Campus A2
      └── School tenant B (another School ID)
```

IDs are *server-generated*, immutable, globally unique display codes backed by UUIDs. A standalone school receives one company record and one school record automatically. Additional schools under one legal company share Company ID and each get a distinct School ID. Access remains explicitly school-scoped even within a group.

Company owners may be authorized to consolidate reporting across their member schools, but a company membership alone must not silently grant personal access to all student details.

## 2. Platform owner "Tenant Command Center"

### Screen 2.1 — Overview

A dedicated, protected `/platform` (illustrative route) on the web, not a navigation option to normal users.

Header: Platform logo; product environment; global notifications; current trusted operator; audit access.
Stat cards: Total tenants, Active, Onboarding, Paused, Suspended, Pending Deletion, Subscription status. Figures MUST be computed from actual tenant records; no fabricated data.
Search/filter: company name/ID, school name/ID, campus, state, subscription, creation date, verification, region.
Table columns: official school logo, school name, School ID, Company ID, owner contact (minimum necessary), plan, user count, lifecycle state, last activity, actions.
Actions: **View details**, **Pause**, **Activate**, **Suspend** (restricted), **Archive**, **Request deletion**, export permitted tenant metadata. Filter/sort/paginate.
Batch destructive actions disabled by default. Operations require appropriate platform permissions, audit reason and sometimes approval.

### Screen 2.2 — Individual tenant detail

Tabs:
- **Overview**: IDs (copy buttons), school identity, owner, verification, campuses, created date, status, website URL, environment health.
- **Brand / Public site**: read-only school homepage preview; change requests and publication status, not arbitrary editing by platform support.
- **People / Access**: approved admins, invitation status, role counts, MFA posture; granular controls to revoke *platform-granted* access while respecting school authority.
- **Modules / Features**: enabled modules and limits (nursery/primary/secondary/TVET/university, teaching, exams, finance, etc).
- **Subscription / Billing**: RWF plan settings, invoices and service state (platform subscriptions distinct from student school fees).
- **Activity / Audit**: lifecycle history, changes, who did what, reason, timestamp, affected tenant and approval reference.
- **Security / Compliance**: access anomalies, export restrictions, reported issues and permitted escalations.
- **Danger Zone**: pause, reactivate, suspend, archive, deletion request, with safeguards.

### Screen 2.3 — Tenant state machine and behavior

States: `application_pending`, `onboarding`, `active`, `paused`, `suspended`, `archived`, `deletion_requested`, `deletion_scheduled`, `deleted` (tombstone).
- **Activate**: only after approval, required configuration, and policy checks. Enable authorized sign-in and permitted modules.
- **Pause**: reversible operational state initiated by platform operator for an administrative purpose; new school session requests and writes are blocked; existing sessions must be denied at API/database scope; public site shows configurable maintenance page. Preservation of records, cancellation/deferral of notifications and payment side effects are deliberate, audited choices.
- **Resume/Activate from paused**: recheck compliance/ownership and restore only permitted services; record who approved.
- **Suspend**: security/compliance enforcement, typically stronger than voluntary pause, with tighter permissions and separate reactivation requirements.
- **Archive**: read-only legal/retention state as appropriate; do not delete student history.
- **Delete**: not an immediate physical DELETE button. Start a **deletion workflow** requiring MFA re-authentication, explicit typed confirmation of School ID, reason, impact preview, eligible approvals, retention/legal-hold review and recoverability period defined by policy. After approved retention and purge schedule, cryptographically erasure/revocation and verified cleanup occur in background, with audit evidence. Never recycle the School ID.
- No tenant can be deleted accidentally, by a school owner selecting its own tenant in another context, or by an unprivileged support role. No unilateral wipe of legal records.

### Screen 2.4 — Platform access control

Distinct identities/permissions: Platform Owner, Platform Operations Admin, Tenant Support Analyst, Security/Compliance Reviewer, Billing Analyst; default deny, least privilege. Separate access to metadata from access to students' personal records. Support access to sensitive school records requires an explicit, time-limited, school-approved support grant where lawful, reason, audit trail and revocation; not permanent impersonation of the school owner.
Enforce elevated MFA, unusual-activity alerts, audit log integrity, separation of duties for deletion, and operator access reviews.

## 3. Sign-up and login experience: branded, safe, frictionless

### Common entry flows

**Platform owner:** uses separate protected admin sign-in and trusted membership; cannot select `Platform Owner` via public sign-up.

**School member mobile app:**
1. Welcome -> `Find your school` by verified name, School ID, link/QR invite, or approved short code.
2. App resolves tenant context and displays that school's actual **logo, official name and colors**. No generic or mismatched school page.
3. Choices: `Sign in`, `Accept invitation`, `Request access`, optionally `Apply for admission`. An optional **I am a teacher / parent / student / staff** question customizes *instructions*, not authorization.
4. Verify email/phone/identity, link to school-authorized role membership and corresponding records.
5. Server derives allowed role(s), assigned school(s), campus(es), classes and child relationships. If multiple memberships exist, show **Choose school/role** switcher with only verified options.
6. Route to the matching dashboard. Missing relationship -> `Access pending school approval` with contact details; never a blank or wrong dashboard.

**Teacher request:** Teacher selects `Teacher` -> finds school -> requests access or uses school invitation -> school admin verifies employment and assigns classes/subjects -> teacher sees only the assigned rosters and courses.
**Parent request:** Parent selects `Parent` -> finds school -> verifies identity -> registrar confirms guardian relationship to child -> sees only that child (plus other verified children).
**Student request:** Student uses school-issued invitation/enrollment ID -> authorized registrar/guardian approves when applicable -> sees only own enrollment. Nursery students generally have no self-service portal account.
**Staff request:** Staff account approved and mapped to HR role and campus -> operations-specific dashboard.

The app must never treat a teacher/parent/student radio button as a privilege. Unapproved sign-ups stay pending with no protected data.

### Cross-role identities

A user may be parent + teacher, or a teacher at two schools. Store one auth identity, multiple verified memberships; enable an explicit context switcher with a school logo + role, not duplicate accounts. Switching context invalidates old UI caches and forces new authorization checks. Switching does not expand underlying entitlements.

## 4. Distinct role-specific dashboards and navigation

### A. Platform owner
Bottom/sidebar: `Overview | Tenants | Approvals | Plans | Security | Audit | Settings`.
First screen: active/paused/pending tenant KPIs, tenant table, renewals and provisioning, exception alerts.
Tenant row actions: Details, Pause/Activate, Archive, Delete request, permissions/audit.

### B. Company / School owner
Navigation: `Overview | Academics | Students | Staff | Finance | Operations | Website | Reports | Settings`.
First screen: school/campus switcher, branding and homepage status; actual enrollment/attendance/fee figures once those modules exist; pending admissions, staff invites and approvals. RWF amounts. Owner cannot administer unrelated schools. Company-level summary is separate from any school-level private student detail.

### C. Teacher: Kasim (example only)
Header: `[real school logo] Good morning, Kasim`; campus/class context.
Cards: `Today's lessons`, `My assigned students`, `Homework to review`, `Unmarked assessments`.
Navigation: `My Classes | Timetable | Lessons | Materials | Homework | Gradebook | Attendance | Class Reports | Messages`.
- **My Classes** lists only classes/sections that school admin assigned.
- Class page: authorized roster, attendance, teaching plan, subject curriculum, homework builder, student submissions, grading and feedback.
- Can upload files and release course homework; publish grades/report cards only with appropriate moderation permission.
- `Class Reports` limited to taught or assigned student scope and authorized fields; no unrelated class/financial/disciplinary records.
- Messages sent only to allowed students/verified guardians with school safeguards.

### D. Student: Shilohn (example only)
Header: `[school logo] Welcome, Shilohn`; grade/class.
Cards: `Today’s timetable`, `Homework due`, `Attendance summary`, `Latest published results`.
Navigation: `Home | Curriculum | Timetable | Homework | My Attendance | My Results/School Reports | Materials | Messages`.
- Curriculum/lesson material is restricted to enrolled classes/courses.
- Homework: due dates, downloadable instructions, allowed submissions and teacher feedback.
- Attendance: self-only, released/eligible records.
- Report cards: own published reports only. No classmates' grades or parent financial information by default.
- Age-specific restrictions on messaging and accounts.

### E. Parent: Gasana linked to child Shilohn (example only)
Header: `[school logo] Hello, Gasana`; child switcher `Shilohn` and other *verified* children only.
Cards: `Shilohn present/absent`, `Homework due`, `School fees outstanding (RWF)`, `Teacher messages`, `Latest published report`.
Navigation: `My Children | Attendance | Homework | Reports | School Fees | Messages | School Calendar`.
- `My Children`: only children with an approved guardian link.
- Fees: only to guardian with appropriate finance visibility, not every contact; statement/receipt amounts in RWF.
- `Messages`: Kasim only if his class assignment/communication policy allows guardian contact; conversation history scoped to child's school and relevant teacher.
- Parent cannot change school grades, teacher rosters or access another child by guessing a school/student ID.

### F. Staff specialists
Registrar: `Applications | Student Records | Classes | Documents | Enrollments` with approval controls.
Finance officer: `Invoices | RWF Receipts | Reconciliation | Arrears | Reports`, not teaching-grade edit rights.
Kitchen staff: `Meals | Student Meal Counts | Stock | Allergies (minimal necessary) | Orders`, never access general academic reports.
Principal: `Academic Oversight | Attendance | Staff | Approvals | Published Reports | Discipline (authorized)`.
Counselor/discipline: case-scoped confidential workflows and explicit school policy.
University instructor/student adapt to modules, semesters, credits/GPA; nursery parent views developmental milestones, meals, pickup rather than quizzes.

## 5. Concrete role scenario — Kasim, Gasana and Shilohn

**School:** a single verified school tenant with Company ID + School ID.
- Registrar enrolls **Shilohn** in an authorized section and links **Gasana** as a verified guardian and (if appropriate) financially responsible parent.
- School admin verifies **Kasim** as teacher, assigns him to Shilohn's subject/class.
- Kasim signs in on Android/iPhone -> school branding -> Teacher workspace -> sees Shilohn **because** of active teacher class assignment, posts homework, records attendance and marks his work.
- Shilohn signs in -> Student workspace -> sees curriculum/timetable/homework/attendance and published report for **Shilohn only**; completes assignments.
- Gasana signs in -> Parent workspace -> child selector Shilohn -> sees Shilohn's attendance, pending homework, RWF fee balance if authorized, published school reports and secure messages to assigned teacher Kasim.
- When Kasim's class assignment ends, access to former class student data must follow an explicit limited history policy and not remain automatically unlimited.
- Student withdrawal, guardian custody change, staff termination, school pause and tenant suspension all trigger scoped access re-evaluation.

## 6. Permission matrix (high-level)

Legend: **All** = platform tenant metadata only unless noted; **Own school** = approved school-scope; **Assigned** = assigned class/subject; **Linked** = verified child; **Self** = person's own enrollment; — = none.

| Resource/action | Platform owner | School owner/admin | Teacher | Parent | Student | Kitchen |
|---|---|---|---|---|---|---|
| Tenant list/status | All | Own school summary | — | — | — | — |
| Pause/activate tenant | All (authorized + audited) | Request only | — | — | — | — |
| Request deletion | All (elevated, reviewed) | Request own school with review | — | — | — | — |
| Brand/homepage edits | Operator support per grant | Own school authorized | — | — | — | — |
| Staff role assignments | Limited platform support | Own school authorized | — | — | — | — |
| Class/student roster | — by default | Own school policy | Assigned | Linked child summary | Self info | — |
| Post homework | — | Authorized educators | Assigned | — | — | — |
| Submit homework | — | — | — | — | Self | — |
| Mark grades | — | Authorized academic role | Assigned | — | — | — |
| View published report | — | Own school permitted | Assigned permitted fields | Linked | Self | — |
| View attendance | — | Own school policy | Assigned | Linked | Self | — |
| School fees in RWF | Platform subscriptions only | Own school authorized | — | Linked + finance right | — by default | — |
| Teacher-family messages | — | Case/oversight policy | Assigned guardian/student | Linked child | Course policy | — |
| Meal stock/dispatch | — | Own school operations | — | — | — | Assigned |

Matrix is a **starting policy**, not blanket owner visibility into protected welfare records. Security implementation requires per-action permissions, school/campus/record scope, relationship validity, temporal checks, resource state (e.g. published vs draft), and privacy/legal restrictions.

## 7. Mobile experience — Android and iPhone are first-class products

### Product packaging

- **Web application**: Next.js or equivalent responsive web frontend; operator and heavy school administrative workflows are best on desktop, but responsive.
- **Native mobile app for Android and iOS**: one React Native + Expo codebase consuming the same secure APIs, with distinct role-specific navigation once logged in. Official Expo build tooling supports installable binaries for both platforms.
- Default recommendation: **one branded-by-school-at-login app** to start, not a separate store listing for every school; institute-specific theme, logo, homepage and push notifications are dynamic by active school. School-specific white-label apps are a later opt-in product subject to store rules and costs.
- Android phone/tablet and iPhone/iPad layouts; no Android-only feature parity gaps without documented reason.
- Potential offline support: encrypted local downloads for permitted learning materials, queued safe homework drafts/uploads and connectivity indicators; do NOT cache broad sensitive student/finance data on shared devices without robust controls.
- Native capabilities: push notifications (school-scoped), camera/photo uploads for homework, secure file/document viewing, biometric unlock where available, and safe deep links for school invites.
- Language options: Kinyarwanda, English and French, respecting school defaults and individual preferences.
- Plan store publication via Google Play and Apple App Store, account deletion request initiation, required privacy disclosures, child safeguarding and store-review demo accounts. Production builds require developer accounts and store review; a web URL is not equivalent to an installable native app.

### Distinct mobile navigation

Platform admin (prefer web first): global tenants, verification, lifecycle, audits; optionally a restricted mobile review companion later.
Owner: Home, Schools, Approvals, Finance, More.
Teacher: Home, My Classes, Homework, Messages, More.
Parent: Home, Children, Fees, Messages, More.
Student: Home, Learning, Homework, Timetable, More.
Kitchen: Today, Meals, Stock, Tasks, More.
Role navigation is server-allowed, not a public self-selected menu.

### Suggested repo package structure (design only)

```
apps/
  web/          # SaaS console + school website + desktop dashboards
  mobile/       # Native Android/iOS app
packages/
  ui-tokens/    # Branding, design tokens, accessibility
  api-client/   # Typed API contracts, safe auth context
  domain/       # Shared validation and domain types
supabase/
  migrations/   # GitHub-first audited SQL migrations
  tests/        # RLS and security validation
docs/
```

## 8. Shared data/security architecture

Key records: `companies`, `schools`, `campuses`, `tenant_lifecycle_events`, `users`/identity links, `memberships`, `role_bindings`, `permissions`, `teacher_section_assignments`, `student_enrollments`, `guardian_student_links`, `guardian_financial_access`, `class_sections`, `course_assignments`, `homework`, `submissions`, `attendance`, `grade_release_states`, `school_invoices`, `messages`, `audit_events`.

Access control: after authentication, server resolves authenticated identity + active Company/School/Campus membership, job role, active teacher/student/guardian relationships, tenant lifecycle status and record-level sharing rules. Every API request and Supabase RLS policy must enforce the result. The user's chosen role in the UI and editable user metadata never authorize actions. Client apps never receive database service-role keys. Sensitive role changes and pauses require audit logs. Suspension checks cannot rely only on a stale JWT: validate current tenant status/relations on protected data access and revoke refresh sessions where appropriate.

Privacy: minors' records, counseling/welfare, health, discipline, payments and guardian identity are separately classified. Platform support does not access them by default. Enforce document/image storage policies and signed URLs; institute-to-institute transfer is explicitly authorized.

## 9. Build sequence and release acceptance

**0. Design/security first:** agree role-based UX, tenant state lifecycle, full membership/RLS matrix, child-link verification, accessibility and native app navigation.
**1A. Platform-owner tenant command center** (view/list/search, onboarding review, status changes, role controls, audit)
**1B. Branded owner onboarding and school website** (automated Company/School IDs, real logo/photos, preview, publish)
**1C. Authentication and contextual routing** (school discovery, approvals, invitations, verified role switcher, native shell)
**2. Students/parents/staff relationships and admissions** (verified guardian-child, teacher class assignment foundations)
**3. Academics/timetable/curriculum** -> **4. Homework/teaching** -> **5. Attendance/grades/reports** -> **6. RWF fees/communications** -> **7. Operations/university/TVET**; functionality becomes live only in its tested phase.
**Mobile deliveries:** start native app shell and secure sign-in alongside role routing in 1C, then implement teacher/student/parent tabs as their corresponding backends are completed; Android and iOS test builds and store publication gates before claiming app availability.

Release tests (minimum):
1. Platform owner can list A and B, pause A; A's owner, teacher, parent, student APIs stop disclosing tenant data while B stays fully operational.
2. Unauthorized tenant admin cannot pause/delete B; all tenant lifecycle changes are audited. Deletion requires protected confirmation and legal retention checks.
3. Self-selecting `Teacher` at sign-up gives NO roster; only school-approved assignment grants Kasim access to his class.
4. Shilohn sees only his own timetable, curriculum, homework, attendance and published reports.
5. Gasana sees Shilohn's records only after verified guardian linkage; fees only if guardian has financial right.
6. Kasim cannot read another class's unassigned student work and cannot edit protected final reports.
7. Two school homepages/login pages show distinct authentic logos and themes; selecting a role/school cannot cross tenant boundaries.
8. One user belonging to two schools can switch *only* to verified contexts; cached data from other tenant does not display after switch.
9. Native Android and iOS test builds support login, correct role-based screen navigation and tenant-bound push/deep links with safe auth.
10. Tests run in isolated/local environments before approval; no manual Supabase schema writes. One confirmed migration deployer; no duplicate CI/CD deployments.

**Current state**: design only. GitHub documentation updated; no app code, production schema changes or native binaries created. APEX Supabase project currently designated; GitHub-to-Supabase auto-deploy not yet verified. Hosting/privacy law review before real Rwandan children's information.
