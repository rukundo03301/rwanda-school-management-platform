"use client";
import {useEffect,useMemo,useState} from "react";
import "./curriculum-library.css";

const REB="https://uat-coremis.reb.rw";
const ORDER=["one","two","three","four","five","six"];
const gradeRank=g=>{const m=/(\d)$/.exec(g)||/\b(Year|Senior|Nursery)\s*(\d)/i.exec(g);const w=ORDER.findIndex(x=>new RegExp("\\b"+x+"\\b","i").test(g));return g==="Other resources"?99:w>=0?w:m?Number(m[m.length-1]):50;};
const LEVEL_HELP={
 "Pre-primary":"Nursery 1 to 3. Learning areas and teacher guides. Assessment is observation based, with no marks or rankings.",
 "Primary":"Primary 1 to 6. Student books and teacher guides, with units and key competences.",
 "Ordinary Level":"Senior 1 to 3. One folder per subject with student books, teacher guides and units.",
 "Advanced Level":"Senior 4 to 6. Subjects and combinations with student books and teacher guides.",
 "Teacher Training College":"Year 1 to 3 for teacher trainees, plus formative assessment resources.",
 "Associate Nursing":"Associate nursing programme, Senior 4 to 6.",
 "Accounting":"Accounting programme, Senior 4 to 6."
};
function guess(cls){
 const t=String(cls||"").toLowerCase();let m;
 if((m=/(?:\bp|primary\s*)(\d)\b/.exec(t)))return {level:"Primary",grade:"Primary "+ORDER[Number(m[1])-1].replace(/^./,c=>c.toUpperCase())};
 if((m=/(?:\bn|nursery\s*)(\d)\b/.exec(t)))return {level:"Pre-primary",grade:"Nursery "+m[1]};
 if((m=/(?:\bs|senior\s*)(\d)\b/.exec(t)))return Number(m[1])<=3?{level:"Ordinary Level",grade:"Senior "+m[1]}:{level:"Advanced Level",grade:"Senior "+m[1]};
 return null;
}
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const fileUrl=m=>REB+"/mod/resource/view.php?id="+m;
const courseUrl=i=>REB+"/course/view.php?id="+i;
function kind(title){return /\bTG\b|teacher|mwarimu|guide/i.test(title)?"Teacher guide":/\bSB\b|student|learner|umunyeshuri|igitabo/i.test(title)?"Student book":"Resource";}
const tidy=t=>String(t||"").replace(/\s+[A-Z0-9]{1,2}$/,"").trim();
const cleanUnits=u=>{const r=(u||[]).map(x=>[x[0],tidy(x[1]),x[2]]).filter(x=>x[1].length>2&&x[1].length<=60&&!/unit|topic|assignment/i.test(x[1]));return r.length>=3?r:[];};
export default function CurriculumLibrary({classes=[],myAssignments=[],classLabel=()=>"",subjectLabel=()=>"",onAddMaterial,focusClass="",focusSubject=""}){
 const [browse,setBrowse]=useState(!focusClass);
 const [idx,setIdx]=useState(null),[err,setErr]=useState(""),[data,setData]=useState({}),[loadingLevel,setLoadingLevel]=useState(false);
 const [level,setLevel]=useState(""),[grade,setGrade]=useState(""),[subject,setSubject]=useState(""),[q,setQ]=useState("");
 useEffect(()=>{let alive=true;fetch("/reb/index.json").then(r=>{if(!r.ok)throw Error("Curriculum catalogue unavailable");return r.json()}).then(d=>{if(alive)setIdx(d)}).catch(e=>{if(alive)setErr(e.message)});return()=>{alive=false};},[]);
 useEffect(()=>{if(!idx||!level||data[level])return;const f=idx.levels.find(l=>l.level===level)?.file;if(!f)return;let alive=true;setLoadingLevel(true);
  fetch("/reb/"+f+".json").then(r=>{if(!r.ok)throw Error("Could not load "+level);return r.json()}).then(d=>{if(alive){setData(x=>({...x,[level]:d}));setLoadingLevel(false)}}).catch(e=>{if(alive){setErr(e.message);setLoadingLevel(false)}});return()=>{alive=false};},[idx,level,data]);
 const cat=idx;const lv=data[level];
 const grades=useMemo(()=>lv?[...lv.grades].sort((a,b)=>gradeRank(a.grade)-gradeRank(b.grade)||a.grade.localeCompare(b.grade)):[],[lv]);
 const gr=grades.find(g=>g.grade===grade);
 const subjects=useMemo(()=>gr?gr.subjects.filter(s=>!q||norm(s.subject).includes(norm(q))):[],[gr,q]);
 const [mineKey,setMineKey]=useState(0);
 const mine=useMemo(()=>{if(!idx)return[];const out=[];const seen=new Set();
  for(const a of myAssignments){const g=guess(classLabel(a.class_id));if(!g)continue;if(!idx.levels.find(l=>l.level===g.level)?.grades.some(x=>x.grade===g.grade))continue;
   const key=g.level+g.grade+a.subject_id;if(seen.has(key))continue;seen.add(key);
   out.push({label:classLabel(a.class_id)+" · "+subjectLabel(a.subject_id),level:g.level,grade:g.grade,subjectName:subjectLabel(a.subject_id),classId:a.class_id,subjectId:a.subject_id});}
  return out;},[idx,myAssignments,classLabel,subjectLabel]);
 function pickMine(m){setLevel(m.level);setGrade(m.grade);setQ("");setSubject("");setMineKey(m);}
 useEffect(()=>{if(!mineKey||!gr)return;const sn=norm(mineKey.subjectName);const S=gr.subjects.find(s=>norm(s.subject)===sn)||gr.subjects.find(s=>sn&&(norm(s.subject).includes(sn)||sn.includes(norm(s.subject))));if(S)setSubject(S.subject);setMineKey(0);},[mineKey,gr]);
 useEffect(()=>{if(!focusClass||!idx)return;
  const m=mine.find(x=>x.classId===focusClass&&(!focusSubject||x.subjectId===focusSubject));
  if(m){pickMine(m);setBrowse(false);}else setBrowse(true);
 },[idx,focusClass,focusSubject]);
 function pick(l,g,s){setLevel(l);setGrade(g);setSubject(s||"");setQ("");}
 if(err)return <section className="cr-panel" role="alert"><h2>Curriculum Library</h2><p>{err}</p></section>;
 if(!idx)return <section className="cr-panel"><p role="status">Loading the Rwanda Education Board curriculum…</p></section>;
 const sj=gr?.subjects.find(s=>s.subject===subject);
 return <div className="cl-root">
  <section className="cr-panel cl-intro"><h2>Curriculum Library</h2>
   <p>Choose what you teach and open the official Rwanda Education Board student books, teacher guides and units for it. Pick a level, then a grade, then a subject.</p>
   <p className="cl-note">Source: REB e-learning site, copied on {cat.extracted}. Links open the official REB pages. Some files may ask you to sign in to REB. The catalogue lists REB material and does not replace it.</p>
   {browse&&mine.length>0&&<div className="cl-mine"><strong>My classes</strong><div className="cl-chips">{mine.map(m=><button key={m.label} className="cl-chip" onClick={()=>pickMine(m)} title="Open this grade and subject">{m.label}</button>)}</div></div>}
  </section>
  {!browse&&<section className="cr-panel cl-focus"><p className="cl-help">Showing REB material for <strong>{classLabel(focusClass)}</strong>{focusSubject?" · "+subjectLabel(focusSubject):""}, matched from your selection at the top. <button className="cl-chip" onClick={()=>setBrowse(true)}>Browse other levels and subjects</button></p></section>}
  {browse&&<section className="cr-panel"><h3>1. Level</h3>
   <div className="cl-chips">{cat.levels.map(l=><button key={l.level} className={"cl-chip"+(level===l.level?" on":"")} onClick={()=>pick(l.level,"","")}>{l.level}</button>)}</div>
   {level&&<p className="cl-help">{LEVEL_HELP[level]}</p>}
   {level&&loadingLevel&&<p role="status" className="cl-help">Loading {level}…</p>}
   {lv&&<><h3>2. Grade</h3><div className="cl-chips">{grades.map(g=><button key={g.grade} className={"cl-chip"+(grade===g.grade?" on":"")} onClick={()=>{setGrade(g.grade);setSubject("");setQ("")}}>{g.grade} <small>({g.subjects.length})</small></button>)}</div></>}
   {gr&&<><h3>3. {level==="Pre-primary"?"Learning area or book":"Subject"}</h3>
    <label className="field cl-search">Search<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Type to filter"/></label>
    <div className="cl-chips">{subjects.map(s=><button key={s.subject} className={"cl-chip"+(subject===s.subject?" on":"")} onClick={()=>setSubject(s.subject)}>{s.subject}</button>)}{!subjects.length&&<span className="cl-help">Nothing matches.</span>}</div></>}
   {focusClass&&<p><button className="cl-chip" onClick={()=>setBrowse(false)}>Back to my selection</button></p>}
  </section>}
  {sj&&<section className="cr-panel"><div className="cl-head"><div><span className="cl-eyebrow">{level} · {grade}</span><h2>{sj.subject}</h2></div>
    {onAddMaterial&&<button className="button secondary" onClick={onAddMaterial}>Add my own link or file</button>}</div>
   {sj.courses.map(c=><article key={c.i} className="cl-course">
    <h3>{c.t}</h3>
    <div className="cl-files">{(c.f||[]).map(f=><a key={f[1]} className="cl-file" href={fileUrl(f[1])} target="_blank" rel="noopener noreferrer"><span>{kind(f[0])}</span>{f[0]}</a>)}
     {(c.l||[]).map(f=><a key={"l"+f[1]} className="cl-file link" href={REB+"/mod/url/view.php?id="+f[1]} target="_blank" rel="noopener noreferrer"><span>Link</span>{f[0]}</a>)}
     <a className="cl-file open" href={courseUrl(c.i)} target="_blank" rel="noopener noreferrer"><span>REB</span>Open the full course</a></div>
    {cleanUnits(c.u).length>0&&<div><h4>Units (read from the REB course page; confirm in the teacher guide)</h4><ol className="cl-units">{cleanUnits(c.u).map(u=><li key={u[0]}><strong>Unit {u[0]}: {u[1]}</strong>{u[2]&&<p>Key competence: {u[2]}</p>}</li>)}</ol></div>}
    {!cleanUnits(c.u).length&&c.s?.length>0&&<div><h4>Course sections</h4><ol className="cl-units">{c.s.map((s,i)=><li key={i}><strong>{s}</strong></li>)}</ol></div>}
    {!c.f?.length&&!cleanUnits(c.u).length&&!c.s?.length&&<p className="cl-help">REB has not published files for this folder yet. Open the course to check for updates.</p>}
   </article>)}
  </section>}
  {gr&&!sj&&<section className="cr-panel"><p className="cl-help">Choose a {level==="Pre-primary"?"learning area or book":"subject"} above to see its student book, teacher guide and units.</p></section>}
 </div>;
}
