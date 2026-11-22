# Module 01 — Smooth School Onboarding, Identity, Branding & Homepage (V2)

**Status:** Approved design direction, implementation not started. **Source:** `planning/module-01-foundation` branch.
**Default currency:** RWF (Rwandan francs).
**Scope:** Independent schools, school-owning companies/groups, campuses; nursery through university/TVET.
**This document supersedes the former nine-step owner onboarding design.**

## Design objective

A first-time school owner should feel they are setting up *their own real school*, not filling out a generic 9-step software form. The system creates company and school IDs **automatically** and prominently displays them. The owner does not enter or invent those IDs. The school uploads its *real* logo and photos, which show immediately in a responsive live preview. Short, guided steps, autosave, sensible defaults, and optional later configuration are essential.

### Conceptual hierarchy and IDs — must not be omitted

```
Platform (SaaS operator)
  -> Company / owning organization (internal company_uuid; visible Company ID e.g. RW-CMP-000001)
     -> School (internal tenant_uuid; visible School ID e.g. RW-SCH-000001)
        -> Campus (internal campus_uuid; optional Campus Code)
        -> Authorized owners, admins, teachers, parents, staff, students
```

For a single independent school, create one company/organization and one school automatically, even when the owner enters only a school name. A company can later own many schools. Company ID and School ID are separate immutable, globally unique human-readable identifiers, backed by UUIDs for security and referential integrity. Display codes are examples, not existing live IDs. Do not derive authorization from user-entered IDs.

Where visible:
- On initial confirmation, show **Company ID** and **School ID** together with school logo/name; provide **Copy** actions.
- Show both in owner onboarding's top context strip, School Settings > Identity, and relevant authorized admin/support views.
- On the owner dashboard, offer compact **School identity** information; do not clutter student/parent interfaces with administrative IDs.
- Public school homepage should use authentic school name and branding, not an internal code, except optional legally required public identifiers.

ID lifecycle:
- On secure school application creation, server generates company record and school tenant in **pending** state within an idempotent transaction; reserve the two IDs and expose them to the verified applicant.
- Approval changes status, **never reassigns** IDs. Repeated submissions / retries do not create extra schools.
- The database enforces uniqueness; support merges/corrections through audited admin operations rather than recycling codes.
- For groups adding a second school, **reuse Company ID**, generate **new School ID**.

## Onboarding UX: five friendly steps, not nine

**Before wizard:** A small `Create your school` screen asks only school name, institution type(s), school contact email and phone, location (district/province) and owner identity. Verify ownership and contact. Use separate legal company name only if applicable; otherwise default company name to the school name. Do not ask for codes, payment integrations, complete curricula or all employees here. Record an application verification status and allow the owner to work on a secure draft while review is pending; publication/operational access stays blocked until approved.

### Step 1: School details — "Welcome, [real school name]"

