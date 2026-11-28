import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {SMART_LEARNING_ACTIVITIES,REB_RESOURCE_PORTALS,REB_SUBJECT_RESOURCES,studioSourcesFor,getStudioActivity,studioSubjectList,studioWorksheetText} from "../lib/smart-learning-catalog.mjs";
import {portalNav,FRAMED_PAGES} from "../lib/portal-nav.mjs";
const text=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
test("learning catalogue has original editable teaching templates, across core subjects and school levels",()=>{
 assert.ok(SMART_LEARNING_ACTIVITIES.length>=18);
 assert.equal(new Set(SMART_LEARNING_ACTIVITIES.map(x=>x.id)).size,SMART_LEARNING_ACTIVITIES.length);
 for(const subject of ["Mathematics","Kinyarwanda","English","Science","Social Studies","Religious Education","Creative Arts","Early Numeracy","Health and Physical Education"])
  assert.ok(studioSubjectList().includes(subject),subject);
 for(const level of ["Nursery","Primary","Secondary","College / University"])
  assert.ok(SMART_LEARNING_ACTIVITIES.some(a=>a.levels.includes(level)),level);
 for(const a of SMART_LEARNING_ACTIVITIES){
  assert.ok(a.objective.length>20&&a.prompt.length>15);
  assert.equal(a.official,false);assert.equal(a.assessmentStatus,"practice_only");
  assert.ok(a.activities.length>=2);assert.equal(getStudioActivity(a.id),a);
  assert.ok(studioWorksheetText(a.id).includes(a.prompt));
 }
 assert.equal(getStudioActivity("../../secrets"),null);
});
test("verified REB resources are links rather than redistributed copyrighted books",()=>{
 for(const resource of REB_RESOURCE_PORTALS)assert.match(resource.url,/^https:\/\/(?:uat-coremis|elearning)\.reb\.rw\//);
 const studio=text("app/s/[code]/studio/SmartLearningStudio.jsx");
 assert.match(studio,/Umurage-original examples/);
 assert.match(studio,/Some resources require a REB account/);
 assert.doesNotMatch(studio,/copyrighted book download|free textbook pdf download/);
});
test("interactive teaching tools are real working controls for shapes fractions groups cards and drawing",()=>{
 const studio=text("app/s/[code]/studio/SmartLearningStudio.jsx");
 for(const widget of ["function Shapes(","function Fractions(","function Groups(","function Cards(","function Sort(","function Art("])assert.ok(studio.includes(widget),widget);
 for(const action of ["Check answer","Next card","Next item","Print worksheet / Save PDF","Copy lesson and questions"])assert.ok(studio.includes(action),action);
 assert.match(studio,/getSession\(\)/);
 assert.match(studio,/\/access/);
 assert.match(studio,/student","teacher","school_owner","school_admin","parent/);
 assert.match(studio,/Practice results are not recorded as formal marks/);
 assert.doesNotMatch(studio,/auth\.admin|serviceRole|service_role/);
});
test("teacher student parent owner menus route to the same tenant-scoped studio",()=>{
 assert.ok(FRAMED_PAGES.includes("studio"));
 for(const role of ["teacher","student","parent","school_owner","school_admin"]){
  const items=portalNav(role,"RW-SCH-000004","");
  assert.ok(items.some(a=>a.href==="/s/RW-SCH-000004/studio"),role);
 }
 const route=text("app/s/[code]/studio/page.jsx");
 assert.match(route,/SmartLearningStudio code=\{code\}/);
 assert.match(text("app/s/[code]/studio/studio.css"),/@media\(max-width:650px\)/);
});

test("teacher can launch an original Studio activity as an unpublished homework draft for an assigned subject",()=>{
 const studio=text("app/s/[code]/studio/SmartLearningStudio.jsx");
 const homework=text("app/s/[code]/classroom/HomeworkComposer.jsx");
 assert.match(studio,/classroom\?tab=homework&studio=/);
 assert.match(homework,/getStudioActivity\(studioId\)/);
 assert.match(homework,/const match=mine\.find/);
 assert.match(homework,/subjectLabel\(a\.subject_id\)\.toLowerCase\(\)===activity\.subject\.toLowerCase\(\)/);
 assert.match(homework,/instructions:studioWorksheetText\(studioId\)\.slice\(0,5000\)/);
 assert.match(homework,/setQs\(\[\{\.\.\.blank\("essay"\),prompt:activity\.prompt,marks:10\}\]\)/);
 assert.match(homework,/unpublished draft/);
 assert.match(homework,/if\(!f\.dueLocal\)throw Error/);
 assert.doesNotMatch(homework,/autoPublishStudioTemplate/);
});

test("each subject resolves to a real official REB resource portal without copying textbooks",()=>{
 for(const subject of studioSubjectList()){
  const sources=studioSourcesFor(subject);
  assert.ok(sources.length>0,subject);
  for(const source of sources)assert.match(source.url,/^https:\/\/uat-coremis\.reb\.rw\//);
 }
 assert.ok(REB_SUBJECT_RESOURCES.Kinyarwanda.some(x=>x.url.includes("categoryid=196")));
 const studio=text("app/s/[code]/studio/SmartLearningStudio.jsx");
 assert.match(studio,/studioSourcesFor\(active\.subject\)/);
 assert.match(studio,/College \/ university courses require the institution/);
});
