# Private Monthly School Payment Clock and Owner Email Reminders

**Scope:** Owner-only tenant management; deliberately **not** a public subscription product.
**Code status:** GitHub feature branch, not deployed to APEX or Vercel.
**Money:** RWF (whole francs). **Clock:** Africa/Kigali calendar dates.

## Business design

Each school is independently branded in its public website and eventual login screen. No school-user interface contains the platform owner's internal payment date, pricing, payment reminders, or revenue administration.

The platform owner manages internal payment dates within **Tenants** and **Monthly payment clock**:

1. Register school -> unique Company ID and School ID, school remains in onboarding until approved.
2. **Set monthly fee**: choose RWF amount and initial date due (internal only).
3. On actual payment received outside the app (e.g. MTN Mobile Money, bank, cash), owner opens **Mark paid**, selects actual payment date, RWF amount, method and optional reference and notes.
4. Full payment is recorded in an immutable/audited ledger; next_due_on is set to one calendar month after **the date actually paid**, with month-end clamping.
5. Every school displays due-date countdown: upcoming, due today or overdue, calculated in Kigali civil time. Dashboard shows overdue and due-today totals.
6. The owner may pause/suspend/reactivate a school using existing tenant controls; payment overdue **does not automatically suspend a school**. This is deliberately a manual owner decision.
7. Mistakes are corrected through an auditable void action; original payment entry remains in history. No direct external payment is initiated or altered.
8. First software release allows manually entered full-month receipts only. Partial payments, credits, multi-month advances, and complex arrears balances need an explicitly designed allocation ledger before use.

## Daily owner-only email reminders

The GitHub Actions job `.github/workflows/owner-fee-reminders.yml` is designed to run daily at **07:17 Africa/Kigali** (05:17 UTC), subject to GitHub scheduling delays.

The job reads private fee dates and sends **one plain-text email digest to the operator's designated address only** if one or more schools are:
- Overdue (past the due date)
- Due today
- Due in the next **7 days**, including exactly seven days away

The email contains school name, School ID, next due date, expected monthly RWF amount and number of days. It explicitly states that payments are manually recorded and not independently verified by a bank.

The job does **not** send email to a school, parent, student, teacher, or other staff member. Nor will it use a branded school email identity. It contains no student's personal or academic details.

### Duplicate prevention and failure handling

The SQL source creates `platform_owner_email_digests` with a unique pair of Kigali date and recipient address, and the `platform_claim_owner_digest` server-only function prevents a routine duplicate. If an attempted send fails, it can be retried. If the provider accepts email and the audit update fails, provider logs must be inspected: no email service can guarantee exactly-once delivery across all network failures. GitHub cron runs can be delayed.

A digest is not sent when every school is more than 7 days away or lacks a fee schedule.

## Configuration before activation

The owner must configure these GitHub **Actions Secrets**:
- `NEXT_PUBLIC_SUPABASE_URL` — exact Supabase API endpoint (APEX)
- `SUPABASE_SECRET_KEY` — privileged key, Actions-only secret; never expose to browser or logs
- `BREVO_API_KEY` — transactional mail API key
- `BREVO_SENDER_EMAIL` — email verified as a sender with Brevo
- `PLATFORM_OWNER_ALERT_EMAIL` — private address to receive reminders

And set GitHub **Actions variable** `ENABLE_OWNER_EMAIL_REMINDERS=true` only after the code and migration are approved and deployed.

The email API is Brevo transactional `POST https://api.brevo.com/v3/smtp/email`, using `textContent`. Sender must be verified. The task sends no messages while running from the feature branch because GitHub scheduled workflows only run from the repository default branch and the job itself requires `main`. It also exits without sending unless the explicit enable flag is set.

**Do not put an actual email address, API key, or sender credential in GitHub source files.**

## School-facing branding and neutrality

The platform operator can configure each school's logo, banner/campus hero photo, public school welcome message, news/announcement, school colors, description and school contacts using the **School site** action in tenant management. Uploaded marketing-only images are processed and published through the `school-branding` storage bucket. Tenant public page is `/s/{School ID}` when the school is active and its site published.

This is a school-owned *public homepage*, not a completed teacher, parent or student login app. School-specific authentication and child/teacher scope will follow in a later tested module; the placeholder homepage should not suggest they are already built.

The private owner payment clock, collection records and fee reminders must never appear in public school site pages.

## Release validation before telling owner reminders are live

- Latest GitHub CI: unit tests, Next.js build, isolated Supabase migration, security checks.
- Test on isolated data: seven days before, due today, one day overdue, leap date and January 31st.
- Confirm payment recording updates due date without creating duplicates and every change is logged.
- Test the Brevo provider in a staging environment using a non-production recipient and verified sender.
- Validate duplicate-suppression records and failed-send retries.
- Test with two schools; no tenant or student data leaks in email/website.
- Verify Github Actions secret permissions, allowlist, and actual scheduled workflow on main.
- **Never deploy SQL directly to Supabase Studio.** Approved migrations only, through a single verified GitHub-first migration pipeline.

**Current state:** The workflow and code are saved in the feature branch, but no email has been sent, no live API credentials were configured, and APEX is untouched.
