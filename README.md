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
