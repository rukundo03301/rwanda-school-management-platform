import LearningDashboard from "./LearningDashboard.jsx";
export const metadata={title:"My Learning · School Portal",robots:{index:false,follow:false}};
export default async function Page({params}){const {code}=await params;return <LearningDashboard code={code}/>;}