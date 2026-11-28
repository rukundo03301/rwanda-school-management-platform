import StudentRecords from "./StudentRecords.jsx";
export const metadata={title:"Student Records",robots:{index:false,follow:false}};
export default async function StudentsPage({params}){
 const {code}=await params;
 return <StudentRecords code={code}/>;
}
