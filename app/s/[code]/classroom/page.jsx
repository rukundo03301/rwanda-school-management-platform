import ClassroomDashboard from "./ClassroomDashboard.jsx";
export const metadata={title:"Classrooms and Lessons · School Portal",robots:{index:false,follow:false}};
export default async function ClassroomPage({params}){
 const {code}=await params;
 return <ClassroomDashboard code={code}/>;
}
