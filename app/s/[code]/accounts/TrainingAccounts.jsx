"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
export default function TrainingAccounts({code}){
 const [data,setData]=useState(null),[busy,setBusy]=useState(""),[error,setError]=useState(""),[issued,setIssued]=useState(null),[accepted,setAccepted]=useState(false);
 const request=useCallback(async(body)=>{
  const auth=browserSupabase();
  if(!auth)throw Error("Supabase sign-in is not configured.");
  const {data:{session}}=await auth.auth.getSession();
  if(!session)throw Error("Sign in with the Remezo School Owner account.");
  const response=await fetch("/api/school/"+code+"/training-accounts",{
   method:body?"POST":"GET",cache:"no-store",headers:{"Authorization":"Bearer "+session.access_token,...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{})
  });
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(value.error||"Unable to access training account setup.");
  return value;
 },[code]);
 const refresh=useCallback(async()=>{try{setData(await request());setError("");}catch(e){setError(e.message);}},[request]);
 useEffect(()=>{refresh();},[refresh]);
 async function create(key){
  setBusy(key);setError("");setIssued(null);
  try{const result=await request({key,confirmTraining:accepted});setIssued(result);await refresh();}
  catch(e){setError(e.message);}finally{setBusy("");}
 }
 const copy=()=>{if(issued&&navigator.clipboard)navigator.clipboard.writeText("Email: "+issued.email+"\nPassword: "+issued.password+"\nSign in: "+window.location.origin+issued.loginPath);};
 return <main className="training-accounts"><header className="training-header"><a href={"/s/"+code+"/admin"}>← School Owner Dashboard</a><h1>Remezo Primary School · Training Accounts</h1><p>Provision genuine Supabase email/password sign-ins for isolated fictional school users. This page is available only to this school's verified owner.</p></header>
 <section className="training-card"><h2>Required security</h2><p>These users are synthetic training identities and do not have real email inboxes. They can sign in with the generated credentials, but they cannot receive password-reset mail. The existing owner account remains unchanged.</p>
  <label className="training-confirm"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/> I understand these are fictional identities, and I have completed owner two-factor authentication.</label>
  {error&&<div className="notice error" role="alert">{error}</div>}
  {issued&&<div className="training-secret" role="status"><h3>Account created · Copy credentials now</h3>
   <p>These credentials will not appear again after you close this page.</p>
   <p><strong>{issued.label}</strong></p>
   <label>Email<input readOnly className="input" value={issued.email}/></label>
   <label>Temporary password<input readOnly className="input" value={issued.password}/></label>
   <button className="button" onClick={copy}>Copy credentials</button>
   <a className="button secondary" href={issued.loginPath}>Open School Login</a>
  </div>}
 </section>
 <section className="training-card"><h2>Role accounts to provision</h2><p>The owner and first teacher account already exist. The remaining staff accounts are created one by one, with unique random passwords. Create the parent before the student.</p>
 {data?.accounts?<div className="table-wrap"><table><thead><tr><th>Role</th><th>Email login</th><th>Status</th><th>Action</th></tr></thead><tbody>
  {data.accounts.map(item=><tr key={item.key}><td>{item.label}</td><td><code>{item.email}</code></td><td>{item.created?"Created":"Not created"}</td>
   <td>{item.created?"Ready":<button className="button small" disabled={!accepted||!!busy} onClick={()=>create(item.key)}>{busy===item.key?"Creating…":"Create account"}</button>}</td></tr>)}
 </tbody></table></div>:<p>Checking existing training accounts…</p>}
 </section>
 <section className="training-card"><h2>How roles are connected</h2>
 <p>Teacher accounts receive one actual school class-and-subject assignment. The fictional parent account is linked to three students using the school's protected guardian relationship records. The student account belongs to one of those children. The Principal receives school administrator access. Other staff have staff memberships but require dedicated kitchen, security, bursar and maintenance workflow permissions as those modules are completed.</p>
 <p>Board members cannot yet receive a board login: board governance is not an implemented authorization role. Do not give them School Owner privileges as a workaround.</p>
 </section></main>;
