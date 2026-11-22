# Module 5 — Rwanda Curriculum, Assessment and Term Reports

**Status:** GitHub development branch, stacked on Module 4. Not merged, deployed to APEX, or released on Android/iPhone.

## Official references and what they prove

1. [NESA Guidelines on Recording Marks in CA-MIS, December 2023](https://www.nesa.gov.rw/fileadmin/user_upload/NESA/Ressources/Assessment_Standards_and_Guidelines/Guidelines_on_Recording_Marks_in_CA-MIS_December_2023__Signed_.pdf): General/Professional Education term marks use end-of-unit 25%, projects 25%, end-of-term 50%, with a subject marks ceiling of weekly teaching periods ×10. The source also documents TVET's distinct rules and lower-primary LEGRA recording.
2. [NESA P1–P6 End-of-Term II Assessment Standards 2025–26](https://www.nesa.gov.rw/fileadmin/user_upload/NESA/Ressources/Assessment_Standards_and_Guidelines/2025-2026_End_of_Term_II_Assessment_Standards_P1_-_S6_GE_PE_TSS/Primary_AS_Term_II_2025-2026_Signed.pdf): official subject assessment listings and separate paper versus CA-MIS maxima, plus LEGRA and inclusive assessment requirements. Source year is specific; do not apply it automatically to a different academic year.
3. [MINEDUC Comprehensive Assessment Instructions](https://www.mineduc.gov.rw/fileadmin/user_upload/Mineduc/Publications/ORDERS/MINISTERIAL_ORDERS__AND_INSTRUCTIONS/MI_comprehensive_Assessmentcomp_F-compressed.pdf): teacher subject marking, recording end-unit results, feedback, remediation and parental communication.
4. [REB Competence-Based Curriculum Framework](https://elearning.reb.rw/pluginfile.php/20881/mod_forum/attachment/10050/Competence%20Based%20Currilum.pdf?forcedownload=1): syllabus units, competence-based learning and outcomes.
5. [MINEDUC A-Level pathway reform](https://www.mineduc.gov.rw/news-detail/rwanda-introduces-new-a-level-learning-pathways-in-general-education): Mathematics and Sciences, Arts and Humanities and Languages pathways. Effective dates and per-cohort subject combinations need school verification.

**Important:** No universal official NESA report-card artwork/template was verified for every Rwanda institution. We generate a SCHOOL-ISSUED report using source-backed marking rules, not a ministry-issued certificate, official seal, national examination slip, CA-MIS submission or purported NESA-approved form.

## Built curriculum system

Each school creates a versioned curriculum source profile for the academic year, with education track and level band. Tracks: General, Professional, TVET, Nursery, Higher Education and International. Upper-secondary pathway is stored separately. All schools remain individually branded.

A course mapping connects School ID, real class, real subject, academic year, source document, approved weekly periods or TVET credits, and syllabus link. Unit records contain an official unit code, title, assigned term (1/2/3), key competence and learning outcomes. Only the verified School Owner can approve curriculum profiles or subject mappings, after MFA. Teachers refer to these actual units when entering end-of-unit marks.

The read-only reference library embeds NESA's 2025–26 Term II primary assessed subjects with paper and CA-MIS maxima for P1–P6. It is a reference for verification, NOT a complete imported REB syllabus. Individual schools still enter and validate unit content and their applicable syllabus versions.

## Marking and report calculation

A verified, actively assigned teacher enters a score and the original exam paper maximum. Example: 39/40 is converted to 78/80 if the curriculum subject maximum is 80. Database validation checks the current School ID, class, year, subject, enrollment, teacher assignment, real syllabus unit and allowable score.

General/Professional school report rules:
- End-of-unit normalized assessment average ×25%.
- Project-based normalized assessment average ×25% (minimum two projects per subject per term before publication).
- End-of-term normalized assessment ×50% (exactly one term exam).
- Subject maximum = approved subject weekly teaching periods ×10.
- Overall percentage = sum earned subject marks / sum available subject maximum marks, not unweighted subject averages.
- Worked NESA example: units 35/40, projects 32/40, end-of-term 39/40 gives 36.25/40 or 90.63%.

All class subjects must have approved curriculum sources and all the configured units for THAT term must have recorded marks before release. Draft marks never appear in parent/student published reports.

## Institution-specific report-card design

Printable A4 school-issued term card includes the actual school logo, name, School ID, student's name and Student ID, class, academic year, term dates, each subject's units/projects/end-term assessment columns, totals and percentages, overall weighted total, class-specific attendance counts for actually recorded days, relevant syllabus competences, teacher feedback, school leader remark, publication date, version and unique report reference.

The headteacher/school owner explicitly publishes. Publication makes an immutable snapshot; corrections require formally withdrawing the published report with MFA and an audit reason, then recording corrected marks and issuing a new version. Old withdrawn history remains for audit. The parent/student report viewer shows published versions only.

Teachers enter grades for their assigned classes/subjects only. School Administrators may receive Curriculum.Manage or Reports.Read privileges using owner-controlled ON/OFF toggles; neither grant allows publication. A verified Student sees only their personal published reports. A verified Parent/Guardian sees only linked children with active school-specific guardian relationships. The platform owner retains separate multi-tenant monthly RWF billing operations and does not automatically receive confidential grades.

## Unsupported tracks intentionally blocked from automatic General Education calculations

- Lower Primary P1–P3: separate LEGRA four-aspect Kinyarwanda and early-grade assessment rules.
- TVET: NESA specific modules use 30% formative and 70% integrated at module level, followed by separate term weighting; complementary/general modules have different 50/50 rules. Must be a distinct engine.
- Nursery: age-appropriate qualitative development records.
- International and Higher Education: institution/authority-approved grading rules, not automatically Rwanda General Education weights.

No fake national ranks, grade boundaries, promotion decisions, mandatory signatures, government stamps, school fee balances or CA-MIS API submissions are produced.

## Code

- database/school_reports_curriculum_v1.sql (sixth GitHub-controlled local migration).
- lib/school-reporting.mjs and lib/rwanda-nesa-primary-reference.mjs.
- /api/school/[code]/reports (verified curriculum, marking and release management).
- /api/school/[code]/published-reports (verified guardian/student published-only read).
- /s/[code]/reports (owner/admin/teacher academic workflow).
- /s/[code]/report-card (private branded printable term card).
- tests/school-reports-curriculum.test.mjs.
- School admin, teacher, student and guardian portals connected to the authorized reporting interfaces.

## Quality gates

1. Node security/calculation tests, Next.js production build and all SIX migrations must pass in isolated CI before merge.
2. Test two synthetic schools, two teachers, multiple pupils, guardians, revoked links, separate terms, missing unit/second project, different original paper denominators, source approvals, concurrent mark/publish, report withdrawal and corrected reissue.
3. Verify current academic-year syllabus and MINEDUC/NESA rules with authorities; additional recent policy or report templates could supersede the source year.
4. Perform access/consent/data-protection/legal review before processing real children; pagination and full-scale reports still require hardening.
5. Do not write SQL into the live APEX dashboard. All migrations remain in version-controlled GitHub through one verified release pipeline.
6. Print/Save as PDF uses the browser printing feature; no official signed PDF or native Android/iPhone binary has yet been generated.

**Next:** standards-specific lower-primary and TVET grade profiles, regulator-reviewed report template layouts, national school-grade syllabus imports, and external CA-MIS integration only after verified specifications and authorization.
