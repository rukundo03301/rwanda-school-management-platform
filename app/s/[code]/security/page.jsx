export const metadata={title:"Account security",robots:{index:false,follow:false}};
export default async function SchoolSecurityPage({params}){
 const {code}=await params;
 return <main className="shell" style={{padding:24}}>
  <section className="auth-card" style={{width:"min(600px,100%)"}}>
   <h1>Account security</h1>
   <p>Use your assigned school account and password to sign in. School memberships and role permissions control what each person can access.</p>
   <p>To reset your password or update school access, use the account recovery and administrator workflows.</p>
   <a className="button" href={"/s/"+encodeURIComponent(code)+"/portal"}>Return to school workspace</a>
  </section>
 </main>;
}
