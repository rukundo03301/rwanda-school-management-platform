"use client";
import {useMemo,useState} from "react";
// One place for the teacher to say what they are teaching. Every tab below follows this choice.
export default function TeachingBar({classes=[],myAssignments=[],selectedClass,selectedSubject,onClass,onSubject,classLabel,subjectLabel,studentCount=0,code}){
 const [help,setHelp]=useState("");
 const subjectIds=useMemo(()=>[...new Set(myAssignments.filter(a=>a.class_id===selectedClass).map(a=>a.subject_id))],[myAssignments,selectedClass]);
 return <section className="tb-bar" aria-label="What are you teaching">
  <div className="tb-row"><strong className="tb-label">Class</strong>
   <div className="tb-chips">{classes.map(c=><button key={c.id} className={"tb-chip"+(c.id===selectedClass?" on":"")} onClick={()=>onClass(c.id)}>{classLabel(c.id)}</button>)}
    <button className="tb-chip add" onClick={()=>setHelp(help==="class"?"":"class")}>+ Add class</button></div></div>
  <div className="tb-row"><strong className="tb-label">Subject</strong>
   <div className="tb-chips"><button className={"tb-chip"+(!selectedSubject?" on":"")} onClick={()=>onSubject("")}>All my subjects</button>
    {subjectIds.map(id=><button key={id} className={"tb-chip"+(id===selectedSubject?" on":"")} onClick={()=>onSubject(id)}>{subjectLabel(id)}</button>)}</div></div>
  <div className="tb-row tb-meta"><span>{studentCount} {studentCount===1?"student":"students"} in this class</span>
   <button className="tb-link" onClick={()=>setHelp(help==="student"?"":"student")}>+ Add student</button></div>
  {help==="class"&&<div className="tb-help"><strong>How a class is added</strong><p>Your school administrator assigns you to a class and subject. This keeps every teacher limited to their own students. Once assigned, the class appears here at once. Ask your administrator to assign you, or send them a note from <a href={"/s/"+code+"/communications"}>Timetable &amp; Messages</a>.</p></div>}
  {help==="student"&&<div className="tb-help"><strong>How a student is added</strong><p>Students are enrolled by the school in Admissions, then they appear in the class list automatically. Ask your administrator to enrol or move a student, or send a note from <a href={"/s/"+code+"/communications"}>Timetable &amp; Messages</a>.</p></div>}
 </section>;
}
