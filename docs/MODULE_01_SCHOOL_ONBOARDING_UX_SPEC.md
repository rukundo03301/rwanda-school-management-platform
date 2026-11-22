# Module 01 — School Onboarding, Branding and Go-Live Design

**Project:** Rwanda School Management Platform
**Status:** UX/product design; no application code, migrations, or deployment
**Source control:** `planning/module-01-foundation` branch
**Base currency:** RWF (Rwandan francs)
**Tenancy:** each school is independently branded and securely separated
**Target:** multi-level nursery, primary, secondary, TVET and higher education; campus groups supported

## Product intent

One education SaaS platform serves independent schools, but each school must have its **own real institutional identity**: registered name, official logo, colors, campus imagery, school description, public website, login page, school-specific dashboard, academic configuration and users. The platform must not create fake official logos or school information. Use safe placeholders in draft until the school supplies content.

Separate (1) platform operator onboarding for a school, (2) owner/admin setup, (3) invited employee and teacher first access, (4) parent/guardian account activation and (5) student activation. They are related journeys, **not one long shared form**.

## Experience A — Registering and activating a school

### Entry / registration

- Public call to action: **Register your school**.
- Small initial form: official institution name, institution type(s), public/private classification, contact email, contact phone (Rwanda +250 supported), province/district, and proposed owner identity.
- Validate required information, duplicates, email/phone normalization, school-name similarity, and reserved subdomains. Do not claim official recognition without an actual verification.
- Show a transparent school verification state: `Application submitted -> Under review -> Approved / More information needed / Declined`.
- A platform operator reviews applications before activating tenant accounts (recommended default; self-service approval could be added later with equivalent checks).
- Upon approval, server generates immutable `tenant_id` and display-only `school_code`, reserves a unique school subdomain, and sends a **single-use expiring** owner invitation. Avoid storing sensitive documents as public assets.

### Initial owner sign-in

- Accept invite -> verify email -> set up account or link existing account -> MFA setup for owner -> join the intended tenant membership -> land on a personalized onboarding wizard.
- School name and code always appear at top of wizard to prevent confusing tenants.
- Show progress, `Save and exit`, `Back`, `Continue`, autosave state with a last-saved indicator, and an accessible mobile layout.
- Every step uses server-side validation. On return, resume at last incomplete step.
- The owner is not silently made an administrator of any other tenant.

## Experience B — School owner onboarding wizard (9 steps)

| Step | Screen title | Required inputs and actions | Optional / advanced |
|---|---|---|---|
| 1 | **Welcome to your school** | Confirm official school name, ownership, school type(s), verification contacts; show assigned school ID | Registration identifiers/document upload as required by verification policy |
| 2 | **School profile & campuses** | Address (province, district, sector/cell where relevant), contacts, first campus name and school levels | More campuses, multiple contact persons, map/location, postal details |
| 3 | **Your school's identity** | Upload authentic logo; choose accessible brand colors; configure motto/tagline | Favicon, crest variant, approved fonts, typography scale, secondary logo |
| 4 | **Build your homepage** | Choose responsive page layout, official campus photo or neutral placeholder, homepage heading, about section, admission contact, navigation | News, calendar, program highlights, gallery, testimonials (approval required) |
| 5 | **Academic configuration** | Academic year, term/semester type, school levels, grade/class or program structures | Grading schemes, language(s), time zone, subject templates, subject combinations |
| 6 | **Staff & permissions** | Confirm school owner, nominate main school administrator, choose invitation/approval rules | Invite teachers, finance, registrar, kitchen, transport staff for later activation |
| 7 | **Finance preferences** | Set base currency **RWF** (locked as default), currency display, receipt numbering convention and fee-cycle preferences | Tuition/transport/meal schedules; supported payment methods stay disabled until integrated |
| 8 | **Security & policies** | Review institution data obligations, privacy controls, permissions, parent communication rules and school-specific policy links | Retention preferences, MFA policies for privileged roles, account recovery contacts |
| 9 | **Review, preview & publish** | Check readiness, inspect desktop/mobile homepage and portal login preview, confirm required content, publish approved public homepage | Connect custom domain after DNS verification; enable admissions later |

