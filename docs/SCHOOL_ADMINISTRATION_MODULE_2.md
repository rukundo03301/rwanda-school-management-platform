# Module 2: School Administration and Academic Foundation

Status: GitHub feature branch only; NOT merged, deployed, or tested with actual users. This branch depends on School Onboarding Module 1B and the earlier Platform Owner Control Center.

## Scope

After the school owner has a verified identity and the platform owner has activated the school, the institution gets its own private management workspace at /s/{School ID}/admin. It shows the school's approved branding and real available data, not invented student rosters or financial totals.

The PLATFORM OWNER remains separate at /platform, with tenant status and private manually recorded monthly RWF payments. The SCHOOL OWNER administers only their own institution. School Administrator accounts are granted only permissions the School Owner activates. Teacher and school staff invitations are recognized in this release, but their academic workspaces are separate future modules. Parent/student enrollment and verified guardian-child links are NOT built yet.

## Implemented code

1. **School Dashboard:** Overview, People & Access, Academic Setup and School Activity, responsive to desktop/mobile. Each user sees the school-specific name and branding.
2. **Local team invitations:** School owner can invite school administrators, teachers and school staff. Administrators with People.Invite can invite teachers and staff but not new administrators. An invite belongs to one School ID, recipient email and role, with a 14-day expiration.
3. **Secure claiming:** The invited person signs in through that school's own login, verifies email, chooses their intended role, and explicitly accepts a pending invitation. The database re-checks Auth UUID, confirmed email and school status. Choosing Teacher or Administrator on the login screen alone never grants access.
4. **School staff permission switches:** The school owner can edit an administrator's permissions in a table with ON/OFF switches, requiring a reason and multifactor authentication. Permissions: People.Read, People.Invite, People.Manage, Academics.Read, Academics.Manage and Audit.Read. Management permissions imply the corresponding Read permission.
5. **Revocation:** Owner/admin can revoke staff as authorized, with MFA and audit log, without touching that identity's memberships in other schools. Only the school owner can revoke another administrator.
6. **Academic setup:** Create academic years (dates, one current year per school), class sections with optional capacity, subjects, and class-to-subject assignments. Foreign keys bind the academic year, class and subject to the SAME school.
7. **School audit:** Activity events are private to each school and only shown to the school owner or an authorized admin.

## New GitHub files

- database/school_administration_v1.sql
- lib/school-admin.mjs and lib/school-admin-permissions.mjs
- app/api/school/[code]/admin/route.js
- app/api/school/[code]/invitation/route.js
- app/s/[code]/admin/page.jsx and SchoolAdmin.jsx
- School Portal updated to offer an actual admin workspace when the verified role is approved.
- tests/school-administration.test.mjs
- CI builds the web application and tests local migrations in dependency order.

## Email setup and limits

The API may request a Supabase Auth invitation email for a new account when APP_PUBLIC_URL and Supabase Auth email delivery are configured. Existing users can claim their school-specific pending invite using the existing login; the response reports whether an email provider accepted an invite request. No live email delivery is claimed until tested.

## Security boundaries

School-scoped tables have Row Level Security enabled and all browser/anonymous grants revoked. Verified backend reads and actions enforce active school status and matching school_id/role. Audit and permission-edit records stay within the school. The platform owner's private payment clock, reminders, support, global tenant controls and collections are never exposed in this school dashboard.

## Before deployment

- Test production Next.js compile, Node tests, and all three GitHub-controlled SQL migrations against an ISOLATED local database.
- Test real identities across two schools, rejected cross-school IDs, email confirmation, pending/expired/revoked invites, multifactor checks and administrator ON/OFF permissions.
- Test academic year/class/subject integrity, only one current year and school-scoped student-free audit activity.
- Verify Google sign-in/provider setup, actual email redirects and delivery, and a verified single GitHub-first deployment path.
- DO NOT manually edit APEX through the Supabase SQL editor.
- No students/guardians or private academic records, no Android/iOS app, and no actual Vercel production deployment in this increment.

Next module after this one is stable: student registration/admissions, class enrollment and verified guardian-child links before building differentiated teacher, student and parent academic views.
