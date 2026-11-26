"use client";
import "./landing.css";

const ICONS={
 book:<><path d="M12 6c-2.1-1.5-4.5-2-8-2v14c3.3 0 5.7.6 8 2 2.3-1.4 4.7-2 8-2V4c-3.5 0-5.9.5-8 2Z"/><path d="M12 6v14"/></>,
 school:<><path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-7h6v7M8 10h1M15 10h1"/></>,
 graduation:<><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v6c3.5 3 8.5 3 12 0v-6M22 9v7"/></>,
 people:<><path d="M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
 profile:<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
 calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-14 4h3m4 0h3"/></>,
 message:<><path d="M21 11.5A8.4 8.4 0 0 1 12.5 20a9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8 12h8"/></>,
 reports:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 16v-4m3 4V8m3 8v-6"/></>,
 finance:<><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20M6 15h5"/></>,
 attendance:<><path d="M20 6 9 17l-5-5"/><circle cx="12" cy="12" r="10"/></>,
 settings:<><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1 2-2.4 2.4-2-.1-.9 1.8h-3.4l-.9-1.8-2 .1-2.4-2.4.1-2L4 14.1v-3.4l1.8-.9-.1-2L8.1 5.4l2 .1.9-1.8h3.4l.9 1.8 2-.1 2.4 2.4-.1 2 1.8.9v3.4Z"/></>,
 shield:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
 sparkle:<><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7L12 3ZM20 18l.5 1.5L22 20l-1.5.5L20 22l-.5-1.5L18 20l1.5-.5L20 18Z"/></>,
 nursery:<><path d="M5 20v-8a7 7 0 0 1 14 0v8M3 20h18"/><path d="M9 10c.5 1 1.5 1.7 3 1.7s2.5-.7 3-1.7M10 16h4"/></>,
 primary:<><path d="M3 21h18M5 21V9l7-5 7 5v12M8 13h2m4 0h2M10 21v-5h4v5"/></>,
 secondary:<><path d="M3 21h18M5 21V6h14v15M9 10h1m4 0h1m-6 4h1m4 0h1M10 21v-4h4v4"/></>,
 university:<><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v6c3.5 3 8.5 3 12 0v-6M22 9v7"/></>,
 bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 phone:<><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 19h2"/></>
};
function Icon({name}){return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[name]||ICONS.school}</svg>}
function BrandLogo(){return <svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="lp-logo-blue" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#3c91fc"/><stop offset="1" stopColor="#1753bc"/></linearGradient></defs><path d="M6 22 31 11l27 11-27 10L6 22Z" fill="#2269d6"/><path d="M13 30c8 0 14 3 19 9 5-6 12-9 20-9v17c-7-1-13 1-20 6-7-5-13-7-19-6V30Z" fill="#edf6ff" stroke="#286fd1" strokeWidth="2.5" strokeLinejoin="round"/><path d="M32 39v14" stroke="#f4a911" strokeWidth="3"/><path d="M56 22v15" stroke="#e5a52e" strokeWidth="3" strokeLinecap="round"/><circle cx="56" cy="39" r="3" fill="#e5a52e"/><path d="M20 34q7 3 12 8m10-8q-6 3-10 8" stroke="#94c0f9" strokeWidth="1.8" fill="none"/></svg>}

function FamilyStage(){
 return <div className="lp-stage-wrap" aria-label="Illustration of a family connected with students, teachers, parents, and school administration">
  <div className="lp-stage-glow" aria-hidden="true"/>
  <svg className="lp-stage-illustration" viewBox="0 0 740 365" role="img" aria-label="Parents and students of different ages on a blue sofa above an elevated circular platform, connected to school services">
   <defs>
    <linearGradient id="lp-couch" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#3685ed"/><stop offset="1" stopColor="#124ea6"/></linearGradient>
    <linearGradient id="lp-platform" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#fff"/><stop offset="1" stopColor="#d4e6ff"/></linearGradient>
    <linearGradient id="lp-shirt" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#245aab"/><stop offset="1" stopColor="#153e83"/></linearGradient>
    <linearGradient id="lp-skyshirt" x1="0" x2="1" y1="0" y2="0"><stop stopColor="#a9dafd"/><stop offset="1" stopColor="#5eaaf6"/></linearGradient>
    <filter id="lp-soft-shadow" x="-30%" width="160%" y="-50%" height="200%"><feGaussianBlur stdDeviation="11"/></filter>
   </defs>
   <ellipse cx="371" cy="331" rx="316" ry="34" fill="#4688d0" opacity=".15" filter="url(#lp-soft-shadow)"/>
   <path d="M62 291Q370 240 678 291v29Q366 388 62 320Z" fill="#aacbf3" stroke="#8cb9ed" strokeWidth="3"/>
   <ellipse cx="370" cy="286" rx="312" ry="53" fill="url(#lp-platform)" stroke="#b0d1fa" strokeWidth="5"/>
   <ellipse cx="370" cy="289" rx="281" ry="40" fill="none" stroke="#7fb7fb" strokeWidth="5" opacity=".75"/>
   <ellipse cx="370" cy="269" rx="256" ry="47" fill="#e5f0ff" opacity=".58"/>
   <path d="M154 248h433v48H154Z" fill="#24589a"/>
   <rect x="128" y="155" width="486" height="132" rx="63" fill="url(#lp-couch)" stroke="#245cba" strokeWidth="4"/>
   <rect x="155" y="210" width="433" height="78" rx="30" fill="#2366c3" stroke="#1955ae" strokeWidth="4"/>
   <rect x="126" y="202" width="66" height="85" rx="26" fill="#1958af"/>
   <rect x="550" y="202" width="64" height="85" rx="26" fill="#1958af"/>
   <rect x="162" y="275" width="25" height="27" rx="8" fill="#164882"/>
   <rect x="549" y="275" width="25" height="27" rx="8" fill="#164882"/>
   {/* Older grandfather, navy suit and silver hair */}
   <g>
    <path d="M213 270q-12-56 19-92l79 7 18 87Z" fill="url(#lp-shirt)"/>
    <path d="M235 256q-14 25-7 44h29l26-35m21-7q18 29 5 42h-34l-14-33" fill="#d8e3f4" stroke="#aabbd0" strokeWidth="2"/>
    <ellipse cx="261" cy="139" rx="32" ry="38" fill="#9c5c3d"/>
    <path d="M230 139q-4-43 28-45 30-3 36 37-10-17-24-19-21 18-40 14Z" fill="#e0e4e8"/>
    <path d="M247 157q14 14 28 0" fill="none" stroke="#673b2e" strokeWidth="3" strokeLinecap="round"/>
    <path d="M248 143h6m14 0h7" stroke="#513229" strokeWidth="2" strokeLinecap="round"/>
    <path d="M246 144h-11m30 0h12" fill="none" stroke="#192c43" strokeWidth="2"/>
    <ellipse cx="250" cy="145" rx="13" ry="8" fill="none" stroke="#192c43" strokeWidth="3"/>
    <ellipse cx="275" cy="145" rx="13" ry="8" fill="none" stroke="#192c43" strokeWidth="3"/>
    <path d="M263 145h-1" stroke="#192c43" strokeWidth="3"/>
    <path d="M294 202q18 24 37 35" stroke="#995c40" strokeWidth="17" fill="none" strokeLinecap="round"/>
   </g>
   {/* Adult mother */}
   <g>
    <path d="M433 189q-49 16-47 91h116q0-69-42-91Z" fill="#f5bb46"/>
    <path d="M412 270l-9 30h32l18-26m20-4 4 30h31l-3-35" fill="#243b77"/>
    <circle cx="450" cy="102" r="32" fill="#24202a"/>
    <path d="M420 150q-12-43 5-54 11-18 34-8 29 8 18 58Z" fill="#2b252b"/>
    <ellipse cx="451" cy="148" rx="29" ry="36" fill="#9f5d3a"/>
    <path d="M434 158q16 11 32-1" stroke="#653b2d" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="M435 143h5m16 0h5" stroke="#593326" strokeWidth="2" strokeLinecap="round"/>
    <path d="M406 211q-18 25-47 35" stroke="#9e603b" strokeWidth="16" fill="none" strokeLinecap="round"/>
   </g>
   {/* School-age child with tablet */}
   <g>
    <path d="M317 226q17-28 40-28 29 0 46 28l4 59h-96Z" fill="url(#lp-skyshirt)"/>
    <path d="M329 276v25h22l4-25m20 0 4 25h23l-4-28" fill="#274e91"/>
    <circle cx="358" cy="164" r="26" fill="#673b2b"/>
    <ellipse cx="358" cy="178" rx="25" ry="30" fill="#ad6b45"/>
    <path d="M334 167q-2-24 22-28 23 1 27 25-10-7-19-5-19 10-30 8Z" fill="#29262b"/>
    <path d="M347 185h3m16 0h3" stroke="#55362a" strokeWidth="2" strokeLinecap="round"/>
    <path d="M349 197q9 8 18 0" fill="none" stroke="#693e2f" strokeWidth="2.5" strokeLinecap="round"/>
    <rect x="320" y="225" width="76" height="48" rx="7" fill="#263f71" stroke="#b9d5f8" strokeWidth="3"/>
    <circle cx="358" cy="249" r="5" fill="#91b5e7"/>
    <path d="M326 250q-13 1-12 10m86-10q15-1 16 9" stroke="#ad6b45" strokeWidth="11" fill="none" strokeLinecap="round"/>
   </g>
   {/* Teenage secondary-school learner at left */}
   <g>
    <path d="M160 184q-41 21-35 80l73 2q3-67-21-81Z" fill="#f2f7ff" stroke="#a1c0e6" strokeWidth="2"/>
    <path d="M139 257v42h30l2-37m19-4 2 41h28l-9-45" fill="#1b3f79"/>
    <ellipse cx="171" cy="145" rx="25" ry="30" fill="#8d5136"/>
    <path d="M145 142q-6-31 21-37 24-5 30 31-17-4-26-16-7 15-25 22Z" fill="#27222b"/>
    <path d="M166 116q8-34 30-24" fill="none" stroke="#29242e" strokeWidth="14" strokeLinecap="round"/>
    <path d="M165 153h3m14 0h3" stroke="#412920" strokeWidth="2"/>
    <path d="M160 181l10 14 11-14" fill="#347fe0"/>
   </g>
   {/* College graduate at right */}
   <g>
    <path d="M536 189q-32 22-32 80l79 0q-2-64-29-80Z" fill="#1c2b49"/>
    <path d="M532 259v42h24l8-37m-30-3 18 41h29l-12-45" fill="#314366"/>
    <ellipse cx="547" cy="151" rx="29" ry="34" fill="#8c4b32"/>
    <path d="M519 147q1-41 28-43 34 2 30 42-11-22-25-17-23-2-33 18Z" fill="#28242a"/>
    <path d="M525 155h4m30 0h4" stroke="#40271f" strokeWidth="2"/>
    <path d="M535 170q13 8 25 0" stroke="#6b3d2e" strokeWidth="3" fill="none" strokeLinecap="round"/>
    <path d="m495 111 51-21 51 21-51 20-51-20Z" fill="#253858"/>
    <path d="M510 116v22c23 16 53 16 75 0v-22" fill="none" stroke="#1d345b" strokeWidth="10"/>
    <path d="M595 112v31" stroke="#f5ae25" strokeWidth="4"/>
    <circle cx="595" cy="146" r="6" fill="#f5ae25"/>
    <path d="m532 186 16 18 15-18" fill="none" stroke="#e9a328" strokeWidth="6"/>
   </g>
   <path d="M222 224q35-2 50 15m170 3q25-26 58-22" fill="none" stroke="#a5cef9" strokeWidth="4" opacity=".42" strokeLinecap="round"/>
  </svg>
  <div className="lp-stage-labels" aria-label="Connected roles">{["Students","Teachers","Parents","School leaders","Finance & reports"].map(x=><span key={x}>{x}</span>)}</div>
  <div className="lp-stage-note">One secure, connected school ecosystem</div>
 </div>;
}

const levelRows=[
 {title:"Nursery",sub:"Early years & development",icon:"nursery",background:"#fff6e6"},
 {title:"Primary",sub:"Foundational learning",icon:"primary",background:"#e5f2ff"},
 {title:"Secondary / High School",sub:"Subjects & assessments",icon:"secondary",background:"#f0ecff"},
 {title:"College / University",sub:"Higher education",icon:"university",background:"#e8f7ef"}
];
const news=[
 {name:"School announcements",sub:"Approved notices reach the right audience.",icon:"bell"},
 {name:"Events & calendars",sub:"School activities, dates and meetings.",icon:"calendar"},
 {name:"Parent communication",sub:"Messages connect home with school.",icon:"message"}
];
const systemFeatures=[
 {icon:"finance",title:"Fees & Payments",sub:"RWF invoices, receipts and financial visibility."},
 {icon:"message",title:"Messages & Communication",sub:"School-approved conversations and announcements."},
 {icon:"reports",title:"Reports & Analytics",sub:"Academic, attendance and operational insights."}
];
export default function Landing({onLogin,onSignup}){
 return <>
  <header className="lp-topbar">
   <div className="lp-brand">
    <div className="lp-logo"><BrandLogo/></div>
    <div className="lp-brand-copy">
     <strong className="lp-brand-name">Umurage School Management Platform</strong>
     <span className="lp-brand-motto">Smart Learning Starts Here</span>
    </div>
   </div>
   <nav className="lp-auth-nav" aria-label="Platform account">
    <button type="button" onClick={onLogin}>Log In</button>
    <button type="button" className="lp-signup" onClick={onSignup}>Sign Up</button>
   </nav>
  </header>
  <div className="lp-main">
   <section className="lp-intro" aria-label="Welcome to Umurage">
    <span className="lp-eyebrow">A connected educational experience</span>
    <h1>Every stage of learning. One connected platform.</h1>
    <p>Bring together schools, teachers, students, families and operations, from nursery through higher education.</p>
   </section>
   <div className="lp-composition">
    <div className="lp-side lp-left">
     <section className="lp-card" aria-label="Academic progress">
      <div className="lp-card-header"><span className="lp-icon"><Icon name="book"/></span><div><h2>Academic Progress</h2><p className="lp-card-sub">Connected academic information</p></div></div>
      <div className="lp-progress-list">
       <div className="lp-progress-row"><div className="lp-progress-mark"><Icon name="book"/></div><div className="lp-progress-copy"><strong>Subjects & lessons</strong><small>Assigned learning activities</small><div className="lp-progress-line" style={{"--lp-bar":"88%"}} aria-hidden="true"/></div></div>
       <div className="lp-progress-row"><div className="lp-progress-mark"><Icon name="reports"/></div><div className="lp-progress-copy"><strong>Results & report cards</strong><small>Approved academic records</small><div className="lp-progress-line" style={{"--lp-bar":"72%"}} aria-hidden="true"/></div></div>
       <div className="lp-progress-row"><div className="lp-progress-mark"><Icon name="attendance"/></div><div className="lp-progress-copy"><strong>Student attendance</strong><small>Class and family visibility</small><div className="lp-progress-line" style={{"--lp-bar":"84%"}} aria-hidden="true"/></div></div>
      </div>
     </section>
     <section className="lp-card" aria-label="Announcements">
      <div className="lp-card-header"><span className="lp-icon"><Icon name="bell"/></span><div><h2>Announcements</h2><p className="lp-card-sub">Stay informed as a community</p></div></div>
      <div className="lp-news">{news.map(n=><div className="lp-news-item" key={n.name}><span className="lp-news-icon"><Icon name={n.icon}/></span><p><strong>{n.name}</strong><span>{n.sub}</span></p></div>)}</div>
     </section>
    </div>
    <div className="lp-center">
     <section className="lp-preview" aria-label="School portal role overview">
      <div className="lp-preview-top">
       <span className="lp-preview-logo"><Icon name="graduation"/></span>
       <div><strong>Umurage Connected Dashboard</strong><span>School-specific portals, one shared foundation</span></div>
       <span className="lp-preview-chip">Role-based access</span>
      </div>
      <div className="lp-preview-roles">
       <div><Icon name="school"/><span>School</span></div>
       <div><Icon name="book"/><span>Teacher</span></div>
       <div><Icon name="profile"/><span>Student</span></div>
       <div><Icon name="people"/><span>Parent</span></div>
      </div>
     </section>
     <section className="lp-connection">
      <svg className="lp-network" viewBox="0 0 740 360" preserveAspectRatio="none" aria-hidden="true">
       <path d="M5 60C108 54 130 164 200 180"/>
       <path d="M735 60C640 54 606 164 538 180"/>
       <path d="M10 295C107 292 138 224 195 215"/>
       <path d="M730 290C630 292 605 224 548 215"/>
       <circle cx="200" cy="180" r="7"/><circle cx="538" cy="180" r="7"/>
       <circle cx="195" cy="215" r="7"/><circle cx="548" cy="215" r="7"/>
      </svg>
      <FamilyStage/>
     </section>
    </div>
    <div className="lp-side lp-right">
     <section className="lp-card" aria-label="School information">
      <div className="lp-card-header"><span className="lp-icon"><Icon name="school"/></span><div><h2>School Information</h2><p className="lp-card-sub">Every institution has its own identity</p></div></div>
      <div className="lp-info-list">
       <div className="lp-info-item"><span className="lp-check">✓</span><p><strong>Unique school branding</strong><small>Official logo, homepage and school details.</small></p></div>
       <div className="lp-info-item"><span className="lp-check">✓</span><p><strong>Classrooms & staff</strong><small>Roles, timetables and academic years.</small></p></div>
       <div className="lp-info-item"><span className="lp-check">✓</span><p><strong>Connected school community</strong><small>Authorized parents and students.</small></p></div>
      </div>
     </section>
     <section className="lp-card" aria-label="Attendance and timetables">
      <div className="lp-card-header"><span className="lp-icon"><Icon name="calendar"/></span><div><h2>Attendance</h2><p className="lp-card-sub">From class register to family view</p></div></div>
      <div className="lp-calendar" aria-label="Illustrative calendar grid">
       {["M","T","W","T","F","S","S"].map((x,i)=><span key={"weekday-"+i} className="lp-day-label">{x}</span>)}
       {Array.from({length:21},(_,i)=><span key={"day-"+i} className={[7,10,16].includes(i)?"lp-featured":[1,4,11,18].includes(i)?"lp-highlight":""}>{i+1}</span>)}
      </div>
      <p className="lp-calendar-caption">Illustrative calendar — live attendance is visible only to authorized school members.</p>
     </section>
    </div>
   </div>
   <div className="lp-bottom-grid" aria-label="Connected school services">
    {systemFeatures.map(x=><section className="lp-bottom-card" key={x.title}><span className="lp-bottom-icon"><Icon name={x.icon}/></span><div><h3>{x.title}</h3><p>{x.sub}</p></div></section>)}
   </div>
   <section aria-label="Education levels supported">
    <div className="lp-levels-title"><h2>Built for every kind of learning institution</h2><span>Nursery to university · School identities stay independent</span></div>
    <div className="lp-level-grid">{levelRows.map(x=><div className="lp-level-card" key={x.title}><span className="lp-level-emblem" style={{"--lp-level-bg":x.background}}><Icon name={x.icon}/></span><div><strong>{x.title}</strong><small>{x.sub}</small></div></div>)}</div>
   </section>
   <p className="lp-footer">Umurage School Management Platform · Smart Learning Starts Here · The public cards illustrate platform capabilities, not personal school records.</p>
  </div>
 </>;
}