**Design rule:** The onboarding wizard may have optional steps, but the identity, secure owner membership, institutional profile and minimum publish-safe content are required. Never block a school from saving a draft because an integration not yet built is missing.

### Visual layout

- Desktop: left rail shows **9 numbered steps**, center shows the current form, right side previews school brand/homepage when applicable.
- Mobile: progress indicator at top, single-column forms, a collapsible `Preview school` control, large accessible tap targets and sticky `Back / Continue` actions.
- Page heading always reflects the school's **actual name** and logo once uploaded.
- Brand theme applies to the school-facing onboarding/portal preview, but controls retain consistent accessibility and focus states.
- Never assume a school logo or photograph exists: a draft displays neutral placeholder assets marked as placeholders.

### School homepage preview

Header: authentic logo + actual school name + site navigation + Apply / School Portal CTAs.
Hero: school-supplied image or neutral placeholder; owner-approved headline and welcome copy.
Sections (configurable): About; Academics/Programs; Admissions; News & Calendar; Campus Gallery; Contact/Location.
Footer: official contact details, policies and accessibility links.
Public site must not leak student details or expose internal administration links beyond a login entry.
Preview is not publication: keep `draft` and `published` versions distinct; an owner can roll back a mistaken publish. Set custom domain to `pending verification` until DNS is proven.
The `Apply` CTA becomes active only once admissions is ready; otherwise show contact/enquiry or hide it, never a dead button.

## Experience C — Owner's first live dashboard

After successful onboarding, the school owner enters a school-specific dashboard, not the platform operator dashboard.

Top bar: school logo/name, campus switcher, notifications, user menu and authorized school switcher.
Primary cards: setup status, staff/invitations, academic readiness, website status and subscription status.
Guided checklist: `Add staff` -> `Configure classes` -> `Set up admissions` -> `Set fee rules (RWF)`.
Modules not implemented or not configured are hidden or explicitly marked `Coming later`, not shown as functioning buttons.
First release shows no fabricated enrollment, fees, attendance or grades; empty states explain how data will appear later.

## Experience D — Invited staff or teacher onboarding

1. Owner/admin invites employee with scoped role, campus and expiration; audit who invited them.
2. User clicks single-use invitation; email verification and authentication; if already a user, link their identity without creating duplicates.
3. Show school **official logo and name** with role/campus; ask for minimal profile details and acknowledgement of policies.
4. Teacher-specific setup (when corresponding modules exist): confirm classes/subjects; configure notifications; view timetable and teaching materials.
5. Non-teaching staff: view assigned unit, duties and relevant task workspace. A kitchen employee should not see examination grades.
6. Accept -> role-specific dashboard. Revoked or expired invites fail securely.

## Experience E — Parent/guardian onboarding

1. Parent gets approved invitation from school or applies through a controlled guardian-verification path.
2. Verify identity/contact and guardian-child relationship **before** access to any student records.
3. Link only the authorized child/children within the tenant (guardian can belong to more than one school with explicit membership).
4. Choose communication language and notifications, review privacy and school communication policies.
5. Parent dashboard shows only linked children, relevant school messages, published academic status and RWF fee statements when those modules are live.
6. Reject unverified child ID guessing and self-linking to arbitrary students.

## Experience F — Student onboarding

1. Students gain an account **after authorized enrollment**, school approval and any applicable guardian consent.
2. Minors use age-appropriate permissions and messaging safeguards; nursery students generally do not receive independent accounts by default.
3. Student selects/reviews school, class/program and accessible course dashboard; the system never exposes another student's protected records.
4. University/TVET students later get semester registration, program and transcript tools appropriate to their level.

