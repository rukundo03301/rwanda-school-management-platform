# Module 1B — School Owner Onboarding and Branded School Portal

**Release state: code in GitHub review branch; not deployed or tested with real schools.**
**Branch:** feature/school-onboarding-v1. **Parent branch:** feature/platform-owner-console-v1 (owner console is still a separate draft).
**Database:** APEX project remains untouched. School schema in GitHub-only SQL source.

## End-to-end flow

1. You, the platform operator, register a school in the Owner Console. The server automatically generates an immutable **Company ID and School ID** and a pending invitation addressed to the approved school owner email.
2. You open Tenant Management -> **Invite school owner**. Only a verified, MFA-authenticated platform owner can send the Supabase Auth invitation. If the school owner already has a verified account, they can use their normal login without a new auth invitation.
3. School owner visits **/s/{School ID}/login**. During draft/onboarding state, public page uses school name and neutral placeholder branding rather than leaking unapproved draft photos.
4. Owner authenticates by email/password or Google (when configured). The backend verifies identity and a matching **pending school owner invitation**, then binds membership to the immutable Supabase Auth user UUID. Choosing a public "school owner" role cannot grant access.
5. Owner enters the five-step setup, showing read-only Company ID and School ID with Copy controls throughout:
   - **School identity:** institution type, Rwanda province, district and main campus.
   - **Logo and photos:** upload official logo / campus hero photo, choose school colors. Safe JPEG/PNG/WebP validation and metadata stripping; private setup preview; server-only upload.
   - **School homepage:** tagline, real welcome message, approved announcements, public contacts.
   - **School essentials:** levels offered, academic year, term or semester structure, privacy responsibility acknowledgment.
   - **Review and launch:** check official school information, request platform review and, after activation, publish the school homepage.
6. Owner can **Save & exit**, return and continue. Progress is stored in the school's database record, not in browser-only local storage.
7. Platform operator sees review requests; activation is blocked until review has been requested. School owner cannot activate a tenant or alter platform-level payments.
8. Once tenant is active, school owner may publish a separate copy of their saved draft to the public homepage at **/s/{School ID}**, which shows real logo, image, announcement, school name, About and Contact with a **School Portal** login link.
9. Paused/suspended/archived tenants deny private onboarding access, and public site displays maintenance notice.

## Explicit access boundaries

- A school owner for A cannot access school B by changing the URL or API parameters. Every request verifies a school-scoped membership in protected server code.
- Supabase Auth confirms verified email; the invitation may only be claimed once and is thereafter bound to the verified Auth user ID. A claimed invite cannot be reused after membership revocation.
- All new school tables have RLS enabled and anonymous/authenticated direct access revoked. The trusted server role is never shipped to browsers.
- Uploaded marketing images are public after storage upload; ask the school to upload only its official marketing assets, never student documents or private children photos.
- The school-facing website and sign-in experience do NOT show the platform operator's monthly fee, collection history, overdue date or subscription terminology.
- Parent, teacher, student, school fee, assignments and reports are **not** implemented by this increment. They will have distinct authorized dashboards in later modules.
- While data still lives in the shared APEX project, every API carries current tenant scope. Tenant isolation and invite flows need real integration tests before release.

## Current supported pages and endpoints

- Public school page: \`/s/[code]\` (existing owner branch; extended login link).
- School-specific login: \`/s/[code]/login\` with Email, Google option and password recovery.
- School password reset: \`/s/[code]/reset-password\`.
- Five-step school setup: \`/s/[code]/setup\`.
- School owner API: \`GET/POST /api/school/[code]\` for invitation claim, profile, site draft, request review and publish.
- School upload API: \`POST /api/school/[code]/upload\` validates school membership, file content and size.
- Owner Console adds \`school.inviteOwner\` and review-readiness gate on activating a school.

## Release checks before merging or deploying

- GitHub web compilation and unit/static checks succeed on latest commit.
- Local Supabase CLI starts an isolated DB, executes platform owner migration **then** this school onboarding migration, and checks policies.
- Register two demo schools and claim two different user invitations; direct API attempts across school A/B return denied.
- Confirm neither an unverified email nor a self-selected role can claim access. Confirm expired/revoked invites and revoked memberships cannot be reused.
- Pausing school A immediately denies all school owner APIs and public page publishing while leaving B working.
- Mobile/desktop test that logo upload, campus photo upload, color preview, save/resume, review request and publish work.
- Confirm drafts remain unpublished, published site is branded and shows no private fees.
- Verify Google provider, email delivery, login redirects and password recovery against a safe test environment.
- Confirm the safe, GitHub-only migration deployment target before any APEX release.
- Create a reliable dependency lockfile and production deploy plan.
- **This is a stacked feature branch, not yet merged and never applied directly in the Supabase SQL editor.**

## Future modules

Only after onboarding is functioning will we implement approved teacher/class memberships, verified guardian-child relationships, student enrollments and the different Android/iOS screens. This module does **not** include a released APK or App Store app.

**Publication isolation:** School owner edits are saved in `school_site_drafts`; the public `platform_school_sites` row is updated only by explicit publication. Editing an already-published site does not immediately change what visitors see. Public marketing image URLs themselves are not private, so upload safeguards and school instructions prohibit private student photos.
