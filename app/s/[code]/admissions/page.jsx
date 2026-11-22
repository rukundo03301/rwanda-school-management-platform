import AdmissionsDashboard from "./AdmissionsDashboard.jsx";
export const metadata={title:"Admissions and Students · School Management",robots:{index:false,follow:false}};
export default async function AdmissionsPage({params}){
 const {code}=await params;
 return <AdmissionsDashboard code={code}/>;
}
