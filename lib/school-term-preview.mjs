// Draft-only calculations for the teacher's authorized subject selection.
// Authoritative publication remains in school_publish_term_report; this module cannot publish.
export const GENERAL_TERM_WEIGHTS=Object.freeze({unit:0.25,project:0.25,end_term:0.50});
const round=(value)=>Math.round((value+Number.EPSILON)*100)/100;
const validScore=(m,max)=>m?.score!==null&&m?.score!==undefined&&m?.score!==""&&Number.isFinite(Number(m?.score))&&Number.isFinite(Number(m?.maximum_marks))&&Number(m.maximum_marks)===max&&Number(m.score)>=0&&Number(m.score)<=max;
const average=(records)=>records.reduce((sum,m)=>sum+Number(m.score),0)/records.length;
export function buildTeacherTermPreview({school,year,term,student,selectedClass,courses=[],subjects=[],curriculum=[],units=[],marks=[]}){
 if(!school||!term||!student||!selectedClass) return null;
 const profileById=new Map(curriculum.map(p=>[p.id,p]));
 const subjectById=new Map(subjects.map(s=>[s.id,s]));
 const lines=courses.filter(m=>m.class_id===selectedClass.id).map(course=>{
  const subject=subjectById.get(course.subject_id);
  const profile=profileById.get(course.curriculum_profile_id);
  const allowed=Boolean(course.approved_at&&profile?.status==="approved"&&
   ["general","professional"].includes(profile.track)&&
   !["lower_primary","nursery","tvet","international","higher_education"].includes(profile.level_band));
  const max=Number(course.weekly_periods)*10;
  const expectedUnits=units.filter(u=>u.class_id===selectedClass.id&&u.subject_id===course.subject_id&&
   Number(u.term_number)===Number(term.term_number)).map(u=>String(u.unit_code));
  const current=marks.filter(m=>m.student_id===student.studentId&&m.class_id===selectedClass.id&&
   m.subject_id===course.subject_id&&m.term_id===term.id);
  const byCategory=(cat)=>current.filter(m=>m.category===cat);
  const unitRows=byCategory("unit").filter(m=>expectedUnits.includes(String(m.assessment_code)));
  const projectRows=byCategory("project");
  const examRows=byCategory("end_term");
  const distinct=(xs)=>new Set(xs.map(x=>String(x.assessment_code))).size===xs.length;
  const complete=allowed&&Number.isInteger(max)&&max>0&&expectedUnits.length>0&&
   new Set(expectedUnits).size===expectedUnits.length&&
   unitRows.length===expectedUnits.length&&distinct(unitRows)&&
   projectRows.length>=2&&distinct(projectRows)&&examRows.length===1&&
   [...unitRows,...projectRows,...examRows].every(m=>validScore(m,max));
  const unitAvg=complete?average(unitRows):null;
  const projectAvg=complete?average(projectRows):null;
  const exam=complete?Number(examRows[0].score):null;
  const total=complete?round(unitAvg*GENERAL_TERM_WEIGHTS.unit+
   projectAvg*GENERAL_TERM_WEIGHTS.project+exam*GENERAL_TERM_WEIGHTS.end_term):null;
  const issues=[];
  if(!allowed)issues.push("The school has not approved a supported general-education subject mapping");
  if(!(max>0))issues.push("Weekly teaching periods are not configured");
  if(!expectedUnits.length)issues.push("Approved curriculum units are missing for this term");
  if(unitRows.length<expectedUnits.length)issues.push("End-of-unit marks are missing");
  if(projectRows.length<2)issues.push("At least two project assessment marks are required");
  if(examRows.length!==1)issues.push("A single end-of-term assessment is required");
  if(!complete&&!issues.length)issues.push("Assessment marks require validation before submission");
  return {
   subject_id:course.subject_id,subject_name:subject?.name||"Assigned subject",
   subject_code:subject?.code||"",maximum_marks:max,
   end_unit_avg:unitAvg,project_avg:projectAvg,end_term_marks:exam,
   term_total_marks:total,term_percentage:complete?round(100*total/max):null,
   teacher_feedback:current.map(m=>m.learning_feedback).filter(Boolean).slice(-2).join(" · "),
   complete,issues
  };
 });
 const ready=lines.length>0&&lines.every(r=>r.complete);
 const maximum=ready?lines.reduce((n,r)=>n+r.maximum_marks,0):null;
 const earned=ready?round(lines.reduce((n,r)=>n+r.term_total_marks,0)):null;
 return {
  status:"draft",ready,
  school_name:school.name,school_code:school.code,school_logo:school.logoUrl||"",
  school_color:/^#[0-9a-f]{6}$/i.test(school.primaryColor||"")?school.primaryColor:"#1e5ab4",
  student_name:student.name,student_code:student.studentCode,
  class_name:selectedClass.name+(selectedClass.section?" · "+selectedClass.section:""),
  year_name:year?.name||"",term_number:term.term_number,
  term_begins:term.begins_on,term_ends:term.ends_on,
  subjects:lines,earned_marks:earned,maximum_marks:maximum,
  overall_percentage:ready?round(100*earned/maximum):null,
  note:lines.length?"Prepared from the marks available to this authorized teacher; other subjects may be excluded.":"No approved subjects are available for preview."
 };
}
