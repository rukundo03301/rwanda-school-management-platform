import SchoolCommunications from "./SchoolCommunications.jsx";
export const metadata={title:"School Timetables and Communication",robots:{index:false,follow:false}};
export default async function SchoolCommunicationsPage({params}){
 const {code}=await params;
 return <SchoolCommunications code={code}/>;
}
