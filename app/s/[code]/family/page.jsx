import FamilyDashboard from "./FamilyDashboard.jsx";
export const metadata={title:"My Family · School Portal",robots:{index:false,follow:false}};
export default async function FamilyPage({params}){
 const {code}=await params;
 return <FamilyDashboard code={code}/>;
}