- Confirm actual company/organization name (default school's official name), actual school name, institution levels and primary campus/location.
- Generate and show **Company ID** and **School ID** automatically in a two-field read-only identity card, each with Copy.
- Explain "These IDs were created for you; you don't need to choose them."
- Use the saved information automatically later; no duplicate school name or address entry.
- Draft saves immediately. Invitation sign-in is via verified owner, MFA for privileged roles.

### Step 2: Make it yours — "Your logo and school photos"

- Large drag/drop and mobile camera/file-picker upload for **official school logo** (clear square/transparent variant recommended), campus **cover/hero photo**, and optional gallery photos.
- Show cropping, orientation, thumbnail previews, image reorder, alt text, replace/remove, upload progress and meaningful file limits.
- As soon as the school uploads assets, immediately update **live school homepage and login previews**; respect originals, do not invent the school's official identity.
- Choose 1 of 3 accessible theme templates, optionally adjust primary/secondary colors. Automatically check contrast and display a legible fallback if colors fail.
- If logo/cover photo absent, show clearly marked neutral placeholders in draft; prevent silent publication of misleading stock imagery. Require confirmed official identity assets or explicit approved text-only branding policy before publish.
- Media isolation: private draft storage, tenant-scoped writes and signed access; only approved published assets become public.

### Step 3: Your homepage — "Tell families about your school"

- Live responsive homepage preview beside short, editable fields. Pre-fill school name, logo, phone, address and school type from Step 1/2.
- Simple sections: hero welcome message, school introduction, programs/levels, admissions contact, news/calendar (optional), gallery (optional), directions/contact.
- Provide 2–3 ready-made editable homepage layouts; allow reorder, hide, preview. Do not require website-development skills.
- Navigation includes `Home`, `About`, `Programs`, `Contact`, `School Portal`. Only show an `Apply` call-to-action when admissions is functional, otherwise use verified contact/enquiry.
- Draft and published versions remain distinct. Provide desktop/mobile previews; staged publish confirmation and a way to roll back.

### Step 4: Set up your school — "A few essentials"

- Quick setup for school levels and current academic year/term or semester; use level-specific defaults for nursery, primary, secondary, TVET or university and offer review/edit.
- Confirm primary admin (owner may be first admin) and invite another administrator **optionally**; teacher/staff invitations are `Do later`.
- RWF preselected and shown as base currency. School fee plans, Mobile Money, payroll, grading, discipline, transport and complex settings are later modules, not required now.
- Explain the difference between `Website ready` and `Academic operations ready` to avoid blocking simple publishing on later modules.
- Security rules, privacy acknowledgement, and contact verification remain mandatory; detailed integrations are deferred.

### Step 5: Review and launch — "Your school is almost ready"

- Show **school logo + actual name**, two visible auto-generated IDs (Company ID and School ID), theme preview, uploaded photos, contact details, public website address, school level(s) and administrator.
- Clear readiness checklist: verified owner, approved institution, safe public content, required brand assets / text fallback, page accessibility and security checks.
- Two distinct actions: `Publish school website` only when public readiness passes; `Open school dashboard` available for authorized setup in draft or active state.
- When publishing: confirmation explaining information becomes public; ensure the school-specific URL resolves and appropriate content is displayed.
- Custom domain is optional and remains pending until DNS verification. A provisional platform subdomain can be used.
- Finish with branded owner dashboard showing launch status, and next-step cards for admissions, teachers, classes and school-fee setup; not fabricated student metrics.

## Visual layout and interactions

Desktop: progress bar (5 segments) across top, small persistent school identity strip, one clear main task in center-left, live preview on right for steps 2/3/5.
Mobile: compact step count, single-column inputs, full-width preview toggled by `See your school`, fixed bottom Continue/Back controls.
Every step: `Save and exit`, `Back`, `Continue`, autosave indicator, resumability, clear error messages and accessibility labels. All writes are server-validated and tenant-scoped. Do not confuse demo preview with functional upload/publish features.

### Example identity strip after Step 1 (illustrative, not real records)

```
[School's own uploaded logo]  Kigali Example Academy
Company ID: RW-CMP-000001  [Copy]   School ID: RW-SCH-000001  [Copy]
Step 2 of 5 — Your logo and school photos         Saved just now
```

## Other user onboarding (separate, short journeys)

- **Teacher:** school-branded invite -> verified identity -> view role/campus/classes when academic module is active -> accept policies -> teacher workspace. Invites expire and cannot elevate privileges.
- **Non-teaching staff:** school-branded invite -> role and campus confirmation -> appropriate operations workspace, no academic grade access.
- **Parent:** school-branded invitation / secure registration -> verify guardian relationship to specific child -> language and notifications -> view only authorized child records after their modules launch.
- **Student:** approved student registration -> invitation and age-appropriate checks, guardian consent where applicable -> school-specific portal and authorized course list. Nursery students generally do not self-register.
- **University/TVET student:** future enrollment/semester registration adds program/course selection; no irrelevant nursery questions.

## Data model / security

Records (logical design, not migrations): `companies`, `schools`, `campuses`, `school_domains`, `owners` or membership/roles, `school_profiles`, `school_brand_themes`, `media_assets`, `homepage_versions`, `onboarding_progress`, `school_status_events`, `audit_events`, `invitations`. Store company/school UUIDs and unique indexed display codes. Company membership does not imply access to every school: enforce explicit scope.

RLS and server authorization must prohibit cross-company and cross-school access in tables, assets, page publishing, invitation acceptance and exports. Validate content/media type, actual bytes and size, scan where appropriate, strip risky metadata, authorize uploads and block unsafe HTML/script injection. Secure school applications against self-provisioning arbitrary privileges. Keep private drafts nonpublic.

## Acceptance criteria — Module 1 cannot be marked complete without evidence

1. Owner registers a standalone school **without ever typing a Company ID or School ID**; both IDs appear automatically upon secure registration and persist through sign-out/resume.
2. One company adding its second school reuses original Company ID and issues a distinct School ID.
3. Two schools show different authentic logos, images, names, homepages and login screens, including on mobile.
4. Logo/photo uploading, preview, update, remove, publish and rollback actually work with permissions and file validation, not only mock interfaces.
5. Onboarding progress autosaves and resumes, with no duplicated tenants on retries or refresh.
6. Optional setup steps can be skipped; unready modules do not expose dead buttons.
7. Draft content stays private until owner approval; public and internal data remain separate.
8. Team and guardian invites are scoped and do not create cross-tenant access.
9. Test direct APIs, RLS, URLs and storage for school A vs school B isolation.
10. No live changes to Supabase are made outside version-controlled GitHub migrations and a single approved deployment path.

**Implementation state:** Specification only. Do not infer completed code, connected GitHub-to-Supabase deployment, or a published school site.
