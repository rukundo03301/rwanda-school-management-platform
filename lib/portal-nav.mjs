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
export const FRAMED_PAGES = ["communications", "report-card", "resources", "studio", "reports", "operations", "admissions", "admin", "fees", "requests", "security", "student-logins", "staff-logins", "nursery", "term-reports", "courses", "settings", "money"];
export const PAGE_TITLE = {
  communications: "Messages and Timetable", "report-card": "Report Cards", resources: "Learning Library", studio: "Practice Games", reports: "Curriculum and Marks",
  operations: "School Operations", admissions: "Students and Admissions", admin: "Administration", fees: "Fees and Payments",
  requests: "Leave and Purchase Requests", security: "Security", "student-logins": "Student Logins", "staff-logins": "Staff Logins", nursery: "Nursery Progress Notes", "term-reports": "Report Cards", courses: "My Courses", settings: "School Settings", money: "Money and Profit",
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
    page("Report Cards", "file", "report-card"), page("Practice Games", "book", "studio"), dash("Fees & Payments", "wallet", "family", "fees"), page("Messages", "chat", "communications"),
    page("Learning Library", "folder", "resources"), dash("Help & Support", "help", "family", "help"),
  ];
  if (role === "student") return [
    dash("Dashboard", "home", "learning", "dashboard"), page("My Courses", "book", "courses"), dash("My Classes & Subjects", "book", "learning", "subjects"), dash("My Timetable", "calendar", "learning", "timetable"),
    dash("Homework", "check", "learning", "homework"), page("Practice Games", "book", "studio"), page("Learning Library", "folder", "resources"), dash("Attendance", "clock", "learning", "attendance"),
    page("Report Cards", "file", "report-card"), dash("Learning Resources", "folder", "learning", "materials"), page("Messages", "chat", "communications"),
    dash("School Events", "megaphone", "learning", "events"), dash("My Profile", "user", "learning", "profile"), dash("Help & Support", "help", "learning", "help"),
  ];
  if (role === "teacher") return [
    dash("Dashboard", "home", "classroom", "overview"), page("My Courses", "book", "courses"), dash("Curriculum Library", "book", "classroom", "curriculum"), page("Report Cards", "file", "term-reports"), ...(offers("nursery") ? [page("Nursery Progress Notes", "users", "nursery")] : []), dash("Lessons & Plans", "book", "classroom", "lessons"), dash("Homework", "check", "classroom", "homework"),
    dash("Attendance", "clock", "classroom", "attendance"), dash("Grade Submissions", "file", "classroom", "submissions"), dash("Learning Materials", "folder", "classroom", "materials"),
    page("Timetable & Messages", "calendar", "communications"), page("Curriculum & Marks", "chart", "reports"), page("Practice Games", "book", "studio"),
    page("Learning Library", "folder", "resources"),
  ];
  if (role === "school_owner" || role === "school_admin") return ownerNav(base, current, offers);
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

// The school owner and principal workspace, grouped so each item says what it is for.
export function ownerNav(base, current, offers) {
  // tone colors the icon of every item in a group, so the groups are easy to tell apart.
  const TONE = { "Overview": "blue", "Set up the school": "purple", "People": "teal", "Money": "green", "School property": "orange", "Teaching & learning": "indigo", "School life": "pink", "Access": "slate" };
  const item = (group, label, icon, seg, hint, active) => ({ group, tone: TONE[group], label, icon, hint, href: base + seg, active: active ?? current === seg });
  return [
    item("Overview", "Dashboard", "home", "home?tab=overview", "Today's numbers for the whole school", false),
    item("Set up the school", "School Settings", "gear", "settings", "Levels, classes, teachers, fees, logo and homepage"),
    item("People", "Students & Admissions", "users", "admissions", "Enrol students and link parents"),
    item("People", "Teachers & Classes", "cap", "settings?section=teachers", "Add teachers, set pay, choose what they teach", false),
    item("Money", "Fees & Finance", "wallet", "home?tab=finance", "Who paid, who is late, set school fees", false),
    item("Money", "Profit & Loss", "chart", "money?tab=pnl", "Money in, money out and profit", false),
    item("Money", "Expenses & Bills", "file", "money?tab=expenses", "Food, electricity, fuel, cars, repairs", false),
    item("Money", "Salaries & Payroll", "check", "money?tab=payroll", "Prepare, approve and pay salaries", false),
    item("School property", "Stock & Food", "box", "operations?tab=stock", "Food, gas, cleaning and stationery stock", false),
    item("School property", "Desks, Chairs & Assets", "building", "operations?tab=assets", "Furniture, computers and vehicles", false),
    item("School property", "Repairs & Maintenance", "wrench", "operations?tab=maintenance", "Broken things and who is fixing them", false),
    item("Teaching & learning", "Courses", "book", "courses", "Every class and subject, with modules and quizzes"),
    item("Teaching & learning", "Report Cards", "file", "term-reports", "Write, check, approve and publish term reports"),
    item("Teaching & learning", "Curriculum & Marks", "chart", "reports", "Syllabus, school terms and the marks book"),
    ...(offers("nursery") ? [item("Teaching & learning", "Nursery Progress Notes", "users", "nursery", "Teachers' notes on how young children are growing")] : []),
    item("Teaching & learning", "Practice Games", "play", "studio", "Interactive practice for pupils, by level and subject"),
    item("Teaching & learning", "Learning Library", "folder", "resources", "Ready-made activities and teachers' own materials"),
    item("School life", "Announcements", "megaphone", "communications?tab=announcements", "Send a notice to everyone, parents, teachers or a class", false),
    item("School life", "Messages & Timetable", "chat", "communications", "Private messages and the class timetable"),
    item("School life", "Leave & Purchase Requests", "file", "requests", "Staff requests waiting for your decision"),
    item("School life", "Board of Directors", "users", "home?tab=board", "Board members and meetings", false),
    item("Access", "Staff Access", "gear", "admin", "Invite principals and staff, see activity"),
  ];
}
