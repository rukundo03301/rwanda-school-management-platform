import {cache} from "react";
import {notFound} from "next/navigation";
import {clients} from "../../../lib/platform-server.js";

export const dynamic="force-dynamic";

// Shown whenever a school's public website must stay hidden. It deliberately
// carries no school name, logo, colour or content.
const NEUTRAL={title:"School website",description:"Official school website.",robots:{index:false,follow:false}};
// Only levels a school selected itself are listed. These are level names, not
// invented course lists.
const LEVEL_LABELS={nursery:"Nursery",primary:"Primary",secondary:"Secondary",tvet:"TVET",university:"University"};

// One loader serves both the browser metadata and the page, so the title,
// logo, colour and content always come from the same school row.
const loadSchoolSite=cache(async(code)=>{
  if(typeof code!=="string"||!/^RW-SCH-\d{6,16}$/.test(code))return null;
  const {db}=clients();
  const {data:school,error}=await db.from("platform_schools")
    .select("id,name,status,school_code").eq("school_code",code).maybeSingle();
  if(error||!school)return null;
  // Published content is not even read unless the school is active.
  if(school.status!=="active")return {school,site:null,available:false};
  const {data:site}=await db.from("platform_school_sites").select(
    "tagline,about_text,announcement,logo_url,hero_url,primary_color,contact_email,contact_phone,is_published,mission_statement,vision_statement,leader_name,leader_title,leader_message,leader_photo_url,advertisements,address_text,programs_intro,admissions_intro,admissions_instructions,admissions_contact,gallery,education_levels"
  ).eq("school_id",school.id).maybeSingle();
  const available=site?.is_published===true;
  return {school,site:available?site:null,available};
});

export async function generateMetadata({params}){
  const {code}=await params;
  try{
    const found=await loadSchoolSite(code);
    if(!found||!found.available)return NEUTRAL;
    const {school,site}=found;
    const description=site.tagline||("Official website of "+school.name+".");
    return {
      title:school.name+" · Official school website",description,
      robots:{index:true,follow:true},
      ...(site.logo_url?{icons:{icon:site.logo_url}}:{}),
      openGraph:{title:school.name,description,...(site.hero_url?{images:[site.hero_url]}:{})}
    };
  }catch{return NEUTRAL;}
}

export default async function SchoolHome({params}) {
  const {code}=await params;
  const found=await loadSchoolSite(code);
  if(!found)notFound();
  const {school,site,available}=found;
  if(!available)return <main className="site-landing">
    <header className="site-header"><div className="site-brand"><span aria-hidden="true" className="site-icon">✦</span><div><strong>School website</strong></div></div></header>
    <section className="site-maintenance"><h1>This school website is not currently available</h1><p>Please contact the school directly for assistance.</p></section>
    <footer className="site-footer">Rwanda Education Platform</footer>
  </main>;
  const color=/^#[0-9a-f]{6}$/i.test(site.primary_color||"")?site.primary_color:"#204a78";
  const contactHref=site.contact_email?"mailto:"+site.contact_email:null;
  const hasMission=Boolean(site.mission_statement?.trim()||site.vision_statement?.trim());
  const hasLeader=Boolean(site.leader_name?.trim()||site.leader_message?.trim());
  const promos=Array.isArray(site.advertisements)?site.advertisements.filter(a=>a?.enabled&&a?.title&&a?.description).slice(0,3):[];
  const levels=(Array.isArray(site.education_levels)?site.education_levels:[]).filter(l=>LEVEL_LABELS[l]);
  const programsIntro=site.programs_intro?.trim()||"";
  const hasPrograms=levels.length>0||Boolean(programsIntro);
  const admissionsIntro=site.admissions_intro?.trim()||"";
  const admissionSteps=(site.admissions_instructions||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const admissionsContact=site.admissions_contact?.trim()||"";
  const admissionsEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admissionsContact);
  const hasAdmissions=Boolean(admissionsIntro||admissionSteps.length||admissionsContact);
  // A gallery photograph is shown only when it sits in this school's own media folder.
  const ownMedia="/storage/v1/object/public/school-branding/"+school.id+"/";
  const gallery=(Array.isArray(site.gallery)?site.gallery:[])
    .filter(g=>typeof g?.url==="string"&&g.url.startsWith("https://")&&g.url.includes(ownMedia)).slice(0,12);
  const address=site.address_text?.trim()||"";
  const brand=<div className="site-brand">
    {site.logo_url?<img src={site.logo_url} alt={school.name+" official logo"} width="64" height="64" style={{objectFit:"contain"}}/>:
      <span aria-hidden="true" className="site-icon">✦</span>}
    <div><strong>{school.name}</strong><small>Official school website</small></div>
  </div>;
  return <main className="site-landing" style={{"--school-color":color}}>
    <header className="site-header">{brand}
      <input type="checkbox" id="site-menu-toggle" className="site-menu-toggle" aria-label="Show or hide the school website menu"/>
      <label htmlFor="site-menu-toggle" className="site-menu-button"><span aria-hidden="true">☰</span> Menu</label>
      <nav aria-label="School website"><a href="#about">About</a>{hasMission&&<a href="#mission">Mission &amp; Vision</a>}{hasLeader&&<a href="#leadership">Leadership</a>}{hasPrograms&&<a href="#programs">Programs</a>}{hasAdmissions&&<a href="#admissions">Admissions</a>}{gallery.length>0&&<a href="#gallery">Gallery</a>}{promos.length>0&&<a href="#opportunities">News &amp; Events</a>}<a href="#contact">Contact</a><a href={"/s/"+code+"/login"} className="site-portal-link">School Login</a></nav></header>
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
    {hasPrograms&&<section id="programs" className="site-section site-alt">
      <span className="site-eyebrow">Learning</span><h2>Programs &amp; education levels</h2>
      {programsIntro&&<p>{programsIntro}</p>}
      {levels.length>0&&<ul className="site-level-grid" aria-label={"Education levels offered by "+school.name}>
        {levels.map(l=><li className="site-level-card" key={l}>{LEVEL_LABELS[l]}</li>)}
      </ul>}
    </section>}
    {hasAdmissions&&<section id="admissions" className="site-section">
      <span className="site-eyebrow">Join our school</span><h2>Admissions</h2>
      {admissionsIntro&&<p>{admissionsIntro}</p>}
      {admissionSteps.length>0&&<><h3>How to apply</h3><ol className="site-steps">{admissionSteps.map((s,i)=><li key={i}>{s}</li>)}</ol></>}
      {admissionsContact&&<p className="site-admissions-contact"><strong>Admissions contact:</strong> {admissionsEmail?<a href={"mailto:"+admissionsContact}>{admissionsContact}</a>:admissionsContact}</p>}
    </section>}
    {gallery.length>0&&<section id="gallery" className="site-section site-alt">
      <span className="site-eyebrow">Our school in pictures</span><h2>Photo gallery</h2>
      <div className="site-gallery">
        {gallery.map((g,i)=><figure key={g.url}>
          <img src={g.url} alt={g.caption||(school.name+" photograph "+(i+1))} loading="lazy" width="480" height="360"/>
          {g.caption&&<figcaption>{g.caption}</figcaption>}
        </figure>)}
      </div>
    </section>}
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
      {address&&<p className="site-address">{address}</p>}
      {!site.contact_email&&!site.contact_phone&&!address&&<p>Official school contact details will be provided here.</p>}
    </section>
    <footer className="site-footer"><strong>{school.name}</strong> · Official school website{address&&<> · <span className="site-address">{address}</span></>} · <a href={"/s/"+code+"/login"} style={{color:"white"}}>School Login</a></footer>
  </main>;
}
