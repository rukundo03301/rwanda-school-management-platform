// Public front page of the Umurage platform, drawn entirely in code (no picture file needed).
// Pure presentation: no data, no secrets. The cards are a preview of what a parent sees.
const MODULES=[["Students","M12 3 2 8l10 5 8-4v6h2V8L12 3zm-6 9v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4l-6 3-6-3z"],["Teachers","M4 4h16v10H4zM8 18h8v2H8zM11 14h2v4h-2z"],["Parents","M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM2 19c0-3 3-5 6-5s6 2 6 5zm13 0c0-1.700-.6-3-1.700-4 .6-.2 1.100-.3 1.700-.3 2.500 0 5 1.500 5 4.300z"],["Administration","M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9 5v-2l-2.200-.5a7 7 0 0 0-.8-1.800l1.200-1.900-1.400-1.400-1.900 1.200a7 7 0 0 0-1.800-.8L13 3h-2l-.5 2.200a7 7 0 0 0-1.800.8L6.800 4.800 5.400 6.200l1.200 1.900a7 7 0 0 0-.8 1.800L3.600 11v2l2.200.5c.2.600.5 1.200.8 1.800l-1.200 1.900 1.400 1.400 1.900-1.200c.6.300 1.200.6 1.800.8L11 21h2l.5-2.200c.6-.2 1.200-.5 1.800-.8l1.900 1.200 1.400-1.400-1.200-1.900c.3-.6.600-1.200.8-1.800z"],["Reports & Analytics","M4 20V10h4v10zm6 0V4h4v16zm6 0v-7h4v7z"],["Finance & Fees","M12 3C7 3 4 4.500 4 6.500S7 10 12 10s8-1.500 8-3.500S17 3 12 3zM4 9v3c0 2 3 3.500 8 3.500s8-1.500 8-3.500V9c-1.500 1.500-4.500 2.200-8 2.200S5.500 10.500 4 9zm0 5.500v3c0 2 3 3.500 8 3.500s8-1.500 8-3.500v-3c-1.500 1.500-4.500 2.200-8 2.200S5.500 16 4 14.500z"]];
const SCHOOLS=[["Nursery","#f59e0b","#ef4444"],["Primary School","#e8c98a","#2563eb"],["High School","#cfe0f7","#2563eb"],["College / University","#f1f5f9","#1d4ed8"]];
const DAYS=(()=>{const a=[];for(let i=0;i<4;i++)a.push(0);for(let d=1;d<=31;d++)a.push(d);return a;})();
const MARK=[8,15,19,20,21];

