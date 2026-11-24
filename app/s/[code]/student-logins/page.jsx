import StudentLogins from "./StudentLogins.jsx";
export const metadata={title:"Student ID logins",robots:{index:false,follow:false}};
export default async function StudentLoginsPage({params}){
  const {code}=await params;
  return <StudentLogins code={code}/>;
}
