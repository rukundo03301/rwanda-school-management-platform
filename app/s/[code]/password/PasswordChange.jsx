"use client";
import {useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

// Any signed-in school user can choose their own password here. A student who
// received a first or reset password from the school is sent here before
// reaching their workspace.
export default function PasswordChange({code}){
  const [client,setClient]=useState(null);
  const [ready,setReady]=useState(false);
  const [signedIn,setSignedIn]=useState(false);
  const [first,setFirst]=useState(false);
  const [a,setA]=useState("");
  const [b,setB]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [done,setDone]=useState(false);
  useEffect(()=>{
    const c=browserSupabase();setClient(c);
    if(!c){setReady(true);return;}
    c.auth.getSession().then(({data})=>{
      setSignedIn(!!data?.session);
      setFirst(data?.session?.user?.user_metadata?.must_change_password===true);
      setReady(true);
    });
  },[]);
  async function save(e){
    e.preventDefault();setError("");
    if(a.length<8){setError("Choose a password with at least 8 characters");return;}
    if(a!==b){setError("The two passwords do not match");return;}
    setBusy(true);
    try{
      const {error:failed}=await client.auth.updateUser({password:a,data:{must_change_password:false}});
      if(failed)throw failed;
      setDone(true);setA("");setB("");
    }catch(err){setError(err.message||"The password could not be changed");}
    finally{setBusy(false);}
  }
  if(!ready)return <main className="shell">Opening your account...</main>;
  return <main className="shell"><div className="auth-card">
    <h1>{first?"Choose your own password":"Change my password"}</h1>
    {first&&!done&&<p className="muted">Your school gave you a first password. Replace it now with one only you know.</p>}
    {error&&<div className="notice error" role="alert">{error}</div>}
    {!client?<div className="notice error">School sign-in is not configured.</div>:
    !signedIn?<div className="notice info">Sign in first.<p><a className="button" href={"/s/"+code+"/login"}>School sign in</a></p></div>:
    done?<div className="notice ok"><strong>Your password has been changed.</strong>
      <p><a className="button" href={"/s/"+code+"/portal"}>Continue to my workspace</a></p></div>:
    <form onSubmit={save}>
      <label className="field">New password<input className="input" type="password" required minLength={8} autoComplete="new-password" value={a} onChange={e=>setA(e.target.value)}/></label>
      <label className="field">Type the new password again<input className="input" type="password" required minLength={8} autoComplete="new-password" value={b} onChange={e=>setB(e.target.value)}/></label>
      <button className="button" type="submit" disabled={busy} style={{width:"100%"}}>{busy?"Saving...":"Save my new password"}</button>
      {!first&&<p><a href={"/s/"+code+"/portal"}>Back to my workspace</a></p>}
    </form>}
  </div></main>;
}
