# Module 7 — School Fees, RWF Invoicing and Verified Collections

**Development only.** Branch `feature/module-07-school-fees-rwf-v1` stacked on Module 6. No live APEX migration, no production Vercel deployment, and no native mobile app released.

## School finance belongs to each institution

This module is for **an individual school's tuition and financial operations**, NOT the platform owner's private monthly school-tenant fees or their deliberately invisible fee countdown. The latter stays only in the platform-owner tenant-management console.

Every finance record is scoped by School ID. Fees, invoices, receipts, credits and reports show **RWF only**. Amounts are whole-franc integers (database BIGINT; code checks safe positive integers). Each school's portal and printable receipt use its own approved school name, School ID and logo. No platform-owner brand, payments or ledger is exposed to parents or school staff.

## Built school financial workflows

1. **Fee catalog.** An authorized finance operator defines fee category (tuition, registration, boarding, transport, meals, examination, other), description, term label, current academic year, optional class, RWF amount and payment due date. Deactivation only prevents new invoices; previously issued amounts remain unchanged.
2. **Invoice issuance.** Issue one fee item to a verified, currently enrolled pupil, or to all eligible pupils in the active year/class. One invoice per school/student/fee ID, with unique number RW-INV-xxxxxxxxx and immutable amount/category/term/due-date snapshot. Bulk issuing skips duplicates.
3. **Guardian statements.** A school-verified parent sees only their active linked pupils and their issued invoices, RWF fee amount, credited waivers, posted payments, balance, and payment due dates. Overdue means due date passed **and** balance remains positive. Parents cannot browse other students by Student ID or invoice number.
4. **Payment evidence intake.** Parents may report a transfer already made via MTN MoMo, Airtel Money or bank transfer and its reference. Authorized school cashier can also submit cash and other collections. The default status is **PENDING**; it does not count as funds received, reduce balance or create receipts.
5. **Independent school review.** A separate school-authorized user checks actual third-party evidence (provider statement, bank statement, independently counted cash or other documented evidence), enters review notes and approves with MFA. The person who created a payment cannot approve it. A transaction locks its invoice and checks that the amount is not larger than the remaining balance. Only then is the payment POSTED and a school receipt generated atomically. A claim may be rejected with a recorded reason.
6. **School-issued receipt.** Unique RW-RCT-xxxxxxxxx number, actual school logo/identity, pupil, invoice, amount in RWF, collection date and receipt issue date. A printable A4 view is provided through the browser print dialog. It is explicitly a **school-issued receipt**, not an MTN, Airtel, bank or government receipt.
7. **Credits/waivers and corrections.** Only the verified school owner with MFA may approve a documented invoice credit up to the remaining balance, cancel an invoice lacking pending/posted payments or waivers, or reverse an already posted collection. Reversal voids the school receipt and restores the invoice balance, retaining all history. It **does not initiate a bank refund or MoMo reversal**.
8. **School finance totals.** A database-calculated (not just UI list-based) summary of issued fees, posted collections, approved waivers, outstanding amounts, overdue balances, pending payment claims and invoice count. All figures are RWF and include only the school's own records.

## Permission matrix

The school owner controls all permissions, with MFA and written audit reason. Only verified school administrators or staff may receive specifically toggled rights:

| Permission | Granted capability |
| --- | --- |
| `finance.read` | Read invoices, approved collections, school financial totals and receipts |
| `fees.manage` | Create and deactivate current-year fee items |
| `invoices.issue` | Issue individual or bulk pupil invoices |
| `payments.record` | Submit cash/transfer references for independent review |
| `payments.approve` | Review and approve/reject collections based on actual evidence |

No teacher or student gains financial access from a role selector. A parent can view their own linked children's issued bills and school receipts without finance-staff privileges. School staff do not receive access to other schools' ledgers. The SaaS platform owner does **not** automatically read individual students' private tuition histories.

## Payment provider truth and future integration

**Not yet connected**: MTN MoMo, Airtel Money, K-Pay, bank open banking, merchant wallets, settlement reconciliation, refunds, payment callbacks and SMS payment prompts.

Official references:
- MTN MoMo Rwanda Collections and Request to Pay [production documentation](https://momoapi.mtn.co.rw/content/html_widgets/vqgez.html) and [sandbox products](https://momodeveloper.mtn.co.rw/products). MTN payment callbacks are asynchronous; only final provider status from an authenticated/reconciled transaction may be treated as provider-confirmed.
- [K-Pay merchant API docs](https://kpay.rw/docs/) describe multi-method initiation and callback processing; product selection, service agreements, webhook authentication and settlement contracts require separate merchant onboarding.

For future provider connectors, require: verified merchant custody for **each school**, secret keys in a server-only credential vault, provider-specific API endpoint versions and credentials, initiated-payment status, securely verified callbacks and independent polling/reconciliation, idempotency by provider transaction ID, replay protection, refund and settlement accounting, bank reconciliation and chargeback handling, privacy and financial compliance review. No provider payment confirmation is faked by this version.

## Code files

- `database/school_fees_rwf_v1.sql`: eighth staged SQL schema, seven private tables, sequence numbers, school-only permission checks, finance RPCs, record keeping and school-wide summary.
- `lib/school-fees.mjs`: RWF validation, precise BigInt invoice balances, Kigali date and tenant-specific permissions.
- `app/api/school/[code]/fees/route.js`: verified current-user school finance and guardian read/write API.
- `app/s/[code]/fees/`: branded school financial dashboard, RWF fee catalog, invoices, parent statements, payment review, receipts and role toggles.
- `tests/school-fees.test.mjs`: source-backed static SQL privacy controls, RWF amount calculations, receipt conditions and workflow order.
- School owner, school administrator, school role selector and parent portal links.
- `.github/workflows/owner-console-ci.yml`: eighth isolated local Supabase migration.

## Security and release gates

- All sensitive finance tables RLS-enabled and direct browser roles revoked. Server uses secret key only after verifying Auth JWT, tenant status, active local memberships and verified guardian links; mutations call SECURITY INVOKER RPC with access checked in SQL. Finance permissions granted by school owner only with MFA.
- Review all math, rounding, duplicates, double approvals, simultaneous reviewer actions, partial collections, waivers, reversal, invoice cancellations, academic year transitions, multiple guardian links, orphaned student records, cross-school UUID guessing and mail/phone personal-data minimization.
- **Never mark parent claim as paid** until a different authorized reviewer verifies independent evidence and the SQL posting succeeds. The school is accountable for its manually reviewed evidence; external provider settlement remains unverified automatically.
- A network-initiated payment must not be labelled successful on the browser redirect or callback receipt alone without backend authenticity/reconciliation.
- Current read endpoints cap line-item collections. Use pagination and automated financial reconciliation before high-volume production. Whole-school aggregate statistics use an independent RPC.
- Add comprehensive accounting reports (general ledger/cash receipts/reconciliation), fee-plan revisions, refunds, scholarship/credit policies, duplicate transfer handling, parental dispute workflow, multi-currency conversion only when required, tax/regulatory review and native app packaging in later increments.
- Changes remain on GitHub; no production Supabase or Vercel changes occur as part of this PR.

**Validation:** Complete Node and Next production builds, all eight isolated database migrations, and real synthetic-school payment/permissions end-to-end tests before moving beyond draft.
