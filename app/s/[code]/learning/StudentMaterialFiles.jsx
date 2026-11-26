"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

const size=n=>n>=1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB";

export default function StudentMaterialFiles({code,subjectName}){
 const [files,setFiles]=useState(null),[err,setErr]=useState("");
 const call=useCallback(async(query)=>{
  const c=browserSupabase();const {data:{session}}=await c.auth.getSession();
  if(!session)throw Error("Sign in again to continue");
  const r=await fetch("/api/school/"+code+"/material-files"+query,{cache:"no-store",headers:{Authorization:"Bearer "+session.access_token}});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Request failed");return j;
 },[code]);
 useEffect(()=>{call("?scope=student").then(j=>setFiles(j.files)).catch(e=>{setErr(e.message);setFiles([]);});},[call]);
 async function open(id){
  setErr("");
  const w=window.open("","_blank");if(w)w.opener=null;
  try{const j=await call("?download="+id);if(w)w.location.href=j.url;else window.location.href=j.url;}
  catch(x){if(w)w.close();setErr(x.message);}
 }
 if(!files||!files.length)return err?<p role="alert" className="ds-empty">{err}</p>:null;
 return <div style={{marginTop:14}} aria-label="Study files">
  <h4>Study files from your teachers</h4>
  <div className="ds-materials">{files.map(x=><article key={x.id} className="ds-material">
   <span className="ds-pill info" style={{marginLeft:0}}>{subjectName(x.subject_id)}</span>
   <h4>{x.title}</h4>{x.description&&<p>{x.description}</p>}<small>{x.file_name} · {size(x.size_bytes)}</small>
   <button className="ds-action blue" onClick={()=>open(x.id)}>Open file</button></article>)}</div>
  {err&&<p role="alert" className="ds-empty">{err}</p>}
 </div>;
}
