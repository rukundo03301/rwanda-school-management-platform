"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

// The school office creates a login for each student from the Student ID the
// school already issued. The first password is shown once so staff can hand it
// to the student, who then chooses their own.
export default function StudentLogins({code}){
  const [client,setClient]=useState(null);
  const [loading,setLoading]=useState(true);
  const [data,setData]=useState(null);
  const [error,setError]=useState("");
  const [busyId,setBusyId]=useState("");
  const [issued,setIssued]=useState(null);
  const call=useCallback(async(c,body)=>{
    const {data:{session}}=await c.auth.getSession();
    if(!session)throw Error("Sign in to your school first");
    const response=await fetch("/api/school/"+code+"/student-login",{
      method:body?"POST":"GET",cache:"no-store",
      headers:{authorization:"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},
      ...(body?{body:JSON.stringify(body)}:{})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(result.error||"Student login request failed");
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
  async function act(action,student){
    setBusyId(student.id);setError("");setIssued(null);
    try{setIssued(await call(client,{action,studentId:student.id}));await refresh(client);}
    catch(e){setError(e.message);}
    finally{setBusyId("");}
  }
  if(loading)return <main className="shell">Opening student logins...</main>;
  return <main className="shell" style={{maxWidth:980}}>
    <a href={"/s/"+code+"/admin"} className="micro">Back to School Administration</a>
    <h1>Student ID logins</h1>
    <p className="muted">Students sign in with their Student ID and a password. No email address is needed. Create a login, give the student the first password, and they will choose their own at first sign-in.</p>
    {error&&<div className="notice error" role="alert">{error}{error.includes("Two-factor")&&<p><a className="button secondary" href={"/s/"+code+"/security"}>Open two-step verification</a></p>}</div>}
    {issued&&<div className="notice ok" role="status"><strong>Give these sign-in details to {issued.name}</strong>
      <p>Student ID: <kbd>{issued.studentId}</kbd><br/>First password: <kbd>{issued.temporaryPassword}</kbd></p>
      <p className="micro">This password is shown once. The student must replace it at first sign-in. If it is lost, use Reset password.</p></div>}
    {data&&<div className="table-wrap"><table><thead><tr><th>Student ID</th><th>Student</th><th>Login</th><th>Action</th></tr></thead>
      <tbody>{data.students.map(s=><tr key={s.id}><td><kbd>{s.studentId}</kbd></td><td>{s.name}</td>
        <td>{s.hasLogin?(s.active?"Active":"Disabled"):"No login yet"}</td>
        <td><button className="button secondary small" disabled={!!busyId||(s.hasLogin&&!s.active)} onClick={()=>act(s.hasLogin?"reset":"create",s)}>
          {busyId===s.id?"Working...":s.hasLogin?"Reset password":"Create login"}</button></td></tr>)}</tbody></table>
      {!data.students.length&&<p className="muted">No active students yet. Admit students first.</p>}</div>}
  </main>;
}