const CSS=[
".shell.lp{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,400px);gap:28px;align-items:start;padding:22px clamp(14px,3vw,48px) 40px;position:relative;overflow:hidden;",
"background:radial-gradient(1200px 500px at 50% -10%,#ffffff 0%,#e6f1ff 45%,#cfe3ff 100%)}",
".shell.lp .auth-card{justify-self:center;width:min(400px,100%);box-shadow:0 22px 60px #1d4ed82e;position:sticky;top:20px;z-index:2}",
".um{min-width:0;display:grid;gap:18px}",
".um-top{display:flex;align-items:center;gap:16px;flex-wrap:wrap;background:#ffffffcc;border:1px solid #d6e6fb;border-radius:20px;padding:12px 18px;box-shadow:0 10px 30px #1d4ed814}",
".um-logo{display:flex;align-items:center;gap:10px}",
".um-logo b{display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:22px}",
".um-logo div{line-height:1.05}.um-logo strong{display:block;font-size:26px;letter-spacing:.5px;color:#12408a;font-weight:900}.um-logo span{font-size:12px;font-weight:700;color:#12408a}",
".um-tag{margin-left:auto;font-size:clamp(18px,2.4vw,28px);font-weight:800;font-style:italic;color:#12408a;border-bottom:3px solid #f59e0b;padding-bottom:2px}",
".um-stage{position:relative;display:grid;grid-template-columns:minmax(140px,1fr) minmax(260px,1.5fr) minmax(140px,1fr);gap:14px;align-items:center}",
".um-col{display:grid;gap:14px}",
".um-pill{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #d6e6fb;border-radius:16px;padding:8px 12px;font-weight:800;color:#12408a;font-size:14px;box-shadow:0 8px 22px #1d4ed814}",
".um-pill svg{width:64px;height:44px;flex:none}",
".um-center{display:grid;gap:10px;justify-items:center}",
".um-welcome{width:100%;background:#fff;border:1px solid #d6e6fb;border-radius:20px;padding:12px 14px;box-shadow:0 10px 30px #1d4ed81a}",
".um-welcome h3{margin:0 0 6px;font-size:16px;color:#0d2a5c;line-height:1.15}.um-welcome p{margin:0;font-size:13px;color:#3b5578}",
".um-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}.um-tabs span{background:#eef5ff;border-radius:10px;padding:6px 2px;text-align:center;font-size:11px;font-weight:700;color:#12408a}.um-tabs span:first-child{background:#2563eb;color:#fff}",
".um-family{width:100%;height:auto;display:block}",
".um-mods{width:100%;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;background:linear-gradient(180deg,#2563eb,#1d4ed8);border-radius:16px;padding:10px 6px;box-shadow:0 12px 30px #1d4ed844}",
".um-mods div{display:grid;justify-items:center;gap:4px;color:#fff;font-size:11px;font-weight:700;text-align:center}.um-mods svg{width:22px;height:22px;fill:#fff}",
".um-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}",
".um-card{background:#fff;border:1px solid #d6e6fb;border-radius:18px;box-shadow:0 10px 28px #1d4ed814;overflow:hidden}",
".um-card h4{margin:0;background:linear-gradient(90deg,#2563eb,#1d4ed8);color:#fff;font-size:14px;padding:9px 14px}",
".um-body{padding:12px 14px;display:grid;gap:9px;font-size:13px;color:#1f3358}",
".um-row{display:flex;justify-content:space-between;gap:10px;align-items:center}",
".um-bar{height:7px;background:#e3edfb;border-radius:99px;overflow:hidden;margin-top:3px}.um-bar i{display:block;height:100%;background:#2563eb;border-radius:99px}",
".um-chip{border-radius:8px;padding:3px 10px;font-size:12px;font-weight:800;color:#fff}.um-paid{background:#16a34a}.um-pend{background:#f59e0b}",
".um-link{color:#1d4ed8;font-weight:800;font-size:13px}",
".um-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:12px}.um-cal b{color:#12408a}.um-cal span{padding:3px 0;border-radius:99px}.um-cal .on{background:#16a34a;color:#fff;font-weight:800}",
".um-note{font-size:11px;color:#5b7196;text-align:center}",
"@media(max-width:1000px){.shell.lp{grid-template-columns:1fr}.shell.lp .auth-card{position:static;order:-1}}",
"@media(max-width:760px){.um-stage{grid-template-columns:1fr}.um-mods{grid-template-columns:repeat(3,1fr)}}"
].join("");

function School({name,wall,roof}){
 return <div className="um-pill"><svg viewBox="0 0 64 44" aria-hidden="true"><rect x="4" y="38" width="56" height="4" rx="2" fill="#7bb36b"/><rect x="10" y="18" width="44" height="20" fill={wall} stroke="#8fb2dc"/><path d="M6 19 32 6l26 13z" fill={roof}/><rect x="28" y="26" width="8" height="12" fill="#2563eb"/><g fill="#8fb2dc"><rect x="14" y="23" width="8" height="7"/><rect x="42" y="23" width="8" height="7"/></g></svg>{name}</div>;
}

function Family(){
 const P=[
  {x:70,c:"#1e3a8a",s:"#7a4a2b",h:"#1b1b1b",t:78},
  {x:150,c:"#1e3a8a",s:"#8a5a3a",h:"#d9d9d9",t:70},
  {x:230,c:"#7dd3fc",s:"#6b3f24",h:"#1b1b1b",t:104},
  {x:310,c:"#d6b88c",s:"#7a4a2b",h:"#1b1b1b",t:74},
  {x:385,c:"#1e3a8a",s:"#6b3f24",h:"#1b1b1b",t:106},
  {x:455,c:"#1e3a8a",s:"#7a4a2b",h:"#1b1b1b",t:78},
  {x:530,c:"#111827",s:"#6b3f24",h:"#1b1b1b",t:68}
 ];
 return <svg className="um-family" viewBox="0 0 600 300" role="img" aria-label="A family looking at their school's progress together on a tablet">
  <ellipse cx="300" cy="268" rx="285" ry="26" fill="#bcd6f7"/>
  <ellipse cx="300" cy="258" rx="265" ry="20" fill="#e8f1ff" stroke="#f59e0b" strokeWidth="2"/>
  <rect x="20" y="150" width="560" height="104" rx="34" fill="#1d4ed8"/>
  <rect x="44" y="196" width="512" height="58" rx="20" fill="#2563eb"/>
  {P.map((p,i)=><g key={i}>
   <rect x={p.x-24} y={p.t+54} width="48" height={190-p.t-54} rx="14" fill={p.c}/>
   <circle cx={p.x} cy={p.t+30} r="24" fill={p.s}/>
   <path d={"M"+(p.x-25)+" "+(p.t+28)+" a25 24 0 0 1 50 0 q-25 -16 -50 0z"} fill={p.h}/>
   <circle cx={p.x-8} cy={p.t+32} r="2.200" fill="#111"/><circle cx={p.x+8} cy={p.t+32} r="2.200" fill="#111"/>
   <path d={"M"+(p.x-7)+" "+(p.t+41)+" q7 6 14 0"} stroke="#fff" strokeWidth="2.500" fill="none"/>
  </g>)}
  <rect x="270" y="172" width="58" height="40" rx="6" fill="#e5e7eb" stroke="#475569" strokeWidth="3"/>
 </svg>;
}

