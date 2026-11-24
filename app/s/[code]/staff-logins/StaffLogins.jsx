"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

// The school owner hands out and resets passwords for the staff, teacher and
// parent logins the school itself created. Nobody has to store a password:
// a lost one is replaced in seconds, and the person chooses their own afterwards.
const ROLE_NAMES={school_admin:"Administrator",teacher:"Teacher",staff:"Staff",parent:"Parent"};
export default function StaffLogins({code}){
  const [client,setClient]=useState(null);
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [busyId,setBusyId]=useState("");
  const [issued,setIssued]=useState(null);
  const call=useCallback(async(c,body)=>{
    const {data:{session}}=await c.auth.getSession();
    if(!session)throw Error("Sign in to your school first");
    const response=await fetch("/api/school/"+code+"/member-password",{
      method:body?"POST":"GET",cache:"no-store",
      headers:{authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||"Account request failed");
    return result;
  },[code]);
  const refresh=useCallback(async(c)=>{
    try{setData(await call(c));}catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[call]);
  useEffect(()=>{
    const c=browserSupabase();setClient(c);
    if(!c){setError("School sign-in is not configured");setLoading(false);return;}
    refresh(c);
  },[refresh]);
  async function reset(member){
    setBusyId(member.userId);setError("");setIssued(null);
    try{setIssued(await call(client,{action:"reset",userId:member.userId}));}
    catch(e){setError(e.message);}
    finally{setBusyId("");}
  }
  if(loading)return <main className="shell">Opening staff and parent logins...</main>;
  return <main className="shell" style={{maxWidth:980}}>
    <a href={"/s/"+code+"/admin"} className="micro">Back to School Administration</a>
    <h1>Staff, teacher and parent logins</h1>
    <p className="muted">Reset a password and give the new one to the person. They will choose their own at next sign-in. Student logins are on a separate page.</p>
    <p><a className="button secondary small" href={"/s/"+code+"/student-logins"}>Student ID logins</a> <a className="button secondary small" href={"/s/"+code+"/security"}>Two-step verification</a></p>
    {error&&<div className="notice error" role="alert">{error}{error.includes("Two-factor")&&<p><a className="button secondary" href={"/s/"+code+"/security"}>Open two-step verification</a></p>}</div>}
    {issued&&<div className="notice ok" role="status"><strong>New sign-in details</strong>
      <p>Login: <kbd>{issued.login}</kbd><br/>New password: <kbd>{issued.temporaryPassword}</kbd></p>
      <p className="micro">Shown once. The person must replace it at next sign-in.</p></div>}
    {data&&<div className="table-wrap"><table><thead><tr><th>Login</th><th>Role</th><th>Action</th></tr></thead>
      <tbody>{data.members.map(m=><tr key={m.userId}><td><kbd>{m.login}</kbd>{m.name&&<div className="micro">{m.name}</div>}</td>
        <td>{m.roles.map(r=>ROLE_NAMES[r]||r).join(", ")}</td>
        <td>{m.schoolIssued?<button className="button secondary small" disabled={!!busyId} onClick={()=>reset(m)}>{busyId===m.userId?"Working...":"Reset password"}</button>:
          <span className="micro">Uses own email. Forgot password on the sign-in page.</span>}</td></tr>)}</tbody></table>
      {!data.members.length&&<p className="muted">No staff, teacher or parent logins yet.</p>}</div>}
  </main>;
}
