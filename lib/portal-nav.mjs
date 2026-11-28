// One navigation model for every school page, so each role sees the same sidebar whether it is on
// its dashboard or on a module page (messages, report cards, fees, resources, reports, admin).
// Tab items open the role dashboard on that tab through ?tab= ; other items are module pages.
const ORDER = ["school_owner", "school_admin", "teacher", "staff", "parent", "student"];
export const ROLE_LABEL = { school_owner: "School Owner", school_admin: "Principal", teacher: "Teacher", staff: "School Staff", parent: "Parent / Guardian", student: "Student" };
export const HOME = { school_owner: "home", school_admin: "home", teacher: "classroom", staff: "home", parent: "family", student: "learning" };
export function primaryRole(roles) {
  const list = Array.isArray(roles) ? roles : [];
  return ORDER.find((r) => list.includes(r)) || null;
}
export const FRAMED_PAGES = ["communications", "report-card", "resources", "studio", "reports", "operations", "admissions", "admin", "fees", "requests", "security", "student-logins", "staff-logins", "nursery", "term-reports", "courses"];
export const PAGE_TITLE = {
  communications: "Messages and Timetable", "report-card": "Report Cards", resources: "Learning Library", studio: "Smart Learning Studio", reports: "Reports and Curriculum",
  operations: "School Operations", admissions: "Students and Admissions", admin: "Administration", fees: "Fees and Payments",
  requests: "Leave and Purchase Requests", security: "Security", "student-logins": "Student Logins", "staff-logins": "Staff Logins", nursery: "Early Years Observations", "term-reports": "Term Reports", courses: "My Courses",
};
// levels: the education levels the school offers (School setup). Level-specific modules
// appear only for schools that offer that level.
export function portalNav(role, code, current, levels = []) {
  const base = "/s/" + code + "/";
  const tab = (home, id) => base + home + "?tab=" + id;
  const page = (label, icon, seg) => ({ label, icon, href: base + seg, active: current === seg });
  const dash = (label, icon, home, id) => ({ label, icon, href: tab(home, id), active: false });
  const offers = (l) => Array.isArray(levels) && levels.includes(l);
  if (role === "parent") return [
    dash("Dashboard", "home", "family", "dashboard"), dash("My Children", "users", "family", "children"), page("Courses", "book", "courses"), dash("Homework", "check", "family", "homework"),
    dash("Attendance", "clock", "family", "attendance"), dash("Timetable & Events", "calendar", "family", "events"),
    page("Report Cards", "file", "report-card"), page("Smart Learning Studio", "book", "studio"), dash("Fees & Payments", "wallet", "family", "fees"), page("Messages", "chat", "communications"),
    page("Learning Library", "folder", "resources"), dash("Help & Support", "help", "family", "help"),
  ];
  if (role === "student") return [
    dash("Dashboard", "home", "learning", "dashboard"), page("My Courses", "book", "courses"), dash("My Classes & Subjects", "book", "learning", "subjects"), dash("My Timetable", "calendar", "learning", "timetable"),
    dash("Homework", "check", "learning", "homework"), page("Smart Learning Studio", "book", "studio"), page("Learning Library", "folder", "resources"), dash("Attendance", "clock", "learning", "attendance"),
    page("Report Cards", "file", "report-card"), dash("Learning Resources", "folder", "learning", "materials"), page("Messages", "chat", "communications"),
    dash("School Events", "megaphone", "learning", "events"), dash("My Profile", "user", "learning", "profile"), dash("Help & Support", "help", "learning", "help"),
  ];
  if (role === "teacher") return [
    dash("Dashboard", "home", "classroom", "overview"), page("My Courses", "book", "courses"), dash("Curriculum Library", "book", "classroom", "curriculum"), page("Term Reports", "file", "term-reports"), ...(offers("nursery") ? [page("Early Years Observations", "users", "nursery")] : []), dash("Lessons & Plans", "book", "classroom", "lessons"), dash("Homework", "check", "classroom", "homework"),
    dash("Attendance", "clock", "classroom", "attendance"), dash("Grade Submissions", "file", "classroom", "submissions"), dash("Learning Materials", "folder", "classroom", "materials"),
    page("Timetable & Messages", "calendar", "communications"), page("Assessment Gradebook", "chart", "reports"), page("Smart Learning Studio", "book", "studio"),
    page("Learning Library", "folder", "resources"),
  ];
  if (role === "school_owner" || role === "school_admin") return [
    dash("Dashboard", "home", "home", "overview"), dash("Fees & Finance", "wallet", "home", "finance"), dash("Inventory & Assets", "box", "home", "inventory"),
    dash("Board of Directors", "building", "home", "board"), page("Students & Admissions", "users", "admissions"), page("Classes & Teachers", "book", "admin"), page("Courses", "book", "courses"),
    page("Reports & Curriculum", "chart", "reports"), page("Term Reports", "file", "term-reports"), ...(offers("nursery") ? [page("Early Years Observations", "users", "nursery")] : []), page("Smart Learning Studio", "book", "studio"), page("Learning Library", "folder", "resources"), page("Messages & Notices", "chat", "communications"), page("School Operations", "wrench", "operations"),
    page("Leave & Purchase Requests", "file", "requests"), page("Administration", "gear", "admin"),
  ];
  if (role === "staff") return [
    dash("Dashboard", "home", "home", "staff"), dash("Inventory & Assets", "box", "home", "inventory"), page("Messages & Notices", "chat", "communications"),
    page("School Operations", "wrench", "operations"), page("Leave & Purchase Requests", "file", "requests"),
  ];
  return [{ label: "School portal", icon: "home", href: base + "portal", active: false }];
}
export function currentSegment(pathname) {
  const m = /^\/s\/RW-SCH-\d{6,16}\/([^/?#]+)/.exec(pathname || "");
  return m ? m[1] : "";
}
export function initialTab(search, allowed, fallback) {
  const v = new URLSearchParams(search || "").get("tab");
  return v && allowed.includes(v) ? v : fallback;
}
