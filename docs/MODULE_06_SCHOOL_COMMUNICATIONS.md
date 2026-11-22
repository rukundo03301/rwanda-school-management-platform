# Module 6 — School Timetables, Calendar, Family Communications and Alerts

**State:** development branch \`feature/module-06-school-communications-v1\`, stacked on Module 5. Not merged or deployed; no changes to the APEX Supabase production database and no Android/iOS binaries.

## What is built in this increment

### School owner and delegated administrators

From the school's branded School Community workspace, an authorized school owner can:
- Create a **weekly class timetable** specifying school/year, class, assigned teacher, subject, weekday, start/end time, room. Time displayed in **Africa/Kigali (UTC+02:00)**. The database rejects overlapping teacher, class and room assignments using a per-school/day transaction lock. The teacher must have an active, approved teacher-class-subject assignment. A period can be deactivated with an audit reason; it is not deleted.
- Publish **verified-audience announcements**: all school members, staff, teachers, parents, students or one specific current-year class. Announcements are text-only, with optional expiration; authorized users can mark them as read. The school can archive with an audit reason. **Not publicly visible to website visitors**.
- Create and cancel **school calendar events**: examinations, meetings, holidays, school activities, closures, other. Events have location, date range, audience, optional class, and are calendar-scoped to the school.
- Assign **ON/OFF permission switches** to verified local school administrators, separately for \`timetable.manage\` and \`announcements.manage\`, with MFA and an audit reason. School admins never receive private parent–teacher conversation access from these switches.

### Teacher's school day

A verified teacher sees only current-year timetable periods for their active assigned class and subject. They can see school announcements and calendar events addressed to teachers or their assigned classes, their own enrolled-class roster, and private family conversations where the school has approved both the parent–child relationship and teacher-class assignment.

### Parent / guardian's daily school dashboard

Only an active guardian in \`school_guardian_links\`, with an active parent school membership, can see the current-year enrolled children linked to their account. The dashboard shows **actual** current class, Student ID, published homework deadlines, recorded attendance entries, count of published term reports, timetable, approved announcements and calendar events.

The parent accesses the child's approved full report through the separately verified Module 5 report viewer. Module 6 does **not** expose private homework response text, another child's student profile, teacher-only gradebooks or platform-owner monthly payment data.

### Student, staff and mixed-role accounts

Students must have their independently school-approved account and may see their own current class timetable, school-calendar events and notices. This module intentionally **does not permit unverified child-to-adult messaging**. Other active school staff see general and staff-directed notices and calendar events. A person holding multiple **verified** school roles can view their permitted union within the same school; choosing a role on the login page still never grants membership.

### Private parent–teacher messaging and in-app alerts

A conversation is exclusively bound to: **School ID + actively enrolled Student ID + currently assigned Teacher user UUID + currently verified Guardian user UUID**.

- Either verified participant can start a thread. Both relationships must be valid. Threads can be closed by a participant with an audit reason.
- Messages are text-only, immutable, limited to 2,000 characters, with a school/author cap of **30 messages per hour**. Messages contain no uploaded IDs, student photos or files.
- Every new message creates a dedicated **in-app notification** for the other verified participant; the recipient can mark their own notification as read.
- **Teacher assignment or guardian authorization is rechecked when reading, sending, creating or acknowledging messages.** Once revoked, the API stops exposing existing conversation content to the former participant. A school administrator or platform owner cannot silently read private messages through the default global console.
- Notification records explicitly store \`email_status=not_configured\`. No email or SMS has been sent or promised. External email/SMS provider setup, opt-in preferences, retry/queue and deliverability verification remain a separate integration task.

## Technical architecture

**Schema**: \`database/school_communications_v1.sql\`, the seventh GitHub-controlled, isolated migration, after curriculum/reports.

Private tables:
- \`school_communication_permissions\`
- \`school_timetable_periods\`
- \`school_announcements\`
- \`school_calendar_events\`
- \`school_announcement_reads\`
- \`school_family_message_threads\`
- \`school_family_messages\`
- \`school_message_notifications\`
- \`school_communications_audit\`

Every table has School ID, RLS enabled, direct anonymous/authenticated grants revoked, and service-role-only access through verified Next.js server endpoints. Sensitive mutation RPCs use SECURITY INVOKER, server-role-only EXECUTE, active school/membership checks and an audit entry. School owner controls require MFA. No secrets are present in browser code.

**API**: \`GET/POST /api/school/[code]/communications\`. Each GET and POST confirms the Supabase Auth token, verified school code, active tenant, approved membership and relevant role/child/class/teacher links. GET also filters notifications and threads to currently valid participants.

**UI**: \`/s/[code]/communications\` includes role-specific overview, weekly timetable, school calendar, announcements, private family messages and an owner-only ON/OFF administrator permission matrix. It uses the school's official name/logo and responsive layout.

Connected entry points: School Administration, role-based School Portal, Teacher Classroom, Student Learning and Family Portal.

## Explicitly not yet built

- Native Android/iPhone push delivery or release binaries.
- Email and SMS delivery, preferences, opt-outs, bulk delivery, retries and delivery logs; email reminders in the platform-owner billing console remain separate work.
- Full school timetable substitute management, exam seating plans, public calendar feed, parent–student absence excuses, meal/transport logistics.
- Guardian receipt verification of confidential records, message attachments or school staff monitoring of message bodies.
- Government CA-MIS messaging or NESA integration.
- Financial invoices, tuition collection, Mobile Money or the platform owner's private monthly fee tracking.

## Security and production release gates

1. \`npm test\` and \`npm run build\` must pass with Next.js production compilation.
2. Apply all seven migrations in a **local-only Supabase CI** stack and check SQL functions, indexes, foreign keys and direct browser role revocations.
3. End-to-end test two synthetic schools, two teachers, multiple classes, separate guardians, one student, and an unauthorized user. Attempt cross-school and cross-child reads/writes and ensure they fail.
4. Test overlapping class/teacher/room slots and concurrent scheduling, teacher assignment revocation, transferred pupils, parent link revocation, archived/expired announcements, class-audience notices, message rate limits, and thread notification access.
5. Validate identity, guardianship, parental communication policy, lawful retention, and Rwanda child-data privacy requirements before using real children's records.
6. Add pagination and definitive full-school counts for large tenants; current API caps records for safety and does not claim exhaustive stats.
7. Only apply migrations after verified review through a single GitHub-first pipeline; **do not modify live APEX** in this module.

**Next recommended module:** school fees in RWF, family invoices, receipt issuance, school financial roles and Mobile Money provider reconciliation. This school financial system remains separate from the platform owner's private fee tracker.
