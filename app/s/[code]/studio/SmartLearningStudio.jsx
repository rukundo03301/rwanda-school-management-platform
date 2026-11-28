"use client";
import {useEffect,useMemo,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import {getStudioActivity,REB_RESOURCE_PORTALS,SMART_LEARNING_ACTIVITIES,studioSubjectList,studioWorksheetText,studioSourcesFor} from "../../../../lib/smart-learning-catalog.mjs";
import "./studio.css";

const SHAPES=[["Circle",0,0],["Triangle",3,3],["Square",4,4],["Rectangle",4,4],["Pentagon",5,5],["Hexagon",6,6]];
const POLYGONS={Triangle:"180,34 304,230 56,230",Square:"78,48 282,48 282,252 78,252",Rectangle:"47,72 313,72 313,228 47,228",Pentagon:"180,23 327,130 271,273 89,273 33,130",Hexagon:"105,33 255,33 336,150 255,267 105,267 24,150"};
const COLORS=["#226add","#f5b82c","#e84e58","#23a884","#894edb","#f48a36","#142a4c","#ffffff"];
function Shapes(){
 const [s,setS]=useState(SHAPES[1]),[guess,setGuess]=useState(""),[checked,setChecked]=useState(false);
 return <div className="sl-workbench"><div className="sl-control-row">{SHAPES.map(x=><button key={x[0]} className={s[0]===x[0]?"selected":""} onClick={()=>{setS(x);setGuess("");setChecked(false)}}>{x[0]}</button>)}</div>
 <svg viewBox="0 0 360 300" className="sl-shape-drawing" role="img" aria-label={"Diagram of a "+s[0]}>{s[0]==="Circle"?<circle cx="180" cy="150" r="115" fill="#a9d5ff" stroke="#2672d3" strokeWidth="8"/>:<polygon points={POLYGONS[s[0]]} fill="#b0d8ff" stroke="#2a73d5" strokeWidth="8" strokeLinejoin="round"/>}</svg>
 <label className="sl-question">How many straight sides does a {s[0].toLowerCase()} have?<input type="number" inputMode="numeric" min="0" max="20" value={guess} onChange={e=>{setGuess(e.target.value);setChecked(false)}}/></label>
 <button className="sl-primary" disabled={guess===""} onClick={()=>setChecked(true)}>Check answer</button>
 {checked&&<p role="status" className={"sl-feedback "+(Number(guess)===s[1]?"correct":"")}>{Number(guess)===s[1]?"Correct!":"Try again."} {s[0]} has {s[1]} straight sides and {s[2]} corners.</p>}</div>;
}
function Fractions(){
 const [den,setDen]=useState(4),[num,setNum]=useState(1);
 return <div className="sl-workbench"><div className="sl-split-control"><label>Equal parts <strong>{den}</strong><input type="range" min="2" max="12" value={den} onChange={e=>{const d=Number(e.target.value);setDen(d);setNum(n=>Math.min(n,d))}}/></label>
 <label>Shaded parts <strong>{num}</strong><input type="range" min="0" max={den} value={num} onChange={e=>setNum(Number(e.target.value))}/></label></div>
 <div className="sl-fraction-display" role="img" aria-label={num+" of "+den+" equal parts shaded"}>{Array.from({length:den},(_,i)=><div key={i} className={i<num?"shaded":""}/>)}</div>
 <p className="sl-big-result"><strong>{num}/{den}</strong> · {num} shaded out of {den} parts</p><p className="sl-mini-note">Move the controls to illustrate fractions visually. Ask learners to explain their answers.</p></div>;
}
function Groups(){
 const [groups,setGroups]=useState(4),[per,setPer]=useState(3);
 return <div className="sl-workbench"><div className="sl-split-control"><label>Groups <strong>{groups}</strong><input type="range" min="1" max="8" value={groups} onChange={e=>setGroups(Number(e.target.value))}/></label>
 <label>Items per group <strong>{per}</strong><input type="range" min="1" max="8" value={per} onChange={e=>setPer(Number(e.target.value))}/></label></div>
 <div className="sl-groups">{Array.from({length:groups},(_,i)=><div key={i} className="sl-group" aria-label={"Group with "+per+" objects"}>{Array.from({length:per},(_,j)=><span key={j}/>)}</div>)}</div>
 <p className="sl-big-result">{groups} × {per} = <strong>{groups*per}</strong></p><p className="sl-mini-note">Repeated addition: {Array.from({length:groups},()=>per).join(" + ")} = {groups*per}</p></div>;
}
function Cards({activity}){
 const [i,setI]=useState(0),[flip,setFlip]=useState(false);const cards=activity.examples;const c=cards[i%cards.length]||{front:activity.title,back:activity.objective};
 return <div className="sl-workbench"><p className="sl-mini-note">Card {i%cards.length+1} of {cards.length} — think before revealing.</p>
 <button className="sl-flashcard" onClick={()=>setFlip(v=>!v)} aria-label={flip?"Show card front":"Reveal card explanation"}><small>{flip?"EXPLANATION":"READ / THINK"}</small><strong>{flip?c.back:c.front}</strong><span>Tap to flip</span></button>
 <div className="sl-control-row"><button onClick={()=>{setI(n=>(n+cards.length-1)%cards.length);setFlip(false)}}>Previous</button><button className="sl-primary" onClick={()=>{setI(n=>(n+1)%cards.length);setFlip(false)}}>Next card</button></div></div>;
}
function Sort({activity}){
 const [i,setI]=useState(0),[choice,setChoice]=useState(null);const c=activity.examples[i%activity.examples.length];
 return <div className="sl-workbench"><p className="sl-mini-note">Item {i%activity.examples.length+1} / {activity.examples.length}</p><div className="sl-sort-prompt">Which state of matter is <strong>{c.front}</strong>?</div>
 <div className="sl-control-row">{["Solid","Liquid","Gas"].map(s=><button key={s} className={choice===s?"selected":""} onClick={()=>setChoice(s)}>{s}</button>)}</div>
 {choice&&<p role="status" className={"sl-feedback "+(choice===c.back?"correct":"")}>{choice===c.back?"Correct!":"Not quite."} Answer: {c.back}.</p>}
 <button className="sl-primary" onClick={()=>{setI(n=>(n+1)%activity.examples.length);setChoice(null)}}>Next item</button></div>;
}
function Art(){
 const [color,setColor]=useState(COLORS[0]),[cells,setCells]=useState({});
 return <div className="sl-workbench"><div className="sl-palette">{COLORS.map(c=><button key={c} aria-label={"Choose colour "+c} aria-pressed={color===c} style={{background:c}} className={color===c?"selected":""} onClick={()=>setColor(c)}/>)}</div>
 <div className="sl-pixel-canvas" role="group" aria-label="Interactive drawing squares">{Array.from({length:64},(_,i)=><button key={i} aria-label={"Paint square "+(i+1)} style={{background:cells[i]||"#fff"}} onClick={()=>setCells(v=>({...v,[i]:color}))}/>)}</div>
 <div className="sl-control-row"><button onClick={()=>setCells({})}>Clear</button><span className="sl-mini-note">Choose a colour and paint a repeating pattern.</span></div></div>;
}
function Workbench({activity}){
 return activity.tool==="shapes"?<Shapes/>:activity.tool==="fractions"?<Fractions/>:activity.tool==="groups"?<Groups/>:activity.tool==="sort"?<Sort key={activity.id} activity={activity}/>:activity.tool==="cards"?<Cards key={activity.id} activity={activity}/>:activity.tool==="art"?<Art/>:null;
}
export default function SmartLearningStudio({code}){
 const [auth,setAuth]=useState({loading:true,school:"",roles:[],error:""});
 const [subject,setSubject]=useState("all"),[level,setLevel]=useState("all"),[search,setSearch]=useState(""),[selected,setSelected]=useState("math-shapes"),[notice,setNotice]=useState("");
 useEffect(()=>{let alive=true;(async()=>{try{
  const c=browserSupabase();if(!c)throw Error("School sign-in is not configured");
  const {data:{session}}=await c.auth.getSession();if(!session)throw Error("Sign in to your school account first");
  const res=await fetch("/api/school/"+encodeURIComponent(code)+"/access",{cache:"no-store",headers:{Authorization:"Bearer "+session.access_token}});
  const data=await res.json().catch(()=>({}));if(!res.ok)throw Error(data.error||"School access unavailable");
  if(!(data.roles||[]).some(r=>["student","teacher","school_owner","school_admin","parent"].includes(r)))throw Error("Your school account does not have learning-library access");
  if(alive)setAuth({loading:false,school:data.school?.name||"Your school",roles:data.roles,error:""});
 }catch(e){if(alive)setAuth({loading:false,school:"",roles:[],error:e.message})}})();return()=>{alive=false};},[code]);
 const isTeacher=auth.roles.some(r=>["teacher","school_owner","school_admin"].includes(r));
 const filtered=useMemo(()=>SMART_LEARNING_ACTIVITIES.filter(a=>(subject==="all"||a.subject===subject)&&(level==="all"||a.levels.includes(level))&&[a.title,a.subject,a.objective,a.prompt].join(" ").toLocaleLowerCase().includes(search.toLocaleLowerCase())),[subject,level,search]);
 const active=filtered.find(a=>a.id===selected)||filtered[0]||null;
 async function copy(){
  if(!active)return;
  try{await navigator.clipboard.writeText(studioWorksheetText(active.id));setNotice("Teaching outline copied. Paste it into a lesson or homework.");}
  catch{setNotice("Clipboard access unavailable. Use Print Worksheet instead.");}
 }
 if(auth.loading)return <main className="sl-root"><p role="status">Checking verified school membership…</p></main>;
 if(auth.error)return <main className="sl-root"><h1>Smart Learning Studio</h1><p role="alert">{auth.error}</p><a href={"/s/"+code+"/login"}>School sign-in</a></main>;
 return <main className="sl-root">
  <header className="sl-header"><div><span className="sl-eyebrow">UMURAGE · SMART LEARNING STARTS HERE</span><h1>Practice Games</h1>
   <p>Short interactive games pupils play to practise a skill (shapes, fractions, Kinyarwanda, English words). Teachers can use one in class or send it as homework. Choose a level below to see only the games for that level.</p></div>
   <div className="sl-header-right"><span>{auth.school}</span><strong>{SMART_LEARNING_ACTIVITIES.length} original activities</strong></div></header>
  <div className="sl-notice"><strong>Teacher-reviewed content.</strong> The activities are Umurage-original examples, not REB textbook pages or certified assessments. Teachers must confirm curriculum and grade suitability. Practice results are not recorded as formal marks.</div>
  <div className="sl-levelbar" role="tablist" aria-label="School level">{["all","Nursery","Primary","Secondary","College / University"].map(l=>
   <button key={l} role="tab" aria-selected={level===l} className={level===l?"on":""} onClick={()=>setLevel(l)}>{l==="all"?"All levels":l} <small>{l==="all"?SMART_LEARNING_ACTIVITIES.length:SMART_LEARNING_ACTIVITIES.filter(a=>a.levels.includes(l)).length}</small></button>)}</div>
  <section className="sl-filters"><label>Find an activity<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Shapes, Kinyarwanda, English…" /></label>
   <label>Subject<select value={subject} onChange={e=>setSubject(e.target.value)}><option value="all">All subjects</option>{studioSubjectList().map(s=><option key={s}>{s}</option>)}</select></label>
   <label>School level<select value={level} onChange={e=>setLevel(e.target.value)}><option value="all">All levels</option>{["Nursery","Primary","Secondary","College / University"].map(s=><option key={s}>{s}</option>)}</select></label></section>
  <section className="sl-content"><div className="sl-collection" aria-label="Subject activity catalogue">
   {filtered.map(a=><button className={"sl-activity "+(active?.id===a.id?"active":"")} key={a.id} onClick={()=>{setSelected(a.id);setNotice("")}}><span>{a.subject} · {a.levels.join(" / ")}</span><strong>{a.title}</strong><small>{a.objective}</small></button>)}
   {!filtered.length&&<p className="sl-empty">No matching activities. Change the search or filters.</p>}</div>
   {active&&<article className="sl-stage" key={active.id}><header className="sl-stage-head"><span className="sl-topic">{active.subject}</span><h2>{active.title}</h2><p>{active.objective}</p><div className="sl-tags">{active.levels.map(s=><button type="button" key={s} title={"Show all "+s+" games"} onClick={()=>setLevel(s)}>{s}</button>)}<span>Guided practice</span></div></header>
    <Workbench activity={active}/>
    <section className="sl-subject-links"><h3>Official learning resources related to {active.subject}</h3>
     <div>{studioSourcesFor(active.subject).map(r=><a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer">{r.label} ↗</a>)}</div>
     <p>Choose the exact year, class and syllabus unit before using any official content. College / university courses require the institution's own approved curriculum.</p></section>
    <section className="sl-plan"><h3>Teacher facilitation guide</h3><ol>{active.activities.map((a,i)=><li key={i}>{a}</li>)}</ol>
     <h3>Suggested student worksheet</h3><p>{active.prompt}</p>
     <div className="sl-plan-actions"><button onClick={copy}>Copy lesson and questions</button><button onClick={()=>window.print()}>Print worksheet / Save PDF</button>
      {isTeacher?<a href={"/s/"+code+"/classroom?tab=homework&studio="+encodeURIComponent(active.id)}>Open homework composer</a>:<a href={"/s/"+code+"/learning?tab=homework"}>Open my assigned homework</a>}</div>
     {notice&&<p role="status" className="sl-feedback correct">{notice}</p>}</section>
   </article>}</section>
  <section className="sl-reb"><div><span className="sl-eyebrow">OFFICIAL BOOKS & GUIDES</span><h2>Rwanda Education Board resource directory</h2>
   <p>Find REB learning materials and teacher guides. Some resources require a REB account; Umurage does not reproduce copyrighted textbooks.</p></div>
   <div className="sl-reb-grid">{REB_RESOURCE_PORTALS.map(r=><a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer"><strong>{r.label} ↗</strong><small>{r.note}</small></a>)}</div></section>
  {active&&<section className="sl-print-only"><h1>{auth.school} — {active.subject}</h1><h2>{active.title}</h2><p>Name: ___________________ Class: __________ Date: __________</p><h3>Learning objective</h3><p>{active.objective}</p><h3>Activity</h3><p>{active.prompt}</p><div className="sl-writing-space"/></section>}
 </main>;
}