export default function Landing(){
 return <section className="um" aria-label="About the Umurage platform">
  <style>{CSS}</style>
  <div className="um-top">
   <div className="um-logo"><b>U</b><div><strong>UMURAGE</strong><span>School Management Platform</span></div></div>
   <div className="um-tag">Smart Learning Starts Here</div>
  </div>
  <div className="um-stage">
   <div className="um-col">
    <School name={SCHOOLS[0][0]} wall={SCHOOLS[0][1]} roof={SCHOOLS[0][2]}/>
    <School name={SCHOOLS[1][0]} wall={SCHOOLS[1][1]} roof={SCHOOLS[1][2]}/>
   </div>
   <div className="um-center">
    <div className="um-welcome"><h3>Umurage School Management Platform</h3><p>Welcome, Parent</p>
     <div className="um-tabs"><span>Overview</span><span>Child Profile</span><span>Notifications</span><span>Settings</span></div></div>
    <Family/>
    <div className="um-mods">{MODULES.map(m=><div key={m[0]}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={m[1]}/></svg>{m[0]}</div>)}</div>
   </div>
   <div className="um-col">
    <School name={SCHOOLS[2][0]} wall={SCHOOLS[2][1]} roof={SCHOOLS[2][2]}/>
    <School name={SCHOOLS[3][0]} wall={SCHOOLS[3][1]} roof={SCHOOLS[3][2]}/>
   </div>
  </div>
  <div className="um-cards">
   <div className="um-card"><h4>Academic Progress</h4><div className="um-body">
    {[["Science",85],["Mathematics",78],["English",92]].map(r=><div key={r[0]}><div className="um-row"><b>{r[0]}</b><b>{r[1]}%</b></div><div className="um-bar"><i style={{width:r[1]+"%"}}/></div></div>)}</div></div>
   <div className="um-card"><h4>School Information</h4><div className="um-body">
    <div className="um-row"><span>Class</span><b>Grade 5</b></div><div className="um-row"><span>Class Teacher</span><b>Your child's teacher</b></div><div className="um-row"><span>Academic Year</span><b>2026 to 2027</b></div><span className="um-link">View Details</span></div></div>
   <div className="um-card"><h4>Announcements</h4><div className="um-body">
    <div><b>Holiday Notice</b><br/>School closed on the announced date.</div><div><b>PTM Schedule</b><br/>Parent and teacher meeting.</div><div><b>New Circular</b><br/>Open it to read the new circular.</div></div></div>
   <div className="um-card"><h4>Fees & Payments</h4><div className="um-body">
    <div className="um-row"><span>Annual Fees</span><span className="um-chip um-paid">Paid</span></div><div className="um-row"><span>Transport Fees</span><span className="um-chip um-paid">Paid</span></div><div className="um-row"><span>Exam Fees</span><span className="um-chip um-pend">Pending</span></div><span className="um-link">View Payment History</span></div></div>
   <div className="um-card"><h4>Messages & Communication</h4><div className="um-body">
    <div><b>Class Teacher</b><br/>Reminder about the parent meeting.</div><div><b>School Admin</b><br/>Annual day celebration.</div><div><b>Sports Department</b><br/>Inter-school competition.</div><span className="um-link">View All Messages</span></div></div>
   <div className="um-card"><h4>Attendance</h4><div className="um-body"><div className="um-cal">
    {["S","M","T","W","T","F","S"].map((d,i)=><b key={i}>{d}</b>)}
    {DAYS.map((d,i)=><span key={i} className={MARK.includes(d)?"on":""}>{d||""}</span>)}</div></div></div>
  </div>
  <div className="um-note">Preview of what a parent sees after signing in. Each school keeps its own name, colours and private records.</div>
 </section>;
}
