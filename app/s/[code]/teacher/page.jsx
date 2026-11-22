import TeacherDashboard from "./TeacherDashboard.jsx";
export const metadata={title:"Teacher Classroom · School Portal",robots:{index:false,follow:false}};
export default async function Page({params}){const {code}=await params;return <TeacherDashboard code={code}/>;}