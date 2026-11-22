# Platform Owner Console — Implementation and Release Readiness

## Purpose

First delivery focuses exclusively on the SaaS **platform operator** (you), not the individual school portals. It's an actual Next.js application + secure server endpoints + GitHub-only SQL source, not a static mockup. Until the release gates are met, it is **development code**, not a functioning production website.

## Implemented in feature branch

- Owner-branded platform web dashboard with real (not invented) tenant counts and status views.
- Tenant listing/search/filter; registration generates separate immutable Company ID and School ID through DB function.
- Tenant lifecycle transitions: onboarding, active, paused, suspended, archived and deletion_requested (not physical deletion); reason required and audit created.
- Support tickets can be opened, assigned to staff with ticket permissions, tracked and resolved.
- Staff first signs up and **requests** platform access; verified owner approves a role and exact permissions; permissions are server checked on each request; owner may revoke.
- Subscription invoices and payment event readout in **RWF** and aggregate global totals, separated from students' school fees.
- Platform payment-method catalog: name/type, enabled/default options. **NOT** real MTN Mobile Money settlement or provider authentication.
- Supabase Auth sign-in and sign-up; verified owner email configured on server; MFA required for staff grants, default method changes and deletion requests.
- 9 pure unit tests and SQL security static checks; GitHub CI workflow that does **not** deploy the database.
- Responsive desktop/mobile web layout. Native Android/iPhone builds are a separate implementation milestone.

## Before the first test deployment

1. Verify latest GitHub branch compiles in CI and every automated test passes. A successful GitHub commit alone is not proof of build quality.
2. Obtain a generated dependency lockfile, verify dependency versions/security, commit it and change CI from \`npm install\` to \`npm ci\`.
3. Use official **Supabase CLI** on a developer workstation or isolated CI environment to create the migration: \`supabase migration new platform_owner_console\`. Copy GitHub \`database/platform_owner_console.sql\` into the CLI-generated migration. **Never create tables manually in Supabase Studio.**
4. Apply migration in a safe local/test environment, validate function SQL semantics and RLS. Until that is done, schema isn't proven executable.
5. Verify one GitHub-to-Supabase migration deployment path (native integration OR GitHub Actions, not both) and target it to APEX project \`stgqhkhfpnqmsiyrvvhe\`. Do not merge migration to main or trigger production until staging gates pass.
6. Verify Vercel team authorization and create a web project from this GitHub repo. Protect environment variables and do not expose the Supabase server secret to the client.
7. Add environment variables on server: \`NEXT_PUBLIC_SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\`, \`SUPABASE_SECRET_KEY\`, and \`PLATFORM_OWNER_EMAIL\`; configure the last to the owner's **confirmed** Supabase Auth email. Never put passwords, tokens or service/secret keys in GitHub source.
8. Verify account email confirmation and owner TOTP MFA. Tests must cover browser authentication, API authorization, staff approvals, ticket assignment, tenant status actions, and database audit entries.
9. Verify page access and tenant reads after suspend/revoke. Current 1A tenant statuses are the operator control plane only: **they do not yet enforce school-user access** because school-member modules do not exist. Their APIs must enforce this status before onboarding schools.
10. Do not release real children/student data until Rwanda privacy, hosting/transfer, security and retention responsibilities are reviewed.

## What is intentionally **not** yet working

- No automated school-subscription invoices, real gateway payment collection, Mobile Money callbacks, bank settlement, cash/balance verification, refunds or reconciliation. "Who paid" will display trusted payment events once an integration writes them. Nothing is fabricated.
- No automated reminder emails or customer ticket creation from school portals; school-facing portals are later modules.
- No irreversible tenant deletion/purge: deletion request workflow only, with legal review needed.
- No direct staff invitations by email; staff create verified accounts and request access, owner approves.
- No school-owner dashboards, teachers, parents, students, Android APK, iOS IPA or app-store releases yet.
- Current tables use a single project shared schema, but future tenant data require separately designed RLS and verified relations.
- No production deployment, no successful migration execution, no native-app smoke test.

## Required user acceptance checks

- Operator signs in under confirmed \`PLATFORM_OWNER_EMAIL\` and sees empty state with all zeros.
- Operator creates School A, receives different Company and School codes. Create School B; IDs must differ.
- Pause School A, activate again; audit shows reason, actor and timestamps.
- Staff user requests access, owner grants \`support\` permissions after MFA; staff can resolve ticket but cannot create/activate tenant or see billing.
- Owner revokes staff; next API request is denied without a new role.
- Owner requests deletion by typing exact School ID with MFA; data stays present pending legal review.
- Revenue shows RWF 0 when no real invoices/payments exist. No fake balances or invented paid status.
- Multiple screen widths and keyboard navigation checked; no broken sidebar/tabs.
- CI, SQL migration and security tests passed before module can be called "built and working" in production.

**Source rule:** Only approved GitHub code/migrations can change Supabase; do not use Supabase SQL editor to create, drop or edit tables.


## Owner-only payment model amendment (overrides legacy subscription language above)

There is **no tenant-facing subscription portal**. The business owner sets a private monthly RWF fee and due date for each school, records actual payments manually, and sees countdowns, past-due alerts and an audited ledger in Tenant Management. Payment due never triggers automatic suspension. The app does not claim that manual receipts were verified by a gateway.

The new optional GitHub Actions email digest lists schools overdue, due today or approaching due within seven days, delivered privately to the operator through a configured Brevo transactional email account. It requires an approved GitHub-first migration, deployment, Brevo sender/API configuration, designated owner recipient and enable flag. See [Private Monthly Payments and Reminders](./PRIVATE_MONTHLY_PAYMENTS_AND_REMINDERS.md).

Tenant branding now includes a public institution-specific homepage with owner-configured logo, campus photograph, school description, official contacts and announcement. The school portal login and actual school-role dashboards are not yet implemented and must not be presented as active.

The platform owner's identity now uses the immutable authenticated user UUID from `PLATFORM_OWNER_USER_ID`, not an editable email setting.
