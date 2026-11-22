import {notFound} from "next/navigation";
import {clients} from "../../../../lib/platform-server.js";
import SchoolLogin from "./SchoolLogin.jsx";
export const dynamic="force-dynamic";
export default async function SchoolLoginPage({params}){
 const {code}=await params;
 if(!/^RW-SCH-\d{6,16}$/.test(code))notFound();
 const {db}=clients();
 const {data:school,error}=await db.from("platform_schools").select("id,name,status,school_code")
   .eq("school_code",code).maybeSingle();
 if(error||!school)notFound();
 const {data:site}=await db.from("platform_school_sites")
   .select("logo_url,primary_color,is_published").eq("school_id",school.id).maybeSingle();
 const published=site?.is_published&&school.status==="active";
 return <SchoolLogin code={code} name={school.name}
   logo={published?site.logo_url:null} color={published?site.primary_color:"#204a78"}
   unavailable={!["active","onboarding"].includes(school.status)}/>;
}
