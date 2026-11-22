# Owner console: login, recovery, staff roles and permission toggles

Status: implementation on a GitHub feature branch; not deployed or end-to-end tested.

## User-visible sign-in flow

1. Email and password: Supabase Auth authenticates the user, then server confirms the owner's verified account or approved staff privileges. Otherwise only Access Pending is displayed.
2. Continue with Google: Supabase OAuth returns a verified identity to the same authorization gate. Selecting Google never grants owner or staff rights.
3. Create staff account: user signs up, confirms email, signs in, requests access; only platform owner can approve after multifactor verification.
4. Forgot password: user enters account email, Supabase issues an email recovery link when applicable. The recovery page at /platform/reset-password accepts a new password (minimum 12 characters) and signs out after successful change.
5. Existing MFA: security screen can enroll an authenticator, verify an already-enrolled authenticator after sign-in, and unlock restricted actions requiring AAL2.

## Permission matrix UI

Platform Owner > My Staff displays a table with each active staff member, role, current permissions and an Access Table action.
The approval and edit dialogs show one row per permission, readable description and an accessible on/off switch. The owner can change role and permissions, enter a reason and save. The server checks owner identity and AAL2, validates permissions, updates the staff record transactionally and writes an audit event.
Disabling a staff account denies its subsequent protected API requests even if the person has a valid login session.

## Required Supabase configuration

- Enable Email Auth and require confirmed email addresses.
- Enable Google under Authentication > Providers using the account owner's Google Cloud OAuth client ID and secret. Register the exact Supabase Auth callback URL.
- Configure correct production Site URL and allowed redirect URLs for /platform and /platform/reset-password; add localhost only for local development.
- Configure suitable email delivery for production password reset and confirmation emails.
- Set protected server environment keys and the verified platform-owner email. Never commit a Supabase secret key or OAuth client secret.
- Activate and verify account MFA before exercising privileged actions.

## Test gates

- Email login, rejected credentials, unconfirmed accounts, signup pending, logout and recovery email roundtrip.
- Google login works only after OAuth provider configuration; verified but unauthorized Google user sees Access Pending.
- Reset link expiration and account-session renewal behave correctly.
- Owner can toggle individual staff permissions; unauthorized actor cannot update staff; changed permission applies to next server request.
- Owner must verify MFA to approve staff and change permissions; audit records preserve reason and actor.
- All functionality must pass GitHub CI, isolated Supabase SQL migration checks and local browser/API integration checks before deployment.

## Current limitations

Auth code and UI exist, but no live website, production OAuth credentials, email provider, database deployment or complete end-to-end login test has been verified. GitHub is the source of truth; don't use Supabase SQL editor for schema changes.