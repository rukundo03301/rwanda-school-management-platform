"use client";
import { useEffect, useMemo, useState } from "react";
import { browserSupabase } from "../../../lib/client.js";

export default function ResetPasswordPage() {
  const client = useMemo(() => browserSupabase(), []);
  const [loading,setLoading] = useState(true);
  const [session,setSession] = useState(null);
  const [password,setPassword] = useState("");
  const [confirm,setConfirm] = useState("");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");
  const [complete,setComplete] = useState(false);

  useEffect(()=>{
    if(!client){setLoading(false);return;}
    let mounted = true;
    const {data:{subscription}} = client.auth.onAuthStateChange((event,newSession)=>{
      if(!mounted)return;
      if(event==="PASSWORD_RECOVERY" || event==="SIGNED_IN" || event==="TOKEN_REFRESHED"){
        setSession(newSession);
        setLoading(false);
      }
    });
    // Supabase processes token fragments / implicit recovery redirects asynchronously.
    client.auth.getSession().then(({data,error})=>{
      if(!mounted)return;
      if(data?.session)setSession(data.session);
      if(error)setError(error.message);
      setLoading(false);
    });
    return ()=>{mounted=false;subscription.unsubscribe();};
  },[client]);

  async function update(e) {
    e.preventDefault();setError("");setMessage("");
    if(password.length < 12){setError("Choose a password with at least 12 characters.");return;}
    if(password!==confirm){setError("Passwords do not match.");return;}
    if(!session){setError("The recovery link is no longer valid. Request a new link.");return;}
    setBusy(true);
    try {
      const {error} = await client.auth.updateUser({password});
      if(error)throw error;
      await client.auth.signOut();
      setComplete(true);
      setMessage("Password updated. Sign in again with your new password.");
      setPassword("");setConfirm("");
    } catch(e){setError(e.message||"Unable to update your password.");}
    finally{setBusy(false);}
  }

  return <main className="shell"><div className="auth-card">
    <div className="mark">R</div><h1>Set a new password</h1>
    <p>Use the secure link sent to your email. This does not change your platform role or permissions.</p>
    {error&&<div className="notice error" role="alert">{error}</div>}
    {message&&<div className="notice ok" role="status">{message}</div>}
    {loading?<p>Checking recovery link…</p>:complete?<a href="/platform" className="button" style={{textDecoration:"none"}}>Return to sign in</a>:session?(
      <form onSubmit={update}>
        <label className="field">New password
          <input className="input" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e=>setPassword(e.target.value)}/>
        </label>
        <label className="field">Confirm new password
          <input className="input" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e=>setConfirm(e.target.value)}/>
        </label>
        <button className="button" disabled={busy} type="submit">{busy?"Updating…":"Change password"}</button>
      </form>
    ):<p>This recovery session is expired or missing. Return to sign in, select <strong>Forgot password?</strong>, and request a new link.</p>}
    <a style={{display:"inline-block",marginTop:20}} href="/platform">Back to Platform Sign In</a>
  </div></main>;
}
