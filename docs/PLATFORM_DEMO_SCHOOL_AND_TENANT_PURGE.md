# Mockup School and Permanent Tenant Deletion — Owner Control Center

**Status:** GitHub draft (not merged or deployed). This feature runs in the private Platform Owner Console and uses the new ninth migration. It must first pass the isolated two-school deletion test and a real authenticated owner/UAT smoke test.

## Create a fictional demo tenant

In Platform Owner → Tenants, select **Create Mockup School** and confirm using a platform-owner session with MFA (AAL2). The database creates a synthetic, clearly labeled school and company, including:
- Unique School ID and Company ID.
- Separate school identity, fictional mission/about page, teal school branding, banner **DEMO SCHOOL — SAMPLE DATA ONLY**, and a generated KLA sample logo uploaded to the school's own Storage folder (if upload succeeds).
- The platform owner linked locally as the fictional demo school owner/teacher/guardian (no separate Auth user created).
- Current academic year, Primary 4 class, mathematics subject, assigned teacher.
- Fake admission, fictitious student, enrollment and active sample guardian link.
- Sample lesson plan, homework, attendance, timetable, school announcement and calendar event.
- Sample RWF fee catalog, one **unpaid fictional invoice**, and a clearly marked **PENDING, NOT REAL** payment claim (no settlement or receipt).
- Sample platform support ticket and zero-RWF private platform monthly fee tracking.
- **No real payments are initiated; no invitation emails are sent; no actual school documents are uploaded.**

The sample exists only after deployment/migration and the platform owner's explicit Create action. The isolated CI test creates and deletes synthetic records in a local DB transaction and then rolls them back. It does **not** provision demo data in live APEX.

## Permanently remove a school from Tenant Management

1. Open Platform Owner → Tenants and choose **Permanently delete** for the specific school.
2. Review its School ID, tenant name, whether it is a demo, whether a legal hold exists, how many of the **54 scoped tables** contain that school's records, and how many school-owned Storage files exist.
3. Explain the reason (12+ characters), type the complete School ID and exact phrase **DELETE ALL SCHOOL DATA**, and check the irreversible-action acknowledgement.
4. The server requires the immutable configured Platform Owner user ID and the verified **AAL2 MFA token**. Other platform staff and school owners cannot use this capability.
5. The school moves to **deletion_requested**, immediately blocking school user access and further active-school operations. If file deletion fails, the tenant stays stopped so the owner can retry safely; the app does NOT claim it was purged.
6. The server uses Supabase Storage **remove API** to physically delete files under the school-specific `<SchoolUUID>/`, `schools/<SchoolUUID>/`, and `tenants/<SchoolUUID>/` prefixes, in each bucket discovered by the trusted preflight RPC. It never deletes from `storage.objects` directly.
7. A repeat database preview must confirm **zero scoped Storage objects**, and the SQL RPC refuses to proceed if any remain.
8. A single PostgreSQL transaction deletes rows from all 54 scoped school tables **child-first based on actual foreign-key dependencies**. All operations use `WHERE school_id = target school UUID`; there are **no global TRUNCATE or ON DELETE CASCADE shortcuts**.
9. Remove the school's Platform Owner audit references and the school root row. The company is deleted only if it has no remaining schools. A nonidentifying purge audit record retains aggregate deletion counts but **no school code, UUID or school name**.
10. Verify the school record no longer exists. If any constraint blocks a database deletion, the SQL transaction rolls back. The application reports success only after the final checks.

### What is wiped in the application

School-specific institution identity/site, onboarding, staff and roles, applications, students/guardian links, classes and teachers, homework, attendance, marks and published reports, syllabus, timetable, school calendars and announcements, private school messages and in-app alerts, school fee catalog, invoices, payment references, receipts, credits, tenant monthly fee records, school-specific support tickets and school-specific platform audit references. The system also deletes files in the platform's known School ID-prefixed Supabase Storage folders.

### What cannot be truthfully claimed as instantly erased

- **Shared Auth users:** A teacher or parent login may belong to another school or also be the Platform Owner. Tenant-specific memberships and links are erased, but shared Supabase Auth credentials are not destroyed.
- **Supabase backups / point-in-time recovery:** Operational backups can retain previous data for the provider's backup retention period; this application cannot instantly erase snapshots.
- **External email, SMS, downloads and cached exports:** Previously delivered or independently copied content cannot be recalled automatically.
- **External brand images:** A URL linking to an outside website is removed from our school database, but data owned by an outside host cannot be erased by our Storage API.
- **Future systems without School ID scope or unknown storage paths:** The database refuses to wipe when a new School ID table or unexpected foreign-key dependency appears; future modules must extend the manifest, storage mapping and smoke tests before going live. Only the platform's supported School ID prefixes are scanned for Storage objects.

For active real schools, conduct a finance/legal retention review before authorizing irreversible deletion. A `legal_hold` flag prevents erasure pending that review. The owner must not confuse tenant suspension, archiving or deletion request with verified permanent purge.

## Validation and threat model

- The ninth migration adds `platform_schools.is_demo`, `platform_schools.legal_hold`, 54-table scope manifest, preflight counts, demo seed and foreign-key-ordered transactional purge.
- `tests/tenant-demo-purge.test.mjs` verifies schema coverage, explicit MFA/exact-code checking, Storage API safety, and owner UI controls.
- `tests/platform-tenant-purge.smoke.sql` in GitHub Actions inserts one *synthetic* verified Auth user and two separate demo schools in **local-only PostgreSQL**, asserts a complete table inventory and per-table counts, asserts that an unexpected new school table, missing deletion state, legal hold or wrong School ID each blocks deletion, purges one demo school, checks all 54 tables have **zero** remaining school rows, confirms the second school is unchanged, then removes the second school and rolls back the complete test transaction.
- Before production: run a real authorized owner session with MFA, deliberately upload branded images to multiple Storage buckets, then confirm physical deletion and inaccessible school URLs; simulate file deletion failure, revocation, concurrent tenant use and large datasets. Production legal, backup, idempotency, storage and race-review gates remain required.

**Key safety property:** The feature cannot guarantee erasure of third-party copies or provider backups, but it can make a verifiable, tenant-scoped deletion of database records and managed school files without affecting other schools.