## Data design outline (not migration SQL)

- `organizations`, `school_tenants`, `campuses`, `tenant_domains`
- `user_memberships`, `role_definitions`, `role_assignments`, `invitations`
- `school_profiles`, `school_branding`, `school_homepage_versions`, `media_assets`
- `onboarding_sessions`, `onboarding_step_status`, `school_preferences`
- `academic_years`, `education_levels` (introduced with the academics module, but planned now)
- `audit_events`, `publish_approvals`, `notification_preferences`

Tenant ownership is established server-side. All tenant-owned rows, storage paths, reporting views and background tasks must enforce tenant isolation. Restrict privilege changes; no authorization from user-editable profile metadata. Schools can share SaaS infrastructure but never private data by accident.

## Onboarding state model

School: `application_draft -> submitted -> under_review -> approved -> tenant_provisioned -> onboarding -> ready_for_publication -> active`.
Exceptions: `needs_information`, `declined`, `suspended`, `archived`.
Homepage: `draft -> preview -> published` with revision history.
Invitation: `pending -> accepted`, `expired`, or `revoked`.
Changes must be idempotent and resumable; duplicate clicks must not provision duplicate school codes or owners.

## RWF finance conventions

- Display currency as `RWF` with readable separators; do not silently switch to USD.
- Preserve exact arithmetic (integer smallest units where applicable or exact decimal fields); prohibit binary floating-point financial storage.
- Until finance module deployment, store only school preferences and avoid generating invoices or payment receipts.
- Mobile Money and bank payment options are future provider integrations requiring approved API connections and verified reconciliation, not merely on-screen buttons.

## Launch and acceptance gates

### Functional tests
- Register one school; duplicate application does not create duplicate tenant.
- Verify institution application; owner invitation works and expires after use.
- Save/resume owner wizard on desktop and mobile.
- Upload valid logo; block malformed/oversized or risky files; ensure private draft assets and scoped publishing.
- Change school colors; homepage and login preview reflect actual school identity.
- Publish homepage; draft changes stay private until approved; rollback works.
- School A and school B have distinct logos, profiles and URLs; no cross-tenant reads or writes via API, SQL/RLS, files, reports, messages, or exports.
- Teacher invitation cannot gain owner/admin privileges; parent cannot attach unrelated student.
- Logout/login, expiry/revocation, MFA for owner, accessibility, and supported browser tests.
- Nonexistent modules cannot be reached as working pages.

### Operational tests
- Email failure is retryable with audit and no duplicate memberships.
- Onboarding steps preserve data across interrupted sessions.
- Audit log records school verification, settings changes, invitations and public publishing.
- Mobile performance works on constrained connectivity; upload progress and safe retries are shown.

## UX copy conventions

Use simple, helpful language: `Tell us about your school`, `Upload your school logo`, `Preview your homepage`, `Invite your school administrator`, `Save and continue later`, `Publish your school site`.
For irreversible/public actions: confirm `Your homepage will be visible to everyone` and show the preview URL.
Do not collect unrelated student health or legal information during generic school onboarding.

## Rollout and deployment guardrails

- **No direct Supabase schema writes.** Database changes are migration files in GitHub.
- Implement one tested module on a feature branch and validate locally/isolated first.
- Confirm whether **Supabase native GitHub deployment** or **GitHub Actions CLI deployment** is enabled; use exactly one migration deployer, not both.
- Merge to protected `main` only after security review, validation, and release approval.
- No deployment or data import is implied by saving this document.

## Decisions to finalize before coding

1. Whether school applications are manually reviewed by platform operator (recommended default) or fully automated.
2. Whether an owner may operate a school group with multiple independently branded campuses/schools (recommended yes).
3. Which homepage theme presets and permitted customizations launch in v1.
4. Whether admissions request/contact should be public before student admissions functionality is delivered.
5. Which Rwanda-specific registration fields are compulsory for different institution types, following verified requirements.
