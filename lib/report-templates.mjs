// Report templates, one per education level. The class's education level decides the template.
// Shared by the server (validation) and the browser (forms and the printed report).
export const TEMPLATE_LABEL = {
  nursery: "Early Years Learning and Development Report",
  primary: "Primary School Term Report",
  secondary: "Secondary School Term Report",
  tvet: "TVET Competence Report",
  university: "University Semester Transcript",
};
export const NURSERY_AREAS = [
  ["language_communication", "Language and communication"],
  ["numeracy_early_math", "Numeracy and early mathematics"],
  ["social_emotional", "Social and emotional development"],
  ["physical_health", "Physical development and health"],
  ["creative_arts_culture", "Creative arts and culture"],
  ["environment_science", "Environment and science"],
];
export const NURSERY_DESCRIPTORS = [["developing", "Developing"], ["secure", "Secure"], ["extending", "Extending"]];
export const COMPETENCE = [["competent", "Competent"], ["not_yet_competent", "Not yet competent"]];

// Default grade scales, printed on every report so families can read the grades.
const SCALE = [[80, "A"], [70, "B"], [60, "C"], [50, "D"], [40, "E"], [0, "F"]];
const UNI = [[70, "A", 5], [60, "B", 4], [50, "C", 3], [45, "D", 2], [40, "E", 1], [0, "F", 0]];
export const gradeFor = (pct) => (SCALE.find(([m]) => pct >= m) || SCALE[SCALE.length - 1])[1];
export const uniGrade = (pct) => { const g = UNI.find(([m]) => pct >= m) || UNI[UNI.length - 1]; return { grade: g[1], points: g[2] }; };
export const SCALE_TEXT = {
  primary: "A 80 to 100, B 70 to 79, C 60 to 69, D 50 to 59, E 40 to 49, F below 40",
  secondary: "A 80 to 100, B 70 to 79, C 60 to 69, D 50 to 59, E 40 to 49, F below 40",
  university: "A 70+ (5), B 60 to 69 (4), C 50 to 59 (3), D 45 to 49 (2), E 40 to 44 (1), F below 40 (0)",
};

const text = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v, min, max) => { if (v === "" || v == null) return null; const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null; };
const rows = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);

// Returns clean content for the template, or throws a readable message.
export function cleanContent(template, input) {
  const c = input && typeof input === "object" ? input : {};
  const attendance = { present: num(c.attendance?.present, 0, 400), total: num(c.attendance?.total, 0, 400) };
  if (template === "nursery") {
    const areas = {};
    for (const [key] of NURSERY_AREAS) {
      const a = c.areas?.[key] || {};
      const descriptor = NURSERY_DESCRIPTORS.some(([d]) => d === a.descriptor) ? a.descriptor : "";
      areas[key] = { descriptor, summary: text(a.summary, 600) };
    }
    return { areas, attendance };
  }
  if (template === "primary" || template === "secondary") {
    const subjects = rows(c.subjects, 30).map((s) => {
      const continuous = num(s.continuous, 0, 100), exam = num(s.exam, 0, 100);
      const total = continuous == null || exam == null ? null : Math.round((continuous * 0.5 + exam * 0.5) * 100) / 100;
      return { name: text(s.name, 100), continuous, exam, total, grade: total == null ? "" : gradeFor(total), comment: text(s.comment, 300) };
    }).filter((s) => s.name);
    const done = subjects.filter((s) => s.total != null);
    const average = done.length ? Math.round(done.reduce((a, s) => a + s.total, 0) / done.length * 100) / 100 : null;
    return { subjects, average, overallGrade: average == null ? "" : gradeFor(average), conduct: text(c.conduct, 300), attendance };
  }
  if (template === "tvet") {
    const modules = rows(c.modules, 30).map((m) => ({
      name: text(m.name, 120), competence: COMPETENCE.some(([k]) => k === m.competence) ? m.competence : "",
      hours: num(m.hours, 0, 2000), comment: text(m.comment, 300),
    })).filter((m) => m.name);
    return { modules, attendance };
  }
  if (template === "university") {
    const courses = rows(c.courses, 30).map((k) => {
      const mark = num(k.mark, 0, 100), credits = num(k.credits, 0, 60);
      const g = mark == null ? { grade: "", points: null } : uniGrade(mark);
      return { code: text(k.code, 20), name: text(k.name, 120), credits, mark, grade: g.grade, points: g.points };
    }).filter((k) => k.name);
    const graded = courses.filter((k) => k.points != null && k.credits);
    const credits = graded.reduce((a, k) => a + k.credits, 0);
    const gpa = credits ? Math.round(graded.reduce((a, k) => a + k.points * k.credits, 0) / credits * 100) / 100 : null;
    return { courses, credits, gpa, attendance };
  }
  throw new Error("Unknown report template");
}

// What must be filled in before the teacher can submit.
export function missingForSubmit(template, c) {
  if (template === "nursery") return NURSERY_AREAS.filter(([k]) => !c.areas?.[k]?.descriptor || !c.areas?.[k]?.summary).map(([, l]) => l);
  if (template === "primary" || template === "secondary") return c.subjects?.length ? c.subjects.filter((s) => s.total == null).map((s) => s.name + " marks") : ["at least one subject"];
  if (template === "tvet") return c.modules?.length ? c.modules.filter((m) => !m.competence).map((m) => m.name + " competence") : ["at least one module"];
  if (template === "university") return c.courses?.length ? c.courses.filter((k) => k.mark == null || !k.credits).map((k) => k.name + " mark and credits") : ["at least one course"];
  return [];
}
