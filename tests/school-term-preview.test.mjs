import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildTeacherTermPreview,GENERAL_TERM_WEIGHTS} from "../lib/school-term-preview.mjs";
const code=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const ids={school:"school-1",class:"c1",term:"t1",student:"s1",subject:"math",profile:"general"};
const input=()=>({
 school:{name:"Training Primary School",code:"TRAIN-001"},year:{name:"2026-2027"},
 term:{id:ids.term,term_number:1,begins_on:"2026-10-01",ends_on:"2026-12-20"},
 student:{studentId:ids.student,name:"Synthetic Learner",studentCode:"SYN-001"},
 selectedClass:{id:ids.class,name:"P4",section:"A"},
 subjects:[{id:ids.subject,code:"MTH",name:"Mathematics"}],
 curriculum:[{id:ids.profile,status:"approved",track:"general",level_band:"upper_primary"}],
 courses:[{class_id:ids.class,subject_id:ids.subject,curriculum_profile_id:ids.profile,weekly_periods:4,approved_at:"2026-10-01"}],
 units:["U1","U2","U3","U4"].map(unit_code=>({class_id:ids.class,subject_id:ids.subject,term_number:1,unit_code})),
 marks:[
  ...[28,30,32,34].map((score,i)=>({term_id:ids.term,student_id:ids.student,class_id:ids.class,subject_id:ids.subject,category:"unit",assessment_code:"U"+(i+1),score,maximum_marks:40})),
  ...[31,29].map((score,i)=>({term_id:ids.term,student_id:ids.student,class_id:ids.class,subject_id:ids.subject,category:"project",assessment_code:"PROJECT-"+(i+1),score,maximum_marks:40})),
  {term_id:ids.term,student_id:ids.student,class_id:ids.class,subject_id:ids.subject,category:"end_term",assessment_code:"TERM",score:36,maximum_marks:40}
 ]});
test("NESA 25/25/50: valid complete marks produce a teacher-only draft, not a published report",()=>{
 const report=buildTeacherTermPreview(input());
 assert.deepEqual(GENERAL_TERM_WEIGHTS,{unit:0.25,project:0.25,end_term:0.5});
 assert.equal(report.status,"draft");
 assert.equal(report.ready,true);
 assert.equal(report.subjects[0].end_unit_avg,31);
 assert.equal(report.subjects[0].project_avg,30);
 assert.equal(report.subjects[0].term_total_marks,33.25);
 assert.equal(report.overall_percentage,83.13);
});
test("missing project or exam must stay missing, never automatically zero",()=>{
 const obj=input();obj.marks=obj.marks.filter(m=>m.category!=="end_term");
 const report=buildTeacherTermPreview(obj);
 assert.equal(report.ready,false);assert.equal(report.subjects[0].term_total_marks,null);
 assert.equal(report.overall_percentage,null);
 assert.match(report.subjects[0].issues.join(" " ),/end-of-term assessment/);
});
test("nil marks, zero achieved marks, unrelated students and class are distinct",()=>{
 const obj=input();
 obj.marks=obj.marks.map(m=>({...m,student_id:"another-student"}));
 let r=buildTeacherTermPreview(obj);
 assert.equal(r.ready,false);assert.equal(r.subjects[0].term_total_marks,null);
 obj.marks=input().marks.map(m=>({...m,score:0}));
 r=buildTeacherTermPreview(obj);
 assert.equal(r.ready,true);assert.equal(r.subjects[0].term_total_marks,0);
});
test("unsupported nursery and lower-primary profiles cannot use general-education grading",()=>{
 for(const band of ["nursery","lower_primary","tvet","international"]){
  const obj=input();obj.curriculum[0].level_band=band;
  obj.curriculum[0].track=band==="nursery"?"nursery":band==="tvet"?"tvet":"general";
  const r=buildTeacherTermPreview(obj);
  assert.equal(r.ready,false,band);assert.equal(r.subjects[0].term_total_marks,null,band);
 }
});
test("teacher preview is wired to gradebook and prints as a private draft with no fake official grade",()=>{
 const manager=code("app/s/[code]/reports/ReportsManager.jsx");
 const component=code("app/s/[code]/reports/TeacherReportPreview.jsx");
 const stylesheet=code("app/s/[code]/reports/teacher-report-preview.css");
 assert.match(manager,/buildTeacherTermPreview/);
 assert.match(manager,/<TeacherReportPreview report=\{draftPreview\}/);
 assert.match(component,/DRAFT — NOT PUBLISHED/);
 assert.match(component,/window\.print\(\)/);
 assert.match(stylesheet,/@page\{size:A4 portrait/);
 assert.doesNotMatch(component,/national rank|Grade A|national certificate obtained/i);
});
