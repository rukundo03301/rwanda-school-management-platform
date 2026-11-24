"use client";
import {useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
import fixture from "../../../../demo/school-d-full-sample.json";

const SECTIONS=[
 ["overview","Overview"],["leadership","Leadership"],["teachers","Teachers"],["staff","Operations Staff"],
 ["governance","Board"],["assets","Assets"],["stock","Stock"],["maintenance","Maintenance"],["events","Events"],["social","Social Links"]
];
function Table({columns,rows,empty="No demonstration records"}){return <div className="table-wrap"><table><thead><tr>{columns.map(c=><th key={c.label}>{c.label}</th>)}</tr></thead><tbody>
 {rows.map((r,i)=><tr key={i}>{columns.map(c=><td key={c.label}>{r[c.key]??"—"}</td>)}</tr>)}</tbody></table>
 {!rows.length&&<p className="muted">{empty}</p>}</div>}
export default function DemoHub({code}){
 const [state,setState]=useState({busy:true,error:"",owner:false,schoolName:"",live:null});
 const [tab,setTab]=useState("overview");
 useEffect(()=>{
  let mounted=true;
  (async()=>{
   try{
    const client=browserSupabase();
    const {data:{session}}=await client.auth.getSession();
    if(!session)throw Error("Sign in with School D's approved owner account.");
    const headers={Authorization:"Bearer "+session.access_token};
    const adminResponse=await fetch("/api/school/"+code+"/admin",{headers,cache:"no-store"});
    const admin=await adminResponse.json();
    if(!adminResponse.ok)throw Error(admin.error||"Unable to verify school administration access.");
    if(admin.actor?.isOwner!==true)throw Error("This fictional demo hub is reserved for the School D owner.");
    const classResponse=await fetch("/api/school/"+code+"/classroom",{headers,cache:"no-store"});
    const live=classResponse.ok?await classResponse.json():null;
    if(mounted)setState({busy:false,error:"",owner:true,schoolName:admin.school?.name||"School D",live});
   }catch(e){if(mounted)setState({busy:false,error:e.message||"Access denied",owner:false,schoolName:"",live:null});}
  })();
  return ()=>{mounted=false};
 },[code]);
 if(state.busy)return <main className="demo-loading">Verifying School D demonstration access…</main>;
 if(!state.owner)return <main className="demo-loading"><h1>Demonstration access unavailable</h1><p role="alert">{state.error}</p><a className="button" href={"/s/"+code+"/login"}>School sign-in</a></main>;
 const live=state.live;
 const liveCounts={students:live?.roster?.length,classes:live?.classes?.length,subjects:live?.subjects?.length,teacherLogins:1};
 const title=SECTIONS.find(([key])=>key===tab)?.[1]||"Overview";
 return <main className="demo-shell">
 <header className="demo-header"><div><a href={"/s/"+code+"/admin"}>← School Administration</a><h1>{state.schoolName}</h1><p>Owner Demonstration Hub · FICTIONAL SAMPLE DATA ONLY</p></div><span className="demo-stamp">DEMO / NOT REAL</span></header>
 <div className="demo-layout"><nav className="demo-navigation" aria-label="Demo modules">
  {SECTIONS.map(([key,label])=><button key={key} className={tab===key?"selected":""} onClick={()=>setTab(key)}>{label}</button>)}
 </nav><div className="demo-content">
 <div className="demo-section-title"><div><h2>{title}</h2><p className="muted">The directory examples below are fictional design fixtures. They are not verified user accounts or completed operational workflows.</p></div></div>
 {tab==="overview"&&<><div className="demo-kpis">
  <article><strong>{liveCounts.students??20}</strong><span>Enrolled learners</span></article><article><strong>{liveCounts.classes??4}</strong><span>Classes</span></article><article><strong>{fixture.teachers.length}</strong><span>Teacher profiles (demo)</span></article><article><strong>{fixture.staff.length}</strong><span>Operational staff (demo)</span></article>
 </div><div className="demo-grid"><section className="demo-panel"><h3>Live academic connections</h3>
  <p>Student admissions, class enrollment, homework, attendance, announcements and calendars are backed by the existing school platform.</p>
  <div className="demo-buttons"><a className="button secondary" href={"/s/"+code+"/admissions"}>Students & Admissions</a><a className="button secondary" href={"/s/"+code+"/classroom"}>Classrooms & Teachers</a><a className="button secondary" href={"/s/"+code+"/communications"}>Events & Timetable</a><a className="button secondary" href={"/s/"+code+"/fees"}>School Fees (RWF)</a><a className="button secondary" href={"/s/"+code+"/reports"}>School Reports</a></div>
  </section><section className="demo-panel"><h3>Operations modules to implement</h3><p>Governance, staff directory, assets, maintenance, kitchen inventory, and stock transactions need their own secured APIs, tables and workflows. The sample entries in this hub are read-only and cannot move real stock or money.</p></section></div></>}
 {tab==="leadership"&&<div className="demo-panel"><Table columns={[{label:"School leadership role",key:"position"},{label:"Scope of responsibility",key:"access"}]} rows={fixture.leadership}/></div>}
 {tab==="teachers"&&<div className="demo-panel"><p>Five fictional teacher directory profiles; only an existing, separately verified teacher account has actual sign-in access.</p><Table columns={[{label:"Directory code",key:"code"},{label:"Fictional name",key:"name"},{label:"Class",key:"assigned_class"},{label:"Subjects",key:"subjectsLabel"},{label:"Account",key:"account_status"}]} rows={fixture.teachers.map(x=>({...x,subjectsLabel:x.subjects.join(", ")}))}/></div>}
 {tab==="staff"&&<div className="demo-panel"><Table columns={[{label:"Code",key:"code"},{label:"Name",key:"name"},{label:"Role",key:"role"},{label:"Example permissions",key:"permissionLabel"}]} rows={fixture.staff.map(x=>({...x,permissionLabel:x.permissions.join(", ")}))}/></div>}
 {tab==="governance"&&<div className="demo-panel"><p>Board or School General Assembly structure must be configured for the school's category and applicable Rwanda requirements.</p><Table columns={[{label:"Position",key:"position"},{label:"Fictional member",key:"name"}]} rows={fixture.board}/></div>}
 {tab==="assets"&&<div className="demo-panel"><Table columns={[{label:"Asset code",key:"code"},{label:"Asset description",key:"label"},{label:"Qty",key:"quantity"},{label:"Location",key:"location"}]} rows={fixture.assets}/></div>}
 {tab==="stock"&&<div className="demo-panel"><Table columns={[{label:"Stock code",key:"sku"},{label:"Description",key:"name"},{label:"Qty",key:"quantity"},{label:"Unit",key:"unit"},{label:"Reorder at",key:"reorder_level"}]} rows={fixture.inventory}/></div>}
 {tab==="maintenance"&&<div className="demo-panel"><Table columns={[{label:"Work order",key:"id"},{label:"Asset",key:"asset_code"},{label:"Task",key:"task"},{label:"Status",key:"status"}]} rows={fixture.maintenance}/></div>}
 {tab==="events"&&<div className="demo-panel"><p>The following fictional event types are included in the live School D calendar; public-school advertising requires approval before publication.</p><Table columns={[{label:"Event",key:"title"},{label:"Audience",key:"audience"},{label:"Date",key:"date"}]} rows={fixture.event_plan}/><a className="button secondary" href={"/s/"+code+"/communications"}>Open live school calendar</a></div>}
 {tab==="social"&&<div className="demo-panel"><h3>Official school social channels</h3><p>No social media accounts or external URLs have been invented. School Owner must enter verified institutional YouTube, TikTok, Facebook, and other official links in a future approved settings editor.</p><Table columns={[{label:"Channel",key:"channel"},{label:"Official link",key:"link"}]} rows={["YouTube","TikTok","Facebook","Instagram","Website"].map(channel=>({channel,link:"Not configured"}))}/></div>}
 </div></div><footer className="demo-footer">Rwanda School Management Platform · School D fictional test fixture · Never use these names for real enrollment, payroll or financial reporting.</footer>
 </main>;
}
