import StaffLogins from "./StaffLogins.jsx";
export const metadata={title:"Staff and parent logins",robots:{index:false,follow:false}};
export default async function StaffLoginsPage({params}){
  const {code}=await params;
  return <StaffLogins code={code}/>;
}
