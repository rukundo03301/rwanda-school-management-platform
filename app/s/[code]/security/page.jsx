import SchoolSecurity from "./SchoolSecurity.jsx";
export const metadata={title:"Two-step verification",robots:{index:false,follow:false}};
export default async function SchoolSecurityPage({params}){
  const {code}=await params;
  return <SchoolSecurity code={code}/>;
}
