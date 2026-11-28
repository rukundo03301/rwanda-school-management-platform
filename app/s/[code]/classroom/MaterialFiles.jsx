"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

const ACCEPT=".pdf,.docx,.pptx,.png,.jpg,.jpeg,.webp";
const size=n=>n>=1048576?(n/1048576).toFixed(1)+" MB":Math.max(1,Math.round(n/1024))+" KB";

export default function MaterialFiles({code,classId,assignments,subjectLabel}){
 const [files,setFiles]=useState([]),[err,setErr]=useState(""),[note,setNote]=useState(""),[busy,setBusy]=useState(false);
 const [f,setF]=useState({title:"",description:"",subjectId:"",file:null,key:0});
 const call=useCallback(async(body,query="")=>{
  const c=browserSupabase();const {data:{session}}=await c.auth.getSession();
  if(!session)throw Error("Sign in again to continue");
  const r=await fetch("/api/school/"+code+"/material-files"+query,{method:body?"POST":"GET",cache:"no-store",
   headers:{Authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(j.error||"Request failed");return j;
 },[code]);
 const load=useCallback(()=>call(null,"?scope=teacher").then(j=>setFiles(j.files)).catch(e=>setErr(e.message)),[call]);
 useEffect(()=>{load();},[load]);
 const subjectId=f.subjectId||assignments[0]?.subject_id||"";
 async function upload(e){
  e.preventDefault();setErr("");setNote("");
  if(!f.file)return setErr("Choose a file to upload");
  setBusy(true);
  try{
   const init=await call({action:"file.init",classId,subjectId,title:f.title,description:f.description,
    fileName:f.file.name,mimeType:f.file.type,size:f.file.size});
   const {path,token,id}=init.result;
   const c=browserSupabase();
   const up=await c.storage.from("school-materials").uploadToSignedUrl(path,token,f.file,{contentType:f.file.type});
   if(up.error)throw Error("The file could not be uploaded. Check your connection and try again.");
   await call({action:"file.finish",fileId:id});
   setNote("File uploaded. It is hidden until you show it to students.");
   setF({title:"",description:"",subjectId:f.subjectId,file:null,key:f.key+1});
   await load();
  }catch(x){setErr(x.message);}finally{setBusy(false);}
 }
 async function act(body,ok){setBusy(true);setErr("");setNote("");try{await call(body);setNote(ok);await load();}catch(x){setErr(x.message);}finally{setBusy(false);}}
 async function open(id){
  const w=window.open("","_blank");if(w)w.opener=null;
  try{const j=await call(null,"?download="+id);if(w)w.location.href=j.url;else window.location.href=j.url;}
  catch(x){if(w)w.close();setErr(x.message);}
 }
 const mine=files.filter(x=>x.class_id===classId);
 return <section className="cr-panel" aria-label="Study material files">
  <h2>Study material files</h2>
  <p className="muted">Upload a PDF, Word, PowerPoint or image (up to 10 MB). Files are private. Students in this class can open a file only while it is switched on.</p>
  <form onSubmit={upload} style={{display:"grid",gap:10,maxWidth:640}}>
   <label><strong>Title</strong><input className="input" maxLength={160} value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="e.g. Fractions study guide"/></label>
   <label><strong>Subject</strong><select className="input" value={subjectId} onChange={e=>setF({...f,subjectId:e.target.value})}>
    {assignments.map(a=><option key={a.subject_id} value={a.subject_id}>{subjectLabel(a.subject_id)}</option>)}</select></label>
   <label><strong>Short description (optional)</strong><input className="input" maxLength={1000} value={f.description} onChange={e=>setF({...f,description:e.target.value})}/></label>
   <label><strong>File</strong><input key={f.key} className="input" type="file" accept={ACCEPT} onChange={e=>setF({...f,file:e.target.files?.[0]||null})}/></label>
   <button className="button" type="submit" disabled={busy||!assignments.length}>{busy?"Uploading…":"Upload file"}</button>
  </form>
  {err&&<div className="notice error" role="alert">{err}</div>}{note&&<div className="notice info" role="status">{note}</div>}
  <div className="cr-card-grid" style={{marginTop:14}}>{mine.map(x=><article key={x.id} className="cr-lesson">
   <div className="cr-card-header"><span className="cr-tag">{subjectLabel(x.subject_id)}</span><span className="cr-status">{x.published?"Visible to students":"Hidden"}</span></div>
   <h3>{x.title}</h3>{x.description&&<p>{x.description}</p>}<small>{x.file_name} · {size(x.size_bytes)}</small>
   <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:8}}>
    <button className="button secondary small" onClick={()=>open(x.id)}>Open</button>
    <button className="button secondary small" disabled={busy} onClick={()=>act({action:"file.toggle",fileId:x.id,published:!x.published},x.published?"Hidden from students.":"Now visible to students.")}>{x.published?"Hide from students":"Show to students"}</button>
    <button className="button secondary small" disabled={busy} onClick={()=>confirm("Delete this file for good?")&&act({action:"file.delete",fileId:x.id},"File deleted.")}>Delete</button></div></article>)}</div>
  {!mine.length&&<div className="cr-empty"><strong>No files yet</strong><p>Upload the first study guide for this class.</p></div>}
 </section>;
}
