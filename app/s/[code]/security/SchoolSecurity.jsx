"use client";
import {useCallback,useEffect,useState} from "react";
import {browserSupabase} from "../../../../lib/client.js";

// Two-step verification for school accounts. The server refuses sensitive
// school actions (inviting staff, admitting students, assigning teachers,
// linking guardians) unless the session is MFA-verified. This page only lets a
// signed-in person set up and confirm their OWN authenticator. It never lowers
// or bypasses that server requirement.
export default function SchoolSecurity({code}){
  const [client,setClient]=useState(null);
  const [state,setState]=useState({loading:true,signedIn:false,email:"",level:"aal1",verifiedFactor:null});
  const [enroll,setEnroll]=useState(null);
  const [otp,setOtp]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const refresh=useCallback(async(c)=>{
    const {data:{session}}=await c.auth.getSession();
    if(!session){setState({loading:false,signedIn:false,email:"",level:"aal1",verifiedFactor:null});return;}
    const [aal,factors]=await Promise.all([c.auth.mfa.getAuthenticatorAssuranceLevel(),c.auth.mfa.listFactors()]);
    const verified=(factors.data?.totp||[]).find(f=>f.status==="verified")||null;
    setState({loading:false,signedIn:true,email:session.user.email||"",level:aal.data?.currentLevel||"aal1",verifiedFactor:verified});
  },[]);
  useEffect(()=>{
    const c=browserSupabase();setClient(c);
    if(!c){setState(s=>({...s,loading:false}));return;}
    refresh(c).catch(e=>{setError(e.message||"Could not read account security");setState(s=>({...s,loading:false}));});
  },[refresh]);
  async function start(){
    setBusy(true);setError("");setMessage("");
    try{
      const existing=await client.auth.mfa.listFactors();
      if(existing.error)throw existing.error;
      if((existing.data?.totp||[]).some(f=>f.status==="verified"))throw new Error("An authenticator is already active on this account.");
      // An abandoned, never-verified setup is removed so a fresh one can start.
      for(const f of (existing.data?.all||[]).filter(f=>f.factor_type==="totp"&&f.status!=="verified")){
        const removed=await client.auth.mfa.unenroll({factorId:f.id});
        if(removed.error)throw removed.error;
      }
      const {data,error:e}=await client.auth.mfa.enroll({factorType:"totp",friendlyName:"School account "+Date.now()});
      if(e)throw e;
      setEnroll({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});
    }catch(e){setError(e.message||"Could not start authenticator setup");}
    finally{setBusy(false);}
  }
  async function verify(factorId){
    setBusy(true);setError("");setMessage("");
    try{
      if(!/^\d{6}$/.test(otp))throw new Error("Enter the 6-digit code from your authenticator app");
      const {error:e}=await client.auth.mfa.challengeAndVerify({factorId,code:otp});
      if(e)throw e;
      setEnroll(null);setOtp("");setMessage("Two-step verification is confirmed for this session.");
      await refresh(client);
    }catch(e){setError(e.message||"The code was not accepted");}
    finally{setBusy(false);}
  }
  const codeInput=<label className="field">6-digit code
    <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp}
      onChange={e=>setOtp(e.target.value.replace(/\D/g,""))} placeholder="123456"/>
  </label>;
  if(state.loading)return <main className="shell">Checking your account security...</main>;
  return <main className="shell"><div className="auth-card">
    <a href={"/s/"+code+"/portal"} className="micro">Back to school portal</a>
    <h1>Two-step verification</h1>
    <p className="muted">Inviting staff, admitting students, assigning teachers and linking guardians are protected. Your school asks for a code from an authenticator app before it allows them.</p>
    {error&&<div className="notice error" role="alert">{error}</div>}
    {message&&<div className="notice ok" role="status">{message}</div>}
    {!client?<div className="notice error">School authentication is not configured.</div>:
    !state.signedIn?<div className="notice info">Sign in to your school account first.
      <p><a className="button" href={"/s/"+code+"/login"}>School sign in</a></p></div>:
    state.level==="aal2"?<div className="notice ok"><strong>This session is verified.</strong>
      <p>Signed in as {state.email}. Protected school actions are available until you sign out.</p>
      <p><a className="button" href={"/s/"+code+"/portal"}>Return to school portal</a></p></div>:
    state.verifiedFactor?<div>
      <p>Open your authenticator app and enter the current code for this school account.</p>
      {codeInput}
      <button className="button" disabled={busy} onClick={()=>verify(state.verifiedFactor.id)}>{busy?"Checking...":"Verify code"}</button>
    </div>:
    enroll?<div>
      <p><strong>1.</strong> Scan this code with an authenticator app such as Google Authenticator or Microsoft Authenticator.</p>
      <img src={enroll.qr} alt="Authenticator setup QR code" width="190" height="190" style={{background:"#fff",padding:8,borderRadius:10}}/>
      <p className="micro">Cannot scan? Enter this key in the app: <code style={{overflowWrap:"anywhere"}}>{enroll.secret}</code></p>
      <p><strong>2.</strong> Enter the 6-digit code the app shows.</p>
      {codeInput}
      <button className="button" disabled={busy} onClick={()=>verify(enroll.id)}>{busy?"Checking...":"Confirm and turn on"}</button>
    </div>:
    <div>
      <p>Signed in as {state.email}. This account has no authenticator yet.</p>
      <button className="button" disabled={busy} onClick={start}>{busy?"Preparing...":"Set up authenticator"}</button>
    </div>}
  </div></main>;
}
