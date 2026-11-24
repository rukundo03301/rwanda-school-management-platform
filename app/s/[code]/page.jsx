import {notFound} from "next/navigation";
import {clients} from "../../../lib/platform-server.js";

export const dynamic="force-dynamic";
// Each school page carries the school's own name in the browser tab and in
// link previews, never the platform console title. Non-active schools are not indexed.
export async function generateMetadata({params}){
const {code}=await params;
const fallback={title:"School website",description:"Official school website.",robots:{index:false,follow:false}};
if(typeof code!=="string"||!/^RW-SCH-\d{6,16}$/.test(code))return fallback;
try{
const {db}=clients();
const {data:school}=await db.from("platform_schools").select("id,name,status").eq("school_code",code).maybeSingle();
if(!school)return fallback;
const live=school.status==="active";
let tagline="";
if(live){
const {data:site}=await db.from("platform_school_sites").select("tagline,is_published").eq("school_id",school.id).maybeSingle();
if(site?.is_published)tagline=site.tagline||"";
}
return {title:school.name+" · Official school website",description:tagline||("Official website of "+school.name+"."),robots:{index:live,follow:live}};
}catch{return fallback;}
}

export default async function SchoolHome({params}) {
  const {code}=await params;
  if(typeof code!=="string"||!/^RW-SCH-\d{6,16}$/.test(code))notFound();
  const {db}=clients();
  const {data:school,error}=await db.from("platform_schools")
    .select("id,name,status,school_code").eq("school_code",code).maybeSingle();
  if(error||!school)notFound();
  const {data:site}=await db.from("platform_school_sites").select(
    "tagline,about_text,announcement,logo_url,hero_url,primary_color,contact_email,contact_phone,is_published,mission_statement,vision_statement,leader_name,leader_title,leader_message,leader_photo_url,advertisements"
  ).eq("school_id",school.id).maybeSingle();
  const color=/^#[0-9a-f]{6}$/i.test(site?.primary_color||"")?site.primary_color:"#204a78";
  const available=school.status==="active"&&site?.is_published===true;
  const brand=<div className="site-brand">
    {site?.logo_url?<img src={site.logo_url} alt={school.name+" official logo"} width="64" height="64" style={{objectFit:"contain"}}/>:
      <span aria-hidden="true" className="site-icon">✦</span>}
    <div><strong>{school.name}</strong><small>Official school website</small></div>
  </div>;
  if(!available)return <main className="site-landing" style={{"--school-color":color}}>
    <header className="site-header">{brand}</header>
    <section className="site-maintenance"><h1>{school.name}</h1><p>This school's online portal is not currently available. Please contact the school directly for assistance.</p></section>
    <footer className="site-footer">Official school information · {school.name}</footer>
  </main>;
  const contactHref=site.contact_email?"mailto:"+site.contact_email:null;
  const hasMission=Boolean(site.mission_statement?.trim()||site.vision_statement?.trim());
  const hasLeader=Boolean(site.leader_name?.trim()||site.leader_message?.trim());
  const promos=Array.isArray(site.advertisements)?site.advertisements.filter(a=>a?.enabled&&a?.title&&a?.description).slice(0,3):[];
  return <main className="site-landing" style={{"--school-color":color}}>
    <header className="site-header">{brand}<nav aria-label="School website"><a href="#about">About</a>{hasMission&&<a href="#mission">Mission &amp; Vision</a>}{hasLeader&&<a href="#leadership">Leadership</a>}{promos.length>0&&<a href="#opportunities">News &amp; Events</a>}<a href="#contact">Contact</a><a href={"/s/"+code+"/login"} className="site-portal-link">School Portal</a></nav></header>
    {site.announcement&&<div className="site-announcement">{site.announcement}</div>}
    <section className="site-hero" style={site.hero_url?{backgroundImage:"linear-gradient(90deg,rgba(7,25,43,.83),rgba(7,25,43,.3)),url("+JSON.stringify(site.hero_url)+")"}:{}}>
      <div className="site-hero-content">
        <span className="site-eyebrow">Welcome to our school</span>
        <h1>{school.name}</h1>
        <p>{site.tagline||"Welcome to our school community."}</p>
        {contactHref&&<a className="site-cta" href={contactHref}>Contact the school</a>}
      </div>
    </section>
    <section id="about" className="site-section"><span className="site-eyebrow">Our school</span><h2>About {school.name}</h2>
      <p>{site.about_text||"The school will publish its official introduction here."}</p></section>
    {hasMission&&<section id="mission" className="site-section site-alt">
      <span className="site-eyebrow">Our purpose</span><h2>Mission &amp; Vision</h2>
      <div className="site-info-grid">
        {site.mission_statement?.trim()&&<article className="site-info-card"><h3>Our Mission</h3><p>{site.mission_statement}</p></article>}
        {site.vision_statement?.trim()&&<article className="site-info-card"><h3>Our Vision</h3><p>{site.vision_statement}</p></article>}
      </div>
    </section>}
    {hasLeader&&<section id="leadership" className="site-section">
      <span className="site-eyebrow">Our school leadership</span><h2>Meet our leadership</h2>
      <div className="site-leadership">
        {site.leader_photo_url&&<img src={site.leader_photo_url} alt={"Portrait of "+(site.leader_name||"school leader")} width="240" height="285"/>}
        <div>
          {site.leader_name?.trim()&&<h3>{site.leader_name}</h3>}
          {site.leader_title?.trim()&&<strong className="site-leader-title">{site.leader_title}</strong>}
          {site.leader_message?.trim()&&<p>{site.leader_message}</p>}
        </div>
      </div>
    </section>}
    <section id="programs" className="site-section site-alt"><span className="site-eyebrow">Learning</span><h2>School life & learning</h2>
      <p>Contact the school for the latest curriculum, academic calendar and admissions information.</p></section>
    {promos.length>0&&<section id="opportunities" className="site-section">
      <span className="site-eyebrow">School announcements &amp; opportunities</span><h2>What's happening at {school.name}</h2>
      <div className="site-info-grid site-ads">
        {promos.map((ad,i)=><article className="site-info-card" key={i}>
          <h3>{ad.title}</h3><p>{ad.description}</p><a href="#contact">Contact our school for details</a>
        </article>)}
      </div>
    </section>}
    <section id="contact" className="site-section"><span className="site-eyebrow">Let's connect</span><h2>Contact {school.name}</h2>
      {site.contact_email&&<p><a href={contactHref}>{site.contact_email}</a></p>}
      {site.contact_phone&&<p>{site.contact_phone}</p>}
      {!site.contact_email&&!site.contact_phone&&<p>Official school contact details will be provided here.</p>}
    </section>
    <footer className="site-footer"><strong>{school.name}</strong> · Official school website · <a href={"/s/"+code+"/login"} style={{color:"white"}}>School Portal</a></footer>
  </main>;
}
