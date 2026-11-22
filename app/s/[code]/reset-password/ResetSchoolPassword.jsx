"use client";
import {useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";
export default function ResetSchoolPassword({code}){
 const [client,setClient]=useState(null),[session,setSession]=useState(null);
 const [password,setPassword]=useState(""),[confirm,setConfirm]=useState("");
 const [error,setError]=useState(""),[success,setSuccess]=useState(false);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{
   const c=browserSupabase();setClient(c);if(!c){setLoading(false);return;}
   let mounted=true;
   const {data:{subscription}}=c.auth.onAuthStateChange((event,s)=>{
     if(mounted&&["PASSWORD_RECOVERY","SIGNED_IN","TOKEN_REFRESHED"].includes(event))setSession(s);
   });
   c.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setLoading(false);}});
   return ()=>{mounted=false;subscription.unsubscribe();};
 },[]);
 async function change(e){
   e.preventDefault();setError("");
   if(password.length<12||password!==confirm){setError("Enter matching passwords of at least 12 characters.");return;}
   const {error:e1}=await client.auth.updateUser({password});
   if(e1){setError(e1.message);return;}
   await client.auth.signOut();setSuccess(true);
 }
 return <main className="shell"><div className="auth-card"><h1>Set your school account password</h1>
   {error&&<div className="notice error">{error}</div>}
   {success?<p>Password changed. Please sign in again.</p>:loading?<p>Checking secure recovery link…</p>:
   !session?<p>This recovery link is missing or expired. Request a new link on the school sign-in page.</p>:
   <form onSubmit={change}>
     <label className="field">New password<input className="input" type="password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/></label>
     <label className="field">Confirm password<input className="input" type="password" minLength={12} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
     <button className="button" type="submit">Set new password</button>
   </form>}
   <a href={"/s/"+code+"/login"}>Return to school sign in</a>
 </div></main>;
}
