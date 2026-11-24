# School operations and role-linked modules — Rwanda demonstration architecture

**Scope:** School D, `RW-SCH-000004`, fictional records only. **Currency:** RWF. **Timezone:** Africa/Kigali.

## Rwanda-specific roles and governance
Rwanda's education legislation identifies a head of institution and deputies responsible for studies and discipline, depending on institution category and enrollment. School governance varies by school type and applicable rules, so "board of directors", "School General Assembly", and private-company directors must be modeled as distinct configurable governing bodies rather than one universal mandatory board. Sources:
- https://rwandalii.org/akn/rw/act/law/2021/10/eng%402021-02-18
- https://rwandalii.org/akn/rw/act/mo/2016/3/eng%402016-01-18
- https://www.reb.rw/

## Roles and first screens
| Role | Entry point / navigation | Data it sees | What it does | Explicit restriction |
|---|---|---|---|---|
| School Owner | Overview, Staff, Academics, Finance, Website, Operations, Governance, Reports | Own school operational indicators | Assign administrators and approve school policies | No other tenant, no blanket access to confidential safeguarding |
| Head Teacher / Principal | Today's priorities, Academics, Staff, Attendance, Approvals, Reports | Own-school academic and authorized personnel summaries | Supervise teachers, academic calendar, approvals and reporting | No SaaS platform billing |
| Deputy Studies | Curriculum, Timetable, Assessments, Teacher Assignments | Authorized class / teacher plans | Academic supervision and moderation | No finance posting by default |
| Deputy Discipline | Attendance, Conduct, Safeguarding, Activities | Minimum necessary learner records | Supervise attendance and conduct | Sensitive case-level policies |
| Teacher | My Classes, Timetable, Lessons, Homework, Gradebook, Attendance, Messages | Assigned class roster and their own assignments | Teach, mark attendance, publish homework, grade and give feedback | Cannot read unassigned classes |
| Student | Learning, Timetable, Homework, Attendance, Results | Own released records | Submit learning activities | No unpublished grades or other students |
| Parent / Guardian | Children, Homework, Attendance, Reports, Fees, Messages | Only verified linked children | Follow progress and communicate | Financial access requires separate grant |
| Bursar / Finance | RWF Invoices, Receipts, Arrears, Reconciliation | School-approved finance | Reconcile, receipt, support budgets | No grade edits |
| Secretary / Registrar | Admissions, Students, Attendance, Records | Approved admission records | Verify enrollment and guardian links | No financial approvals without grant |
| Cook / Kitchen | Meals, Daily Meal Counts, Food Inventory | Required meal counts and limited dietary flags | Issue food stock, record meals | No grades or school fees |
| Security Guard | Visitors, Gate Log, Pickup Verification, Incidents | Minimum necessary names and access authorizations | Control entrances and escalate incidents | No academic or finance records |
| Maintenance | Assets, Work Orders, Inspections, Parts | Asset registers and tasks | Inspect, repair and document work | No student private data |
| Patron / Matron / Animatrice (where applicable) | Boarding/Welfare, Supervision, Activities | Assigned pupils only and essential safeguarding flags | Supervision and welfare, escalate issues | Not general guardian/student record access |
| Board / General Assembly | Governance, Meetings, Policies, Approved Budgets, Reports | Approved aggregate reports only | Oversight and approvals as constituted | Cannot access individual child grades or override operations by default |

## Shared authoritative data; no disconnected dashboards
School Owner → verified staff role → class and subject assignment → student enrollment → verified guardian link → teacher lessons/homework/attendance/marks → released student report → parent view.
Finance officer reads student fee invoices and receipt ledger, never the platform-owner private subscription ledger.
Operations staff use asset register → maintenance work order → inspection and closure, and stock catalog → receipt → issue → physical counts with immutable audit trails.
Public relations officer / approved school owner drafts event notices and social links → publication approval → school public homepage; social links must be real approved URLs.

## School owner management modules and dependencies
1. **School identity**: public homepage, uploads, official links, publication, campus and academic setup.
2. **People / Roles**: school employees and contractors, memberships/invitations, principal and deputy roles, teacher assignments, staff-scoped permissions. Directory records alone never authorize logins.
3. **Admissions / Students / Guardians**: application → admission → enrollment → approved guardian, with immutable academic-year history.
4. **Teaching / Assessments**: assignments, attendance, feedback, moderation and published reports shared across teacher/student/parent dashboards.
5. **Finance (RWF)**: fee catalog, invoice → proposal/verification → receipt → allocation and reporting; audit and separation of duties.
6. **Facilities / Assets / Maintenance**: site, building, room, asset barcode, custodian, scheduled maintenance, defect, work order, parts and cost approvals.
7. **Stock / Procurement / Kitchen**: item, location, stock receipt, issue/return, count/adjustment, supplier, approved purchase; meal counts and allergen-aware minimal-access data.
8. **Governance**: board or School General Assembly structure configured by school category; members, meetings, resolutions, approval thresholds, compliance calendar and audit committee.
9. **Events / Communications / Website**: timetable, public events, school announcements, approved school social links and newsletters; never send child data to social platforms.
10. **Reports**: attendance, class performance, enrollment, inventory valuation, maintenance backlog, budget and board-approved aggregates. Private operational views use trusted school-scoped APIs.

## Important existing implementation boundaries
Current APEX tables cover academics, enrollment, student fees, homework, announcements, calendars and basic school-user roles. The application does **not** yet contain a production-grade school employee directory, role-specific board portal, asset ledger, inventory stock movements, work orders or procurement. The JSON fixture under `demo/school-d-full-sample.json` is **not** an authentication database and must never be advertised as live staff accounts.

Before adding new school_id-scoped SQL tables, extend the existing 54-table tenant purge manifest and isolated two-tenant wipe tests, enforce RLS and private API authorization, and keep operational changes in GitHub-controlled migrations. Public social URLs must be verified school-supplied links only.

## Demonstration success test
Show exactly 20 fictional learners in four classes; five distinctly assigned teacher profiles and five operational staff profiles (only actual verified accounts may sign in); sample events and notices; RWF tuition examples; a private stock and asset list; board meeting agenda; distinct role dashboards with real database joins and no cross-school access. No real fees, emails or social posts may be sent.
