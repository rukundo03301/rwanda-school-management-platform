import {notFound} from "next/navigation";
import {clients} from "../../../lib/platform-server.js";

export const dynamic="force-dynamic";
export const metadata={robots:{index:true,follow:true}};

export default async function SchoolHome({params}) {
  const {code}=await params;
  if(typeof code!=="string"||!/^RW-SCH-\d{6,16}$/.test(code))notFound();
  const {db}=clients();
  const {data:school,error}=await db.from("platform_schools")
    .select("id,name,status,school_code").eq("school_code",code).maybeSingle();
  if(error||!school)notFound();
  const {data:site}=await db.from("platform_school_sites").select(
    "tagline,about_text,announcement,logo_url,hero_url,primary_color,contact_email,contact_phone,is_published"
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
  return <main className="site-landing" style={{"--school-color":color}}>
    <header className="site-header">{brand}<nav aria-label="School website"><a href="#about">About</a><a href="#programs">Programs</a><a href="#contact">Contact</a></nav></header>
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
    <section id="programs" className="site-section site-alt"><span className="site-eyebrow">Learning</span><h2>School life & learning</h2>
      <p>Contact the school for the latest curriculum, academic calendar and admissions information.</p></section>
    <section id="contact" className="site-section"><span className="site-eyebrow">Let's connect</span><h2>Contact {school.name}</h2>
      {site.contact_email&&<p><a href={contactHref}>{site.contact_email}</a></p>}
      {site.contact_phone&&<p>{site.contact_phone}</p>}
      {!site.contact_email&&!site.contact_phone&&<p>Official school contact details will be provided here.</p>}
    </section>
    <footer className="site-footer"><strong>{school.name}</strong> · Official school website</footer>
  </main>;
}
